from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from backend.app.services.extraction import ExtractionRecord

def normalize_key(val: Optional[str]) -> str:
    if not val:
        return ""
    # Strip whitespace and lowercase
    cleaned = re_normalize(val)
    return cleaned

def re_normalize(val: str) -> str:
    import re
    return re.sub(r"[_\-\s]+", " ", val).strip().lower()

def check_conditions_conflict(c1: Any, c2: Any) -> Optional[str]:
    """Checks if conditions conflict between two records."""
    if c1.shots is not None and c2.shots is not None and c1.shots != c2.shots:
        return f"Different prompt shots: {c1.shots}-shot vs {c2.shots}-shot"
    if c1.hardware and c2.hardware and normalize_key(c1.hardware) != normalize_key(c2.hardware):
        return f"Different hardware setup: {c1.hardware} vs {c2.hardware}"
    if c1.model_size and c2.model_size and normalize_key(c1.model_size) != normalize_key(c2.model_size):
        return f"Different model scale: {c1.model_size} vs {c2.model_size}"
    return None

def evaluate_comparability(records: List[ExtractionRecord]) -> Dict[str, Any]:
    """
    Groups records by (task, dataset, metric, unit).
    Determines which metrics are directly comparable vs not directly comparable,
    with explicit rule-based reasons.
    """
    # Group by (task, dataset, metric, unit)
    groups: Dict[Tuple[str, str, str, str], List[ExtractionRecord]] = defaultdict(list)

    for r in records:
        task_k = normalize_key(r.task)
        data_k = normalize_key(r.dataset)
        metric_k = normalize_key(r.metric)
        unit_k = normalize_key(r.unit)
        groups[(task_k, data_k, metric_k, unit_k)].append(r)

    comparable_groups = []
    not_comparable_groups = []

    for (task_k, data_k, metric_k, unit_k), group_records in groups.items():
        # Check if group has entries from multiple distinct papers
        paper_ids = {r.paper_id for r in group_records}

        if len(paper_ids) >= 2:
            # Check for condition conflicts between any pair
            conflict_reason = None
            for i in range(len(group_records)):
                for j in range(i + 1, len(group_records)):
                    if group_records[i].paper_id != group_records[j].paper_id:
                        conflict = check_conditions_conflict(
                            group_records[i].conditions, group_records[j].conditions
                        )
                        if conflict:
                            conflict_reason = conflict
                            break
                if conflict_reason:
                    break

            if not conflict_reason:
                comparable_groups.append({
                    "task": group_records[0].task or "General Evaluation",
                    "dataset": group_records[0].dataset or "Standard Benchmark",
                    "metric": group_records[0].metric or "Performance",
                    "unit": group_records[0].unit or "",
                    "is_comparable": True,
                    "records": [r.model_dump() for r in group_records]
                })
            else:
                not_comparable_groups.append({
                    "task": group_records[0].task or "General Evaluation",
                    "dataset": group_records[0].dataset or "Standard Benchmark",
                    "metric": group_records[0].metric or "Performance",
                    "unit": group_records[0].unit or "",
                    "is_comparable": False,
                    "reason": conflict_reason,
                    "records": [r.model_dump() for r in group_records]
                })
        else:
            # Singleton metric (only 1 paper evaluated this specific combination)
            sample_r = group_records[0]
            not_comparable_groups.append({
                "task": sample_r.task or "General Evaluation",
                "dataset": sample_r.dataset or "Domain Benchmark",
                "metric": sample_r.metric or "Evaluation Metric",
                "unit": sample_r.unit or "",
                "is_comparable": False,
                "reason": f"Only evaluated by {sample_r.paper_title[:40]}... (benchmark not reported in other selected papers)",
                "records": [r.model_dump() for r in group_records]
            })

    return {
        "comparable_groups": comparable_groups,
        "not_comparable_groups": not_comparable_groups
    }

def build_aspect_matrix(papers: List[Any], paper_extractions_map: Dict[int, List[ExtractionRecord]], summary_map: Dict[int, Any]) -> List[Dict[str, Any]]:
    """Builds side-by-side aspect comparison rows across selected papers."""
    aspects = [
        "Methodology / Approach",
        "Benchmark Datasets",
        "Primary Task",
        "Key Quantitative Results",
        "Limitations & Boundary Conditions"
    ]

    matrix_rows = []

    for aspect in aspects:
        row = {"aspect": aspect, "cells": {}}
        for p in papers:
            p_id = p.id
            exts = paper_extractions_map.get(p_id, [])
            summ = summary_map.get(p_id, {})

            if aspect == "Methodology / Approach":
                methods = summ.get("methodology", [])
                val = methods[0]["text"] if methods else (exts[0].method if exts else "Methodology details in paper.")
                quote = methods[0]["quote"] if methods else (exts[0].source.quote if exts else "")
                page = methods[0]["page"] if methods else (exts[0].source.page if exts else 1)
            elif aspect == "Benchmark Datasets":
                datasets = summ.get("datasets", [])
                val = ", ".join(d["name"] for d in datasets) if datasets else (exts[0].dataset if exts else "Domain Datasets")
                quote = datasets[0]["quote"] if datasets else (exts[0].source.quote if exts else "")
                page = datasets[0]["page"] if datasets else (exts[0].source.page if exts else 1)
            elif aspect == "Primary Task":
                tasks = list({e.task for e in exts if e.task})
                val = ", ".join(tasks[:2]) if tasks else "Research & Benchmark Evaluation"
                quote = exts[0].source.quote if exts else ""
                page = exts[0].source.page if exts else 1
            elif aspect == "Key Quantitative Results":
                results = summ.get("results", [])
                if results:
                    val = f"{results[0]['metric']}: {results[0]['value']}"
                    quote = results[0]["quote"]
                    page = results[0]["page"]
                elif exts and exts[0].value != "N/A":
                    val = f"{exts[0].metric}: {exts[0].value} {exts[0].unit or ''}"
                    quote = exts[0].source.quote
                    page = exts[0].source.page
                else:
                    val = "Experimental validation reported"
                    quote = exts[0].source.quote if exts else ""
                    page = exts[0].source.page if exts else 1
            else:  # Limitations
                limits = summ.get("limitations", [])
                val = limits[0]["text"] if limits else "Future research directions in paper."
                quote = limits[0]["quote"] if limits else ""
                page = limits[0]["page"] if limits else 1

            row["cells"][str(p_id)] = {
                "paper_title": p.title,
                "value": val,
                "quote": quote,
                "page": page
            }
        matrix_rows.append(row)

    return matrix_rows
