"""Tests for deterministic judge assignment and workload balancing."""

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.app.database import Base
from backend.app.models import (
    Assignment,
    Event,
    Judge,
    JudgeTrackEligibility,
    Project,
    Score,
    Team,
    Track,
)
from backend.assignment_service import AssignmentResult, assign_judges
from backend.fixture_loader import load_fixture_data
from backend.fixture_models import FixtureBase, Judge as FixtureJudge, Score as FixtureScore


FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures.json"


def uid(label: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"dogfood-assignment-test:{label}"))


@pytest.fixture
def session(tmp_path: Path):
    test_engine = create_engine(f"sqlite:///{tmp_path / 'assignment_test.db'}")
    Base.metadata.create_all(test_engine)
    with Session(test_engine) as test_session:
        yield test_session
    Base.metadata.drop_all(test_engine)
    test_engine.dispose()


def add_event(session: Session) -> tuple[Event, Judge]:
    organizer = Judge(
        id=uid("organizer"), name="Organizer", email="organizer@example.org", role="organizer"
    )
    event = Event(
        id=uid("event"),
        organizer_id=organizer.id,
        title="Test event",
        start_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        end_at=datetime(2026, 3, 2, tzinfo=timezone.utc),
        status="published",
    )
    session.add_all([organizer, event])
    session.flush()
    return event, organizer


def add_track(session: Session, track_id: str = "trk_01") -> Track:
    event = session.get(Event, uid("event"))
    if event is None:
        event, _ = add_event(session)
    track = Track(id=uid(track_id), event_id=event.id, name=track_id)
    session.add(track)
    session.flush()
    return track


def add_project(
    session: Session,
    project_id: str,
    track: Track,
    team_id: str = "tm_01",
) -> Project:
    team = session.get(Team, uid(team_id))
    if team is None:
        team = Team(
            id=uid(team_id),
            event_id=track.event_id,
            name=team_id,
            created_by=uid("organizer"),
        )
        session.add(team)
        session.flush()
    project = Project(
        id=uid(project_id),
        team=team,
        track=track,
        title=project_id,
        summary="Test project",
        repository_url=f"https://example.org/{project_id}",
        created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )
    session.add(project)
    session.flush()
    return project


def add_judge(session: Session, judge_id: str, eligible_tracks: list[Track]) -> Judge:
    judge = Judge(
        id=uid(judge_id),
        name=judge_id,
        email=f"{judge_id}@example.org",
        role="judge",
    )
    session.add(judge)
    session.flush()
    session.add_all(
        JudgeTrackEligibility(event_id=track.event_id, track_id=track.id, judge_id=judge.id)
        for track in eligible_tracks
    )
    session.flush()
    return judge


def get_assignments(session: Session) -> list[Assignment]:
    return list(
        session.scalars(
            select(Assignment).order_by(Assignment.project_id, Assignment.judge_id)
        )
    )


def test_only_eligible_judges_are_assigned(session: Session) -> None:
    track = add_track(session)
    other_track = add_track(session, "trk_02")
    project = add_project(session, "prj_01", track)
    eligible = add_judge(session, "jdg_01", [track])
    ineligible = add_judge(session, "jdg_02", [other_track])

    result = assign_judges(session, [project], [ineligible, eligible], 1)

    assert [(item.judge_id, item.project_id) for item in result.created_assignments] == [
        (eligible.id, project.id)
    ]
    assert result.unassigned_projects == {}


def test_multiple_judges_can_be_assigned_to_one_project(session: Session) -> None:
    track = add_track(session)
    project = add_project(session, "prj_01", track)
    judges = [add_judge(session, f"jdg_0{number}", [track]) for number in (1, 2)]

    result = assign_judges(session, [project], judges, 2)

    assert {(item.judge_id, item.project_id) for item in result.created_assignments} == {
        (judge.id, project.id) for judge in judges
    }


def test_existing_pair_is_not_assigned_twice(session: Session) -> None:
    track = add_track(session)
    project = add_project(session, "prj_01", track)
    judge = add_judge(session, "jdg_01", [track])
    session.add(
        Assignment(
            event_id=project.event_id,
            judge_id=judge.id,
            project_id=project.id,
            status="assigned",
        )
    )
    session.commit()

    result = assign_judges(session, [project], [judge], 1)

    assert result.created_assignments == []
    assert result.unassigned_projects == {}
    assert len(get_assignments(session)) == 1


