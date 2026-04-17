"""add event fields to posts

Revision ID: 73207aaf84ad
Revises: da65fc1b9856
Create Date: 2026-04-17 12:14:52.504498

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '73207aaf84ad'
down_revision: Union[str, Sequence[str], None] = 'da65fc1b9856'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("event_date", sa.Date(), nullable=True))
    op.add_column("posts", sa.Column("event_time", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("posts", "event_time")
    op.drop_column("posts", "event_date")
