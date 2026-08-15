from fastapi import APIRouter, Depends, Request

from ..auth import require_internal_token
from ..main_state import AiState
from ..schemas import RecipeRequest, RecipeResponse


router = APIRouter(prefix="/design", tags=["design"])


@router.post("/recipe", response_model=RecipeResponse, dependencies=[Depends(require_internal_token)])
async def recipe(request: RecipeRequest, http_request: Request) -> RecipeResponse:
    state: AiState = http_request.app.state.ai
    choices, degraded, model = await state.recipe_generator.generate(request)
    return RecipeResponse(choices=choices, degraded=degraded, model=model)
