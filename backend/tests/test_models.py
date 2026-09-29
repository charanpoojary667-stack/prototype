"""Tests for mappings to the shared PostgreSQL schema."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import Uuid, create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.database import Base
from backend.app.models import (
    Assignment,
    Event,
    Judge,
    JudgeTrackEligibility,
    Project,
    RubricCriterion,
    Score,
    Team,
    TeamMember,
    Track,
)


@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as test_session:
        yield test_session
    Base.metadata.drop_all(engine)
    engine.dispose()


def make_graph(session: Session):
    event_id, organizer_id, judge_id, track_id, team_id, project_id = [
        str(uuid4()) for _ in range(6)
    ]
    organizer = Judge(
        id=organizer_id,
        name="Organizer",
        email=f"{organizer_id}@example.org",
        role="organizer",
    )
    judge = Judge(
        id=judge_id,
        name="Judge",
        email=f"{judge_id}@example.org",
        role="judge",
    )
    event = Event(
        id=event_id,
        organizer_id=organizer_id,
        title="Test event",
        start_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        end_at=datetime(2026, 3, 2, tzinfo=timezone.utc),
        status="published",
    )
    track = Track(id=track_id, event_id=event_id, name="Track one")
    team = Team(id=team_id, event_id=event_id, name="Team one", created_by=organizer_id)
    project = Project(
        id=project_id,
        team=team,
        track=track,
        title="Project one",
        summary="Summary",
        repository_url="https://example.org/repo",
        created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )
    criteria = [
        RubricCriterion(
            id=str(uuid4()),
            event_id=event_id,
            name=name,
            max_score=10,
            position=index,
        )
        for index, name in enumerate(("functionality", "quality", "innovation"))
    ]
    eligibility = JudgeTrackEligibility(
        event_id=event_id,
        track_id=track_id,
        judge=judge,
    )
    session.add_all([organizer, judge, event, track, team, project, *criteria, eligibility])
    session.commit()
    assignment = Assignment(
        event_id=event_id,
        project=project,
        judge=judge,
        status="assigned",
    )
    session.add(assignment)
    session.commit()
    return event, organizer, judge, track, team, project, criteria, assignment


def test_metadata_uses_shared_tables_without_duplicate_conceptual_tables(
    session: Session,
) -> None:
    table_names = set(inspect(session.get_bind()).get_table_names())
    assert table_names == {
        "users",
        "events",
        "tracks",
        "rubric_criteria",
        "teams",
        "team_members",
        "submissions",
        "judge_assignments",
        "judge_track_eligibility",
        "judging_assignments",
        "scores",
    }
    assert not {"judges", "projects", "assignments", "judgements", "judge_tracks"} & table_names


def test_shared_column_names_and_uuid_types_match_schema(session: Session) -> None:
    metadata = Base.metadata.tables
    assert set(metadata["users"].columns.keys()) == {
        "id", "name", "email", "role", "password_hash", "created_at"
    }
    assert set(metadata["submissions"].columns.keys()) == {
        "id", "team_id", "title", "summary", "repository_url", "demo_url",
        "created_at", "track_id",
    }
    assert set(metadata["judging_assignments"].columns.keys()) == {
        "id", "event_id", "submission_id", "judge_id", "status", "overall_feedback",
        "assigned_at", "started_at", "completed_at",
    }
    assert set(metadata["scores"].columns.keys()) == {
        "id", "submission_id", "event_id", "judge_id", "criterion_id",
        "judging_assignment_id", "score", "feedback", "updated_at",
    }
    for table_name in (
        "users", "events", "tracks", "rubric_criteria", "teams", "submissions",
        "judge_assignments", "judge_track_eligibility", "judging_assignments", "scores",
    ):
        assert isinstance(metadata[table_name].c.id.type, Uuid)


def test_user_track_membership_and_submission_relationships_work(session: Session) -> None:
    event, organizer, judge, track, team, project, _criteria, assignment = make_graph(session)

    eligibility = session.query(JudgeTrackEligibility).one()
    assert eligibility.judge.id == judge.id
    assert eligibility.track.id == track.id
    assert project.team.id == team.id
    assert project.track.id == track.id
    assert project.event_id == event.id
    assert assignment.project_id == project.id
    assert organizer.role == "organizer"
    assert project.__tablename__ == "submissions"


def test_memberships_and_multiple_assignments_use_existing_schema(session: Session) -> None:
    event, organizer, judge, _track, team, project, _criteria, assignment = make_graph(session)
    member = Judge(
        id=str(uuid4()), name="Participant", email="participant@example.org", role="participant"
    )
    session.add(member)
    session.add(TeamMember(team=team, event_id=event.id, user=member, position=0))
    another = Judge(id=str(uuid4()), name="Another", email="another@example.org", role="judge")
    session.add(another)
    second_assignment = Assignment(
        event_id=event.id, project=project, judge=another, status="assigned"
    )
    session.add(second_assignment)
    session.commit()
    assert team.member_links[0].user.id == member.id
    assert {assignment.judge_id, second_assignment.judge_id} == {judge.id, another.id}
    assert organizer.id == team.created_by


def test_scores_are_unique_per_assignment_and_criterion(session: Session) -> None:
    _event, _organizer, judge, _track, _team, project, criteria, assignment = make_graph(session)
    score = Score(
        project_id=project.id,
        event_id=assignment.event_id,
        judge_id=judge.id,
        criterion_id=criteria[0].id,
        assignment_id=assignment.id,
        raw_score=8,
    )
    session.add(score)
    session.commit()
    session.add(
        Score(
            project_id=project.id,
            event_id=assignment.event_id,
            judge_id=judge.id,
            criterion_id=criteria[0].id,
            assignment_id=assignment.id,
            raw_score=9,
        )
    )
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_assignment_pair_is_unique(session: Session) -> None:
    _event, _organizer, judge, _track, _team, project, _criteria, _assignment = make_graph(
        session
    )
    session.add(
        Assignment(event_id=project.event_id, project=project, judge=judge, status="assigned")
    )
    with pytest.raises(IntegrityError):
        session.commit()
