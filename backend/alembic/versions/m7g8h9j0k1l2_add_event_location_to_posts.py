"""add event_location column to posts

Revision ID: m7g8h9j0k1l2
Revises: l6f7g8h9j0k1
Create Date: 2026-05-03 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'm7g8h9j0k1l2'
down_revision: Union[str, Sequence[str], None] = 'l6f7g8h9j0k1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("event_location", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("posts", "event_location")
