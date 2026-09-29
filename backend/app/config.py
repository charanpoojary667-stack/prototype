"""Application settings loaded from environment variables."""

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings that can be overridden with environment variables."""

    database_url: str | None = None
    jwt_secret: str | None = None
    jwt_issuer: str = "dogfood-judging-api"
    jwt_audience: str = "dogfood-judging-platform"
    app_env: str = Field(
        default="development", validation_alias=AliasChoices("APP_ENV", "NODE_ENV")
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @model_validator(mode="after")
    def require_production_settings(self) -> "Settings":
        """Refuse to silently use a local database for production."""

        if self.app_env.lower() == "production":
            if not self.database_url:
                raise ValueError("DATABASE_URL is required in production")
            if not self.jwt_secret or len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET must contain at least 32 characters in production")
        return self


settings = Settings()
