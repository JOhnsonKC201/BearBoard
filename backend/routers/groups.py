"""Group management endpoints.

Split out of routers/extras.py so the file size stays sane and the four
distinct concern areas (admin permissions, settings, invitations,
edge-case guards) live near each other.

Permission tiers used throughout:
    - owner   : creator of the group; only one per group. Required for transfer + delete.
    - admin   : owner or any member with role='admin'. Required for invite, remove,
                promote/demote (within bounds), settings edits, ban management.
    - member  : any active group_members row. Required for member list + leave + mute.
    - public  : anyone (logged-in or not). Required for browse + group detail.

Anyone can read a group's PUBLIC profile (name/description/member_count). The
member list is members-only so we don't accidentally enumerate accounts to
non-members. Private groups still appear in the API by id (for invite links),
but their member list is members-only too.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from models.group import Group
from models.group_invitation import GroupInvitation
from models.group_join_request import GroupJoinRequest
from models.group_member import GroupMember
from models.user import User
from routers.auth import get_current_user_dep


router = APIRouter(prefix="/api/groups", tags=["groups"])


# ============================================================================
# Schemas (kept local — these are group-specific and don't bleed into other
# routers).
# ============================================================================

class GroupSettings(BaseModel):
    """Subset of fields a group admin can update via PATCH /api/groups/{id}.
    All optional so the client can send only what changed."""
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=2000)
    course_code: Optional[str] = Field(default=None, max_length=20)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    cover_url: Optional[str] = Field(default=None, max_length=500)
    is_private: Optional[bool] = None
    requires_approval: Optional[bool] = None
    posting_permission: Optional[str] = Field(default=None, pattern="^(all|admins)$")


class GroupDetailResponse(BaseModel):
    id: int
    name: str
    course_code: Optional[str] = None
    description: Optional[str] = None
    member_count: int
    is_private: bool
    requires_approval: bool
    posting_permission: str
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    created_by: Optional[int] = None
    # Convenience for the UI: viewer's relationship to this group. None if
    # logged-out or not a member.
    viewer_role: Optional[str] = None
    viewer_membership_status: Optional[str] = None
    viewer_muted: bool = False
    has_pending_request: bool = False
    has_pending_invite: bool = False

    class Config:
        from_attributes = True


class MemberInfo(BaseModel):
    user_id: int
    name: str
    avatar_url: Optional[str] = None
    role: str
    status: str
    joined_at: Optional[str] = None
    invited_by_id: Optional[int] = None
    invited_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class InvitationInfo(BaseModel):
    id: int
    group_id: int
    group_name: str
    invited_user_id: int
    invited_user_name: Optional[str] = None
    invited_by_id: int
    invited_by_name: Optional[str] = None
    status: str
    created_at: Optional[str] = None


class JoinRequestInfo(BaseModel):
    id: int
    group_id: int
    user_id: int
    user_name: Optional[str] = None
    status: str
    created_at: Optional[str] = None


class InviteRequest(BaseModel):
    """Admin invites a user by username (case-insensitive). Email-based
    invites would require a confirmed-email + verification flow; deferred."""
    username: str = Field(min_length=1, max_length=80)


class TransferRequest(BaseModel):
    new_owner_user_id: int


# ============================================================================
# Helpers
# ============================================================================

def _get_group_or_404(db: Session, group_id: int) -> Group:
    g = db.query(Group).filter(Group.id == group_id).one_or_none()
    if g is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return g


def _membership(db: Session, group_id: int, user_id: int) -> Optional[GroupMember]:
    return (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .one_or_none()
    )


def _require_admin(db: Session, group: Group, user: User) -> GroupMember:
    """Return the membership row if the user is an owner OR admin of the group;
    raise 403 otherwise. Site-wide moderators/admins are also allowed so platform
    staff can intervene without being a member of every group."""
    if user.role in ("admin", "moderator"):
        # Synthesize an owner-equivalent. We don't persist this; it's only used
        # for permission checks within this request.
        return GroupMember(group_id=group.id, user_id=user.id, role="owner", status="active")
    m = _membership(db, group.id, user.id)
    if m is None or m.status != "active" or m.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Group admin permission required")
    return m


def _require_owner(db: Session, group: Group, user: User) -> GroupMember:
    if user.role in ("admin", "moderator"):
        return GroupMember(group_id=group.id, user_id=user.id, role="owner", status="active")
    m = _membership(db, group.id, user.id)
    if m is None or m.status != "active" or m.role != "owner":
        raise HTTPException(status_code=403, detail="Only the group owner can do that")
    return m


def _name_taken(db: Session, name: str, exclude_group_id: Optional[int] = None) -> bool:
    """Case-insensitive uniqueness check on group names within the entire scope.
    BearBoard has no nested orgs/teams, so the scope is global. If that ever
    changes, narrow this query to the relevant org."""
    q = db.query(Group).filter(func.lower(Group.name) == name.lower())
    if exclude_group_id is not None:
        q = q.filter(Group.id != exclude_group_id)
    return db.query(q.exists()).scalar()


def _serialize_group(g: Group, viewer: Optional[User], viewer_membership: Optional[GroupMember],
                     pending_invite: bool, pending_request: bool) -> dict:
    """Pack a Group + viewer context into the GroupDetailResponse dict."""
    return {
        "id": g.id,
        "name": g.name,
        "course_code": g.course_code,
        "description": g.description,
        "member_count": g.member_count or 0,
        "is_private": bool(g.is_private),
        "requires_approval": bool(g.requires_approval),
        "posting_permission": g.posting_permission or "all",
        "avatar_url": g.avatar_url,
        "cover_url": g.cover_url,
        "created_by": g.created_by,
        "viewer_role": viewer_membership.role if (viewer_membership and viewer_membership.status == "active") else None,
        "viewer_membership_status": viewer_membership.status if viewer_membership else None,
        "viewer_muted": bool(viewer_membership.muted) if viewer_membership else False,
        "has_pending_request": pending_request,
        "has_pending_invite": pending_invite,
    }


def _viewer_context(db: Session, group_id: int, viewer: Optional[User]):
    """Pull the viewer's membership + pending invite + pending join request
    in one helper since they're needed by the detail endpoint and the
    join-flow endpoints alike."""
    if viewer is None:
        return None, False, False
    m = _membership(db, group_id, viewer.id)
    inv = (
        db.query(GroupInvitation)
        .filter(
            GroupInvitation.group_id == group_id,
            GroupInvitation.invited_user_id == viewer.id,
            GroupInvitation.status == "pending",
        )
        .one_or_none()
    )
    req = (
        db.query(GroupJoinRequest)
        .filter(
            GroupJoinRequest.group_id == group_id,
            GroupJoinRequest.user_id == viewer.id,
            GroupJoinRequest.status == "pending",
        )
        .one_or_none()
    )
    return m, inv is not None, req is not None


def _try_get_user(request: Request, db: Session) -> Optional[User]:
    """Same helper as posts.py for endpoints that don't require auth but
    behave differently for logged-in users (e.g. group detail surfaces
    viewer_role)."""
    auth = request.headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    try:
        from jose import jwt
        from routers.auth import SECRET_KEY, ALGORITHM
        token = auth.split(None, 1)[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None
        return db.query(User).filter(User.id == int(sub)).first()
    except Exception:
        return None


# ============================================================================
# Read endpoints (group detail + member list)
# ============================================================================

@router.get("/{group_id}", response_model=GroupDetailResponse)
def get_group_detail(group_id: int, request: Request, db: Session = Depends(get_db)):
    g = _get_group_or_404(db, group_id)
    viewer = _try_get_user(request, db)
    membership, has_invite, has_request = _viewer_context(db, group_id, viewer)
    return _serialize_group(g, viewer, membership, has_invite, has_request)


@router.get("/{group_id}/members", response_model=list[MemberInfo])
def list_members(
    group_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Member list with roles + join dates + inviter attribution. Members-only
    by design — non-members shouldn't be able to enumerate accounts."""
    g = _get_group_or_404(db, group_id)
    is_site_admin = current_user.role in ("admin", "moderator")
    viewer_member = _membership(db, group_id, current_user.id)
    if not is_site_admin and (viewer_member is None or viewer_member.status != "active"):
        raise HTTPException(status_code=403, detail="You must be a member to view this group's members")

    rows = (
        db.query(GroupMember)
        .options(joinedload(GroupMember.user), joinedload(GroupMember.inviter))
        .filter(GroupMember.group_id == group_id, GroupMember.status == "active")
        .order_by(
            # Owner first, then admins, then members; alphabetical within each tier.
            func.lower(GroupMember.role).asc(),
            GroupMember.joined_at.asc(),
        )
        .all()
    )
    # Sort manually to enforce owner -> admin -> member ordering (lexical sort
    # would put "admin" before "member" before "owner" alphabetically — wrong).
    role_rank = {"owner": 0, "admin": 1, "member": 2}
    rows.sort(key=lambda r: (role_rank.get(r.role, 9), r.joined_at or 0))

    return [
        MemberInfo(
            user_id=r.user_id,
            name=getattr(r.user, "name", None) or "Unknown",
            avatar_url=getattr(r.user, "avatar_url", None),
            role=r.role,
            status=r.status,
            joined_at=r.joined_at.isoformat() if r.joined_at else None,
            invited_by_id=r.invited_by,
            invited_by_name=getattr(r.inviter, "name", None) if r.inviter else None,
        )
        for r in rows
    ]


