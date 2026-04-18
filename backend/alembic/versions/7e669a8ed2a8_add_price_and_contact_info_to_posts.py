"""add price and contact_info to posts

Revision ID: 7e669a8ed2a8
Revises: 6837cbf1e273
Create Date: 2026-04-17 20:57:55.780768

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e669a8ed2a8'
down_revision: Union[str, Sequence[str], None] = '6837cbf1e273'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("price", sa.String(length=40), nullable=True))
    op.add_column("posts", sa.Column("contact_info", sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column("posts", "contact_info")
    op.drop_column("posts", "price")
