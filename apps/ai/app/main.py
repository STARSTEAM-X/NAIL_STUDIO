from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import get_settings
from .generation.recipe import RecipeGenerator
from .main_state import AiState
from .ollama import OllamaClient
from .repositories import InMemoryRepository, PostgresRepository
from .retrieval.embedding import EmbeddingProvider
from .retrieval.intent import IntentRouter
from .routers import chat, design, recommend
from .schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    embeddings = EmbeddingProvider(settings.embedding_model)
    embeddings.load()
    intent = IntentRouter(embeddings)
    intent.load()
    ollama = (
        OllamaClient(settings.ollama_url, settings.ollama_model, settings.ollama_timeout_seconds)
        if settings.ai_enable_ollama
        else None
    )
    repository = InMemoryRepository()
    database_pool = None
    if settings.ai_database_url:
        try:
            from psycopg_pool import AsyncConnectionPool

            database_pool = AsyncConnectionPool(
                conninfo=settings.ai_database_url,
                min_size=settings.ai_database_pool_min,
                max_size=settings.ai_database_pool_max,
                open=False,
            )
            await database_pool.open()
            repository = PostgresRepository(database_pool)
        except Exception:
            # The AI service is optional. Keep an in-memory repository until the
            # database migration/extension is available.
            if database_pool is not None:
                await database_pool.close()
            database_pool = None

    app.state.ai = AiState(
        settings=settings,
        repository=repository,
        embeddings=embeddings,
        intent=intent,
        recipe_generator=RecipeGenerator(ollama),
        ollama=ollama,
        database_pool=database_pool,
    )
    yield
    if database_pool is not None:
        await database_pool.close()


app = FastAPI(title="Nail Studio AI", version="0.1.0", lifespan=lifespan)
app.include_router(chat.router)
app.include_router(design.router)
app.include_router(recommend.router)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        ollama_available=settings.ai_enable_ollama,
        database_configured=bool(settings.ai_database_url),
    )
