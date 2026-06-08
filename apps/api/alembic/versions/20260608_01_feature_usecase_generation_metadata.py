"""Add persisted latest use-case generation metadata to feature intents."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260608_01"
down_revision: Union[str, Sequence[str], None] = "20260607_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "feature_intents",
        sa.Column("latest_usecase_generation", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("feature_intents", "latest_usecase_generation")
