import sys
import argparse
from pathlib import Path
from typing import List

# Add root directory to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.services.rag import generate_rag_stream

DEFAULT_TEST_QUESTIONS = [
    "What are the results of the Defensive Booster algorithm under Brier score loss?",
    "How does the time-dependent traveling salesman problem handle time windows?",
    "What is the threshold algorithm in scalable triangle counting?",
    "What is the coloring approach in paged geophylogenies?",
    "How does the post-processing approach enforce fairness in tie-aware rankings?"
]

def run_chat_query(question: str):
    print("\n" + "=" * 75)
    print(f"QUESTION: {question}")
    print("=" * 75)

    full_answer = ""
    citations = []

    for event in generate_rag_stream(query=question, scope="library"):
        if event.startswith("data: "):
            try:
                import json
                data = json.loads(event[6:].strip())
                if data.get("done"):
                    citations = data.get("citations", [])
                    full_answer = data.get("full_answer", "")
            except Exception:
                pass

    clean_ans = full_answer.encode("ascii", "replace").decode("ascii")
    print(f"\n{clean_ans}\n")

    if citations:
        print("-" * 75)
        print("VERIFIED CITATIONS (PAGE-LEVEL GROUNDING):")
        for c in citations:
            c_title = c['title'].encode("ascii", "replace").decode("ascii")
            c_quote = c['quote'].encode("ascii", "replace").decode("ascii")
            print(f"  [{c['n']}] {c_title} -- Page {c['page']}")
            print(f"      Quote: \"{c_quote}\"")
    print("=" * 75 + "\n")

def main():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="CLI Chat with Cited RAG")
    parser.add_argument("--auto", action="store_true", help="Run 5 automated test questions")
    parser.add_argument("question", type=str, nargs="?", default=None, help="Optional single question")
    args = parser.parse_args()

    if args.auto or not args.question:
        print("\n[CLI Chat] Running 5 automated test questions against the indexed corpus...\n")
        for q in DEFAULT_TEST_QUESTIONS:
            run_chat_query(q)
    else:
        run_chat_query(args.question)

if __name__ == "__main__":
    main()
