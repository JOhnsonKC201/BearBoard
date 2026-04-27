"""widen users.avatar_url to TEXT to fit base64 data URLs

Revision ID: b8c2e7d1a4f3
Revises: f3a1b2c4d5e6
Create Date: 2026-04-24 18:00:00.000000

The original column was VARCHAR(500), which is fine for an external URL but
nowhere near enough room for an inline base64 data URL (a 1.2 MB JPEG comes
out at ~1.6 MB once base64-encoded). Profile photos are now stored as
data URLs in this column so they sync across devices and surface on every
post/comment author chip.

On MySQL we widen to MEDIUMTEXT (16 MB) since plain TEXT is 64 KB. Other
dialects get plain Text, which is unbounded.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision: str = 'b8c2e7d1a4f3'
down_revision: Union[str, Sequence[str], None] = 'f3a1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "mysql":
        op.alter_column(
            "users",
            "avatar_url",
            existing_type=sa.String(length=500),
            type_=mysql.MEDIUMTEXT(),
            existing_nullable=True,
        )
    else:
        op.alter_column(
            "users",
            "avatar_url",
            existing_type=sa.String(length=500),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade() -> None:
    # Truncating a populated TEXT column back into VARCHAR(500) would silently
    # drop every uploaded photo, so the downgrade is a no-op rather than a
    # data-destroying ALTER. Roll back by restoring from a backup if needed.
    pass
