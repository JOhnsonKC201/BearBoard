"""add chat_messages table for BearChat 1:1 messaging

Revision ID: j4d5e6f7g8h9
Revises: i3c4d5e6f7g8
Create Date: 2026-04-29 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j4d5e6f7g8h9'
down_revision: Union[str, Sequence[str], None] = 'i3c4d5e6f7g8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_messages_id", "chat_messages", ["id"], unique=False)
    op.create_index(
        "ix_chat_msg_pair_created",
        "chat_messages",
        ["sender_id", "recipient_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_chat_msg_recipient_unread",
        "chat_messages",
        ["recipient_id", "read_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_chat_msg_recipient_unread", table_name="chat_messages")
    op.drop_index("ix_chat_msg_pair_created", table_name="chat_messages")
    op.drop_index("ix_chat_messages_id", table_name="chat_messages")
    op.drop_table("chat_messages")
