"""Tests for PostgreSQL URL selection and normalization."""

import pytest
from pydantic import ValidationError

from backend.app.config import Settings
from backend.app.database import normalize_database_url


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("postgres://user:secret@db.example/test", "postgresql+psycopg://user:secret@db.example/test"),
        ("postgresql://user:secret@db.example/test", "postgresql+psycopg://user:secret@db.example/test"),
        ("postgresql+psycopg://user:secret@db.example/test", "postgresql+psycopg://user:secret@db.example/test"),
        ("sqlite:///:memory:", "sqlite:///:memory:"),
    ],
)
def test_database_urls_are_normalized_for_psycopg3(source: str, expected: str) -> None:
    assert normalize_database_url(source) == expected


def test_production_requires_database_and_shared_jwt_secret(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.setenv("NODE_ENV", "production")
    with pytest.raises(ValidationError, match="DATABASE_URL is required"):
        Settings(_env_file=None)


def test_production_settings_read_the_shared_environment(monkeypatch) -> None:
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgres://user:secret@localhost/test")
    monkeypatch.setenv("JWT_SECRET", "a-long-shared-secret-value-over-32-characters")
    configured = Settings(_env_file=None)
    assert configured.app_env == "production"
    assert configured.database_url == "postgres://user:secret@localhost/test"
