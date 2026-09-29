"""Load DOGFOOD acceptance fixtures into an isolated SQLite test database.

This is not a production data loader. The shared PostgreSQL schema uses UUID
identifiers and relational users, so the supplied fixture IDs and members are
intentionally kept in a separate SQLite-only schema.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
import os

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from backend.fixture_models import (
    FixtureBase,
    Event,
    Judge,
    Project,
    Score,
    Team,
    Track,
)


FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures.json"


class FixtureAlreadyLoadedError(Exception):
    """Raised when this fixture's event already exists in the database."""


def parse_utc_timestamp(value: str) -> datetime:
    """Parse an ISO timestamp and return it as an aware UTC datetime."""

    timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise ValueError(f"Fixture timestamp must include a timezone: {value}")
    return timestamp.astimezone(timezone.utc)


def load_fixture_data(
    session: Session, fixture_path: Path = FIXTURE_PATH
) -> None:
    """Load fixture rows once; existing fixture event data is never overwritten."""

    if session.get_bind().dialect.name != "sqlite":
        raise RuntimeError("DOGFOOD fixture data may only be loaded into isolated SQLite tests")

    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    event_data = fixture["event"]
    event_id = event_data["id"]

    # Do not silently duplicate or replace fixture rows on a second run.
    if session.get(Event, event_id) is not None:
        raise FixtureAlreadyLoadedError(
            f"Fixture event {event_id!r} already exists; no fixture data was loaded."
        )

    try:
        event = Event(
            id=event_id,
            name=event_data["name"],
            submissions_close=parse_utc_timestamp(event_data["submissions_close"]),
        )

        tracks_by_id = {
            data["id"]: Track(id=data["id"], name=data["name"])
            for data in fixture["tracks"]
        }
        judges_by_id = {}
        for data in fixture["judges"]:
            judge = Judge(id=data["id"], name=data["name"], email=data["email"])
            judge.eligible_tracks = [tracks_by_id[track_id] for track_id in data["tracks"]]
            judges_by_id[judge.id] = judge

        teams_by_id = {
            data["id"]: Team(
                id=data["id"],
                name=data["name"],
                members=data["members"],
            )
            for data in fixture["teams"]
        }

        projects_by_id = {}
        for data in fixture["projects"]:
            project = Project(
                id=data["id"],
                team=teams_by_id[data["team"]],
                track=tracks_by_id[data["track"]],
                title=data["title"],
                summary=data["summary"],
                repo_url=data["repo_url"],
                submitted_at=parse_utc_timestamp(data["submitted_at"]),
            )
            projects_by_id[project.id] = project

        scores = [
            Score(
                judge=judges_by_id[data["judge"]],
                project=projects_by_id[data["project"]],
                functionality=data["criteria"]["functionality"],
                quality=data["criteria"]["quality"],
                innovation=data["criteria"]["innovation"],
                comment=data["comment"],
            )
            for data in fixture["scores"]
        ]

        session.add_all(
            [event, *tracks_by_id.values(), *judges_by_id.values(), *teams_by_id.values()]
        )
        session.add_all(projects_by_id.values())
        session.add_all(scores)
        session.commit()
    except Exception:
        session.rollback()
        raise


def main() -> None:
    """Load fixtures into a local SQLite-only acceptance-test database."""

    fixture_url = os.environ.get("FIXTURE_DATABASE_URL", "sqlite:///./dogfood-fixtures.db")
    if not fixture_url.startswith("sqlite:"):
        raise RuntimeError("FIXTURE_DATABASE_URL must point to an isolated SQLite database")
    fixture_engine = create_engine(fixture_url)
    try:
        FixtureBase.metadata.create_all(fixture_engine)
        with Session(fixture_engine) as session:
            try:
                load_fixture_data(session)
            except FixtureAlreadyLoadedError as error:
                print(error)
                return

            score_count = session.scalar(select(func.count()).select_from(Score))
            print(f"Loaded fixture data, including {score_count} scores.")
    finally:
        fixture_engine.dispose()


if __name__ == "__main__":
    main()
