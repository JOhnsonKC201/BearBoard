"""add streak fields to users

Revision ID: d26ad33d3aeb
Revises: 24a7810d7f56
Create Date: 2026-04-17 20:42:50.878780

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd26ad33d3aeb'
down_revision: Union[str, Sequence[str], None] = '24a7810d7f56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("streak_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("last_activity_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_activity_date")
    op.drop_column("users", "streak_count")
