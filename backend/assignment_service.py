"""Create balanced, deterministic judge assignments."""

from collections import Counter
from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models import Assignment, Judge, Project


@dataclass
class AssignmentResult:
    """Assignments created and any requested slots left unfilled."""

    created_assignments: list[Assignment]
    unassigned_projects: dict[str, int]


def assign_judges(
    session: Session,
    projects: Iterable[Project],
    judges: Iterable[Judge],
    judges_per_project: int,
) -> AssignmentResult:
    """Assign eligible judges, prioritizing judges with the smallest workload.

    Existing assignments in the database count toward each project's target and
    each judge's workload. Projects are processed by ID; workload ties are
    broken by judge ID. Any unfilled slot counts are returned by project ID.
    """

    if judges_per_project < 1:
        raise ValueError("judges_per_project must be at least 1")

    ordered_projects = sorted(projects, key=lambda project: project.id)
    judges_by_id = {judge.id: judge for judge in judges}
    stored_assignments = session.scalars(select(Assignment)).all()

    assignment_pairs = {
        (assignment.judge_id, assignment.project_id)
        for assignment in stored_assignments
    }
    workload = Counter(assignment.judge_id for assignment in stored_assignments)
    eligible_tracks = {
        judge.id: {link.track_id for link in judge.eligibility_links}
        for judge in judges_by_id.values()
    }

    created_assignments: list[Assignment] = []
    unassigned_projects: dict[str, int] = {}

    for project in ordered_projects:
        project_assignments = {
            judge_id
            for judge_id, project_id in assignment_pairs
            if project_id == project.id
        }
        slots_needed = max(0, judges_per_project - len(project_assignments))

        candidates = [
            judge
            for judge in judges_by_id.values()
            if judge.role == "judge"
            and project.track_id is not None
            and project.track_id in eligible_tracks[judge.id]
            and (judge.id, project.id) not in assignment_pairs
        ]
        candidates.sort(key=lambda judge: (workload[judge.id], judge.id))

        for judge in candidates[:slots_needed]:
            assignment = Assignment(
                event_id=project.event_id,
                judge_id=judge.id,
                project_id=project.id,
                status="assigned",
            )
            created_assignments.append(assignment)
            session.add(assignment)
            assignment_pairs.add((judge.id, project.id))
            workload[judge.id] += 1

        remaining_slots = slots_needed - min(slots_needed, len(candidates))
        if remaining_slots:
            unassigned_projects[project.id] = remaining_slots

    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
    return AssignmentResult(created_assignments, unassigned_projects)
