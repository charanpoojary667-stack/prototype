"""HTTP authorization and shared-token tests for private judging data."""

import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import Base
from backend.app.dependencies import get_db
from backend.app.main import app
from backend.app.models import Assignment, Event, Judge, Project, RubricCriterion, Score, Team, Track
from backend.app.security import AuthenticatedPrincipal, get_current_user, verify_shared_jwt


TOKEN_SECRET = "shared-test-secret-that-is-long-enough"
CRITERIA = ("functionality", "quality", "innovation")


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def sign_token(subject: str, **claim_changes: object) -> str:
    now = int(time.time())
    claims: dict[str, object] = {
        "sub": subject,
        "iss": "dogfood-judging-api",
        "aud": "dogfood-judging-platform",
        "iat": now,
        "exp": now + 7 * 24 * 60 * 60,
    }
    claims.update(claim_changes)
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = b64url(json.dumps(claims).encode())
    signed = f"{header}.{payload}"
    signature = b64url(hmac.new(TOKEN_SECRET.encode(), signed.encode(), hashlib.sha256).digest())
    return f"{signed}.{signature}"


@pytest.fixture
def judging_api(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    app.dependency_overrides.clear()
    monkeypatch.setattr(settings, "jwt_secret", TOKEN_SECRET)
    test_engine = create_engine(
        f"sqlite:///{tmp_path / 'authorization_test.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(test_engine)
    session = Session(test_engine)
    organizer = Judge(
        id=str(uuid4()), name="Organizer", email="organizer@example.org", role="organizer"
    )
    own_judge = Judge(id=str(uuid4()), name="Judge A", email="a@example.org", role="judge")
    peer_judge = Judge(id=str(uuid4()), name="Judge B", email="b@example.org", role="judge")
    participant = Judge(
        id=str(uuid4()), name="Participant", email="participant@example.org", role="participant"
    )
    event = Event(
        id=str(uuid4()), organizer_id=organizer.id, title="Test Event",
        start_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        end_at=datetime(2026, 3, 2, tzinfo=timezone.utc), status="published",
    )
    track = Track(id=str(uuid4()), event_id=event.id, name="Track")
    team = Team(id=str(uuid4()), event_id=event.id, name="Team", created_by=organizer.id)
    project = Project(
        id=str(uuid4()), team=team, track=track, title="Project", summary="Summary",
        repository_url="https://example.org/project",
        created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )
    criteria = [
        RubricCriterion(id=str(uuid4()), event_id=event.id, name=name, max_score=10, position=i)
        for i, name in enumerate(CRITERIA)
    ]
    own_assignment = Assignment(
        id=str(uuid4()), event_id=event.id, judge=own_judge, project=project,
        status="completed", completed_at=datetime(2026, 3, 2, tzinfo=timezone.utc),
        overall_feedback="Own judgement",
    )
    peer_assignment = Assignment(
        id=str(uuid4()), event_id=event.id, judge=peer_judge, project=project,
        status="completed", completed_at=datetime(2026, 3, 2, tzinfo=timezone.utc),
        overall_feedback="Peer judgement",
    )
    session.add_all([
        organizer, own_judge, peer_judge, participant, event, track, team, project,
        *criteria, own_assignment, peer_assignment,
    ])
    session.flush()
    own_scores = [
        Score(
            project_id=project.id, event_id=event.id, judge_id=own_judge.id,
            criterion_id=criterion.id, assignment_id=own_assignment.id, raw_score=3 + i,
        )
        for i, criterion in enumerate(criteria)
    ]
    peer_scores = [
        Score(
            project_id=project.id, event_id=event.id, judge_id=peer_judge.id,
            criterion_id=criterion.id, assignment_id=peer_assignment.id, raw_score=5 + i,
        )
        for i, criterion in enumerate(criteria)
    ]
    session.add_all([*own_scores, *peer_scores])
    session.commit()

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)
    ids = {
        "organizer": organizer.id,
        "own_judge": own_judge.id,
        "peer_judge": peer_judge.id,
        "participant": participant.id,
        "own_assignment": own_assignment.id,
        "peer_assignment": peer_assignment.id,
        "own_score": own_scores[0].id,
        "peer_score": peer_scores[0].id,
    }
    yield client, session, ids
    app.dependency_overrides.clear()
    session.close()
    Base.metadata.drop_all(test_engine)
    test_engine.dispose()


def authenticate(client: TestClient, role: str, user_id: str) -> None:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedPrincipal(
        user_id=user_id, role=role  # type: ignore[arg-type]
    )


def test_judge_can_read_only_their_own_scores_and_judgement(judging_api) -> None:
    client, _, ids = judging_api
    authenticate(client, "judge", ids["own_judge"])
    own_score = client.get(f"/judging/scores/{ids['own_score']}")
    own_judgement = client.get(f"/judging/judgements/{ids['own_assignment']}")
    score_list = client.get("/judging/scores")
    judgement_list = client.get("/judging/judgements")
    assert own_score.status_code == own_judgement.status_code == 200
    assert own_score.json()["judge_id"] == ids["own_judge"]
    assert own_judgement.json()["judge_id"] == ids["own_judge"]
    assert all(row["judge_id"] == ids["own_judge"] for row in score_list.json())
    assert [row["id"] for row in judgement_list.json()] == [ids["own_assignment"]]


def test_judge_cannot_read_peer_score_or_judgement_by_direct_id(judging_api) -> None:
    client, _, ids = judging_api
    authenticate(client, "judge", ids["own_judge"])
    assert client.get(f"/judging/scores/{ids['peer_score']}").status_code == 403
    assert client.get(f"/judging/judgements/{ids['peer_assignment']}").status_code == 403
    assert client.get(f"/judging/assignments/{ids['peer_assignment']}").status_code == 403


def test_participant_cannot_read_private_scores_or_judgements(judging_api) -> None:
    client, _, ids = judging_api
    authenticate(client, "participant", ids["participant"])
    assert client.get("/judging/scores").status_code == 403
    assert client.get(f"/judging/scores/{ids['own_score']}").status_code == 403
    assert client.get("/judging/judgements").status_code == 403
    assert client.get(f"/judging/judgements/{ids['own_assignment']}").status_code == 403


def test_organizer_can_read_all_judging_data_without_judge_identity(judging_api) -> None:
    client, _, _ = judging_api
    authenticate(client, "organizer", judging_api[2]["organizer"])
    assert len(client.get("/judging/scores").json()) == 6
    assert len(client.get("/judging/judgements").json()) == 2


def test_judge_cannot_submit_to_peer_assignment_id(judging_api) -> None:
    client, session, ids = judging_api
    authenticate(client, "judge", ids["own_judge"])
    count_before = len(list(session.scalars(select(Score))))
    response = client.post(
        f"/judging/assignments/{ids['peer_assignment']}/judgement",
        json={"functionality": 5, "quality": 5, "innovation": 5},
    )
    assert response.status_code == 403
    assert len(list(session.scalars(select(Score)))) == count_before


def test_unauthenticated_request_is_rejected_with_401(judging_api) -> None:
    client, _, ids = judging_api
    app.dependency_overrides.pop(get_current_user, None)
    assert client.get(f"/judging/scores/{ids['own_score']}").status_code == 401


def test_malformed_score_uuid_is_rejected_before_database_lookup(judging_api) -> None:
    client, _session, ids = judging_api
    authenticate(client, "judge", ids["own_judge"])
    assert client.get("/judging/scores/not-a-uuid").status_code == 422


def test_fixture_style_private_data_is_not_exposed_to_participants(judging_api) -> None:
    client, _, ids = judging_api
    authenticate(client, "participant", ids["participant"])
    response = client.get(f"/judging/scores/{ids['peer_score']}")
    assert response.status_code == 403
    assert "score" not in response.json()


def test_shared_jwt_claims_are_verified_and_role_is_loaded_from_database(judging_api) -> None:
    client, _, ids = judging_api
    response = client.get(
        "/judging/scores",
        headers={"Authorization": f"Bearer {sign_token(ids['own_judge'])}"},
    )
    assert response.status_code == 200
    assert all(row["judge_id"] == ids["own_judge"] for row in response.json())
    # A participant's token subject cannot claim the judge role: the DB role wins.
    participant = client.get(
        "/judging/scores",
        headers={"Authorization": f"Bearer {sign_token(ids['participant'])}"},
    )
    assert participant.status_code == 403


@pytest.mark.parametrize(
    "claims",
    [
        {"aud": "wrong-audience"},
        {"exp": int(time.time()) - 1},
        {"iat": int(time.time()) + 120},
    ],
)
def test_shared_jwt_rejects_invalid_claims(judging_api, claims: dict[str, object]) -> None:
    _client, _session, ids = judging_api
    with pytest.raises(HTTPException):
        verify_shared_jwt(sign_token(ids["own_judge"], **claims), TOKEN_SECRET)


def test_shared_jwt_rejects_tampered_signature(judging_api) -> None:
    _client, _session, ids = judging_api
    token = sign_token(ids["own_judge"])
    parts = token.split(".")
    altered = "A" if parts[2][0] != "A" else "B"
    with pytest.raises(HTTPException):
        verify_shared_jwt(".".join([parts[0], parts[1], altered + parts[2][1:]]), TOKEN_SECRET)
