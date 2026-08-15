from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../../.env"), extra="ignore")

    ai_internal_token: str = Field(
        default="",
        validation_alias="AI_INTERNAL_TOKEN",
        description="Shared secret accepted only from the internal Express API",
    )
    ai_database_url: str | None = Field(default=None, validation_alias="AI_DATABASE_URL")
    ai_database_pool_min: int = Field(default=1, validation_alias="AI_DATABASE_POOL_MIN", ge=1, le=20)
    ai_database_pool_max: int = Field(default=5, validation_alias="AI_DATABASE_POOL_MAX", ge=1, le=20)
    ollama_url: str = Field(default="http://localhost:11434", validation_alias="OLLAMA_URL")
    ai_enable_ollama: bool = Field(default=False, validation_alias="AI_ENABLE_OLLAMA")
    ollama_model: str = Field(
        default="scb10x/llama3.1-typhoon2-8b-instruct", validation_alias="OLLAMA_MODEL"
    )
    ollama_timeout_seconds: float = Field(default=60.0, validation_alias="OLLAMA_TIMEOUT_SECONDS", gt=0, le=300)
    embedding_model: str = Field(
        default="intfloat/multilingual-e5-base", validation_alias="EMBEDDING_MODEL"
    )
    retrieval_top_k: int = Field(default=5, validation_alias="RETRIEVAL_TOP_K", ge=1, le=20)
    chat_history_limit: int = Field(default=20, validation_alias="CHAT_HISTORY_LIMIT", ge=1, le=100)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
