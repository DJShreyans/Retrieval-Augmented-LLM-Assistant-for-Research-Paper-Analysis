import sys
import time
from pathlib import Path
from typing import List, Tuple
import numpy as np
from tqdm import tqdm

# Add root directory to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.config import yaml_config
from backend.app.db import SessionLocal
from backend.app.models import Chunk
from backend.app.corpus_db import get_corpus_connection
from backend.app.services.embeddings import embed_passages
from backend.app.services.index import add_to_index, get_faiss_index

def build_vector_index(batch_size: int = 64):
    corpus_conn = get_corpus_connection()
    app_db = SessionLocal()

    try:
        cur = corpus_conn.cursor()
        # Find chunks that haven't been indexed into FAISS yet
        cur.execute("""
        SELECT id, text FROM corpus_chunks
        WHERE faiss_id IS NULL AND is_reference = 0
        ORDER BY id ASC
        """)
        unindexed = cur.fetchall()
        total_unindexed = len(unindexed)

        faiss_index = get_faiss_index()
        current_faiss_total = faiss_index.ntotal

        print(f"\n[Index Build] Existing vectors in FAISS: {current_faiss_total}")
        print(f"[Index Build] Chunks pending embedding: {total_unindexed}")

        if total_unindexed == 0:
            print("[Index Build] All eligible chunks are already indexed!")
            return

        # Timing tracking for first 1,000 chunks
        start_time = time.time()
        chunks_processed = 0
        timed_eta_printed = False

        batches = [unindexed[i:i + batch_size] for i in range(0, total_unindexed, batch_size)]

        with tqdm(total=total_unindexed, desc="Building FAISS Index") as pbar:
            for batch in batches:
                chunk_ids = [row[0] for row in batch]
                chunk_texts = [row[1] for row in batch]

                vectors = embed_passages(chunk_texts, batch_size=batch_size)
                start_faiss_id = add_to_index(vectors)

                # Update faiss_id in corpus_chunks
                update_tuples = [(start_faiss_id + idx, cid) for idx, cid in enumerate(chunk_ids)]
                cur.executemany("""
                UPDATE corpus_chunks SET faiss_id = ? WHERE id = ?
                """, update_tuples)
                corpus_conn.commit()

                # Also update in app_db for consistency
                for f_id, c_id in update_tuples:
                    app_db.query(Chunk).filter(Chunk.id == c_id).update({"faiss_id": f_id})
                app_db.commit()

                chunks_processed += len(batch)
                pbar.update(len(batch))

                # Check if we passed 1,000 chunks to compute and print ETA
                if not timed_eta_printed and (chunks_processed >= 1000 or chunks_processed == total_unindexed):
                    elapsed = time.time() - start_time
                    rate = chunks_processed / max(elapsed, 0.001)
                    rem_chunks = total_unindexed - chunks_processed
                    rem_sec = rem_chunks / rate if rate > 0 else 0
                    print(f"\n[Index Build Benchmark] Processed first {chunks_processed} chunks in {elapsed:.1f}s ({rate:.1f} chunks/sec).")
                    if rem_chunks > 0:
                        print(f"[Index Build Benchmark] Estimated Time Remaining: {rem_sec/60:.1f} minutes ({rem_chunks} chunks).")
                    timed_eta_printed = True

        print(f"\n[Index Build] Completed! FAISS total vectors: {get_faiss_index().ntotal}")

    finally:
        corpus_conn.close()
        app_db.close()

if __name__ == "__main__":
    bs = yaml_config.get("embedding", {}).get("batch_size", 64)
    build_vector_index(batch_size=bs)
