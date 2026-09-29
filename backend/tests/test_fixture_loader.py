"""Tests for loading the repository fixture into SQLite."""

import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from backend.fixture_models import (
    Assignment,
    Event,
    FixtureBase,
    Judgement,
    Judge,
    Project,
    Score,
    Team,
    Track,
)
from backend.fixture_loader import FixtureAlreadyLoadedError, load_fixture_data


FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures.json"


@pytest.fixture
def fixture_session(tmp_path: Path):
    """Provide an isolated temporary SQLite database."""

    database_path = tmp_path / "fixture_test.db"
    test_engine = create_engine(f"sqlite:///{database_path}")
    FixtureBase.metadata.create_all(test_engine)
    with Session(test_engine) as session:
        yield session
    FixtureBase.metadata.drop_all(test_engine)
    test_engine.dispose()


def count_rows(session: Session, model) -> int:
    return session.scalar(select(func.count()).select_from(model))


def test_fixture_records_and_relationships_are_loaded(fixture_session: Session) -> None:
    load_fixture_data(fixture_session, FIXTURE_PATH)

    assert count_rows(fixture_session, Event) == 1
    assert count_rows(fixture_session, Track) == 8
    assert count_rows(fixture_session, Judge) == 30
    assert count_rows(fixture_session, Team) == 40
    assert count_rows(fixture_session, Project) == 41
    assert count_rows(fixture_session, Score) == 126

    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    for judge_data in fixture["judges"]:
        judge = fixture_session.get(Judge, judge_data["id"])
        assert judge is not None
        assert sorted(track.id for track in judge.eligible_tracks) == sorted(
            judge_data["tracks"]
        )

    event_data = fixture["event"]
    event = fixture_session.get(Event, event_data["id"])
    assert event is not None
    assert event.name == event_data["name"]
    assert event.submissions_close.tzinfo is not None

    for team_data in fixture["teams"]:
        team = fixture_session.get(Team, team_data["id"])
        assert team is not None
        assert team.members == team_data["members"]

    for project_data in fixture["projects"]:
        project = fixture_session.get(Project, project_data["id"])
        assert project is not None
        assert project.team.id == project_data["team"]
        assert project.track.id == project_data["track"]
        assert project.submitted_at.tzinfo is not None


def test_projects_and_raw_fixture_scores_are_preserved(fixture_session: Session) -> None:
    load_fixture_data(fixture_session, FIXTURE_PATH)
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    first_project = fixture_session.get(Project, "prj_07")
    duplicate_like_project = fixture_session.get(Project, "prj_41")
    assert first_project is not None
    assert duplicate_like_project is not None
    assert first_project.id != duplicate_like_project.id
    assert first_project.team_id == duplicate_like_project.team_id == "tm_07"
    assert first_project.track_id == duplicate_like_project.track_id == "trk_03"

    loaded_scores = {
        (score.judge_id, score.project_id): (
            score.functionality,
            score.quality,
            score.innovation,
            score.comment,
        )
        for score in fixture_session.scalars(select(Score)).all()
    }
    expected_scores = {
        (data["judge"], data["project"]): (
            data["criteria"]["functionality"],
            data["criteria"]["quality"],
            data["criteria"]["innovation"],
            data["comment"],
        )
        for data in fixture["scores"]
    }
    assert loaded_scores == expected_scores
    assert len(loaded_scores) == 126
    assert any(score[3] == "" for score in loaded_scores.values())

    constant_judge_scores = [
        score
        for (judge_id, _project_id), score in loaded_scores.items()
        if judge_id == "jdg_07"
    ]
    assert len(constant_judge_scores) == 3
    assert constant_judge_scores == [(4, 4, 4, ""), (4, 4, 4, ""), (4, 4, 4, "")]
    assert count_rows(fixture_session, Judgement) == 0
    assert count_rows(fixture_session, Assignment) == 0


def test_rerun_detects_existing_fixture_without_adding_duplicates(
    fixture_session: Session,
) -> None:
    load_fixture_data(fixture_session, FIXTURE_PATH)

    with pytest.raises(FixtureAlreadyLoadedError, match="already exists"):
        load_fixture_data(fixture_session, FIXTURE_PATH)

    assert count_rows(fixture_session, Event) == 1
    assert count_rows(fixture_session, Project) == 41
    assert count_rows(fixture_session, Score) == 126
