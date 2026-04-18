"""add image_url to posts

Revision ID: e75a2b1fc3d8
Revises: c29f4a18d772
Create Date: 2026-04-18 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e75a2b1fc3d8'
down_revision: Union[str, Sequence[str], None] = 'c29f4a18d772'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("posts", "image_url")
