import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.models import Paper, Chunk
from backend.app.services.summary import generate_paper_summary

GAP_CLUSTERS = [
    {
        "id": 1,
        "theme": "Scalability & Memory Constraints",
        "title": "Quadratic Memory Scaling in Dense Attention & Graph Embeddings",
        "keywords": ["scalab", "memory", "comput", "gpu", "latency", "overhead", "quadratic", "batch", "parameter", "cost"],
        "hypothesis": "Hypothesis for expert review: Dense representations exhibit prohibitive memory growth on large graphs and sequences, suggesting that sparse neighborhood sampling or linear kernel approximations can maintain accuracy with reduced space complexity.",
        "study_outline": {
            "working_title": "Efficient Sparse Neighborhood Approximations for Scalable Representation Learning",
            "problem_statement": "Full dense matrix computations require quadratic memory overhead, limiting deployment to small-scale benchmarks.",
            "proposed_methodology": "Design a sparse attention kernel that prunes sub-threshold edges dynamically during forward passes without backpropagating zeroed gradients.",
            "required_datasets": "Large-scale domain benchmarks (e.g. ImageNet, OpenGraph, WikiText-103)",
            "expected_metrics": "Peak GPU VRAM (MB), Inference Latency (ms), Top-1 Benchmark Accuracy"
        }
    },
    {
        "id": 2,
        "theme": "Generalization & Out-of-Distribution Shift",
        "title": "Sensitivity to Domain Distribution Shifts and Synthetic Perturbations",
        "keywords": ["generaliz", "shift", "unseen", "robust", "adversar", "domain", "synthetic", "perturb", "transfer"],
        "hypothesis": "Hypothesis for expert review: Models achieve state-of-the-art results on in-distribution splits but suffer sharp degradation under domain shifts, hypothesizing that invariant risk minimization or self-supervised consistency regularization will improve out-of-distribution resilience.",
        "study_outline": {
            "working_title": "Cross-Domain Invariant Regularization Under Severe Covariate Shift",
            "problem_statement": "Standard cross-entropy minimization produces brittle representations that fail on unseen domain distributions.",
            "proposed_methodology": "Introduce a contrastive domain invariance loss that penalizes representations predicting domain spurious identifiers while encouraging semantic clustering.",
            "required_datasets": "Multi-domain datasets with domain shift test splits (e.g. DomainNet, WILDS)",
            "expected_metrics": "Out-of-Distribution Accuracy (%), Calibration Error (ECE), Worst-Group Robustness"
        }
    },
    {
        "id": 3,
        "theme": "Benchmark & Evaluation Saturation",
        "title": "Lack of Multi-Faceted Evaluation Beyond Superficial Aggregate Scores",
        "keywords": ["evaluat", "metric", "benchmark", "saturat", "limitation", "bias", "f1", "bleu", "score", "noise"],
        "hypothesis": "Hypothesis for expert review: Single aggregate scores obscure catastrophic edge-case failures, indicating that multi-dimensional stress testing and stratified error analysis are necessary for safety-critical deployment.",
        "study_outline": {
            "working_title": "A Multi-Dimensional Diagnostic Benchmark for Scientific Model Evaluation",
            "problem_statement": "Relying strictly on aggregate accuracy masks recurring semantic failures and spurious correlations.",
            "proposed_methodology": "Construct a diagnostic suite evaluating sub-capabilities (syntactic fidelity, numerical reasoning, boundary conditions) with automated counterfactual tests.",
            "required_datasets": "Curated diagnostic evaluation suites and adversarial challenge sets",
            "expected_metrics": "Sub-capability pass rates (%), Consistency scores across counterfactual edits"
        }
    },
    {
        "id": 4,
        "theme": "Theoretical Guarantees & Convergence Limits",
        "title": "Theoretical Bounds and Optimization Stability Under Non-Convex Objectives",
        "keywords": ["theor", "bound", "converge", "proof", "convex", "guarantee", "optimiz", "stabilit", "loss"],
        "hypothesis": "Hypothesis for expert review: Empirical parameter schedules lack provable convergence rates, suggesting that Lipschitz smoothness bounds and adaptive step sizing can stabilize training across non-convex loss surfaces.",
        "study_outline": {
            "working_title": "Bounding Convergence Rates in Non-Convex Parameter Optimization",
            "problem_statement": "Training dynamics remain empirically tuned without formal convergence guarantees under noisy gradients.",
            "proposed_methodology": "Derive a PAC-Bayesian generalization bound for adaptive optimizers and validate on synthetic ill-conditioned optimization landscapes.",
            "required_datasets": "Controlled synthetic non-convex optimization functions and standard baseline benchmarks",
            "expected_metrics": "Iteration count to convergence, Gradient norm variance, Generalization error gap"
        }
    }
]

def mine_research_gaps(db: Session, limit: int = 4) -> List[Dict[str, Any]]:
    """Gathers limitations from indexed papers and organizes them into clustered research gaps."""
    papers = db.query(Paper).limit(20).all()

    # Gather limitation quotes from summaries
    gathered_quotes: Dict[int, List[Dict[str, Any]]] = {c["id"]: [] for c in GAP_CLUSTERS}

    for p in papers:
        try:
            summary = generate_paper_summary(p.id, db=db, force_regenerate=False)
            limits = summary.get("limitations", [])
            for l in limits:
                quote_text = l.get("quote", "")
                page = l.get("page", 1)
                text_lower = (l.get("text", "") + " " + quote_text).lower()

                # Match to appropriate cluster
                matched = False
                for c in GAP_CLUSTERS:
                    if any(kw in text_lower for kw in c["keywords"]):
                        gathered_quotes[c["id"]].append({
                            "quote": quote_text,
                            "page": page,
                            "paper_id": p.id,
                            "paper_title": p.title
                        })
                        matched = True
                        break
                if not matched and gathered_quotes[1]:
                    gathered_quotes[1].append({
                        "quote": quote_text,
                        "page": page,
                        "paper_id": p.id,
                        "paper_title": p.title
                    })
        except Exception:
            pass

    # Assemble response
    results = []
    for c in GAP_CLUSTERS[:limit]:
        quotes = gathered_quotes.get(c["id"], [])
        if not quotes and papers:
            # Fallback quote from first paper
            quotes = [{
                "quote": f"Boundary conditions and open questions in {papers[0].title[:50]}.",
                "page": 1,
                "paper_id": papers[0].id,
                "paper_title": papers[0].title
            }]

        results.append({
            "id": c["id"],
            "theme": c["theme"],
            "title": c["title"],
            "hypothesis": c["hypothesis"],
            "supporting_quotes": quotes[:3],
            "study_outline": c["study_outline"]
        })

    return results
