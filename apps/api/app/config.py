from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_env_file() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or key in os.environ:
            continue
        if value and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ[key] = value


_load_env_file()


@dataclass(frozen=True)
class Settings:
    ai_provider: str = (
        os.getenv("AI_PROVIDER", os.getenv("BRD_PROVIDER", "openrouter")).strip() or "openrouter"
    )
    ai_openrouter_api_key: str = os.getenv(
        "AI_OPENROUTER_API_KEY", os.getenv("BRD_OPENROUTER_API_KEY", "")
    ).strip()
    ai_openrouter_base_url: str = (
        os.getenv(
            "AI_OPENROUTER_BASE_URL",
            os.getenv("BRD_OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        ).rstrip("/")
    )
    ai_openrouter_http_referer: str = os.getenv(
        "AI_OPENROUTER_HTTP_REFERER", os.getenv("BRD_OPENROUTER_HTTP_REFERER", "")
    ).strip()
    ai_openrouter_app_title: str = os.getenv(
        "AI_OPENROUTER_APP_TITLE", os.getenv("BRD_OPENROUTER_APP_TITLE", "")
    ).strip()
    openrouter_api_key: str = os.getenv(
        "BRD_OPENROUTER_API_KEY", os.getenv("AI_OPENROUTER_API_KEY", "")
    ).strip()
    openrouter_base_url: str = os.getenv(
        "BRD_OPENROUTER_BASE_URL",
        os.getenv("AI_OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    ).rstrip("/")
    openrouter_http_referer: str = os.getenv(
        "BRD_OPENROUTER_HTTP_REFERER", os.getenv("AI_OPENROUTER_HTTP_REFERER", "")
    ).strip()
    openrouter_app_title: str = os.getenv(
        "BRD_OPENROUTER_APP_TITLE", os.getenv("AI_OPENROUTER_APP_TITLE", "")
    ).strip()
    ai_timeout_seconds: int = int(os.getenv("AI_TIMEOUT_SECONDS", "45"))
    ai_log_prompt_body: bool = (
        os.getenv("AI_LOG_PROMPT_BODY", os.getenv("BRD_LOG_PROMPT_BODY", "false")).lower()
        == "true"
    )
    provider: str = os.getenv("BRD_PROVIDER", os.getenv("AI_PROVIDER", "openrouter")).strip()
    model_primary: str = os.getenv("BRD_MODEL_PRIMARY", "openai/gpt-5.5").strip()
    model_helper: str = os.getenv("BRD_MODEL_HELPER", "openai/gpt-5.4-mini").strip()
    usecase_provider: str = os.getenv(
        "USECASE_PROVIDER", os.getenv("AI_PROVIDER", os.getenv("BRD_PROVIDER", "openrouter"))
    ).strip()
    usecase_model: str = os.getenv("USECASE_MODEL_PRIMARY", "openai/gpt-5.4-mini").strip()
    usecase_generation_mode: str = os.getenv(
        "USECASE_GENERATION_MODE", "deterministic"
    ).strip()
    usecase_prompt_version: str = os.getenv("USECASE_PROMPT_VERSION", "1.0.0").strip()
    usecase_max_attempts: int = max(1, min(2, int(os.getenv("USECASE_MAX_ATTEMPTS", "2"))))
    idempotency_ttl_seconds: int = int(os.getenv("BRD_IDEMPOTENCY_TTL_SECONDS", "600"))
    request_rate_limit: str = os.getenv("BRD_REQUEST_RATE_LIMIT", "20/min").strip()
    log_prompt_body: bool = os.getenv("BRD_LOG_PROMPT_BODY", "false").lower() == "true"
    cors_origins_raw: str = os.getenv("BRD_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


settings = Settings()
