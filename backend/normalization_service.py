"""Calculate deterministic per-judge, per-rubric-criterion z-scores."""

from collections import defaultdict
from dataclasses import dataclass
from math import fsum, sqrt
from typing import Iterable

from backend.app.models import Score


@dataclass(frozen=True)
class NormalizedScore:
    """A normalized result that keeps its shared raw score explicit."""

    source_id: str
    assignment_id: str
    judge_id: str
    project_id: str
    criterion_id: str
    criterion_name: str
    raw_score: int
    mean: float
    population_stddev: float
    normalized_score: float


def normalize_judging_scores(scores: Iterable[Score] = ()) -> list[NormalizedScore]:
    """Normalize only the supplied existing criterion score rows, without writes."""

    groups: dict[tuple[str, str], list[Score]] = defaultdict(list)
    for score in scores:
        groups[(score.judge_id, score.criterion_id)].append(score)

    results: list[NormalizedScore] = []
    for (_judge_id, _criterion_id), rows in sorted(groups.items()):
        rows.sort(key=lambda row: (row.project_id, row.assignment_id, row.id))
        values = [row.raw_score for row in rows]
        mean = fsum(values) / len(values)
        variance = fsum((value - mean) ** 2 for value in values) / len(values)
        population_stddev = sqrt(variance)

        for score in rows:
            normalized = (
                0.0
                if len(rows) == 1 or population_stddev == 0
                else (score.raw_score - mean) / population_stddev
            )
            results.append(
                NormalizedScore(
                    source_id=score.id,
                    assignment_id=score.assignment_id,
                    judge_id=score.judge_id,
                    project_id=score.project_id,
                    criterion_id=score.criterion_id,
                    criterion_name=score.criterion.name,
                    raw_score=score.raw_score,
                    mean=mean,
                    population_stddev=population_stddev,
                    normalized_score=normalized,
                )
            )
    return results
