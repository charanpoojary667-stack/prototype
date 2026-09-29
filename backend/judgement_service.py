"""Submit criterion-level raw scores for a judge's shared-schema assignment."""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.models import Assignment, RubricCriterion, Score, utc_now


CRITERIA_BY_NAME = ("functionality", "quality", "innovation")


class AssignmentNotFoundError(LookupError):
    """Raised when an assignment does not exist."""


class AssignmentOwnershipError(PermissionError):
    """Raised when a judge does not own the requested assignment."""


class AssignmentStatusError(ValueError):
    """Raised when an assignment is not open for the requested operation."""


class JudgementAlreadyExistsError(ValueError):
    """Raised when an assignment already has one or more submitted scores."""


class RubricNotFoundError(ValueError):
    """Raised when the event rubric does not define all supported criteria."""


class InvalidScoreError(ValueError):
    """Raised when a raw score is not an integer in its rubric range."""


class InvalidTimestampError(ValueError):
    """Raised when a supplied judgement timestamp is not timezone-aware."""


@dataclass(frozen=True)
class JudgementResult:
    """The shared assignment and its criterion-level raw score rows."""

    assignment: Assignment
    scores: list[Score]


def validate_raw_scores(values: tuple[object, object, object], criteria: list[RubricCriterion]) -> None:
    """Check integer types and the explicit maximum in each rubric criterion."""

    for name, value in zip(CRITERIA_BY_NAME, values, strict=True):
        if type(value) is not int:
            raise InvalidScoreError(f"{name} must be an integer score")
        criterion = next((item for item in criteria if item.name.casefold() == name), None)
        if criterion is None:
            raise RubricNotFoundError(f"The event rubric is missing {name!r}")
        if value < 0 or value > criterion.max_score:
            raise InvalidScoreError(
                f"{name} must be between 0 and {criterion.max_score}"
            )


def _criteria_for_assignment(
    session: Session, assignment: Assignment
) -> list[RubricCriterion]:
    project = assignment.project
    statement = select(RubricCriterion).where(
        RubricCriterion.event_id == assignment.event_id,
        RubricCriterion.track_id == project.track_id,
    )
    criteria = list(session.scalars(statement.order_by(RubricCriterion.position)))
    if not criteria:
        criteria = list(
            session.scalars(
                select(RubricCriterion)
                .where(
                    RubricCriterion.event_id == assignment.event_id,
                    RubricCriterion.track_id.is_(None),
                )
                .order_by(RubricCriterion.position)
            )
        )
    return criteria


def _get_owned_assignment(session: Session, assignment_id: str, judge_id: str) -> Assignment:
    assignment = session.get(Assignment, assignment_id)
    if assignment is None:
        raise AssignmentNotFoundError(f"Assignment {assignment_id} does not exist")
    if assignment.judge_id != judge_id:
        raise AssignmentOwnershipError("Assignment belongs to a different judge")
    return assignment


def _utc_timestamp(value: datetime | None) -> datetime:
    if value is None:
        return utc_now()
    if value.tzinfo is None or value.utcoffset() is None:
        raise InvalidTimestampError("submitted_at must include timezone information")
    return value.astimezone(timezone.utc)


def mark_assignment_in_progress(
    session: Session, assignment_id: str, judge_id: str
) -> Assignment:
    """Move an owned assignment from assigned to in_progress."""

    assignment = _get_owned_assignment(session, assignment_id, judge_id)
    if assignment.status == "in_progress":
        return assignment
    if assignment.status != "assigned":
        raise AssignmentStatusError(
            f"Cannot start an assignment with status {assignment.status!r}"
        )
    assignment.status = "in_progress"
    assignment.started_at = utc_now()
    session.commit()
    return assignment


def submit_judgement(
    session: Session,
    assignment_id: str,
    judge_id: str,
    functionality: object,
    quality: object,
    innovation: object,
    comment: str = "",
    submitted_at: datetime | None = None,
) -> JudgementResult:
    """Store raw criterion scores and mark their shared assignment complete."""

    if not isinstance(comment, str):
        raise TypeError("comment must be a string")
    assignment = _get_owned_assignment(session, assignment_id, judge_id)
    if assignment.status not in ("assigned", "in_progress"):
        raise AssignmentStatusError(
            f"Cannot submit scores for status {assignment.status!r}"
        )

    existing_score = session.scalar(
        select(Score.id).where(Score.assignment_id == assignment.id).limit(1)
    )
    if existing_score is not None:
        raise JudgementAlreadyExistsError(
            f"Assignment {assignment.id} already has scores"
        )

    criteria = _criteria_for_assignment(session, assignment)
    values = (functionality, quality, innovation)
    validate_raw_scores(values, criteria)
    score_by_name = dict(zip(CRITERIA_BY_NAME, values, strict=True))
    criterion_by_name = {item.name.casefold(): item for item in criteria}
    submitted_time = _utc_timestamp(submitted_at)

    assignment.overall_feedback = comment
    assignment.status = "completed"
    assignment.completed_at = submitted_time
    if assignment.started_at is None:
        assignment.started_at = submitted_time

    scores = [
        Score(
            project_id=assignment.project_id,
            event_id=assignment.event_id,
            judge_id=assignment.judge_id,
            criterion_id=criterion_by_name[name].id,
            assignment_id=assignment.id,
            raw_score=score_by_name[name],
            comment="",
            updated_at=submitted_time,
        )
        for name in CRITERIA_BY_NAME
    ]
    session.add_all(scores)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise JudgementAlreadyExistsError(
            f"Assignment {assignment_id} already has scores"
        ) from error
    return JudgementResult(assignment=assignment, scores=scores)
