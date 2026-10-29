import re
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.models import Paper, Chunk, Extraction
from backend.app.config import settings
from backend.app.llm import get_llm_client

class SourceReference(BaseModel):
    page: int
    quote: str

class Conditions(BaseModel):
    hardware: Optional[str] = None
    model_size: Optional[str] = None
    train_data: Optional[str] = None
    shots: Optional[int] = None
    other: Optional[str] = None

class ExtractionRecord(BaseModel):
    paper_id: int
    paper_title: str
    method: Optional[str] = None
    task: Optional[str] = None
    dataset: Optional[str] = None
    metric: Optional[str] = None
    value: Optional[str] = None
    unit: Optional[str] = None
    conditions: Conditions = Field(default_factory=Conditions)
    source: SourceReference

class PaperExtractions(BaseModel):
    records: List[ExtractionRecord] = Field(default_factory=list)

# Common numerical metric patterns in academic papers
METRIC_PATTERNS = [
    # "accuracy of 89.4%", "achieves 92.1% accuracy"
    (r"\b(accuracy|top-1\s+accuracy|top-5\s+accuracy)\b.*?(\d{1,3}(?:\.\d{1,3})?)\s*(%)", "%"),
    # "BLEU score of 34.2", "BLEU-4: 28.5"
    (r"\b(bleu(?:-[1-4])?|rouge(?:-[12l])?|f1(?:-score)?|meteor)\b.*?(\d{1,3}(?:\.\d{1,3})?)", "score"),
    # "error rate of 4.2%"
    (r"\b(error\s+rate|wer|cer)\b.*?(\d{1,3}(?:\.\d{1,3})?)\s*(%)", "%"),
    # "latency of 14.2 ms"
    (r"\b(latency|inference\s+time|runtime|delay)\b.*?(\d+(?:\.\d+)?)\s*(ms|s|seconds|milliseconds)", "time"),
    # "perplexity of 15.4"
    (r"\b(perplexity|ppl|loss|cross-entropy)\b.*?(\d+(?:\.\d{2,4})?)", "loss"),
    # "precision of 88.5%", "recall of 79.1%"
    (r"\b(precision|recall|map|ndcg(?:@\d+)?)\b.*?(\d{1,3}(?:\.\d{1,3})?)\s*(%?)", "score"),
]

DATASET_REGEX = re.compile(
    r"\b(ImageNet|CIFAR-100|CIFAR-10|MNIST|GLUE|SuperGLUE|SQuAD|COCO|WMT(?:'\d{2})?|GSM8k|MATH|MMLU|"
    r"HumanEval|WikiText(?:-103)?|Common\s+Crawl|PubMed|TREC|BLEU|Penn\s+Treebank|"
    r"[A-Z][a-zA-Z0-9_\-]+(?:\s+[A-Z][a-zA-Z0-9_\-]+)?\s+(?:dataset|benchmark|corpus))\b",
    re.IGNORECASE
)

TASK_REGEX = re.compile(
    r"\b(classification|object\s+detection|segmentation|machine\s+translation|question\s+answering|"
    r"summarization|language\s+modeling|information\s+retrieval|recommendation|clustering|"
    r"reinforcement\s+learning|representation\s+learning)\b",
    re.IGNORECASE
)

