"""add parent_id to comments

Revision ID: d7f4a92c1b03
Revises: b8c2e7d1a4f3
Create Date: 2026-04-25 02:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7f4a92c1b03'
down_revision: Union[str, Sequence[str], None] = 'b8c2e7d1a4f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Self-referential FK so comments can reply to other comments. Nullable
    # because top-level comments have no parent. ON DELETE CASCADE covers
    # Postgres; SQLite ignores it unless PRAGMA foreign_keys=ON, so the
    # delete route also cascades replies in application code.
    with op.batch_alter_table("comments") as batch_op:
        batch_op.add_column(sa.Column("parent_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_comments_parent_id",
            "comments",
            ["parent_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index(
            "ix_comments_parent_id",
            ["parent_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("comments") as batch_op:
        batch_op.drop_index("ix_comments_parent_id")
        batch_op.drop_constraint("fk_comments_parent_id", type_="foreignkey")
        batch_op.drop_column("parent_id")
