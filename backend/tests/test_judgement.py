"""Tests for criterion-level score submission and shared assignment state."""

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.database import Base
from backend.app.models import (
    Assignment,
    Event,
    Judge,
    Project,
    RubricCriterion,
    Score,
    Team,
    Track,
)
from backend.fixture_loader import load_fixture_data
from backend.fixture_models import FixtureBase, Score as FixtureScore
from backend.judgement_service import (
    AssignmentNotFoundError,
    AssignmentOwnershipError,
    AssignmentStatusError,
    InvalidScoreError,
    InvalidTimestampError,
    JudgementAlreadyExistsError,
    RubricNotFoundError,
    mark_assignment_in_progress,
    submit_judgement,
)


FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures.json"
CRITERIA = ("functionality", "quality", "innovation")


def uid(label: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"dogfood-judgement-test:{label}"))


@pytest.fixture
def session(tmp_path: Path):
    engine = create_engine(f"sqlite:///{tmp_path / 'judgement_test.db'}")
    Base.metadata.create_all(engine)
    with Session(engine) as test_session:
        yield test_session
    Base.metadata.drop_all(engine)
    engine.dispose()


def add_assignment(session: Session, status: str = "assigned") -> Assignment:
    organizer = Judge(
        id=uid("organizer"), name="Organizer", email="org@example.org", role="organizer"
    )
    judge = Judge(id=uid("judge"), name="Judge", email="judge@example.org", role="judge")
    event = Event(
        id=uid("event"), organizer_id=organizer.id, title="Event",
        start_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        end_at=datetime(2026, 3, 2, tzinfo=timezone.utc), status="published",
    )
    track = Track(id=uid("track"), event_id=event.id, name="Track")
    team = Team(id=uid("team"), event_id=event.id, name="Team", created_by=organizer.id)
    project = Project(
        id=uid("project"), team=team, track=track, title="Project",
        summary="Summary", repository_url="https://example.org/project",
        created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )
    criteria = [
        RubricCriterion(
            id=uid(f"criterion-{name}"), event_id=event.id, name=name,
            max_score=10, position=position,
        )
        for position, name in enumerate(CRITERIA)
    ]
    assignment = Assignment(
        id=uid("assignment"), event_id=event.id, project=project,
        judge=judge, status=status,
    )
    session.add_all([organizer, judge, event, track, team, project, *criteria, assignment])
    session.commit()
    return assignment


def test_successful_judgement_creates_raw_criterion_rows_and_completes_assignment(
    session: Session,
) -> None:
    assignment = add_assignment(session)
    submitted_at = datetime(2026, 3, 1, 12, 30, tzinfo=timezone.utc)
    comment = "  Careful review.\n"

    result = submit_judgement(
        session, assignment.id, assignment.judge_id,
        functionality=3, quality=4, innovation=5,
        comment=comment, submitted_at=submitted_at,
    )

    assert result.assignment.id == assignment.id
    assert result.assignment.status == "completed"
    assert result.assignment.overall_feedback == comment
    assert result.assignment.completed_at == submitted_at
    assert {row.criterion.name: row.raw_score for row in result.scores} == {
        "functionality": 3, "quality": 4, "innovation": 5,
    }
    assert all(row.assignment_id == assignment.id for row in result.scores)


def test_empty_comment_is_preserved(session: Session) -> None:
    assignment = add_assignment(session)
    result = submit_judgement(
        session, assignment.id, assignment.judge_id, 4, 3, 2, comment=""
    )
    assert result.assignment.overall_feedback == ""


def test_assignment_can_be_marked_in_progress_and_then_judged(session: Session) -> None:
    assignment = add_assignment(session)
    updated = mark_assignment_in_progress(session, assignment.id, assignment.judge_id)
    assert updated.status == "in_progress"
    assert updated.started_at is not None and updated.started_at.tzinfo is not None
    result = submit_judgement(session, assignment.id, assignment.judge_id, 2, 3, 4)
    assert result.assignment.status == "completed"


def test_nonexistent_assignment_is_rejected(session: Session) -> None:
    with pytest.raises(AssignmentNotFoundError):
        submit_judgement(session, uid("missing"), uid("judge"), 1, 2, 3)
    assert list(session.scalars(select(Score))) == []


