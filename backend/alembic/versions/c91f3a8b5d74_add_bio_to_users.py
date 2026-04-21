"""add bio column to users

Revision ID: c91f3a8b5d74
Revises: b4c81f7d5e92
Create Date: 2026-04-20 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c91f3a8b5d74'
down_revision: Union[str, Sequence[str], None] = 'b4c81f7d5e92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "bio")
