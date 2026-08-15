from dataclasses import dataclass

from .embedding import EmbeddingProvider, cosine_similarity
from .lexical import lexical_score, rank_lexical
from .rrf import reciprocal_rank_fusion, sort_fused


@dataclass(frozen=True)
class KnowledgeEntry:
    id: str
    question: str
    answer: str
    embedding: list[float] | None = None
    is_active: bool = True

    @property
    def text(self) -> str:
        return f"{self.question}\n{self.answer}"


@dataclass(frozen=True)
class RetrievedEntry:
    entry: KnowledgeEntry
    score: float


class RetrievalEngine:
    def __init__(self, embeddings: EmbeddingProvider, entries: list[KnowledgeEntry] | None = None) -> None:
        self.embeddings = embeddings
        self.entries = entries or []

    def search(self, query: str, top_k: int = 5) -> list[RetrievedEntry]:
        active_entries = [entry for entry in self.entries if entry.is_active]
        if not active_entries:
            return []

        query_vector = self.embeddings.encode(query)
        vector_scores = {
            entry.id: cosine_similarity(query_vector, entry.embedding or self.embeddings.encode(entry.text))
            for entry in active_entries
        }
        vector_ranking = [entry_id for entry_id, _ in sorted(vector_scores.items(), key=lambda item: (-item[1], item[0]))]
        lexical_ranking = [entry_id for entry_id, _ in rank_lexical(query, [(entry.id, entry.text) for entry in active_entries])]
        fused = reciprocal_rank_fusion((vector_ranking, lexical_ranking))
        ordered = sort_fused(fused)[:top_k]

        # Normalize RRF into the public 0..1 range without a relevance cut-off.
        maximum = ordered[0][1] if ordered else 1.0
        by_id = {entry.id: entry for entry in active_entries}
        return [RetrievedEntry(by_id[entry_id], score=min(1.0, score / maximum)) for entry_id, score in ordered]

    def lexical_score_for(self, query: str, entry: KnowledgeEntry) -> float:
        return lexical_score(query, entry.text)
