"""SQLite-only models used to read the supplied acceptance-test fixture.

These tables are intentionally isolated from the production PostgreSQL metadata.
They do not map to the shared Node backend's users, submissions, or score tables.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Table,
    Column,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator


class FixtureBase(DeclarativeBase):
    """Separate metadata for temporary fixture acceptance tests only."""


class FixtureUTCDateTime(TypeDecorator):
    """Keep fixture timestamps UTC-aware in SQLite tests."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)
        return value.replace(tzinfo=None) if dialect.name == "sqlite" else value

    def process_result_value(self, value: datetime | None, _dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


def fixture_utc_now() -> datetime:
    return datetime.now(timezone.utc)


fixture_judge_tracks = Table(
    "judge_tracks",
    FixtureBase.metadata,
    Column("judge_id", ForeignKey("judges.id", ondelete="CASCADE"), primary_key=True),
    Column("track_id", ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_fixture_judge_tracks_track_id", "track_id"),
)


class Event(FixtureBase):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    submissions_close: Mapped[datetime] = mapped_column(FixtureUTCDateTime(), nullable=False)


class Track(FixtureBase):
    __tablename__ = "tracks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    eligible_judges: Mapped[list["Judge"]] = relationship(
        secondary=fixture_judge_tracks, back_populates="eligible_tracks"
    )
    projects: Mapped[list["Project"]] = relationship(back_populates="track")


class Judge(FixtureBase):
    __tablename__ = "judges"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    eligible_tracks: Mapped[list[Track]] = relationship(
        secondary=fixture_judge_tracks, back_populates="eligible_judges"
    )
    scores: Mapped[list["Score"]] = relationship(back_populates="judge")
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="judge")


class Team(FixtureBase):
    __tablename__ = "teams"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    members: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    projects: Mapped[list["Project"]] = relationship(back_populates="team")


class Project(FixtureBase):
    __tablename__ = "projects"
    __table_args__ = (Index("ix_fixture_projects_track_submitted_at", "track_id", "submitted_at"),)
    id: Mapped[str] = mapped_column(String, primary_key=True)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    track_id: Mapped[str] = mapped_column(ForeignKey("tracks.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(String, nullable=False)
    repo_url: Mapped[str] = mapped_column(String, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(FixtureUTCDateTime(), nullable=False)
    team: Mapped[Team] = relationship(back_populates="projects")
    track: Mapped[Track] = relationship(back_populates="projects")
    scores: Mapped[list["Score"]] = relationship(back_populates="project")
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="project")


class Score(FixtureBase):
    __tablename__ = "scores"
    __table_args__ = (
        UniqueConstraint("judge_id", "project_id", name="uq_fixture_scores_judge_project"),
        Index("ix_fixture_scores_project_id", "project_id"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    judge_id: Mapped[str] = mapped_column(ForeignKey("judges.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    functionality: Mapped[int] = mapped_column(Integer, nullable=False)
    quality: Mapped[int] = mapped_column(Integer, nullable=False)
    innovation: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(String, nullable=False, default="")
    judge: Mapped[Judge] = relationship(back_populates="scores")
    project: Mapped[Project] = relationship(back_populates="scores")


class Assignment(FixtureBase):
    __tablename__ = "assignments"
    __table_args__ = (
        UniqueConstraint("judge_id", "project_id", name="uq_fixture_assignments_judge_project"),
        CheckConstraint(
            "status IN ('assigned', 'in_progress', 'completed')",
            name="ck_fixture_assignments_status",
        ),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    judge_id: Mapped[str] = mapped_column(ForeignKey("judges.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="assigned")
    created_at: Mapped[datetime] = mapped_column(FixtureUTCDateTime(), default=fixture_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        FixtureUTCDateTime(), default=fixture_utc_now, onupdate=fixture_utc_now
    )
    judge: Mapped[Judge] = relationship(back_populates="assignments")
    project: Mapped[Project] = relationship(back_populates="assignments")
    judgement: Mapped["Judgement | None"] = relationship(back_populates="assignment", uselist=False)


class Judgement(FixtureBase):
    __tablename__ = "judgements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("assignments.id"), nullable=False, unique=True, index=True
    )
    submitted_at: Mapped[datetime] = mapped_column(FixtureUTCDateTime(), default=fixture_utc_now)
    functionality: Mapped[int] = mapped_column(Integer, nullable=False)
    quality: Mapped[int] = mapped_column(Integer, nullable=False)
    innovation: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(String, nullable=False, default="")
    assignment: Mapped[Assignment] = relationship(back_populates="judgement")
