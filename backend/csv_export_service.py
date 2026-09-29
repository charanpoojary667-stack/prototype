"""Build deterministic organizer CSV from shared criterion-level score rows."""

import csv
from io import StringIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models import Assignment, Project, RubricCriterion, Score


CSV_COLUMNS = (
    "project_id",
    "project_title",
    "team_id",
    "track_id",
    "judge_id",
    "assignment_status",
    "functionality",
    "quality",
    "innovation",
    "comment",
    "judgement_submitted_at",
)


def build_judging_csv(session: Session) -> str:
    """Return raw scores without modifying assignments or score rows.

    Every project appears. Each assignment is one row; absent criterion scores
    stay blank. The shared schema stores the prior single comment on the
    assignment's overall_feedback field and completion time on completed_at.
    """

    statement = (
        select(Project, Assignment, Score, RubricCriterion)
        .outerjoin(Assignment, Assignment.project_id == Project.id)
        .outerjoin(Score, Score.assignment_id == Assignment.id)
        .outerjoin(RubricCriterion, RubricCriterion.id == Score.criterion_id)
        .order_by(Project.id, Assignment.judge_id, Assignment.id, RubricCriterion.position)
    )

    rows: dict[tuple[str, str | None], dict[str, object]] = {}
    for project, assignment, score, criterion in session.execute(statement):
        key = (project.id, assignment.id if assignment is not None else None)
        if key not in rows:
            rows[key] = {
                "project_id": project.id,
                "project_title": project.title,
                "team_id": project.team_id,
                "track_id": project.track_id or "",
                "judge_id": assignment.judge_id if assignment else "",
                "assignment_status": assignment.status if assignment else "",
                "functionality": "",
                "quality": "",
                "innovation": "",
                "comment": assignment.overall_feedback if assignment else "",
                "judgement_submitted_at": (
                    assignment.completed_at.isoformat()
                    if assignment and assignment.completed_at
                    else ""
                ),
            }
        if score is not None and criterion is not None:
            criterion_column = criterion.name.casefold()
            if criterion_column in ("functionality", "quality", "innovation"):
                rows[key][criterion_column] = score.raw_score

    output = StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)
    for row in rows.values():
        writer.writerow([row[column] for column in CSV_COLUMNS])
    return output.getvalue()
