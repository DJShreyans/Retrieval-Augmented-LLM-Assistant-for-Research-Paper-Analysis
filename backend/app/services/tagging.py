from typing import List, Dict, Any
import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from backend.app.config import settings, yaml_config
from backend.app.db import SessionLocal
from backend.app.models import Paper, Tag, PaperTag
from backend.app.services.embeddings import embed_passages

def generate_cluster_tags(n_clusters: int = 15):
    """
    Cluster paper abstracts using KMeans and label each cluster.
    When LLM_PROVIDER=none, uses top TF-IDF unigrams/bigrams for extractive naming.
    """
    db = SessionLocal()
    try:
        papers = db.query(Paper).filter(Paper.has_text == True).all()
        if len(papers) < n_clusters:
            n_clusters = max(2, len(papers) // 2) if len(papers) >= 4 else 1

        if not papers:
            print("[Tagging] No eligible papers found for clustering.")
            return

        abstracts = [p.abstract if (p.abstract and len(p.abstract) > 40) else p.title for p in papers]

        print(f"[Tagging] Embedding {len(abstracts)} abstracts for KMeans (k={n_clusters})...")
        emb_matrix = embed_passages(abstracts, batch_size=64)

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
        labels = kmeans.fit_predict(emb_matrix)

        # Name clusters using TF-IDF
        cluster_texts = [[] for _ in range(n_clusters)]
        for idx, lbl in enumerate(labels):
            cluster_texts[lbl].append(abstracts[idx])

        tfidf = TfidfVectorizer(max_df=0.85, min_df=1, stop_words="english", ngram_range=(1, 2))
        cluster_names = []

        for c_idx in range(n_clusters):
            texts = cluster_texts[c_idx]
            if not texts:
                cluster_names.append(f"Topic {c_idx + 1}")
                continue
            try:
                tfidf_mat = tfidf.fit_transform(texts)
                scores = np.asarray(tfidf_mat.sum(axis=0)).ravel()
                terms = tfidf.get_feature_names_out()
                top_indices = scores.argsort()[::-1][:2]
                label = " / ".join(terms[i].title() for i in top_indices if i < len(terms))
                cluster_names.append(label if label else f"Topic {c_idx + 1}")
            except Exception:
                cluster_names.append(f"Topic {c_idx + 1}")

        # Save tags and link to papers
        tag_cache = {}
        for c_name in cluster_names:
            tag = db.query(Tag).filter(Tag.name == c_name).first()
            if not tag:
                tag = Tag(name=c_name)
                db.add(tag)
                db.flush()
            tag_cache[c_name] = tag.id

        for paper, lbl in zip(papers, labels):
            tag_name = cluster_names[lbl]
            tag_id = tag_cache[tag_name]
            existing_link = db.query(PaperTag).filter(
                PaperTag.paper_id == paper.id,
                PaperTag.tag_id == tag_id
            ).first()
            if not existing_link:
                db.add(PaperTag(paper_id=paper.id, tag_id=tag_id))

        db.commit()
        print(f"[Tagging] Assigned {n_clusters} topic tags across {len(papers)} papers.")
    finally:
        db.close()
