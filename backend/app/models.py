"""SQLAlchemy mappings for the shared PostgreSQL judging schema."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    func,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    JSON,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from backend.app.database import Base


def new_id() -> str:
    """Generate UUID primary keys in the same format as the Node backend."""

    return str(uuid4())


def utc_now() -> datetime:
    """Return the current time in UTC."""

    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Keep timestamps UTC-aware in Python, including SQLite test databases."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
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


json_document = JSON().with_variant(JSONB(), "postgresql")


class User(Base):
    """An authenticated shared user; roles are read from this database row."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('organizer', 'judge', 'participant')", name="ck_users_role"
        ),
    )

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    role: Mapped[str] = mapped_column(Text, nullable=False, default="judge")
    password_hash: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)

    eligibility_links: Mapped[list["JudgeTrackEligibility"]] = relationship(
        back_populates="judge", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="judge")
    event_assignments: Mapped[list["EventJudgeAssignment"]] = relationship(
        back_populates="judge"
    )
    memberships: Mapped[list["TeamMember"]] = relationship(back_populates="user")

    @property
    def judge_id(self) -> str:
        """Compatibility name for code that treats this user as a judge."""

        return self.id


# Judge is an alias, not another mapped table. Authentication and judging share
# the one users table in the Node backend schema.
Judge = User


class Event(Base):
    """A shared event that owns tracks, teams, criteria, and assignments."""

    __tablename__ = "events"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    organizer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    venue: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    start_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    end_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    rubric: Mapped[list[dict[str, object]]] = mapped_column(
        json_document, nullable=False, default=list
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)

    __table_args__ = (
        CheckConstraint("end_at > start_at", name="ck_events_end_after_start"),
        CheckConstraint(
            "status IN ('draft', 'published', 'completed')", name="ck_events_status"
        ),
        Index("events_organizer_idx", "organizer_id"),
    )


class Track(Base):
    """A track belonging to a shared event."""

    __tablename__ = "tracks"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)

    __table_args__ = (
        UniqueConstraint("id", "event_id"),
        UniqueConstraint("event_id", "name"),
        Index("tracks_event_idx", "event_id"),
    )
    eligibility_links: Mapped[list["JudgeTrackEligibility"]] = relationship(
        back_populates="track", cascade="all, delete-orphan"
    )
    projects: Mapped[list["Project"]] = relationship(back_populates="track")


class RubricCriterion(Base):
    """A named event or track scoring criterion from the shared rubric."""

    __tablename__ = "rubric_criteria"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    track_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False))
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    max_score: Mapped[int] = mapped_column(Integer, nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    __table_args__ = (
        ForeignKeyConstraint(
            ["track_id", "event_id"], ["tracks.id", "tracks.event_id"], ondelete="CASCADE"
        ),
        CheckConstraint("max_score BETWEEN 1 AND 100", name="ck_rubric_criteria_max_score"),
        CheckConstraint("position BETWEEN 0 AND 11", name="ck_rubric_criteria_position"),
        Index(
            "rubric_criteria_event_name_idx",
            "event_id",
            func.lower(name),
            unique=True,
            postgresql_where=text("track_id IS NULL"),
            sqlite_where=text("track_id IS NULL"),
        ),
        Index(
            "rubric_criteria_track_name_idx",
            "track_id",
            func.lower(name),
            unique=True,
            postgresql_where=text("track_id IS NOT NULL"),
            sqlite_where=text("track_id IS NOT NULL"),
        ),
    )


class Team(Base):
    """A team from the shared schema; members are shared user accounts."""

    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)

    __table_args__ = (UniqueConstraint("event_id", "name"), Index("teams_event_idx", "event_id"))
    member_links: Mapped[list["TeamMember"]] = relationship(
        back_populates="team", cascade="all, delete-orphan"
    )
    projects: Mapped[list["Project"]] = relationship(back_populates="team")


class TeamMember(Base):
    """A shared team-to-user membership row."""

    __tablename__ = "team_members"

    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    __table_args__ = (
        UniqueConstraint("event_id", "user_id"),
        UniqueConstraint("team_id", "position"),
        CheckConstraint("position BETWEEN 0 AND 5", name="ck_team_members_position"),
    )
    team: Mapped[Team] = relationship(back_populates="member_links")
    user: Mapped[User] = relationship(back_populates="memberships")


