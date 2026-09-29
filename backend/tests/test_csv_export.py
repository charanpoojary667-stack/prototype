"""Tests for organizer CSV export from the shared PostgreSQL table model."""

import csv
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.app.database import Base
from backend.app.dependencies import get_db
from backend.app.main import app
from backend.app.models import Assignment, Event, Judge, Project, RubricCriterion, Score, Team, Track
from backend.app.security import AuthenticatedPrincipal, get_current_user


CSV_HEADER = [
    "project_id", "project_title", "team_id", "track_id", "judge_id",
    "assignment_status", "functionality", "quality", "innovation", "comment",
    "judgement_submitted_at",
]


@pytest.fixture
def export_api(tmp_path: Path):
    app.dependency_overrides.clear()
    engine = create_engine(f"sqlite:///{tmp_path / 'csv_export_test.db'}")
    Base.metadata.create_all(engine)
    session = Session(engine)
    organizer = Judge(id=str(uuid4()), name="Organizer", email="org@example.org", role="organizer")
    judge = Judge(id=str(uuid4()), name="Judge", email="judge@example.org", role="judge")
    judge_two = Judge(id=str(uuid4()), name="Judge Two", email="judge2@example.org", role="judge")
    event = Event(
        id=str(uuid4()), organizer_id=organizer.id, title="Test event",
        start_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        end_at=datetime(2026, 3, 2, tzinfo=timezone.utc), status="published",
    )
    track = Track(id=str(uuid4()), event_id=event.id, name="Track One")
    team = Team(id=str(uuid4()), event_id=event.id, name="Team One", created_by=organizer.id)
    project = Project(
        id=str(uuid4()), team=team, track=track, title="Project One", summary="Summary",
        repository_url="https://example.org/project", created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )
    project_two = Project(
        id=str(uuid4()), team=team, track=track, title="Project Two", summary="Summary two",
        repository_url="https://example.org/project-two", created_at=datetime(2026, 3, 2, tzinfo=timezone.utc),
    )
    criteria = [
        RubricCriterion(id=str(uuid4()), event_id=event.id, name=name, max_score=10, position=i)
        for i, name in enumerate(("functionality", "quality", "innovation"))
    ]
    complete_time = datetime(2026, 3, 3, 12, tzinfo=timezone.utc)
    completed = Assignment(
        id=str(uuid4()), event_id=event.id, judge=judge, project=project,
        status="completed", completed_at=complete_time,
        overall_feedback='Comma, quote " and newline\nkept',
    )
    in_progress = Assignment(
        id=str(uuid4()), event_id=event.id, judge=judge_two, project=project,
        status="in_progress",
    )
    session.add_all([
        organizer, judge, judge_two, event, track, team, project, project_two,
        *criteria, completed, in_progress,
    ])
    session.flush()
    scores = [
        Score(
            project_id=project.id, event_id=event.id, judge_id=judge.id,
            criterion_id=criterion.id, assignment_id=completed.id, raw_score=value,
        )
        for criterion, value in zip(criteria, (2, 4, 5), strict=True)
    ]
    session.add_all(scores)
    session.commit()

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)
    ids = {
        "organizer": organizer.id,
        "judge": judge.id,
        "judge_two": judge_two.id,
        "project": project.id,
        "team": team.id,
        "track": track.id,
        "assignment": completed.id,
        "in_progress_assignment": in_progress.id,
        "score": scores[0].id,
    }
    yield client, session, ids
    app.dependency_overrides.clear()
    session.close()
    Base.metadata.drop_all(engine)
    engine.dispose()


def authenticate(client: TestClient, role: str, user_id: str) -> None:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedPrincipal(
        user_id=user_id, role=role  # type: ignore[arg-type]
    )


def csv_rows(response_text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(StringIO(response_text)))


