# ResearchMate System Limitations

This document provides a frank, transparent overview of the technical and algorithmic boundaries of ResearchMate in its current architecture.

---

## 1. Document Extraction & OCR Boundaries

### Scanned PDFs and Non-Digital Documents
- **Behavior**: ResearchMate uses PyMuPDF (`fitz`) for fast, local layout-aware extraction of two-column academic PDFs. It analyzes character bounding boxes and word streams.
- **Limitation**: Scanned documents or image-only PDFs lacking embedded text streams cannot be parsed without OCR. ResearchMate detects these files, marks them as `has_text = False` and `text_quality = "scanned_or_empty"`, and preserves them in the library with their generated first-page thumbnails while gracefully excluding them from vector and full-text indexes.
- **Mitigation**: To index scanned manuscripts, an upstream OCR layer (such as Tesseract or Surya OCR) must be incorporated prior to ingestion.

### Complex Multi-Column Tables and LaTeX Math
- **Behavior**: Two-column layout sorting groups text blocks by vertical and horizontal columns.
- **Limitation**: Academic tables spanning both columns or papers featuring complex inline LaTeX math syntax may have table cells linearized into sentence fragments. While semantic chunks retain the numerical values and units, nested sub-tables can lose spatial row-column relationships.

---

## 2. No-LLM (Extractive) Mode vs Generative Synthesis

- **Behavior**: When `LLM_PROVIDER=none`, ResearchMate operates entirely without external API keys or heavy generative models. It outputs ranked evidence cards with verbatim document quotes and page numbers.
- **Trade-off**: 
  - **Advantage**: Zero hallucination risk, zero operating cost, complete privacy, and instant sub-50ms latency.
  - **Limitation**: The system cannot perform creative rephrasing, inductive reasoning across disparate hypotheses, or stylistic prose formatting. Higher-level synthesis features (e.g., Literature Review thematic generation) display structured extractive passages rather than fluid multi-page prose.

---

## 3. Metric Comparability Edge Cases

- **Strict Conservatism**: ResearchMate enforces a strict zero-hallucination comparability rule: two papers are only marked as directly comparable when `(task, dataset, metric, unit)` match and all known conditions do not conflict.
- **Unreported Hyperparameters**: In empirical research papers, researchers frequently omit critical conditioning parameters (e.g., precise prompt templates, random seeds, batch size, or exact compute hardware). In such cases, ResearchMate reports the known conditions and attaches an "Incomplete Condition Context" notice, leaving the final scientific judgment to the researcher.
- **Unit Normalization**: The system strictly avoids converting units (e.g. converting "0.85" to "85%") unless the paper explicitly writes it in both forms, avoiding potential scale errors.

---

## 4. Single-Node In-Memory Vector Boundaries

- **Index Architecture**: The current architecture uses FAISS `IndexFlatIP` storing 384-dimensional dense vectors in process memory.
- **Memory Footprint**:
  - 100 papers (~3,700 chunks): **~5.7 MB** RAM.
  - 4,393 papers (~175,000 chunks): **~268 MB** RAM.
  - 50,000 papers (~2,000,000 chunks): **~3.07 GB** RAM.
- **Limitation**: While ideal for local laptops and single VPS instances up to ~50,000 papers, scaling beyond 100,000 papers on a low-RAM host requires switching from brute-force `IndexFlatIP` to an inverted file index with product quantization (`IndexIVFPQ`) or an external vector database (e.g., Qdrant or Milvus).

---

## 5. CPU Ingestion Throughput

- **Measured Rate**: On modern 4-core CPUs, `BAAI/bge-small-en-v1.5` embeds text passages at **~1.88 chunks/sec** (~8.8 minutes per 1,000 chunks).
- **GPU Acceleration**: With NVIDIA CUDA enabled (e.g. GTX 1650 Ti with fp16), throughput scales to **~32 chunks/sec** (~31 seconds per 1,000 chunks).
- **Limitation**: Ingesting corpora of over 10,000 papers in a strictly CPU-only deployment requires overnight batch processing or parallelized multi-core worker processes.
