"""Tests for deterministic normalization of shared criterion-level scores."""

from datetime import datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.app.database import Base
from backend.app.models import Assignment, Event, Judge, Project, RubricCriterion, Score, Team, Track
from backend.fixture_loader import load_fixture_data
from backend.fixture_models import FixtureBase, Score as FixtureScore
from backend.judgement_service import submit_judgement
from backend.normalization_service import NormalizedScore, normalize_judging_scores


FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures.json"


def uid(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"dogfood-normalization-test:{value}"))


@pytest.fixture
def session(tmp_path: Path):
    engine = create_engine(f"sqlite:///{tmp_path / 'normalization_test.db'}")
    Base.metadata.create_all(engine)
    with Session(engine) as test_session:
        yield test_session
    Base.metadata.drop_all(engine)
    engine.dispose()


def make_score(
    score_id: str,
    judge_id: str,
    project_id: str,
    criterion_name: str,
    raw_score: int,
) -> Score:
    criterion = RubricCriterion(
        id=uid(f"criterion-{criterion_name}"),
        event_id=uid("event"),
        name=criterion_name,
        max_score=10,
        position=0,
    )
    return Score(
        id=uid(score_id),
        project_id=uid(project_id),
        event_id=uid("event"),
        judge_id=uid(judge_id),
        criterion_id=criterion.id,
        assignment_id=uid(f"assignment-{score_id}"),
        raw_score=raw_score,
        criterion=criterion,
    )


def result_map(results: list[NormalizedScore]) -> dict[str, NormalizedScore]:
    return {result.source_id: result for result in results}


def test_basic_z_score_reports_group_statistics_and_normalized_values() -> None:
    scores = [
        make_score("s1", "judge-a", "p1", "functionality", 2),
        make_score("s2", "judge-a", "p2", "functionality", 4),
        make_score("s3", "judge-a", "p3", "functionality", 6),
    ]
    results = result_map(normalize_judging_scores(scores))
    assert results[uid("s1")].mean == pytest.approx(4.0)
    assert results[uid("s1")].population_stddev == pytest.approx((8 / 3) ** 0.5)
    assert results[uid("s1")].normalized_score == pytest.approx(-1.22474487139)
    assert results[uid("s2")].normalized_score == pytest.approx(0.0)
    assert results[uid("s3")].normalized_score == pytest.approx(1.22474487139)


def test_population_standard_deviation_is_used() -> None:
    scores = [
        make_score("s1", "judge-a", "p1", "functionality", 1),
        make_score("s2", "judge-a", "p2", "functionality", 3),
    ]
    results = result_map(normalize_judging_scores(scores))
    assert results[uid("s1")].mean == 2.0
    assert results[uid("s1")].population_stddev == 1.0
    assert results[uid("s1")].normalized_score == -1.0
    assert results[uid("s2")].normalized_score == 1.0


def test_zero_variation_returns_zero_for_every_observation() -> None:
    scores = [
        make_score("s1", "judge-a", "p1", "quality", 4),
        make_score("s2", "judge-a", "p2", "quality", 4),
    ]
    results = normalize_judging_scores(scores)
    assert len(results) == 2
    assert all(result.population_stddev == result.normalized_score == 0 for result in results)


def test_single_observation_normalizes_to_zero() -> None:
    results = normalize_judging_scores(
        [make_score("s1", "judge-a", "p1", "innovation", 7)]
    )
    assert len(results) == 1
    assert results[0].normalized_score == 0


def test_missing_score_rows_are_excluded() -> None:
    scores = [
        make_score("s1", "judge-a", "p1", "functionality", 2),
        make_score("s2", "judge-a", "p2", "functionality", 4),
    ]
    results = normalize_judging_scores(scores)
    assert len(results) == 2
    assert {result.raw_score for result in results} == {2, 4}
    assert {result.mean for result in results} == {3.0}


