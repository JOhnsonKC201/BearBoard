"""add post_reports table

Revision ID: n8h9j0k1l2m3
Revises: l6f7g8h9j0k1
Create Date: 2026-05-04 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'n8h9j0k1l2m3'
down_revision: Union[str, Sequence[str], None] = 'l6f7g8h9j0k1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "post_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("reporter_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_by", sa.Integer(), nullable=True),
        sa.Column("resolution", sa.String(length=40), nullable=True),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["resolved_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("post_id", "reporter_id", name="uq_post_reports_unique"),
    )
    op.create_index("ix_post_reports_id", "post_reports", ["id"], unique=False)
    op.create_index("ix_post_reports_post_id", "post_reports", ["post_id"], unique=False)
    op.create_index(
        "ix_post_reports_reporter_id", "post_reports", ["reporter_id"], unique=False
    )
    op.create_index(
        "ix_post_reports_status_created",
        "post_reports",
        ["status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_post_reports_status_created", table_name="post_reports")
    op.drop_index("ix_post_reports_reporter_id", table_name="post_reports")
    op.drop_index("ix_post_reports_post_id", table_name="post_reports")
    op.drop_index("ix_post_reports_id", table_name="post_reports")
    op.drop_table("post_reports")
