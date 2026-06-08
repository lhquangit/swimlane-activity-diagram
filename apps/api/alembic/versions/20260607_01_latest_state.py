"""Create latest-state persistence schema."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260607_01"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def timestamp_columns() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "app_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clerk_user_id", sa.String(255), nullable=False, unique=True),
        sa.Column("email", sa.String(320)),
        sa.Column("display_name", sa.String(255)),
        sa.Column("role", sa.String(20), server_default="user", nullable=False),
        *timestamp_columns(),
        sa.CheckConstraint("role in ('user', 'admin')", name="ck_app_users_role"),
    )
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("app_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        *timestamp_columns(),
    )
    op.create_index("idx_projects_app_user_updated", "projects", ["app_user_id", "updated_at"])
    op.create_table(
        "specs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("project_summary", sa.Text(), server_default="", nullable=False),
        sa.Column("business_context", sa.Text()),
        sa.Column("target_users", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("business_rules", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("glossary", postgresql.JSONB(), server_default="[]", nullable=False),
        *timestamp_columns(),
    )
    op.create_table(
        "feature_intents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("spec_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("specs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("feature_summary", sa.Text(), nullable=False),
        sa.Column("actors", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("trigger", sa.Text()),
        sa.Column("inputs", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("outputs", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("constraints", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("assumptions", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("systems_involved", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("success_outcome", sa.Text()),
        *timestamp_columns(),
    )
    op.create_index("idx_feature_intents_spec_updated", "feature_intents", ["spec_id", "updated_at"])
    op.create_table(
        "use_cases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("feature_intent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("feature_intents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("use_case_key", sa.String(100), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("review_status", sa.String(20), server_default="draft", nullable=False),
        *timestamp_columns(),
        sa.UniqueConstraint("feature_intent_id", "use_case_key", name="uq_use_cases_feature_key"),
        sa.CheckConstraint("review_status in ('draft', 'reviewed', 'approved')", name="ck_use_cases_review_status"),
    )
    op.create_table(
        "diagrams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("use_case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("use_cases.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("graph_data", postgresql.JSONB(), nullable=False),
        sa.Column("lanes_data", postgresql.JSONB(), nullable=False),
        sa.Column("lane_height", sa.Integer(), nullable=False),
        sa.Column("source_use_case_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("semantic_edited", sa.Boolean(), server_default=sa.false(), nullable=False),
        *timestamp_columns(),
    )
    op.create_table(
        "brd_docs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("diagram_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("diagrams.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("structured_spec", postgresql.JSONB(), nullable=False),
        sa.Column("markdown_content", sa.Text(), nullable=False),
        sa.Column("warnings", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("template", sa.String(20), server_default="default", nullable=False),
        sa.Column("source_diagram_updated_at", sa.DateTime(timezone=True), nullable=False),
        *timestamp_columns(),
        sa.CheckConstraint("template in ('default', 'full')", name="ck_brd_docs_template"),
    )


def downgrade() -> None:
    op.drop_table("brd_docs")
    op.drop_table("diagrams")
    op.drop_table("use_cases")
    op.drop_index("idx_feature_intents_spec_updated", table_name="feature_intents")
    op.drop_table("feature_intents")
    op.drop_table("specs")
    op.drop_index("idx_projects_app_user_updated", table_name="projects")
    op.drop_table("projects")
    op.drop_table("app_users")
