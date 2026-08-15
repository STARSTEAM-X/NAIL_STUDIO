import hashlib
import math
from collections.abc import Sequence


class EmbeddingProvider:
    """Lazy sentence-transformers provider with a deterministic fallback.

    The fallback is intentionally small and deterministic for tests and local
    development without a model download. Production loads the configured
    multilingual model once during application startup.
    """

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self._model = None

    def load(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
        except (ImportError, OSError, RuntimeError):
            self._model = None

    def encode(self, text: str) -> list[float]:
        if self._model is not None:
            vector = self._model.encode(text, normalize_embeddings=True)
            return [float(value) for value in vector]
        return _fallback_embedding(text)


def _fallback_embedding(text: str, dimensions: int = 96) -> list[float]:
    values = [0.0] * dimensions
    normalized = " ".join(text.lower().split())
    units = list(normalized) if any("\u0e00" <= char <= "\u0e7f" for char in normalized) else normalized.split()
    for index, unit in enumerate(units):
        digest = hashlib.blake2b(unit.encode("utf-8"), digest_size=8).digest()
        bucket = int.from_bytes(digest, "big") % dimensions
        values[bucket] += 1.0 + (index % 3) * 0.1
    magnitude = math.sqrt(sum(value * value for value in values))
    return [value / magnitude for value in values] if magnitude else values


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))