def test_workload_balancing_prefers_judge_with_fewer_assignments(session: Session) -> None:
    track = add_track(session)
    existing = add_project(session, "prj_01", track)
    new_project = add_project(session, "prj_02", track)
    busy = add_judge(session, "jdg_01", [track])
    free = add_judge(session, "jdg_02", [track])
    session.add(
        Assignment(
            event_id=existing.event_id,
            judge_id=busy.id,
            project_id=existing.id,
            status="assigned",
        )
    )
    session.commit()

    result = assign_judges(session, [new_project], [busy, free], 1)

    assert [(item.judge_id, item.project_id) for item in result.created_assignments] == [
        (free.id, new_project.id)
    ]


def test_no_eligible_judge_reports_project_as_unassigned(session: Session) -> None:
    track = add_track(session)
    other_track = add_track(session, "trk_02")
    project = add_project(session, "prj_01", track)
    judge = add_judge(session, "jdg_01", [other_track])

    result = assign_judges(session, [project], [judge], 2)

    assert result.created_assignments == []
    assert result.unassigned_projects == {project.id: 2}


def test_insufficient_eligible_judges_reports_remaining_slots(session: Session) -> None:
    track = add_track(session)
    project = add_project(session, "prj_01", track)
    eligible = add_judge(session, "jdg_01", [track])
    ineligible = add_judge(session, "jdg_02", [])

    result = assign_judges(session, [project], [eligible, ineligible], 2)

    assert [(item.judge_id, item.project_id) for item in result.created_assignments] == [
        (eligible.id, project.id)
    ]
    assert result.unassigned_projects == {project.id: 1}
    assert all(item.judge_id != ineligible.id for item in get_assignments(session))


def test_new_assignments_have_assigned_status_and_no_score_rows(session: Session) -> None:
    track = add_track(session)
    project = add_project(session, "prj_01", track)
    judge = add_judge(session, "jdg_01", [track])

    result = assign_judges(session, [project], [judge], 1)

    assert result.created_assignments[0].status == "assigned"
    assert list(session.scalars(select(Score))) == []


def test_same_inputs_produce_deterministic_assignments(tmp_path: Path) -> None:
    def run_once(database_name: str) -> list[tuple[str, str]]:
        test_engine = create_engine(f"sqlite:///{tmp_path / database_name}")
        Base.metadata.create_all(test_engine)
        with Session(test_engine) as test_session:
            track = add_track(test_session)
            projects = [
                add_project(test_session, "prj_02", track),
                add_project(test_session, "prj_01", track),
            ]
            judges = [
                add_judge(test_session, "jdg_02", [track]),
                add_judge(test_session, "jdg_01", [track]),
            ]
            result = assign_judges(test_session, projects, judges, 1)
            pairs = sorted(
                (item.judge_id, item.project_id)
                for item in result.created_assignments
            )
        test_engine.dispose()
        return pairs

    assert run_once("first.db") == run_once("second.db")


def test_actual_fixture_remains_in_an_isolated_acceptance_database(tmp_path: Path) -> None:
    fixture_engine = create_engine(f"sqlite:///{tmp_path / 'fixture_acceptance.db'}")
    FixtureBase.metadata.create_all(fixture_engine)
    try:
        with Session(fixture_engine) as fixture_session:
            load_fixture_data(fixture_session, FIXTURE_PATH)
            fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
            project = next(
                row for row in fixture["projects"] if row["id"] == "prj_05"
            )
            fixture_judge_ids = {
                judge.id
                for judge in fixture_session.scalars(select(FixtureJudge))
                if project["track"] in {track.id for track in judge.eligible_tracks}
            }
            raw_scores_before = [
                (score.judge_id, score.project_id, score.functionality, score.quality,
                 score.innovation, score.comment)
                for score in fixture_session.scalars(select(FixtureScore))
            ]
            assert fixture_judge_ids
            assert len(fixture["scores"]) == len(raw_scores_before) == 126
            raw_scores_after = [
                (score.judge_id, score.project_id, score.functionality, score.quality,
                 score.innovation, score.comment)
                for score in fixture_session.scalars(select(FixtureScore))
            ]
            assert raw_scores_after == raw_scores_before
    finally:
        FixtureBase.metadata.drop_all(fixture_engine)
        fixture_engine.dispose()
