from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AppUser(TimestampMixin, Base):
    __tablename__ = "app_users"
    __table_args__ = (CheckConstraint("role in ('user', 'admin')", name="ck_app_users_role"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_user_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    email: Mapped[str | None] = mapped_column(String(320))
    display_name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default="user")

    projects: Mapped[list[Project]] = relationship(
        back_populates="app_user", cascade="all, delete-orphan", passive_deletes=True
    )


class Project(TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        Index("idx_projects_app_user_updated", "app_user_id", "updated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    app_user: Mapped[AppUser] = relationship(back_populates="projects")
    spec: Mapped[Spec] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )


class Spec(TimestampMixin, Base):
    __tablename__ = "specs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    project_summary: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    business_context: Mapped[str | None] = mapped_column(Text)
    target_users: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    business_rules: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    glossary: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    project: Mapped[Project] = relationship(back_populates="spec")
    feature_intents: Mapped[list[FeatureIntentModel]] = relationship(
        back_populates="spec", cascade="all, delete-orphan", passive_deletes=True
    )


class FeatureIntentModel(TimestampMixin, Base):
    __tablename__ = "feature_intents"
    __table_args__ = (Index("idx_feature_intents_spec_updated", "spec_id", "updated_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spec_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("specs.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    feature_summary: Mapped[str] = mapped_column(Text, nullable=False)
    actors: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    trigger: Mapped[str | None] = mapped_column(Text)
    inputs: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    outputs: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    constraints: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    assumptions: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    systems_involved: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    success_outcome: Mapped[str | None] = mapped_column(Text)

    spec: Mapped[Spec] = relationship(back_populates="feature_intents")
    use_cases: Mapped[list[UseCaseModel]] = relationship(
        back_populates="feature_intent", cascade="all, delete-orphan", passive_deletes=True
    )


class UseCaseModel(TimestampMixin, Base):
    __tablename__ = "use_cases"
    __table_args__ = (
        UniqueConstraint("feature_intent_id", "use_case_key", name="uq_use_cases_feature_key"),
        CheckConstraint(
            "review_status in ('draft', 'reviewed', 'approved')",
            name="ck_use_cases_review_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_intent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("feature_intents.id", ondelete="CASCADE"),
        nullable=False,
    )
    use_case_key: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    review_status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="draft")

    feature_intent: Mapped[FeatureIntentModel] = relationship(back_populates="use_cases")
    diagram: Mapped[Diagram] = relationship(
        back_populates="use_case",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )


class Diagram(TimestampMixin, Base):
    __tablename__ = "diagrams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    use_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("use_cases.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    graph_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    lanes_data: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    lane_height: Mapped[int] = mapped_column(Integer, nullable=False)
    source_use_case_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    semantic_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    use_case: Mapped[UseCaseModel] = relationship(back_populates="diagram")
    brd_doc: Mapped[BrdDoc] = relationship(
        back_populates="diagram",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )


class BrdDoc(TimestampMixin, Base):
    __tablename__ = "brd_docs"
    __table_args__ = (
        CheckConstraint("template in ('default', 'full')", name="ck_brd_docs_template"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    diagram_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("diagrams.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    structured_spec: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    markdown_content: Mapped[str] = mapped_column(Text, nullable=False)
    warnings: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    template: Mapped[str] = mapped_column(String(20), nullable=False, server_default="default")
    source_diagram_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    diagram: Mapped[Diagram] = relationship(back_populates="brd_doc")
