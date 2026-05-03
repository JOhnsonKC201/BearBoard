"""add attachment columns to group_messages

Lets group members share a file (notes, study guide PDF, image) inside
a group chat — the "share notes" half of US-2.

The existing `body` column was NOT NULL; we relax it so a message can be
attachment-only. Application code enforces "body OR attachment_url"
(never neither).

Revision ID: n8h9j0k1l2m3
Revises: l6f7g8h9j0k1
Create Date: 2026-05-03 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'n8h9j0k1l2m3'
down_revision: Union[str, Sequence[str], None] = 'l6f7g8h9j0k1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "group_messages",
        sa.Column("attachment_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "group_messages",
        sa.Column("attachment_name", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "group_messages",
        sa.Column("attachment_kind", sa.String(length=20), nullable=True),
    )
    # Relax body so attachment-only messages are valid. Existing rows are
    # already non-NULL, so this is a one-way safe widening.
    with op.batch_alter_table("group_messages") as batch:
        batch.alter_column("body", existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("group_messages") as batch:
        batch.alter_column("body", existing_type=sa.Text(), nullable=False)
    op.drop_column("group_messages", "attachment_kind")
    op.drop_column("group_messages", "attachment_name")
    op.drop_column("group_messages", "attachment_url")
