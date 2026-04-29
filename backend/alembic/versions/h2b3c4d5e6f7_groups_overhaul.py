"""groups overhaul: roles, settings, invitations, ban/mute

Foundation for the full group-management spec. Bundling into one migration
because a half-applied set (roles without invitations, or settings without
the matching status enum) leaves the API in an unloadable state on Render's
free tier where rolling back mid-deploy is painful.

Adds to `groups`:
  * is_private          — public (discoverable + open join) vs. private (invite-only).
  * requires_approval   — public groups can require admin approval before a join takes effect.
  * posting_permission  — 'all' | 'admins'. Who can author posts under the group's banner. (Reserved
                          for when posts get a group_id; today the column is consumed only by the API.)
  * avatar_url, cover_url — display assets for the group profile page.
  * updated_at          — last-modified timestamp the settings panel surfaces.

Adds to `group_members`:
  * role          — 'owner' | 'admin' | 'member'. Owners can transfer/delete; admins can
                    invite, remove, promote/demote within the bounds of the owner.
  * invited_by    — optional FK to users; "you were invited by X" attribution on the member list.
  * status        — 'active' | 'banned'. Banned rows are kept (not deleted) so a re-join attempt
                    can be detected and rejected. Pending invites live in group_invitations.
  * muted         — per-member notification mute. The notifications fan-out reads this flag.

Backfill: every existing group's creator becomes role='owner' on their group_members row. Groups
without a matching row (shouldn't exist, but defensive) get one created so ownership is never lost.

New table `group_invitations`:
  * Tracks an invite from one user (admin) to another (invited_user_id) under a specific group.
  * status: 'pending' (awaiting accept/decline), 'accepted', 'declined', 'revoked'.
  * (group_id, invited_user_id) is unique only when status='pending' — Postgres partial index. On
    SQLite (used in tests) the regular unique constraint is good enough since acceptance always
    deletes the invitation row.

New table `group_join_requests`:
  * Holds requests-to-join for private OR approval-required public groups. Admin approves/denies.
  * status: 'pending' | 'approved' | 'denied'.

Note on post cascade: the spec asks "what happens to a member's posts when they're removed or
leave." Posts in BearBoard have a `category` but no `group_id`, so removing a user from a group
has no effect on their posts. Left as-is. If posts ever get group-scoped, revisit here.

Revision ID: h2b3c4d5e6f7
Revises: g1a2b3c4d5e6
Create Date: 2026-04-29 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'h2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = 'g1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- groups ---------------------------------------------------------
    op.add_column("groups", sa.Column("is_private", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("groups", sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("groups", sa.Column("posting_permission", sa.String(length=20), nullable=False, server_default="all"))
    op.add_column("groups", sa.Column("avatar_url", sa.String(length=500), nullable=True))
    op.add_column("groups", sa.Column("cover_url", sa.String(length=500), nullable=True))
    op.add_column("groups", sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True))

    # --- group_members --------------------------------------------------
    op.add_column("group_members", sa.Column("role", sa.String(length=20), nullable=False, server_default="member"))
    op.add_column("group_members", sa.Column("invited_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("group_members", sa.Column("status", sa.String(length=20), nullable=False, server_default="active"))
    op.add_column("group_members", sa.Column("muted", sa.Boolean(), nullable=False, server_default=sa.false()))

    # Backfill: creators become owners. Use a raw SQL update so we don't need
    # the ORM mapping at migration time.
    op.execute(
        """
        UPDATE group_members
        SET role = 'owner'
        WHERE EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_members.group_id
              AND groups.created_by = group_members.user_id
        )
        """
    )

    # Defensive: insert a row for any creator that doesn't already have a
    # membership (shouldn't happen with the existing create_group path, but
    # better to be safe than wake up to a group with no owner).
    op.execute(
        """
        INSERT INTO group_members (group_id, user_id, role, status)
        SELECT g.id, g.created_by, 'owner', 'active'
        FROM groups g
        WHERE g.created_by IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = g.id AND gm.user_id = g.created_by
          )
        """
    )

    # --- group_invitations ---------------------------------------------
    op.create_table(
        "group_invitations",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("invited_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("invited_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("group_id", "invited_user_id", name="uq_group_invite_user"),
    )

    # --- group_join_requests -------------------------------------------
    op.create_table(
        "group_join_requests",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("group_id", "user_id", name="uq_group_join_request_user"),
    )


def downgrade() -> None:
    op.drop_table("group_join_requests")
    op.drop_table("group_invitations")
    op.drop_column("group_members", "muted")
    op.drop_column("group_members", "status")
    op.drop_column("group_members", "invited_by")
    op.drop_column("group_members", "role")
    op.drop_column("groups", "updated_at")
    op.drop_column("groups", "cover_url")
    op.drop_column("groups", "avatar_url")
    op.drop_column("groups", "posting_permission")
    op.drop_column("groups", "requires_approval")
    op.drop_column("groups", "is_private")
