"""add professors and professor_ratings tables

Revision ID: c29f4a18d772
Revises: a14b2f3c9e01
Create Date: 2026-04-18 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c29f4a18d772'
down_revision: Union[str, Sequence[str], None] = 'a14b2f3c9e01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "professors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_professors_name", "professors", ["name"])

    op.create_table(
        "professor_ratings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "professor_id",
            sa.Integer(),
            sa.ForeignKey("professors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=True),
        sa.Column("would_take_again", sa.Boolean(), nullable=True),
        sa.Column("course_code", sa.String(length=30), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("professor_id", "user_id", name="uq_prof_rating_user"),
    )
    op.create_index("ix_prof_ratings_prof", "professor_ratings", ["professor_id"])


def downgrade() -> None:
    op.drop_index("ix_prof_ratings_prof", table_name="professor_ratings")
    op.drop_table("professor_ratings")
    op.drop_index("ix_professors_name", table_name="professors")
    op.drop_table("professors")
