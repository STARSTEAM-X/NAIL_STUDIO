from dataclasses import dataclass

from ..schemas import ChatIntent
from .embedding import EmbeddingProvider, cosine_similarity


@dataclass(frozen=True)
class IntentDecision:
    intent: ChatIntent
    confidence: float


_EXEMPLARS: dict[ChatIntent, tuple[str, ...]] = {
    ChatIntent.QA: ("ตอบคำถามเรื่องการทำเล็บ", "ดูแลเล็บอย่างไร", "สีนี้ใช้กับเล็บได้ไหม"),
    ChatIntent.GENERATE_DESIGN: ("ช่วยออกแบบเล็บใหม่", "อยากได้ดีไซน์เล็บโทนหวาน", "สร้างแบบเล็บให้หน่อย"),
    ChatIntent.EDIT_CURRENT: ("เปลี่ยนสีเล็บนี้", "ทำเล็บนิ้วนางเป็นสีแดง", "แก้แบบที่กำลังเปิดอยู่"),
    ChatIntent.FIND_TEMPLATE: ("หาแบบเล็บที่คล้ายกัน", "แนะนำ template โทนมินิมอล", "ค้นหาดีไซน์ยอดนิยม"),
    ChatIntent.FIND_SHOP: ("หาร้านทำเล็บใกล้ฉัน", "ร้านไหนรับทำสีนี้", "ขอแนะนำร้าน"),
    ChatIntent.CHITCHAT: ("สวัสดี", "ขอบคุณมาก", "วันนี้เป็นอย่างไรบ้าง"),
}


class IntentRouter:
    def __init__(self, embeddings: EmbeddingProvider) -> None:
        self.embeddings = embeddings
        self._vectors: dict[ChatIntent, list[list[float]]] = {}

    def load(self) -> None:
        self._vectors = {
            intent: [self.embeddings.encode(example) for example in examples]
            for intent, examples in _EXEMPLARS.items()
        }

    def detect(self, query: str) -> IntentDecision:
        if not self._vectors:
            self.load()
        query_vector = self.embeddings.encode(query)
        best_intent = ChatIntent.CHITCHAT
        best_score = 0.0
        for intent, exemplars in self._vectors.items():
            score = max((cosine_similarity(query_vector, vector) for vector in exemplars), default=0.0)
            if score > best_score:
                best_intent, best_score = intent, score
        return IntentDecision(intent=best_intent, confidence=best_score)