class Project(Base):
    """A submission row, exposed under the judging module's Project name."""

    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    summary: Mapped[str] = mapped_column(String(2000), nullable=False)
    repository_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    demo_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)
    track_id: Mapped[str | None] = mapped_column(ForeignKey("tracks.id"))

    __table_args__ = (
        Index("submissions_team_idx", "team_id"),
        Index("submissions_track_idx", "track_id"),
    )
    team: Mapped[Team] = relationship(back_populates="projects")
    track: Mapped[Track | None] = relationship(back_populates="projects")
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="project")

    @property
    def event_id(self) -> str:
        """Get an event through the submission's team, as the schema defines it."""

        return self.team.event_id

    @property
    def repo_url(self) -> str:
        return self.repository_url

    @property
    def submitted_at(self) -> datetime:
        return self.created_at


class EventJudgeAssignment(Base):
    """A judge assigned to participate in an event."""

    __tablename__ = "judge_assignments"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), nullable=False)
    judge_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)

    __table_args__ = (UniqueConstraint("event_id", "judge_id"), Index("assignments_judge_idx", "judge_id", "event_id"))
    judge: Mapped[User] = relationship(back_populates="event_assignments")


class JudgeTrackEligibility(Base):
    """A judge's eligibility for one track in an event."""

    __tablename__ = "judge_track_eligibility"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_id)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    track_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), nullable=False)
    judge_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)

    __table_args__ = (
        ForeignKeyConstraint(
            ["track_id", "event_id"], ["tracks.id", "tracks.event_id"], ondelete="CASCADE"
        ),
        UniqueConstraint("track_id", "judge_id"),
        Index("eligibility_judge_track_idx", "judge_id", "track_id"),
    )
    judge: Mapped[User] = relationship(back_populates="eligibility_links")
    track: Mapped[Track] = relationship(back_populates="eligibility_links")


class Assignment(Base):
    """A project-level judge assignment from the shared schema."""

    __tablename__ = "judging_assignments"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_id)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[str] = mapped_column(
        "submission_id", ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False
    )
    judge_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="assigned")
    overall_feedback: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    assigned_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    __table_args__ = (
        UniqueConstraint("submission_id", "judge_id"),
        UniqueConstraint("id", "submission_id", "event_id", "judge_id"),
        CheckConstraint(
            "status IN ('assigned', 'in_progress', 'completed')", name="ck_judging_assignments_status"
        ),
        Index("judging_assignments_judge_status_idx", "judge_id", "status"),
    )
    judge: Mapped[User] = relationship(back_populates="assignments")
    project: Mapped[Project] = relationship(back_populates="assignments")
    scores: Mapped[list["Score"]] = relationship(
        back_populates="assignment", foreign_keys="Score.assignment_id"
    )


class Score(Base):
    """One raw score for a single rubric criterion on an assignment."""

    __tablename__ = "scores"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(
        "submission_id", ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False
    )
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    judge_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    criterion_id: Mapped[str] = mapped_column(ForeignKey("rubric_criteria.id"), nullable=False)
    assignment_id: Mapped[str] = mapped_column(
        "judging_assignment_id", ForeignKey("judging_assignments.id", ondelete="CASCADE"), nullable=False
    )
    raw_score: Mapped[int] = mapped_column("score", Integer, nullable=False)
    comment: Mapped[str] = mapped_column("feedback", String(2000), nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)

    __table_args__ = (
        UniqueConstraint("judging_assignment_id", "criterion_id"),
        ForeignKeyConstraint(
            ["judging_assignment_id", "submission_id", "event_id", "judge_id"],
            ["judging_assignments.id", "judging_assignments.submission_id", "judging_assignments.event_id", "judging_assignments.judge_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint("score >= 0", name="ck_scores_nonnegative"),
        Index("scores_submission_idx", "submission_id", "judge_id"),
    )
    assignment: Mapped[Assignment] = relationship(
        back_populates="scores", foreign_keys=[assignment_id]
    )
    criterion: Mapped[RubricCriterion] = relationship()


# Project and Judge are domain-friendly aliases for existing shared rows.
Submission = Project
Criterion = RubricCriterion
