from collections.abc import Sequence

from ..retrieval.engine import RetrievedEntry


REFUSAL_MESSAGE = "ยังไม่มีข้อมูลในคลังที่ยืนยันคำตอบนี้ได้ ลองถามเรื่องแบบ สี หรือบริการที่มีในระบบอีกครั้งนะคะ"


def grounded_context(results: Sequence[RetrievedEntry], max_sources: int = 5) -> str:
    if not results:
        return ""
    return "\n\n".join(
        f"<untrusted_source index=\"{index}\">\nคำถาม: {result.entry.question}\nคำตอบ: {result.entry.answer}\n</untrusted_source>"
        for index, result in enumerate(results[:max_sources], start=1)
    )


def should_refuse(results: Sequence[RetrievedEntry], *, intent: str) -> bool:
    # Chitchat and edit proposals can work without a knowledge hit. Factual QA
    # must be grounded; empty retrieval is never silently turned into a guess.
    return intent in {"qa", "find_shop", "find_template"} and not results
