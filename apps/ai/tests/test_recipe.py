from uuid import uuid4

import pytest

from app.generation.recipe import parse_recipe
from app.schemas import RecipeRequest


def test_recipe_repairs_omitted_array_fields() -> None:
    recipe = parse_recipe(
        '{"archetype":"ombre","paletteId":"pal-lavender-milk","baseColor":"#A58CBD",'
        '"finish":"glossy","shape":"almond","length":"medium"}'
    )
    assert recipe.accent_nails == []
    assert recipe.decorations == []


def test_recipe_rejects_unknown_catalog_reference() -> None:
    with pytest.raises(ValueError):
        parse_recipe(
            '{"archetype":"ombre","paletteId":"pal-lavender-milk","baseColor":"#A58CBD",'
            '"accentNails":[],"finish":"glossy","shape":"almond","length":"medium",'
            '"decorations":[{"catalogId":"not-real","zone":"nail-plate","density":0.2}]}'
        )


def test_recipe_request_is_bounded() -> None:
    request = RecipeRequest(user_id=uuid4(), prompt="แบบหวาน", count=3)
    assert request.count == 3
