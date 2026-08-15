import re

from ..schemas import EditorContext, ProposedCommand


_COLOR_PATTERN = re.compile(r"(?:สี|color)\s*([#A-Fa-f0-9]{6}|[\u0E00-\u0E7F]+)", re.IGNORECASE)
_NAIL_PATTERN = re.compile(r"(?:นิ้ว|nail)\s*([0-4]|โป้ง|ชี้|กลาง|นาง|ก้อย)", re.IGNORECASE)
_NAIL_NAMES = {"โป้ง": "0", "ชี้": "1", "กลาง": "2", "นาง": "3", "ก้อย": "4"}
_HEX_COLORS = {"แดง": "#c62828", "ชมพู": "#ec407a", "ขาว": "#ffffff", "ดำ": "#111111", "น้ำเงิน": "#1565c0"}


def propose_command(message: str, context: EditorContext | None) -> ProposedCommand | None:
    """Return a safe, confirm-first proposal; never mutate editor state."""

    if context is None:
        return None
    normalized = message.strip().lower()
    if not any(verb in normalized for verb in ("เปลี่ยน", "ทำ", "แก้", "set", "change")):
        return None
    color_match = _COLOR_PATTERN.search(normalized)
    if not color_match:
        return None
    raw_color = color_match.group(1)
    color = raw_color if raw_color.startswith("#") else _HEX_COLORS.get(raw_color)
    if color is None:
        return None

    nail_match = _NAIL_PATTERN.search(normalized)
    nail = context.selected_nail or "selected"
    if nail_match:
        nail = _NAIL_NAMES.get(nail_match.group(1), nail_match.group(1))
    return ProposedCommand(type="SetNailColor", nail=nail, value=color)