def test_organizer_export_succeeds_with_headers_and_raw_scores(export_api) -> None:
    client, _, ids = export_api
    authenticate(client, "organizer", ids["organizer"])

    response = client.get("/judging/export.csv")
    rows = csv_rows(response.text)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert 'filename="judging-results.csv"' in response.headers["content-disposition"]
    assert list(rows[0]) == CSV_HEADER
    completed = next(row for row in rows if row["judge_id"] == ids["judge"])
    assert (completed["project_id"], completed["team_id"], completed["track_id"]) == (
        ids["project"], ids["team"], ids["track"]
    )
    assert completed["project_title"] == "Project One"
    assert completed["assignment_status"] == "completed"
    assert (completed["functionality"], completed["quality"], completed["innovation"]) == (
        "2", "4", "5"
    )
    assert completed["judgement_submitted_at"] == "2026-03-03T12:00:00+00:00"


@pytest.mark.parametrize("role", ["judge", "participant"])
def test_non_organizer_export_is_denied(export_api, role: str) -> None:
    client, _, ids = export_api
    authenticate(client, role, ids["judge"])
    assert client.get("/judging/export.csv").status_code == 403


def test_unauthenticated_export_is_denied(export_api) -> None:
    client, _, _ = export_api
    app.dependency_overrides.pop(get_current_user, None)
    assert client.get("/judging/export.csv").status_code == 401


def test_comments_with_commas_quotes_and_newlines_round_trip(export_api) -> None:
    client, _, ids = export_api
    authenticate(client, "organizer", ids["organizer"])
    rows = csv_rows(client.get("/judging/export.csv").text)
    completed = next(row for row in rows if row["judge_id"] == ids["judge"])
    assert completed["comment"] == 'Comma, quote " and newline\nkept'


def test_empty_comment_is_preserved(export_api) -> None:
    client, session, ids = export_api
    authenticate(client, "organizer", ids["organizer"])
    assignment = session.get(Assignment, ids["assignment"])
    assert assignment is not None
    assignment.overall_feedback = ""
    session.commit()
    rows = csv_rows(client.get("/judging/export.csv").text)
    assert next(row for row in rows if row["judge_id"] == ids["judge"])["comment"] == ""


def test_repeated_export_is_deterministic_and_incomplete_state_is_preserved(export_api) -> None:
    client, _, ids = export_api
    authenticate(client, "organizer", ids["organizer"])
    first = client.get("/judging/export.csv").text
    second = client.get("/judging/export.csv").text
    assert first == second
    rows = csv_rows(first)
    unfinished = next(row for row in rows if row["judge_id"] == ids["judge_two"])
    assert unfinished["assignment_status"] == "in_progress"
    assert unfinished["functionality"] == unfinished["judgement_submitted_at"] == ""
    unassigned = next(row for row in rows if row["project_title"] == "Project Two")
    assert unassigned["judge_id"] == unassigned["assignment_status"] == ""


def test_export_does_not_modify_assignment_or_score_rows(export_api) -> None:
    client, session, ids = export_api
    authenticate(client, "organizer", ids["organizer"])
    assignments_before = [
        (row.id, row.status, row.overall_feedback, row.completed_at)
        for row in session.scalars(select(Assignment).order_by(Assignment.id))
    ]
    scores_before = [
        (row.id, row.assignment_id, row.criterion_id, row.raw_score, row.comment, row.updated_at)
        for row in session.scalars(select(Score).order_by(Score.id))
    ]
    assert client.get("/judging/export.csv").status_code == 200
    session.expire_all()
    assignments_after = [
        (row.id, row.status, row.overall_feedback, row.completed_at)
        for row in session.scalars(select(Assignment).order_by(Assignment.id))
    ]
    scores_after = [
        (row.id, row.assignment_id, row.criterion_id, row.raw_score, row.comment, row.updated_at)
        for row in session.scalars(select(Score).order_by(Score.id))
    ]
    assert assignments_after == assignments_before
    assert scores_after == scores_before


def test_direct_export_route_still_requires_organizer(export_api) -> None:
    client, _, ids = export_api
    authenticate(client, "judge", ids["judge"])
    response = client.get("/judging/export.csv")
    assert response.status_code == 403
    assert "project_id" not in response.text
