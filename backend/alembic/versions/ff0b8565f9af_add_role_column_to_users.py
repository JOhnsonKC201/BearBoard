"""add role column to users

Revision ID: ff0b8565f9af
Revises: 7e669a8ed2a8
Create Date: 2026-04-17 21:15:49.104763

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff0b8565f9af'
down_revision: Union[str, Sequence[str], None] = '7e669a8ed2a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="student"),
    )


def downgrade() -> None:
    op.drop_column("users", "role")
