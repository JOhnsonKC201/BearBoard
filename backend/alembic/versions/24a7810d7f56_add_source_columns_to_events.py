"""add source columns to events

Revision ID: 24a7810d7f56
Revises: 3352bef24c3b
Create Date: 2026-04-17 20:36:46.641433

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '24a7810d7f56'
down_revision: Union[str, Sequence[str], None] = '3352bef24c3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("source", sa.String(length=40), nullable=True))
    op.add_column("events", sa.Column("external_id", sa.String(length=255), nullable=True))
    op.add_column("events", sa.Column("source_url", sa.String(length=500), nullable=True))
    op.create_index("ux_events_external_id", "events", ["external_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ux_events_external_id", table_name="events")
    op.drop_column("events", "source_url")
    op.drop_column("events", "external_id")
    op.drop_column("events", "source")
