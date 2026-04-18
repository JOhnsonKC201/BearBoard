"""add sos flags to posts

Revision ID: 6837cbf1e273
Revises: d26ad33d3aeb
Create Date: 2026-04-17 20:46:15.129462

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6837cbf1e273'
down_revision: Union[str, Sequence[str], None] = 'd26ad33d3aeb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("is_sos", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("posts", sa.Column("sos_resolved", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("posts", "sos_resolved")
    op.drop_column("posts", "is_sos")
