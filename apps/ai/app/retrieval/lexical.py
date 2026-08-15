import re
from collections import Counter
from typing import Iterable


_WORD_RE = re.compile(r"[\u0E00-\u0E7F]+|[A-Za-z0-9][A-Za-z0-9_.#-]*")


def tokenize_thai(text: str) -> list[str]:
    """Tokenize Thai with PyThaiNLP when available and a safe fallback otherwise.

    The same function is used when indexing and querying. The old keyword
    `is_relevant()` filter is deliberately absent: lexical evidence is ranked
    and fused with semantic evidence instead of discarding semantic matches.
    """

    normalized = " ".join(text.lower().split())
    try:
        from pythainlp.tokenize import word_tokenize

        tokens = word_tokenize(normalized, engine="newmm", keep_whitespace=False)
    except (ImportError, RuntimeError):
        tokens = _WORD_RE.findall(normalized)
        # Thai text without an installed tokenizer still gets useful matching
        # through overlapping bigrams, while Latin words remain whole tokens.
        expanded: list[str] = []
        for token in tokens:
            if re.fullmatch(r"[\u0E00-\u0E7F]+", token) and len(token) > 2:
                expanded.extend(token[index : index + 2] for index in range(len(token) - 1))
            else:
                expanded.append(token)
        tokens = expanded
    return [token for token in tokens if token and not token.isspace()]


def lexical_score(query: str, document: str) -> float:
    query_tokens = Counter(tokenize_thai(query))
    document_tokens = Counter(tokenize_thai(document))
    if not query_tokens or not document_tokens:
        return 0.0
    overlap = sum(min(count, document_tokens[token]) for token, count in query_tokens.items())
    return min(1.0, overlap / max(1, sum(query_tokens.values())))


def rank_lexical(query: str, documents: Iterable[tuple[str, str]]) -> list[tuple[str, float]]:
    scored = [(identifier, lexical_score(query, text)) for identifier, text in documents]
    return sorted(scored, key=lambda item: (-item[1], item[0]))
