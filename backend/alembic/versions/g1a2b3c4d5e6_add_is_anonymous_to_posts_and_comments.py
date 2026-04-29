"""add is_anonymous to posts and comments

Decouples "post anonymously" from the post category. Until now anonymity was
encoded as `category='anonymous'`, which meant a Housing or Safety post
couldn't be anonymous without losing its category. The new boolean column is
the single source of truth for the API's anonymization layer.

Backfill: any existing post with category='anonymous' gets is_anonymous=true.
We leave the category column as-is (don't rewrite to 'general') so the
old data is recoverable if anyone needs it; the anon stripper now ORs the
two signals so behavior matches whichever one is set.

Revision ID: g1a2b3c4d5e6
Revises: e8b3a4c92d17
Create Date: 2026-04-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'g1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e8b3a4c92d17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "comments",
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Backfill: posts already living under category='anonymous' should keep
    # behaving identically — flip the boolean so the new code path matches.
    op.execute("UPDATE posts SET is_anonymous = TRUE WHERE category = 'anonymous'")


def downgrade() -> None:
    op.drop_column("comments", "is_anonymous")
    op.drop_column("posts", "is_anonymous")
