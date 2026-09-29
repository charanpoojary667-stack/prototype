"""Shared PostgreSQL SQLAlchemy engine and model base."""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase

from backend.app.config import settings


class Base(DeclarativeBase):
    """Metadata for mappings to the shared Node backend schema."""


def normalize_database_url(database_url: str) -> str:
    """Use psycopg 3 for PostgreSQL URLs accepted by the Node backend."""

    if database_url.startswith("postgres://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgres://")
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgresql://")
    return database_url


raw_database_url = settings.database_url or "sqlite:///:memory:"
database_url = normalize_database_url(raw_database_url)
connect_args = {}
if database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine_options = {"connect_args": connect_args}
if not database_url.startswith("sqlite"):
    engine_options["pool_pre_ping"] = True
engine = create_engine(database_url, **engine_options)


if database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _connection_record) -> None:
        """Make SQLite enforce the foreign keys declared by the models."""

        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
