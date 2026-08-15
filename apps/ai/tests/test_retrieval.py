from app.retrieval.embedding import EmbeddingProvider
from app.retrieval.engine import KnowledgeEntry, RetrievalEngine
from app.retrieval.rrf import reciprocal_rank_fusion, sort_fused


def test_rrf_keeps_semantic_result_without_keyword_filter() -> None:
    scores = reciprocal_rank_fusion([["semantic-only", "shared"], ["shared", "lexical-only"]])
    ordered = [identifier for identifier, _score in sort_fused(scores)]
    assert ordered[0] == "shared"
    assert "semantic-only" in ordered


def test_retrieval_uses_both_rankings_and_returns_active_entries() -> None:
    embeddings = EmbeddingProvider("test")
    engine = RetrievalEngine(
        embeddings,
        [
            KnowledgeEntry("1", "สีชมพู", "โทนชมพูอ่อน", is_active=True),
            KnowledgeEntry("2", "คำตอบเก่า", "ไม่ควรแสดง", is_active=False),
        ],
    )
    results = engine.search("อยากได้โทนชมพู", top_k=5)
    assert [result.entry.id for result in results] == ["1"]
    assert 0 <= results[0].score <= 1
