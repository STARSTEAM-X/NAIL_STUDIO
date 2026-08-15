from collections import defaultdict
from collections.abc import Iterable


def reciprocal_rank_fusion(
    rankings: Iterable[Iterable[str]], *, k: int = 60
) -> dict[str, float]:
    """Merge ranked ids in O(number of ranked results).

    `k=60` is the conventional stabilizer. A document appearing in both the
    vector and lexical lists receives evidence from both lists; no post-hoc
    keyword filter can erase a semantic match.
    """

    scores: dict[str, float] = defaultdict(float)
    for ranking in rankings:
        for rank, identifier in enumerate(ranking, start=1):
            scores[identifier] += 1.0 / (k + rank)
    return dict(scores)


def sort_fused(scores: dict[str, float]) -> list[tuple[str, float]]:
    return sorted(scores.items(), key=lambda item: (-item[1], item[0]))
