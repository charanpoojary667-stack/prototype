"""Protected routes backed by the shared PostgreSQL judging tables."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, StrictInt
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.dependencies import get_db
from backend.app.models import Assignment, Score
from backend.app.security import (
    AuthenticatedPrincipal,
    authorize_judge_data,
    get_current_user,
    require_judge_identity,
)
from backend.csv_export_service import build_judging_csv
from backend.judgement_service import (
    AssignmentNotFoundError,
    AssignmentOwnershipError,
    AssignmentStatusError,
    InvalidScoreError,
    JudgementAlreadyExistsError,
    RubricNotFoundError,
    submit_judgement,
)


router = APIRouter(prefix="/judging", tags=["judging"])
DatabaseSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[AuthenticatedPrincipal, Depends(get_current_user)]


class JudgementSubmission(BaseModel):
    """Raw criterion scores accepted by the existing judging route."""

    functionality: StrictInt
    quality: StrictInt
    innovation: StrictInt
    comment: str = ""


def _score_data(score: Score) -> dict[str, object]:
    return {
        "id": score.id,
        "judge_id": score.judge_id,
        "project_id": score.project_id,
        "assignment_id": score.assignment_id,
        "criterion_id": score.criterion_id,
        "criterion": score.criterion.name,
        "score": score.raw_score,
        "feedback": score.comment,
        "updated_at": score.updated_at,
    }


def _assignment_data(assignment: Assignment) -> dict[str, object]:
    return {
        "id": assignment.id,
        "judge_id": assignment.judge_id,
        "project_id": assignment.project_id,
        "status": assignment.status,
        "assigned_at": assignment.assigned_at,
        "started_at": assignment.started_at,
        "completed_at": assignment.completed_at,
    }


def _judgement_data(session: Session, assignment: Assignment) -> dict[str, object]:
    scores = session.scalars(
        select(Score)
        .where(Score.assignment_id == assignment.id)
        .order_by(Score.criterion_id)
    ).all()
    by_name = {score.criterion.name.casefold(): score.raw_score for score in scores}
    return {
        "id": assignment.id,
        "assignment_id": assignment.id,
        "judge_id": assignment.judge_id,
        "project_id": assignment.project_id,
        "functionality": by_name.get("functionality"),
        "quality": by_name.get("quality"),
        "innovation": by_name.get("innovation"),
        "comment": assignment.overall_feedback,
        "submitted_at": assignment.completed_at,
    }


def _judge_filter(principal: AuthenticatedPrincipal) -> str | None:
    if principal.role == "organizer":
        return None
    return require_judge_identity(principal)


@router.get("/export.csv")
def export_judging_csv(session: DatabaseSession, principal: CurrentUser) -> Response:
    """Export project judgements to CSV for organizers only."""

    if principal.role != "organizer":
        raise HTTPException(status_code=403, detail="Organizer access is required")
    return Response(
        content=build_judging_csv(session),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="judging-results.csv"'},
    )


@router.get("/scores")
def list_scores(session: DatabaseSession, principal: CurrentUser) -> list[dict[str, object]]:
    """List organizer-visible criterion scores or only the judge's own rows."""

    judge_id = _judge_filter(principal)
    statement = select(Score).order_by(Score.id)
    if judge_id is not None:
        statement = statement.where(Score.judge_id == judge_id)
    return [_score_data(score) for score in session.scalars(statement)]


@router.get("/scores/{score_id}")
def get_score(score_id: UUID, session: DatabaseSession, principal: CurrentUser) -> dict[str, object]:
    score = session.get(Score, str(score_id))
    if score is None:
        raise HTTPException(status_code=404, detail="Score not found")
    authorize_judge_data(principal, score.judge_id)
    return _score_data(score)


@router.get("/judgements")
def list_judgements(
    session: DatabaseSession, principal: CurrentUser
) -> list[dict[str, object]]:
    """List completed assignments as reconstructed judgements."""

    judge_id = _judge_filter(principal)
    statement = select(Assignment).where(Assignment.status == "completed").order_by(Assignment.id)
    if judge_id is not None:
        statement = statement.where(Assignment.judge_id == judge_id)
    return [_judgement_data(session, item) for item in session.scalars(statement)]


@router.get("/judgements/{judgement_id}")
def get_judgement(
    judgement_id: UUID, session: DatabaseSession, principal: CurrentUser
) -> dict[str, object]:
    """Read judgement state by its shared assignment UUID and check its owner."""

    assignment = session.get(Assignment, str(judgement_id))
    if assignment is None or assignment.status != "completed":
        raise HTTPException(status_code=404, detail="Judgement not found")
    authorize_judge_data(principal, assignment.judge_id)
    return _judgement_data(session, assignment)


@router.get("/assignments")
def list_assignments(
    session: DatabaseSession, principal: CurrentUser
) -> list[dict[str, object]]:
    judge_id = _judge_filter(principal)
    statement = select(Assignment).order_by(Assignment.id)
    if judge_id is not None:
        statement = statement.where(Assignment.judge_id == judge_id)
    return [_assignment_data(item) for item in session.scalars(statement)]


@router.get("/assignments/{assignment_id}")
def get_assignment(
    assignment_id: UUID, session: DatabaseSession, principal: CurrentUser
) -> dict[str, object]:
    assignment = session.get(Assignment, str(assignment_id))
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    authorize_judge_data(principal, assignment.judge_id)
    return _assignment_data(assignment)


@router.post("/assignments/{assignment_id}/judgement", status_code=status.HTTP_201_CREATED)
def create_judgement(
    assignment_id: UUID,
    body: JudgementSubmission,
    session: DatabaseSession,
    principal: CurrentUser,
) -> dict[str, object]:
    judge_id = require_judge_identity(principal)
    try:
        result = submit_judgement(
            session,
            assignment_id=str(assignment_id),
            judge_id=judge_id,
            functionality=body.functionality,
            quality=body.quality,
            innovation=body.innovation,
            comment=body.comment,
        )
    except AssignmentNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssignmentOwnershipError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except (AssignmentStatusError, JudgementAlreadyExistsError, RubricNotFoundError) as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except InvalidScoreError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return _judgement_data(session, result.assignment)