# ============================================================================
# Settings (admin-only PATCH)
# ============================================================================

@router.patch("/{group_id}", response_model=GroupDetailResponse)
def update_group_settings(
    group_id: int,
    patch: GroupSettings,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Edit any combination of name/description/avatar/cover/privacy/posting.
    Admin or owner can call this. Name uniqueness is checked case-insensitively
    against all other groups."""
    g = _get_group_or_404(db, group_id)
    _require_admin(db, g, current_user)

    if patch.name is not None:
        new_name = patch.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        if _name_taken(db, new_name, exclude_group_id=group_id):
            raise HTTPException(status_code=409, detail="A group with that name already exists")
        g.name = new_name

    if patch.description is not None:
        g.description = patch.description.strip() or None

    if patch.course_code is not None:
        g.course_code = patch.course_code.strip() or None

    if patch.avatar_url is not None:
        g.avatar_url = patch.avatar_url.strip() or None

    if patch.cover_url is not None:
        g.cover_url = patch.cover_url.strip() or None

    if patch.is_private is not None:
        g.is_private = bool(patch.is_private)

    if patch.requires_approval is not None:
        g.requires_approval = bool(patch.requires_approval)

    if patch.posting_permission is not None:
        g.posting_permission = patch.posting_permission

    db.commit()
    db.refresh(g)
    membership, has_invite, has_request = _viewer_context(db, group_id, current_user)
    return _serialize_group(g, current_user, membership, has_invite, has_request)


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Owner-only. Cascade-removes memberships + invitations + join requests
    via the FK ondelete cascades on those tables."""
    g = _get_group_or_404(db, group_id)
    _require_owner(db, g, current_user)
    # Manually delete membership rows because `group_members` doesn't have a
    # cascade FK (legacy from the original migration). Invitations and join
    # requests do cascade via their FKs.
    db.query(GroupMember).filter(GroupMember.group_id == group_id).delete(synchronize_session=False)
    db.delete(g)
    db.commit()
    return None


# ============================================================================
# Member admin actions (remove / promote / demote / transfer / ban / mute)
# ============================================================================

@router.delete("/{group_id}/members/{user_id}", status_code=204)
def remove_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    g = _get_group_or_404(db, group_id)
    actor = _require_admin(db, g, current_user)
    target = _membership(db, group_id, user_id)
    if target is None or target.status != "active":
        raise HTTPException(status_code=404, detail="Member not found")
    if target.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner — transfer ownership first")
    # Admins cannot remove other admins; only the owner can.
    if target.role == "admin" and actor.role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can remove an admin")
    db.delete(target)
    g.member_count = max(0, (g.member_count or 1) - 1)
    db.commit()
    return None


@router.post("/{group_id}/members/{user_id}/promote", status_code=200)
def promote_to_admin(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Owner-only: promote a member to co-admin. Multiple co-admins are allowed."""
    g = _get_group_or_404(db, group_id)
    _require_owner(db, g, current_user)
    target = _membership(db, group_id, user_id)
    if target is None or target.status != "active":
        raise HTTPException(status_code=404, detail="Member not found")
    if target.role == "owner":
        raise HTTPException(status_code=400, detail="User is already the owner")
    if target.role == "admin":
        return {"detail": "Already an admin"}
    target.role = "admin"
    db.commit()
    return {"detail": "Promoted to admin"}


@router.post("/{group_id}/members/{user_id}/demote", status_code=200)
def demote_admin(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Owner-only: demote a co-admin back to member."""
    g = _get_group_or_404(db, group_id)
    _require_owner(db, g, current_user)
    target = _membership(db, group_id, user_id)
    if target is None or target.status != "active":
        raise HTTPException(status_code=404, detail="Member not found")
    if target.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot demote the owner — transfer ownership first")
    if target.role == "member":
        return {"detail": "Already a regular member"}
    target.role = "member"
    db.commit()
    return {"detail": "Demoted to member"}


@router.post("/{group_id}/transfer", status_code=200)
def transfer_ownership(
    group_id: int,
    payload: TransferRequest,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Owner hands the title to another active member. The previous owner
    becomes an 'admin' (not 'member') so they keep moderation privileges
    until they explicitly leave."""
    g = _get_group_or_404(db, group_id)
    actor = _require_owner(db, g, current_user)
    if payload.new_owner_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You're already the owner")
    target = _membership(db, group_id, payload.new_owner_user_id)
    if target is None or target.status != "active":
        raise HTTPException(status_code=404, detail="Target user is not an active member")
    # Find the actual current-owner row (actor may be a synthesized site-admin).
    current_owner_row = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.role == "owner")
        .one_or_none()
    )
    if current_owner_row is not None:
        current_owner_row.role = "admin"
    target.role = "owner"
    g.created_by = target.user_id
    db.commit()
    return {"detail": "Ownership transferred", "new_owner_user_id": target.user_id}


@router.post("/{group_id}/members/{user_id}/ban", status_code=200)
def ban_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Mark a user as banned so they can't rejoin. The membership row is
    kept (status='banned') rather than deleted so re-join attempts are
    detected; otherwise a banned user could just hit /join again."""
    g = _get_group_or_404(db, group_id)
    actor = _require_admin(db, g, current_user)
    target = _membership(db, group_id, user_id)
    if target is None:
        # No prior membership — create a banned row so the ban still sticks.
        target = GroupMember(group_id=group_id, user_id=user_id, role="member", status="banned")
        db.add(target)
    else:
        if target.role == "owner":
            raise HTTPException(status_code=400, detail="Cannot ban the owner")
        if target.role == "admin" and actor.role != "owner":
            raise HTTPException(status_code=403, detail="Only the owner can ban an admin")
        was_active = target.status == "active"
        target.status = "banned"
        if was_active:
            g.member_count = max(0, (g.member_count or 1) - 1)
    # Drop any pending invitation/request so the ban isn't bypassed.
    db.query(GroupInvitation).filter(
        GroupInvitation.group_id == group_id,
        GroupInvitation.invited_user_id == user_id,
        GroupInvitation.status == "pending",
    ).update({GroupInvitation.status: "revoked"}, synchronize_session=False)
    db.query(GroupJoinRequest).filter(
        GroupJoinRequest.group_id == group_id,
        GroupJoinRequest.user_id == user_id,
        GroupJoinRequest.status == "pending",
    ).update({GroupJoinRequest.status: "denied"}, synchronize_session=False)
    db.commit()
    return {"detail": "User banned from group"}


@router.delete("/{group_id}/members/{user_id}/ban", status_code=200)
def unban_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    g = _get_group_or_404(db, group_id)
    _require_admin(db, g, current_user)
    target = _membership(db, group_id, user_id)
    if target is None or target.status != "banned":
        raise HTTPException(status_code=404, detail="No active ban for that user")
    # Unban deletes the row entirely so a fresh join creates a new
    # active membership cleanly. If the user wants back in, they request again.
    db.delete(target)
    db.commit()
    return {"detail": "Ban lifted"}


@router.post("/{group_id}/mute", status_code=200)
def mute_group(
    group_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Per-member notification mute. The notifications fan-out reads this
    flag and skips muted users. Doesn't affect membership or feed access."""
    g = _get_group_or_404(db, group_id)
    m = _membership(db, group_id, current_user.id)
    if m is None or m.status != "active":
        raise HTTPException(status_code=403, detail="You aren't a member of this group")
    m.muted = True
    db.commit()
    return {"detail": "Group muted", "muted": True}


@router.delete("/{group_id}/mute", status_code=200)
def unmute_group(
    group_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    g = _get_group_or_404(db, group_id)
    m = _membership(db, group_id, current_user.id)
    if m is None or m.status != "active":
        raise HTTPException(status_code=403, detail="You aren't a member of this group")
    m.muted = False
    db.commit()
    return {"detail": "Group unmuted", "muted": False}


# ============================================================================
# Invitations
# ============================================================================

@router.post("/{group_id}/invitations", status_code=201)
def invite_user(
    group_id: int,
    payload: InviteRequest,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Admin invites a user by username. The user can then accept or decline
    via the /accept and /decline endpoints below."""
    g = _get_group_or_404(db, group_id)
    _require_admin(db, g, current_user)

    target = (
        db.query(User)
        .filter(func.lower(User.name) == payload.username.strip().lower())
        .first()
    )
    if target is None:
        raise HTTPException(status_code=404, detail="No user found with that name")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't invite yourself")

    existing = _membership(db, group_id, target.id)
    if existing is not None:
        if existing.status == "banned":
            raise HTTPException(status_code=400, detail="That user is banned from this group")
        if existing.status == "active":
            raise HTTPException(status_code=400, detail="User is already a member")

    inv = (
        db.query(GroupInvitation)
        .filter(
            GroupInvitation.group_id == group_id,
            GroupInvitation.invited_user_id == target.id,
        )
        .one_or_none()
    )
    if inv is None:
        inv = GroupInvitation(
            group_id=group_id,
            invited_user_id=target.id,
            invited_by=current_user.id,
            status="pending",
        )
        db.add(inv)
    elif inv.status == "pending":
        raise HTTPException(status_code=400, detail="An invitation is already pending for that user")
    else:
        # Resurrect a declined/revoked invite by flipping it back to pending.
        inv.status = "pending"
        inv.invited_by = current_user.id

    db.commit()
    db.refresh(inv)
    return {"detail": "Invitation sent", "invitation_id": inv.id, "invited_user_id": target.id}


@router.get("/{group_id}/invitations", response_model=list[InvitationInfo])
def list_pending_invitations(
    group_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Admin sees the list of pending invitations they've sent. Useful for
    revoking a stale invite or seeing who hasn't responded yet."""
    g = _get_group_or_404(db, group_id)
    _require_admin(db, g, current_user)
    rows = (
        db.query(GroupInvitation)
        .options(joinedload(GroupInvitation.invited_user), joinedload(GroupInvitation.inviter))
        .filter(GroupInvitation.group_id == group_id, GroupInvitation.status == "pending")
        .order_by(desc(GroupInvitation.created_at))
        .all()
    )
    return [
        InvitationInfo(
            id=r.id,
            group_id=group_id,
            group_name=g.name,
            invited_user_id=r.invited_user_id,
            invited_user_name=getattr(r.invited_user, "name", None),
            invited_by_id=r.invited_by,
            invited_by_name=getattr(r.inviter, "name", None) if r.inviter else None,
            status=r.status,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


@router.delete("/{group_id}/invitations/{invitation_id}", status_code=200)
def revoke_invitation(
    group_id: int,
    invitation_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    g = _get_group_or_404(db, group_id)
    _require_admin(db, g, current_user)
    inv = (
        db.query(GroupInvitation)
        .filter(GroupInvitation.id == invitation_id, GroupInvitation.group_id == group_id)
        .one_or_none()
    )
    if inv is None or inv.status != "pending":
        raise HTTPException(status_code=404, detail="No pending invitation with that id")
    inv.status = "revoked"
    db.commit()
    return {"detail": "Invitation revoked"}


@router.post("/{group_id}/invitations/accept", status_code=200)
def accept_invitation(
    group_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    g = _get_group_or_404(db, group_id)
    inv = (
        db.query(GroupInvitation)
        .filter(
            GroupInvitation.group_id == group_id,
            GroupInvitation.invited_user_id == current_user.id,
            GroupInvitation.status == "pending",
        )
        .one_or_none()
    )
    if inv is None:
        raise HTTPException(status_code=404, detail="No pending invitation for you on this group")

    existing = _membership(db, group_id, current_user.id)
    if existing is not None and existing.status == "banned":
        raise HTTPException(status_code=403, detail="You're banned from this group")
    if existing is not None and existing.status == "active":
        # Already a member somehow — just close out the invitation.
        inv.status = "accepted"
        db.commit()
        return {"detail": "Already a member"}

    if existing is None:
        db.add(GroupMember(
            group_id=group_id,
            user_id=current_user.id,
            role="member",
            status="active",
            invited_by=inv.invited_by,
        ))
    else:
        existing.status = "active"
        existing.role = "member"
        existing.invited_by = inv.invited_by
    g.member_count = (g.member_count or 0) + 1
    inv.status = "accepted"
    db.commit()
    return {"detail": "Joined", "group_id": group_id}


@router.post("/{group_id}/invitations/decline", status_code=200)
def decline_invitation(
    group_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    inv = (
        db.query(GroupInvitation)
        .filter(
            GroupInvitation.group_id == group_id,
            GroupInvitation.invited_user_id == current_user.id,
            GroupInvitation.status == "pending",
        )
        .one_or_none()
    )
    if inv is None:
        raise HTTPException(status_code=404, detail="No pending invitation for you on this group")
    inv.status = "declined"
    db.commit()
    return {"detail": "Invitation declined"}


# ============================================================================
# Join requests (private + approval-required public groups)
# ============================================================================

@router.get("/{group_id}/requests", response_model=list[JoinRequestInfo])
def list_join_requests(
    group_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    g = _get_group_or_404(db, group_id)
    _require_admin(db, g, current_user)
    rows = (
        db.query(GroupJoinRequest)
        .options(joinedload(GroupJoinRequest.user))
        .filter(GroupJoinRequest.group_id == group_id, GroupJoinRequest.status == "pending")
        .order_by(desc(GroupJoinRequest.created_at))
        .all()
    )
    return [
        JoinRequestInfo(
            id=r.id,
            group_id=group_id,
            user_id=r.user_id,
            user_name=getattr(r.user, "name", None),
            status=r.status,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


@router.post("/{group_id}/requests/{user_id}/approve", status_code=200)
def approve_request(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    g = _get_group_or_404(db, group_id)
    _require_admin(db, g, current_user)
    req = (
        db.query(GroupJoinRequest)
        .filter(
            GroupJoinRequest.group_id == group_id,
            GroupJoinRequest.user_id == user_id,
            GroupJoinRequest.status == "pending",
        )
        .one_or_none()
    )
    if req is None:
        raise HTTPException(status_code=404, detail="No pending request from that user")
    existing = _membership(db, group_id, user_id)
    if existing is not None and existing.status == "banned":
        raise HTTPException(status_code=400, detail="That user is banned")
    if existing is None:
        db.add(GroupMember(group_id=group_id, user_id=user_id, role="member", status="active"))
    else:
        existing.status = "active"
        existing.role = "member"
    g.member_count = (g.member_count or 0) + 1
    req.status = "approved"
    db.commit()
    return {"detail": "Request approved"}


@router.post("/{group_id}/requests/{user_id}/deny", status_code=200)
def deny_request(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    g = _get_group_or_404(db, group_id)
    _require_admin(db, g, current_user)
    req = (
        db.query(GroupJoinRequest)
        .filter(
            GroupJoinRequest.group_id == group_id,
            GroupJoinRequest.user_id == user_id,
            GroupJoinRequest.status == "pending",
        )
        .one_or_none()
    )
    if req is None:
        raise HTTPException(status_code=404, detail="No pending request from that user")
    req.status = "denied"
    db.commit()
    return {"detail": "Request denied"}


# ============================================================================
# Per-user views: my pending invitations
# ============================================================================

@router.get("/me/invitations", response_model=list[InvitationInfo])
def my_pending_invitations(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """The current user's pending group invites — feeds the notification
    panel + a 'Pending invitations' tab in the UI."""
    rows = (
        db.query(GroupInvitation)
        .options(
            joinedload(GroupInvitation.group),
            joinedload(GroupInvitation.inviter),
            joinedload(GroupInvitation.invited_user),
        )
        .filter(
            GroupInvitation.invited_user_id == current_user.id,
            GroupInvitation.status == "pending",
        )
        .order_by(desc(GroupInvitation.created_at))
        .all()
    )
    return [
        InvitationInfo(
            id=r.id,
            group_id=r.group_id,
            group_name=getattr(r.group, "name", "") or "",
            invited_user_id=r.invited_user_id,
            invited_user_name=getattr(r.invited_user, "name", None),
            invited_by_id=r.invited_by,
            invited_by_name=getattr(r.inviter, "name", None) if r.inviter else None,
            status=r.status,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]
