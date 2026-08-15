from fastapi import APIRouter, Depends, Request

from ..auth import require_internal_token
from ..main_state import AiState
from ..retrieval.engine import KnowledgeEntry, RetrievalEngine
from ..schemas import Recommendation, RecommendationRequest, RecommendationResponse


router = APIRouter(prefix="/recommend", tags=["recommend"])


@router.post("", response_model=RecommendationResponse, dependencies=[Depends(require_internal_token)])
async def recommend(request: RecommendationRequest, http_request: Request) -> RecommendationResponse:
    state: AiState = http_request.app.state.ai
    templates = await state.repository.templates(request.user_id, request.limit)
    entries = [
        KnowledgeEntry(
            id=template.id,
            question=template.name,
            answer=" ".join(value for value in (template.caption, template.category, template.primary_color) if value),
            embedding=template.embedding,
        )
        for template in templates
    ]
    results = RetrievalEngine(state.embeddings, entries).search(request.query, request.limit)
    by_id = {template.id: template for template in templates}
    return RecommendationResponse(
        items=[
            Recommendation(
                template_id=result.entry.id,
                name=by_id[result.entry.id].name,
                caption=by_id[result.entry.id].caption,
                category=by_id[result.entry.id].category,
                primary_color=by_id[result.entry.id].primary_color,
                score=result.score,
            )
            for result in results
        ],
        degraded=not bool(templates),
    )
