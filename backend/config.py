from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # App
    app_name: str = "Cognitive API"
    environment: str = "development"

    # Telegram
    telegram_bot_token: str

    # AI — Groq (free) primary, OpenAI fallback later
    groq_api_key: str | None = None
    openai_api_key: str | None = None

    # Supabase — matches his .env.example exactly
    supabase_url: str | None = None
    supabase_key: str | None = None          # ← was supabase_service_key

    # Backend URL — used by the Telegram worker to reach the FastAPI service
    backend_url: str = "http://127.0.0.1:8000"


@lru_cache
def get_settings() -> Settings:
    return Settings()