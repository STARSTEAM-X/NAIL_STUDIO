from dataclasses import dataclass

from .config import Settings
from .generation.recipe import RecipeGenerator
from .ollama import OllamaClient
from .repositories import AiRepository
from .retrieval.embedding import EmbeddingProvider
from .retrieval.intent import IntentRouter


@dataclass
class AiState:
    settings: Settings
    repository: AiRepository
    embeddings: EmbeddingProvider
    intent: IntentRouter
    recipe_generator: RecipeGenerator
    ollama: OllamaClient | None
    database_pool: object | None = None
