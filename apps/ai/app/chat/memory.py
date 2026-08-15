from dataclasses import dataclass, field

from ..schemas import ChatRole, ChatTurn


@dataclass
class RollingMemory:
    """Keep a bounded recent window and a compact summary.

    The summary is deliberately extractive and deterministic. It is safe to
    run when Ollama is down and prevents unbounded history from reaching a
    prompt. A future summarizer can replace `compact` without changing callers.
    """

    max_turns: int = 20
    summary: str = ""
    turns: list[ChatTurn] = field(default_factory=list)

    @classmethod
    def from_history(cls, history: list[ChatTurn], max_turns: int = 20) -> "RollingMemory":
        memory = cls(max_turns=max_turns)
        for turn in history:
            memory.append(turn)
        return memory

    def append(self, turn: ChatTurn) -> None:
        self.turns.append(turn)
        if len(self.turns) > self.max_turns:
            overflow = len(self.turns) - self.max_turns
            removed = self.turns[:overflow]
            self.turns = self.turns[overflow:]
            self.summary = self._merge_summary(self.summary, removed)

    def _merge_summary(self, current: str, removed: list[ChatTurn]) -> str:
        snippets = [turn.content.replace("\n", " ").strip()[:180] for turn in removed]
        parts = [part for part in (current, *snippets) if part]
        return " | ".join(parts)[-1_000:]

    def prompt_context(self) -> str:
        lines: list[str] = []
        if self.summary:
            lines.append(f"Summary of earlier conversation: {self.summary}")
        lines.extend(f"{turn.role.value}: {turn.content}" for turn in self.turns)
        return "\n".join(lines)

    def has_user_turn(self) -> bool:
        return any(turn.role == ChatRole.USER for turn in self.turns)