def test_each_judge_is_normalized_independently() -> None:
    scores = [
        make_score("s1", "judge-a", "p1", "functionality", 2),
        make_score("s2", "judge-a", "p2", "functionality", 4),
        make_score("s3", "judge-b", "p3", "functionality", 100),
    ]
    results = normalize_judging_scores(scores)
    judge_a = {
        row.source_id: row.normalized_score
        for row in results
        if row.judge_id == uid("judge-a")
    }
    judge_b = next(r for r in results if r.judge_id == uid("judge-b"))
    assert judge_a == {uid("s1"): -1.0, uid("s2"): 1.0}
    assert judge_b.mean == 100.0 and judge_b.normalized_score == 0.0


def test_each_criterion_is_normalized_independently() -> None:
    scores = [
        make_score("s1", "judge-a", "p1", "functionality", 2),
        make_score("s2", "judge-a", "p2", "functionality", 4),
        make_score("s3", "judge-a", "p1", "quality", 10),
        make_score("s4", "judge-a", "p2", "quality", 10),
    ]
    results = result_map(normalize_judging_scores(scores))
    assert results[uid("s1")].normalized_score == -1.0
    assert results[uid("s2")].normalized_score == 1.0
    assert results[uid("s3")].normalized_score == 0.0
    assert results[uid("s4")].normalized_score == 0.0


def test_same_input_produces_same_sorted_output() -> None:
    scores = [
        make_score("s2", "judge-b", "p2", "functionality", 4),
        make_score("s1", "judge-a", "p1", "functionality", 2),
        make_score("s3", "judge-a", "p2", "functionality", 6),
    ]
    assert normalize_judging_scores(scores) == normalize_judging_scores(reversed(scores))


def test_empty_input_returns_empty_result() -> None:
    assert normalize_judging_scores() == []


def test_jdg_07_fixture_edge_case_stays_in_fixture_schema(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'fixture_normalization_test.db'}")
    FixtureBase.metadata.create_all(engine)
    try:
        with Session(engine) as fixture_session:
            load_fixture_data(fixture_session, FIXTURE_PATH)
            rows = list(
                fixture_session.scalars(
                    select(FixtureScore).where(FixtureScore.judge_id == "jdg_07")
                )
            )
            assert len(rows) == 3
            assert all(
                (row.functionality, row.quality, row.innovation) == (4, 4, 4)
                for row in rows
            )
    finally:
        FixtureBase.metadata.drop_all(engine)
        engine.dispose()


def test_normalization_does_not_write_or_change_shared_raw_scores(session: Session) -> None:
    organizer = Judge(id=uid("organizer"), name="Org", email="org@example.org", role="organizer")
    judge = Judge(id=uid("judge"), name="Judge", email="judge@example.org", role="judge")
    event = Event(
        id=uid("event"), organizer_id=organizer.id, title="Event",
        start_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        end_at=datetime(2026, 3, 2, tzinfo=timezone.utc), status="published",
    )
    track = Track(id=uid("track"), event_id=event.id, name="Track")
    team = Team(id=uid("team"), event_id=event.id, name="Team", created_by=organizer.id)
    project = Project(
        id=uid("project"), team=team, track=track, title="Project", summary="Summary",
        repository_url="", created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )
    criteria = [
        RubricCriterion(id=uid(name), event_id=event.id, name=name, max_score=10, position=i)
        for i, name in enumerate(("functionality", "quality", "innovation"))
    ]
    assignment = Assignment(
        id=uid("assignment"), event_id=event.id, judge=judge, project=project, status="assigned"
    )
    session.add_all([organizer, judge, event, track, team, project, *criteria, assignment])
    session.commit()
    result = submit_judgement(session, assignment.id, judge.id, 5, 1, 3, "raw comment")

    def raw_rows():
        return [
            (row.id, row.raw_score, row.comment, row.assignment_id)
            for row in session.scalars(select(Score).order_by(Score.id))
        ]

    before = raw_rows()
    normalized = normalize_judging_scores(result.scores)
    assert len(normalized) == 3
    assert raw_rows() == before
    assert len(raw_rows()) == 3
