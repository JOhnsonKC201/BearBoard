"""add comment_votes table + upvotes/downvotes on comments

Revision ID: e8b3a4c92d17
Revises: d7f4a92c1b03
Create Date: 2026-04-25 03:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8b3a4c92d17'
down_revision: Union[str, Sequence[str], None] = 'd7f4a92c1b03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Per-user vote on a comment. Mirrors `votes` (for posts) so the
    # toggle/change/new logic is uniform across the codebase.
    op.create_table(
        "comment_votes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("comment_id", sa.Integer(), nullable=False),
        sa.Column("vote_type", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["comment_id"], ["comments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "comment_id", name="uq_user_comment_vote"),
    )
    op.create_index("ix_comment_votes_id", "comment_votes", ["id"], unique=False)
    op.create_index("ix_comment_votes_comment_id", "comment_votes", ["comment_id"], unique=False)

    # Denormalized vote counts on the comment itself so the feed and detail
    # page can sort + display scores without an extra join. server_default="0"
    # backfills existing rows in one statement.
    with op.batch_alter_table("comments") as batch_op:
        batch_op.add_column(sa.Column("upvotes", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("downvotes", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("comments") as batch_op:
        batch_op.drop_column("downvotes")
        batch_op.drop_column("upvotes")
    op.drop_index("ix_comment_votes_comment_id", table_name="comment_votes")
    op.drop_index("ix_comment_votes_id", table_name="comment_votes")
    op.drop_table("comment_votes")
