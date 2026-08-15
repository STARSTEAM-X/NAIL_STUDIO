import json
from collections.abc import AsyncIterator

import httpx


class OllamaUnavailable(RuntimeError):
    """The optional model server is unavailable or returned an invalid result."""


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout_seconds: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = httpx.Timeout(timeout_seconds, connect=min(10.0, timeout_seconds))

    async def stream_generate(self, prompt: str) -> AsyncIterator[str]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json={"model": self.model, "prompt": prompt, "stream": True},
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            payload = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        token = payload.get("response")
                        if isinstance(token, str) and token:
                            yield token
        except (httpx.HTTPError, OSError) as error:
            raise OllamaUnavailable(str(error)) from error

    async def generate_json(self, prompt: str) -> str:
        chunks: list[str] = []
        async for chunk in self.stream_generate(prompt):
            chunks.append(chunk)
        if not chunks:
            raise OllamaUnavailable("Ollama returned an empty response")
        return "".join(chunks)
