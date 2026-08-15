from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from .retrieval.engine import KnowledgeEntry


@dataclass(frozen=True)
class TemplateRecord:
    id: str
    name: str
    caption: str | None
    category: str | None
    primary_color: str | None
    embedding: list[float] | None = None


class AiRepository(Protocol):
    async def knowledge_entries(self) -> list[KnowledgeEntry]: ...

    async def templates(self, user_id: UUID, limit: int) -> list[TemplateRecord]: ...

    async def save_chat(self, session_id: UUID, role: str, content: str) -> None: ...


class InMemoryRepository:
    """Safe development fallback and a seam for unit tests."""

    def __init__(self) -> None:
        self.entries: list[KnowledgeEntry] = []
        self.template_records: list[TemplateRecord] = []
        self.messages: dict[UUID, list[tuple[str, str]]] = {}

    async def knowledge_entries(self) -> list[KnowledgeEntry]:
        return list(self.entries)

    async def templates(self, _user_id: UUID, limit: int) -> list[TemplateRecord]:
        return list(self.template_records[:limit])

    async def save_chat(self, session_id: UUID, role: str, content: str) -> None:
        self.messages.setdefault(session_id, []).append((role, content))


class PostgresRepository:
    """Read-only AI repository; missing optional tables degrade to empty data."""

    def __init__(self, pool: object) -> None:
        self.pool = pool

    async def knowledge_entries(self) -> list[KnowledgeEntry]:
        try:
            async with self.pool.connection() as connection:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        """
                        SELECT id::text, question, answer
                        FROM knowledge_entries
                        WHERE is_active = TRUE
                        ORDER BY created_at DESC
                        LIMIT 200
                        """
                    )
                    return [KnowledgeEntry(id=row[0], question=row[1], answer=row[2]) for row in await cursor.fetchall()]
        except Exception:
            return []

    async def templates(self, _user_id: UUID, limit: int) -> list[TemplateRecord]:
        try:
            async with self.pool.connection() as connection:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        """
                        SELECT id::text, name, caption, category, primary_color
                        FROM nail_templates
                        WHERE visibility = 'public' AND deleted_at IS NULL
                        ORDER BY like_count DESC, created_at DESC, id DESC
                        LIMIT %s
                        """,
                        (limit,),
                    )
                    return [
                        TemplateRecord(
                            id=row[0], name=row[1], caption=row[2], category=row[3], primary_color=row[4]
                        )
                        for row in await cursor.fetchall()
                    ]
        except Exception:
            return []

    async def save_chat(self, session_id: UUID, role: str, content: str) -> None:
        # Chat persistence is enabled after the Slice 6 migration is deployed.
        # Do not silently write to an unverified schema.
        del session_id, role, content
