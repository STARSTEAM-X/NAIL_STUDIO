import json
import re
from collections.abc import Iterable

from ..ollama import OllamaClient, OllamaUnavailable
from ..schemas import Recipe, RecipeRequest


RECIPE_PROMPT = """You translate the user's nail-design request into a compact Recipe.
Return ONLY one JSON object. Do not use markdown or explanations.
Every field is required. `accentNails` and `decorations` MUST always be arrays;
use [] when there are no accent nails or decorations.
Only use known enum-like values from the examples and never invent catalog ids.

Schema:
{
  \"archetype\": \"french-tip|ombre|accent-nail|negative-space|marble|geometric|glitter-gradient\",
  \"paletteId\": \"pal-nude-rose\",
  \"baseColor\": \"#E0A884\",
  \"accentNails\": [0, 3],
  \"finish\": \"glossy|matte|chrome|glitter\",
  \"shape\": \"round|oval|square|squoval|almond|coffin|stiletto\",
  \"length\": \"short|medium|long\",
  \"decorations\": [{\"catalogId\": \"metal-bar\", \"zone\": \"nail-plate\", \"density\": 0.4}]
}

User request: {prompt}
"""

_FALLBACKS = (
    Recipe(
        archetype="french-tip",
        paletteId="pal-nude-rose",
        baseColor="#E0A884",
        accentNails=[3],
        finish="glossy",
        shape="oval",
        length="medium",
    decorations=[{"catalogId": "metal-bar", "zone": "free-edge", "density": 0.25}],
    ),
    Recipe(
        archetype="ombre",
        paletteId="pal-lavender-milk",
        baseColor="#A58CBD",
        accentNails=[],
        finish="glossy",
        shape="almond",
        length="medium",
        decorations=[],
    ),
    Recipe(
        archetype="glitter-gradient",
        paletteId="pal-clear-gold",
        baseColor="#FFFDF8",
        accentNails=[1, 3],
        finish="glitter",
        shape="squoval",
        length="short",
        decorations=[{"catalogId": "gem-diamond", "zone": "free-edge", "density": 0.5}],
    ),
)


def _strip_json_fence(raw: str) -> str:
    return re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", raw.strip(), flags=re.IGNORECASE)


def parse_recipe(raw: str) -> Recipe:
    payload = json.loads(_strip_json_fence(raw))
    if not isinstance(payload, dict):
        raise ValueError("recipe response must be a JSON object")
    # Repair only omissions that the prompt explicitly defines as empty arrays;
    # all enum/catalog validation remains strict in Pydantic.
    payload.setdefault("accentNails", [])
    payload.setdefault("decorations", [])
    return Recipe.model_validate(payload)


class RecipeGenerator:
    def __init__(self, ollama: OllamaClient | None) -> None:
        self.ollama = ollama

    async def generate(self, request: RecipeRequest) -> tuple[list[Recipe], bool, str]:
        if self.ollama is not None:
            try:
                raw = await self.ollama.generate_json(RECIPE_PROMPT.format(prompt=request.prompt))
                for _attempt in range(3):
                    try:
                        parsed = parse_recipe(raw)
                        return self._choices(parsed, request.count), False, self.ollama.model
                    except (ValueError, TypeError, json.JSONDecodeError):
                        if _attempt == 2:
                            raise
                        raw = await self.ollama.generate_json(
                            "Repair this response into the exact Recipe JSON schema. "
                            "Every field is required; use [] for empty arrays. Return JSON only.\n"
                            f"Invalid response:\n{raw}"
                        )
            except (OllamaUnavailable, ValueError, TypeError, json.JSONDecodeError):
                # A deterministic fallback is safer than returning malformed JSON
                # or blocking the main editor when the model is unavailable.
                pass
        return list(_FALLBACKS[: request.count]), True, self.ollama.model if self.ollama else "fallback"

    @staticmethod
    def _choices(recipe: Recipe, count: int) -> list[Recipe]:
        variants = [recipe]
        for fallback in _FALLBACKS:
            if len(variants) >= count:
                break
            if fallback.palette_id != recipe.palette_id or fallback.archetype != recipe.archetype:
                variants.append(fallback)
        return variants[:count]


def fallback_recipes() -> Iterable[Recipe]:
    return _FALLBACKS
