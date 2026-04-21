"""add image_url to events

Revision ID: a14b2f3c9e01
Revises: 24a7810d7f56
Create Date: 2026-04-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a14b2f3c9e01'
down_revision: Union[str, Sequence[str], None] = 'ff0b8565f9af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "image_url")