def test_wrong_judge_cannot_submit_for_another_judge(session: Session) -> None:
    assignment = add_assignment(session)
    with pytest.raises(AssignmentOwnershipError):
        submit_judgement(session, assignment.id, uid("other-judge"), 1, 2, 3)
    assert list(session.scalars(select(Score))) == []


def test_completed_assignment_cannot_receive_a_second_judgement(session: Session) -> None:
    assignment = add_assignment(session)
    submit_judgement(session, assignment.id, assignment.judge_id, 1, 2, 3)
    with pytest.raises(AssignmentStatusError):
        submit_judgement(session, assignment.id, assignment.judge_id, 4, 5, 6)
    assert len(list(session.scalars(select(Score)))) == 3


def test_existing_scores_are_rejected_even_if_status_was_reset(session: Session) -> None:
    assignment = add_assignment(session)
    submit_judgement(session, assignment.id, assignment.judge_id, 1, 2, 3)
    assignment.status = "in_progress"
    session.commit()
    with pytest.raises(JudgementAlreadyExistsError):
        submit_judgement(session, assignment.id, assignment.judge_id, 4, 5, 6)


def test_database_uniqueness_constraint_prevents_duplicate_assignment_criterion(
    session: Session,
) -> None:
    assignment = add_assignment(session)
    submit_judgement(session, assignment.id, assignment.judge_id, 1, 2, 3)
    existing = session.scalar(select(Score).where(Score.assignment_id == assignment.id))
    assert existing is not None
    session.add(
        Score(
            project_id=existing.project_id, event_id=existing.event_id,
            judge_id=existing.judge_id, criterion_id=existing.criterion_id,
            assignment_id=existing.assignment_id, raw_score=8,
        )
    )
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


@pytest.mark.parametrize("invalid_score", [3.5, "4", True, None, -1, 11])
def test_invalid_or_out_of_range_scores_are_rejected(
    session: Session, invalid_score: object
) -> None:
    assignment = add_assignment(session)
    with pytest.raises(InvalidScoreError):
        submit_judgement(session, assignment.id, assignment.judge_id, invalid_score, 3, 4)
    assert session.get(Assignment, assignment.id).status == "assigned"
    assert list(session.scalars(select(Score))) == []


def test_missing_rubric_criterion_is_not_filled_with_a_fake_score(session: Session) -> None:
    assignment = add_assignment(session)
    session.query(RubricCriterion).filter_by(name="quality").delete()
    session.commit()
    with pytest.raises(RubricNotFoundError):
        submit_judgement(session, assignment.id, assignment.judge_id, 1, 2, 3)
    assert list(session.scalars(select(Score))) == []


def test_naive_submission_timestamp_is_rejected(session: Session) -> None:
    assignment = add_assignment(session)
    with pytest.raises(InvalidTimestampError):
        submit_judgement(
            session, assignment.id, assignment.judge_id, 1, 2, 3,
            submitted_at=datetime(2026, 3, 1),
        )
    assert list(session.scalars(select(Score))) == []


def test_fixture_scores_stay_in_isolated_database_when_app_scores_are_created(
    session: Session, tmp_path: Path
) -> None:
    fixture_engine = create_engine(f"sqlite:///{tmp_path / 'fixture_scores.db'}")
    FixtureBase.metadata.create_all(fixture_engine)
    try:
        with Session(fixture_engine) as fixture_session:
            load_fixture_data(fixture_session, FIXTURE_PATH)
            fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
            first_fixture = fixture["scores"][0]
            before = [
                (row.judge_id, row.project_id, row.functionality, row.quality,
                 row.innovation, row.comment)
                for row in fixture_session.scalars(select(FixtureScore).order_by(FixtureScore.id))
            ]
            assignment = add_assignment(session)
            result = submit_judgement(
                session, assignment.id, assignment.judge_id, 5, 4, 3,
                comment="New application judgement",
            )
            after = [
                (row.judge_id, row.project_id, row.functionality, row.quality,
                 row.innovation, row.comment)
                for row in fixture_session.scalars(select(FixtureScore).order_by(FixtureScore.id))
            ]
            assert before == after
            assert len(before) == len(fixture["scores"]) == 126
            assert result.assignment.status == "completed"
            assert len(result.scores) == 3
            assert first_fixture["judge"].startswith("jdg_")
    finally:
        FixtureBase.metadata.drop_all(fixture_engine)
        fixture_engine.dispose()
