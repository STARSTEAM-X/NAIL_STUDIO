from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatIntent(StrEnum):
    QA = "qa"
    GENERATE_DESIGN = "generate_design"
    EDIT_CURRENT = "edit_current"
    FIND_TEMPLATE = "find_template"
    FIND_SHOP = "find_shop"
    CHITCHAT = "chitchat"


class ChatRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: ChatRole
    content: str = Field(min_length=1, max_length=8_000)


class EditorContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    selected_nail: str | None = Field(default=None, max_length=64)
    selected_color: str | None = Field(default=None, max_length=32)
    selected_shape: str | None = Field(default=None, max_length=32)
    selected_finish: str | None = Field(default=None, max_length=32)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    session_id: UUID
    message: str = Field(min_length=1, max_length=8_000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    editor_context: EditorContext | None = None

    @field_validator("message")
    @classmethod
    def reject_control_characters(cls, value: str) -> str:
        if any(ord(character) < 9 for character in value):
            raise ValueError("message contains unsupported control characters")
        return value.strip()


class RetrievalSource(BaseModel):
    id: str
    question: str
    answer: str
    score: float = Field(ge=0, le=1)


class ProposedCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    nail: str = Field(min_length=1, max_length=64)
    value: str = Field(min_length=1, max_length=64)
    confirmation_required: bool = True


class ChatResponse(BaseModel):
    session_id: UUID
    intent: ChatIntent
    grounded: bool
    sources: list[RetrievalSource] = Field(default_factory=list)
    proposed_command: ProposedCommand | None = None


class RecipeDecoration(BaseModel):
    catalog_id: str = Field(alias="catalogId", min_length=1, max_length=100)
    zone: str = Field(min_length=1, max_length=40)
    density: float = Field(ge=0, le=1)

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    @field_validator("catalog_id")
    @classmethod
    def validate_catalog_id(cls, value: str) -> str:
        if value not in {
            "gem-diamond",
            "gem-round",
            "gem-princess",
            "gem-cushion",
            "gem-emerald",
            "gem-sapphire",
            "gem-ruby",
            "gem-crystal",
            "metal-hoop",
            "metal-double-hoop",
            "metal-square-hoop",
            "metal-bar",
            "metal-bar-double",
            "metal-stud",
            "metal-knot",
            "pearl-single",
            "pearl-cabochon",
            "pearl-drop",
            "motif-heart",
            "motif-star",
            "motif-moon",
            "motif-bolt",
            "motif-leaf",
            "motif-butterfly",
            "motif-crown",
            "motif-flower",
            "motif-orbit",
            "ribbon-bow",
            "ribbon-knot",
            "ribbon-wave",
            "ribbon-loop",
        }:
            raise ValueError("catalogId is not present in the decoration catalog")
        return value

    @field_validator("zone")
    @classmethod
    def validate_zone(cls, value: str) -> str:
        if value not in {"nail-plate", "free-edge", "accent-nail", "negative-space"}:
            raise ValueError("zone is not supported by the composer")
        return value


class Recipe(BaseModel):
    """The compact LLM output; TS owns full DesignDocument composition."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    archetype: str = Field(min_length=1, max_length=64)
    palette_id: str = Field(alias="paletteId", min_length=1, max_length=64)
    base_color: str = Field(alias="baseColor", pattern=r"^#[0-9A-Fa-f]{6}$")
    accent_nails: list[int] = Field(alias="accentNails", min_length=0, max_length=5)
    finish: str = Field(min_length=1, max_length=32)
    shape: str = Field(min_length=1, max_length=32)
    length: str = Field(min_length=1, max_length=32)
    decorations: list[RecipeDecoration] = Field(default_factory=list, max_length=12)

    @field_validator("accent_nails")
    @classmethod
    def validate_nails(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value) or any(nail < 0 or nail > 4 for nail in value):
            raise ValueError("accentNails must contain unique nail indexes from 0 to 4")
        return value

    @field_validator("archetype")
    @classmethod
    def validate_archetype(cls, value: str) -> str:
        if value not in {
            "french-tip",
            "ombre",
            "accent-nail",
            "negative-space",
            "marble",
            "geometric",
            "glitter-gradient",
        }:
            raise ValueError("archetype is not present in the design catalog")
        return value

    @field_validator("palette_id")
    @classmethod
    def validate_palette(cls, value: str) -> str:
        if value not in {
            "pal-nude-rose",
            "pal-berry-night",
            "pal-sage-sky",
            "pal-sunset-coral",
            "pal-lavender-milk",
            "pal-mocha-gold",
            "pal-monochrome-ink",
            "pal-clear-gold",
        }:
            raise ValueError("paletteId is not present in the design catalog")
        return value

    @field_validator("finish")
    @classmethod
    def validate_finish(cls, value: str) -> str:
        if value not in {"glossy", "matte", "chrome", "glitter"}:
            raise ValueError("finish is not supported by the editor")
        return value

    @field_validator("shape")
    @classmethod
    def validate_shape(cls, value: str) -> str:
        if value not in {"round", "oval", "square", "squoval", "almond", "coffin", "stiletto"}:
            raise ValueError("shape is not supported by the editor")
        return value

    @field_validator("length")
    @classmethod
    def validate_length(cls, value: str) -> str:
        if value not in {"short", "medium", "long"}:
            raise ValueError("length is not supported by the editor")
        return value


class RecipeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    prompt: str = Field(min_length=1, max_length=2_000)
    count: int = Field(default=3, ge=1, le=3)
    editor_context: EditorContext | None = None


class RecipeResponse(BaseModel):
    choices: list[Recipe] = Field(min_length=1, max_length=3)
    degraded: bool = False
    model: str


class RecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    query: str = Field(min_length=1, max_length=2_000)
    limit: int = Field(default=10, ge=1, le=50)


class Recommendation(BaseModel):
    template_id: str
    name: str
    caption: str | None = None
    category: str | None = None
    primary_color: str | None = None
    score: float = Field(ge=0, le=1)


class RecommendationResponse(BaseModel):
    items: list[Recommendation]
    degraded: bool = False


class HealthResponse(BaseModel):
    status: str
    ollama_available: bool
    database_configured: bool


def model_dump_json_safe(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(by_alias=True, mode="json")
