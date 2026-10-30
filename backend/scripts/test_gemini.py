import os
import json
import requests

API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-2.5-flash"

def test_generate():
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"
    payload = {
        "systemInstruction": {"parts": [{"text": "You are ResearchMate AI. Be concise."}]},
        "contents": [{"role": "user", "parts": [{"text": "Explain defensive boosting in one sentence."}]}],
    }
    res = requests.post(url, json=payload, timeout=15)
    print("Generate Status:", res.status_code)
    data = res.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    print("Response text:", text)

def test_stream():
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:streamGenerateContent?alt=sse&key={API_KEY}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": "Count from 1 to 5 separated by commas."}]}],
    }
    res = requests.post(url, json=payload, stream=True, timeout=15)
    print("Stream Status:", res.status_code)
    tokens = []
    for line in res.iter_lines():
        if not line:
            continue
        line_str = line.decode("utf-8")
        if line_str.startswith("data: "):
            chunk_data = json.loads(line_str[6:])
            candidates = chunk_data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                for p in parts:
                    if "text" in p:
                        tokens.append(p["text"])
    print("Streamed tokens:", "".join(tokens))

if __name__ == "__main__":
    test_generate()
    test_stream()
