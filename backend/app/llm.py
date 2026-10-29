import json
import time
from typing import List, Dict, Any, Optional, Generator, Type
from pydantic import BaseModel
from backend.app.config import settings
from backend.app.db import SessionLocal
from backend.app.models import LLMCall

def log_llm_call(purpose: str, model: str, prompt_tokens: int, completion_tokens: int, latency_ms: int, user_id: Optional[int] = None):
    try:
        db = SessionLocal()
        call = LLMCall(
            user_id=user_id,
            purpose=purpose,
            model=model or settings.LLM_PROVIDER,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=latency_ms
        )
        db.add(call)
        db.commit()
        db.close()
    except Exception as e:
        print(f"[LLM Log Error] {e}")

class LLMService:
    def __init__(self):
        self.provider = (settings.LLM_PROVIDER or "none").lower()
        self.model = settings.LLM_MODEL or "default"
        self.api_key = settings.LLM_API_KEY
        self.base_url = settings.LLM_BASE_URL

    def complete(self, messages: List[Dict[str, str]], system: Optional[str] = None, user_id: Optional[int] = None) -> str:
        start_time = time.time()
        provider = self.provider

        if provider == "none":
            return "Extractive mode: No LLM provider is connected. Evidence passages are provided below."

        prompt_text = " ".join(m.get("content", "") for m in messages)
        prompt_tokens = len(prompt_text.split())

        output_text = ""
        if provider in ("openai", "openai_compatible"):
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key or "sk-dummy", base_url=self.base_url)
            full_messages = []
            if system:
                full_messages.append({"role": "system", "content": system})
            full_messages.extend(messages)
            res = client.chat.completions.create(model=self.model, messages=full_messages)
            output_text = res.choices[0].message.content or ""
            completion_tokens = res.usage.completion_tokens if res.usage else len(output_text.split())
        elif provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model or "gemini-1.5-flash", system_instruction=system)
            prompt = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
            res = model.generate_content(prompt)
            output_text = res.text
            completion_tokens = len(output_text.split())
        elif provider == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            res = client.messages.create(
                model=self.model or "claude-3-5-sonnet-20241022",
                system=system or "",
                messages=messages,
                max_tokens=2048
            )
            output_text = res.content[0].text
            completion_tokens = res.usage.output_tokens
        else:
            output_text = f"Unsupported LLM provider: {provider}"
            completion_tokens = 0

        latency_ms = int((time.time() - start_time) * 1000)
        log_llm_call("complete", self.model, prompt_tokens, completion_tokens, latency_ms, user_id)
        return output_text

    def stream(self, messages: List[Dict[str, str]], system: Optional[str] = None, user_id: Optional[int] = None) -> Generator[str, None, None]:
        start_time = time.time()
        provider = self.provider

        if provider == "none":
            # Extractive streaming
            text = "Top evidence (no LLM connected):\n\n"
            for word in text.split(" "):
                yield word + " "
                time.sleep(0.01)
            return

        if provider in ("openai", "openai_compatible"):
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key or "sk-dummy", base_url=self.base_url)
            full_messages = []
            if system:
                full_messages.append({"role": "system", "content": system})
            full_messages.extend(messages)
            response = client.chat.completions.create(model=self.model, messages=full_messages, stream=True)
            total_tokens = 0
            for chunk in response:
                delta = chunk.choices[0].delta.content if chunk.choices else ""
                if delta:
                    total_tokens += 1
                    yield delta
            latency_ms = int((time.time() - start_time) * 1000)
            log_llm_call("stream", self.model, len(messages), total_tokens, latency_ms, user_id)
        else:
            # Fallback to complete
            full_res = self.complete(messages, system=system, user_id=user_id)
            for word in full_res.split(" "):
                yield word + " "
                time.sleep(0.01)

    def structured(
        self,
        messages: List[Dict[str, str]],
        schema: Type[BaseModel],
        system: Optional[str] = None,
        user_id: Optional[int] = None,
        retries: int = 2
    ) -> BaseModel:
        sys_prompt = (system or "") + f"\nOutput ONLY valid JSON adhering strictly to the schema: {schema.model_json_schema()}"
        last_err = None

        for attempt in range(retries + 1):
            try:
                raw_json = self.complete(messages, system=sys_prompt, user_id=user_id)
                # Strip markdown code blocks if any
                cleaned = raw_json.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                parsed_data = json.loads(cleaned.strip())
                return schema.model_validate(parsed_data)
            except Exception as e:
                last_err = e
                time.sleep(0.5)

        raise RuntimeError(f"Failed to generate valid structured response after {retries+1} attempts: {last_err}")

llm_service = LLMService()
