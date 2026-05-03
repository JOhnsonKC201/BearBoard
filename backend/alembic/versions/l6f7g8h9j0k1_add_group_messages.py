"""add group_messages table for BearBoard group chat

Revision ID: l6f7g8h9j0k1
Revises: k5e6f7g8h9j0
Create Date: 2026-05-03 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'l6f7g8h9j0k1'
down_revision: Union[str, Sequence[str], None] = 'k5e6f7g8h9j0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "group_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("edited_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_group_messages_id", "group_messages", ["id"], unique=False)
    op.create_index(
        "ix_group_msg_group_created",
        "group_messages",
        ["group_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_group_msg_group_created", table_name="group_messages")
    op.drop_index("ix_group_messages_id", table_name="group_messages")
    op.drop_table("group_messages")