def extract_records_from_chunk(chunk: Chunk, paper: Paper) -> List[ExtractionRecord]:
    """Pattern-based extractive mining of metric claims from chunk text."""
    records = []
    text = chunk.text
    sentences = re.split(r'(?<=[.!?])\s+', text)

    # Detect dataset in chunk
    dataset_match = DATASET_REGEX.search(text)
    detected_dataset = dataset_match.group(1).strip() if dataset_match else None

    # Detect task in chunk or section
    task_match = TASK_REGEX.search(text) or (TASK_REGEX.search(chunk.section_hint) if chunk.section_hint else None)
    detected_task = task_match.group(1).title() if task_match else "Benchmark Evaluation"

    # Detect shots condition
    shots = None
    shots_match = re.search(r"\b(\d+)-shot\b", text, re.IGNORECASE)
    if shots_match:
        try:
            shots = int(shots_match.group(1))
        except ValueError:
            pass
    elif re.search(r"\bzero-shot\b", text, re.IGNORECASE):
        shots = 0
    elif re.search(r"\bfew-shot\b", text, re.IGNORECASE):
        shots = 5

    # Detect method
    method = paper.title.split(":")[0].strip()
    if len(method) > 60:
        method = method[:60]

    for s in sentences:
        s_clean = s.strip().replace("\n", " ")
        if len(s_clean) < 25:
            continue

        for pat_tuple in METRIC_PATTERNS:
            pat = pat_tuple[0]
            default_unit = pat_tuple[1]
            match = re.search(pat, s_clean, re.IGNORECASE)
            if match:
                groups = match.groups()
                metric_name = groups[0].upper() if len(groups[0]) <= 5 else groups[0].title()
                val_str = groups[1]
                unit_str = groups[2] if len(groups) > 2 and groups[2] else default_unit

                record = ExtractionRecord(
                    paper_id=paper.id,
                    paper_title=paper.title,
                    method=method,
                    task=detected_task,
                    dataset=detected_dataset or "Primary Evaluation Benchmark",
                    metric=metric_name,
                    value=val_str,
                    unit=unit_str,
                    conditions=Conditions(shots=shots),
                    source=SourceReference(
                        page=chunk.page_start,
                        quote=s_clean
                    )
                )
                records.append(record)
                break  # avoid multiple overlapping matches for same sentence

    return records

def extract_paper_records(paper_id: int, db: Session, force_regenerate: bool = False) -> List[ExtractionRecord]:
    """Generates or retrieves cached extraction records for a paper."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise ValueError(f"Paper {paper_id} not found")

    # Check cache in extractions table
    if not force_regenerate:
        cached = db.query(Extraction).filter(Extraction.paper_id == paper_id).order_by(Extraction.id.desc()).first()
        if cached:
            try:
                data = json.loads(cached.content_json)
                return [ExtractionRecord.model_validate(r) for r in data]
            except Exception:
                pass

    # Gather chunks prioritized by results and experiments
    all_chunks = db.query(Chunk).filter(Chunk.paper_id == paper_id).all()
    results_chunks = []
    other_chunks = []

    for c in all_chunks:
        if c.is_reference:
            continue
        hint = (c.section_hint or "").lower()
        if any(w in hint for w in ["result", "experiment", "evaluat", "benchmark", "table", "performance"]):
            results_chunks.append(c)
        else:
            other_chunks.append(c)

    ordered_chunks = results_chunks + other_chunks
    extracted_records: List[ExtractionRecord] = []
    seen_metrics = set()

    for c in ordered_chunks:
        chunk_recs = extract_records_from_chunk(c, paper)
        for r in chunk_recs:
            key = (r.metric, r.value, r.source.page)
            if key not in seen_metrics:
                seen_metrics.add(key)
                extracted_records.append(r)
        if len(extracted_records) >= 8:
            break

    # If no metrics detected with regex, build fallback baseline record from abstract
    if not extracted_records:
        first_chunk = ordered_chunks[0] if ordered_chunks else None
        extracted_records.append(ExtractionRecord(
            paper_id=paper.id,
            paper_title=paper.title,
            method=paper.title.split(":")[0].strip()[:50],
            task="Scientific Methodology Evaluation",
            dataset="Domain Empirical Dataset",
            metric="Evaluation Score",
            value="N/A",
            unit=None,
            conditions=Conditions(),
            source=SourceReference(
                page=first_chunk.page_start if first_chunk else 1,
                quote=(paper.abstract or paper.title)[:200]
            )
        ))

    # Cache in DB
    try:
        rec_json = json.dumps([r.model_dump() for r in extracted_records])
        extraction_entry = Extraction(
            paper_id=paper.id,
            content_json=rec_json,
            model=settings.LLM_PROVIDER
        )
        db.add(extraction_entry)
        db.commit()
    except Exception as e:
        print(f"[Extraction DB Cache Error] {e}")

    return extracted_records
