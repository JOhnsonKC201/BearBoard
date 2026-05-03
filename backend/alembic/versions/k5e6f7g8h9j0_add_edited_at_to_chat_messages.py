"""add edited_at to chat_messages

Revision ID: k5e6f7g8h9j0
Revises: j4d5e6f7g8h9
Create Date: 2026-05-02 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'k5e6f7g8h9j0'
down_revision: Union[str, Sequence[str], None] = 'j4d5e6f7g8h9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_messages",
        sa.Column("edited_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chat_messages", "edited_at")
