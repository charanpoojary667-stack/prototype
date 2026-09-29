"""Shared FastAPI dependencies."""

from collections.abc import Generator

from sqlalchemy.orm import Session

from backend.app.database import engine


def get_db() -> Generator[Session, None, None]:
    """Provide a database session for one API request."""

    with Session(engine) as session:
        yield session
