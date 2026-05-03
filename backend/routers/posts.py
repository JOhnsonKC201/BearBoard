import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, case
from core.database import get_db
from core.rate_limit import limiter
from schemas.post import (
    PostCreate,
    PostUpdate,
    PostResponse,
    PostDetailResponse,
    VoteRequest,
    EventResponse,
    GroupResponse,
    ChatRequest,
    ChatResponse,
    CommentCreate,
    CommentUpdate,
    CommentResponse,
)
from models.post import Post
from models.vote import Vote
from models.comment import Comment
from models.comment_vote import CommentVote
from models.event import Event
from models.group import Group
from models.user import User
from routers.auth import get_current_user_dep
from services.streak import bump_streak
from services.resurface import find_relevant_recipients
from models.notification import Notification
from agents import moderation
from datetime import datetime, timedelta, timezone

SOS_NOTIFICATION_KIND = "sos"
COMMENT_NOTIFICATION_KIND = "comment"
REPLY_NOTIFICATION_KIND = "reply"

logger = logging.getLogger("bearboard.posts")

router = APIRouter(prefix="/api/posts", tags=["posts"])


def _guard_content(content: str, kind: str, author_id: int) -> None:
    """Run user-submitted text through the moderation agent and hard-block
    anything with a `block` verdict.

    Sprint 1 posture:
    - `block` → HTTP 400 with the model's reason (client surfaces it).
    - `flag`  → allow the write, just log a warning so moderators can review.
    - `allow` → silent.

    `moderate()` never raises (it degrades to a keyword heuristic when the
    LLM is unreachable), so a broad catch here is belt-and-suspenders: we
    never want a moderation hiccup to prevent a student from posting.

    `kind` is one of "post" | "comment". `author_id` only lands in the log
    line; we do not attach moderation state to the DB row in this sprint
    because that requires a model change Johnson owns.
    """
    try:
        result = moderation.moderate(content or "")
    except Exception:
        logger.exception("moderation call failed for %s by user=%s; allowing write", kind, author_id)
        return

    if result.verdict == "block":
        raise HTTPException(
            status_code=400,
            detail=f"Content blocked by moderation: {result.reason or 'policy violation'}",
        )

    if result.verdict == "flag":
        logger.warning(
            "moderation flagged %s by user=%s categories=%s reason=%s provider=%s",
            kind, author_id, result.categories, result.reason, result.provider,
        )


def _post_is_anon(post: Post) -> bool:
    """Treat a post as anonymous if either the explicit boolean is set OR
    the legacy category is 'anonymous'. The OR keeps pre-migration rows
    behaving identically while new code writes the boolean directly."""
    if post is None:
        return False
    return bool(getattr(post, "is_anonymous", False)) or (post.category or "").lower() == "anonymous"


def _anonymize_if_needed(post: Post, viewer_id: int | None = None, viewer_is_mod: bool = False) -> Post:
    """Strip author identity from anonymous posts before returning.

    The Post row always keeps author_id so moderators can investigate abuse
    at the DB layer (out-of-band SQL queries), but the API response for
    anonymous posts must not leak the author to *anyone* except the author
    themselves — otherwise the 'Anonymous' label is cosmetic only.

    Note: mods used to be exempt from this scrub so they could moderate
    on-feed, but that broke the anonymity contract from the perspective of
    a normal user (an admin viewing your post saw your name even though you
    chose Anonymous). Moderation actions don't actually need the identity
    visible in the feed — they need to be able to delete the row, which
    they still can via the comment/post id alone. `viewer_is_mod` is kept
    as a parameter so call sites don't need to be updated and so we can
    revisit the policy later without touching every endpoint.
    """
    del viewer_is_mod  # intentionally unused; see docstring
    if post and _post_is_anon(post):
        post.is_anonymous = True  # normalize for response
        if viewer_id is None or post.author_id != viewer_id:
            # Shadow attributes override the ORM values only for the serialization pass.
            post.author_id = None
            post.author = None
    return post


def _anonymize_list(posts: list[Post], viewer_id: int | None = None, viewer_is_mod: bool = False) -> list[Post]:
    for p in posts:
        _anonymize_if_needed(p, viewer_id=viewer_id, viewer_is_mod=viewer_is_mod)
    return posts


def _anonymize_comment(comment: Comment, viewer_id: int | None = None, viewer_is_mod: bool = False) -> Comment:
    """Same shape as _anonymize_if_needed, applied to comments. The author
    themselves sees the real author; everyone else (including mods and the
    post owner) sees a nulled-out author. See _anonymize_if_needed for why
    we no longer bypass the scrub for mods."""
    del viewer_is_mod  # intentionally unused; see _anonymize_if_needed docstring
    if comment and bool(getattr(comment, "is_anonymous", False)):
        if viewer_id is None or comment.author_id != viewer_id:
            comment.author_id = None
            comment.author = None
    return comment


def _anonymize_comment_list(comments, viewer_id: int | None = None, viewer_is_mod: bool = False):
    for c in comments or []:
        _anonymize_comment(c, viewer_id=viewer_id, viewer_is_mod=viewer_is_mod)
    return comments


def _viewer_is_mod(user) -> bool:
    return bool(user) and getattr(user, "role", None) in ("admin", "moderator")


def _attach_user_post_votes(posts, viewer_id: int | None, db: Session) -> None:
    """Populate `post.user_vote` (shadow attribute, picked up by Pydantic
    via from_attributes) with the viewer's existing vote on each post.

    One batch query rather than N queries — for a 50-row feed that's the
    difference between a snappy load and a stutter on Render's free tier.

    Without this, the frontend always shows "neutral" arrows on page load
    even though the backend has the user's prior vote in the DB. A user
    re-logging in would click upvote, the backend would correctly toggle
    the existing vote off (decrement), but the frontend's optimistic +1
    would leave the UI desynced — looking like votes were stacking when
    they were really flipping on/off.
    """
    if viewer_id is None or not posts:
        return
    post_ids = [p.id for p in posts]
    rows = (
        db.query(Vote.post_id, Vote.vote_type)
        .filter(Vote.user_id == viewer_id, Vote.post_id.in_(post_ids))
        .all()
    )
    by_post = {pid: vtype for pid, vtype in rows}
    for p in posts:
        p.user_vote = by_post.get(p.id)


def _attach_user_comment_votes(comments, viewer_id: int | None, db: Session) -> None:
    """Same shape as _attach_user_post_votes, for comments."""
    if viewer_id is None or not comments:
        return
    comment_ids = [c.id for c in comments]
    rows = (
        db.query(CommentVote.comment_id, CommentVote.vote_type)
        .filter(CommentVote.user_id == viewer_id, CommentVote.comment_id.in_(comment_ids))
        .all()
    )
    by_comment = {cid: vtype for cid, vtype in rows}
    for c in comments:
        c.user_vote = by_comment.get(c.id)


def _try_get_user(request: Request, db: Session) -> User | None:
    """Best-effort current-user lookup for endpoints that don't require auth
    (the public feed and post detail). We need this to know whether to
    show the real author to the post's own author. Failures mean
    anonymous viewer — we just route them through the safer path that
    strips author identity."""
    auth = request.headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    try:
        from jose import jwt, JWTError
        from routers.auth import SECRET_KEY, ALGORITHM
        token = auth.split(None, 1)[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None
        return db.query(User).filter(User.id == int(sub)).first()
    except Exception:
        return None


@router.get("/", response_model=list[PostResponse])
def get_posts(
    request: Request,
    sort: str = Query("newest", regex="^(newest|popular|trending)$"),
    category: str = Query(None),
    author_id: int = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Post).options(joinedload(Post.author))

    if category:
        query = query.filter(Post.category == category)

    if author_id is not None:
        # Anonymous posts must NOT appear in any author-filtered listing
        # served to other users — that's the easiest leak vector (your
        # public profile's "Posts" tab would otherwise enumerate them).
        # Only the author themselves (or a moderator) can pull a list
        # filtered by their own id.
        viewer = _try_get_user(request, db)
        is_self_or_mod = viewer is not None and (viewer.id == author_id or _viewer_is_mod(viewer))
        if not is_self_or_mod:
            query = query.filter(Post.is_anonymous.is_(False), Post.category != "anonymous")
        query = query.filter(Post.author_id == author_id)

    # Unresolved SOS posts always pin to the top of the feed regardless of sort.
    sos_first = case((Post.is_sos.is_(True) & Post.sos_resolved.is_(False), 0), else_=1)

    if sort == "popular":
        query = query.order_by(sos_first, desc(Post.upvotes - Post.downvotes))
    elif sort == "trending":
        day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        query = query.filter(Post.created_at >= day_ago).order_by(sos_first, desc(Post.upvotes - Post.downvotes))
    else:
        query = query.order_by(sos_first, desc(Post.created_at))

    posts = query.offset(offset).limit(limit).all()

    if posts:
        post_ids = [p.id for p in posts]
        counts = dict(
            db.query(Comment.post_id, func.count(Comment.id))
            .filter(Comment.post_id.in_(post_ids))
            .group_by(Comment.post_id)
            .all()
        )
        for p in posts:
            p.comment_count = counts.get(p.id, 0)

    viewer = _try_get_user(request, db)
    viewer_id = viewer.id if viewer else None
    _attach_user_post_votes(posts, viewer_id, db)
    return _anonymize_list(
        posts,
        viewer_id=viewer_id,
        viewer_is_mod=_viewer_is_mod(viewer),
    )


SOS_RECENT_LIMIT = 1
SOS_RECENT_WINDOW_HOURS = 6


@router.post("/", response_model=PostResponse)
@limiter.limit("20/hour")
def create_post(
    request: Request,
    post: PostCreate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    is_event = post.category.lower() in {"event", "events"}
    is_listing = post.category.lower() in {"housing", "swap"}

    if post.is_sos:
        # Per-user SOS throttle so a single student cannot mass-notify major-mates.
        window = datetime.now(timezone.utc) - timedelta(hours=SOS_RECENT_WINDOW_HOURS)
        recent_sos = (
            db.query(func.count(Post.id))
            .filter(
                Post.author_id == current_user.id,
                Post.is_sos.is_(True),
                Post.created_at >= window,
            )
            .scalar()
            or 0
        )
        if recent_sos >= SOS_RECENT_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"SOS limit reached: {SOS_RECENT_LIMIT} per {SOS_RECENT_WINDOW_HOURS}h.",
            )

    _guard_content(f"{post.title or ''}\n\n{post.body or ''}", kind="post", author_id=current_user.id)

    db_post = Post(
        title=post.title,
        body=post.body,
        category=post.category,
        author_id=current_user.id,
        event_date=post.event_date if is_event else None,
        event_time=post.event_time if is_event else None,
        event_location=(post.event_location.strip() or None) if (is_event and post.event_location) else None,
        is_sos=bool(post.is_sos),
        is_anonymous=bool(post.is_anonymous) or post.category.lower() == "anonymous",
        price=(post.price or None) if is_listing else None,
        contact_info=(post.contact_info or None) if is_listing else None,
        image_url=(post.image_url or None),
    )
    db.add(db_post)
    bump_streak(db, current_user)
    db.flush()  # need db_post.id for SOS notifications

    if db_post.is_sos:
        recipient_ids = find_relevant_recipients(db, current_user)
        for rid in recipient_ids:
            db.add(Notification(
                recipient_id=rid,
                post_id=db_post.id,
                kind=SOS_NOTIFICATION_KIND,
                read=False,
            ))

    db.commit()
    db.refresh(db_post)
    return db_post


@router.get("/{post_id}", response_model=PostDetailResponse)
def get_post(post_id: int, request: Request, db: Session = Depends(get_db)):
    post = (
        db.query(Post)
        .options(joinedload(Post.author), joinedload(Post.comments).joinedload(Comment.author))
        .filter(Post.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    viewer = _try_get_user(request, db)
    viewer_id = viewer.id if viewer else None
    is_mod = _viewer_is_mod(viewer)
    _attach_user_post_votes([post], viewer_id, db)
    _attach_user_comment_votes(post.comments, viewer_id, db)
    _anonymize_if_needed(post, viewer_id=viewer_id, viewer_is_mod=is_mod)
    _anonymize_comment_list(post.comments, viewer_id=viewer_id, viewer_is_mod=is_mod)
    return post


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    is_mod = current_user.role in ("admin", "moderator")
    if post.author_id != current_user.id and not is_mod:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    db.delete(post)
    db.commit()
    return {"detail": "Post deleted", "by_mod": is_mod and post.author_id != current_user.id}


@router.put("/{post_id}", response_model=PostResponse)
@limiter.limit("20/hour")
def update_post(
    request: Request,
    post_id: int,
    patch: PostUpdate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Edit an existing post. Author-only (moderators are intentionally
    *not* allowed here: edits should preserve the author's voice; mods
    can delete if content is rule-breaking). Only title/body/image_url
    can change — category is locked because changing a post's flair
    would rearrange filters, notifications, and leaderboard attribution
    in ways the feed never renders cleanly."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this post")
    if patch.title is not None:
        post.title = patch.title.strip()
    if patch.body is not None:
        post.body = patch.body.strip()
    if patch.image_url is not None:
        # Empty string clears the image; anything else is the already-validated URL.
        post.image_url = patch.image_url.strip() or None
    db.commit()
    db.refresh(post)
    return post


@router.post("/{post_id}/resolve-sos")
def resolve_sos(
    post_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Mark an SOS post as resolved. The author can resolve their own; mods/admins
    can resolve anyone's."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not post.is_sos:
        raise HTTPException(status_code=400, detail="Post is not an SOS")
    is_mod = current_user.role in ("admin", "moderator")
    if post.author_id != current_user.id and not is_mod:
        raise HTTPException(status_code=403, detail="Not authorized to resolve this SOS")
    post.sos_resolved = True
    db.commit()
    return {"detail": "resolved"}


@router.post("/{post_id}/vote")
@limiter.limit("60/minute")
def vote_post(
    request: Request,
    post_id: int,
    vote: VoteRequest,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing_vote = db.query(Vote).filter(
        Vote.user_id == current_user.id, Vote.post_id == post_id
    ).first()

    if existing_vote:
        if existing_vote.vote_type == vote.vote_type:
            # Toggle off
            if vote.vote_type == "up":
                post.upvotes = max(0, post.upvotes - 1)
            else:
                post.downvotes = max(0, post.downvotes - 1)
            db.delete(existing_vote)
        else:
            # Change vote
            if existing_vote.vote_type == "up":
                post.upvotes = max(0, post.upvotes - 1)
                post.downvotes += 1
            else:
                post.downvotes = max(0, post.downvotes - 1)
                post.upvotes += 1
            existing_vote.vote_type = vote.vote_type
    else:
        new_vote = Vote(user_id=current_user.id, post_id=post_id, vote_type=vote.vote_type)
        db.add(new_vote)
        if vote.vote_type == "up":
            post.upvotes += 1
        else:
            post.downvotes += 1

    db.commit()
    db.refresh(post)
    return {"upvotes": post.upvotes, "downvotes": post.downvotes}


@router.post("/{post_id}/comments", response_model=CommentResponse)
@limiter.limit("30/minute")
def create_comment(
    request: Request,
    post_id: int,
    comment: CommentCreate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    body = comment.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment body cannot be empty")

    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Validate threaded reply: parent must exist on the same post and itself
    # be a top-level comment. Depth-1 cap mirrors Facebook — replies-of-replies
    # are still attached to the original parent so the UI never has to render
    # arbitrarily nested walls.
    parent_id = comment.parent_id
    if parent_id is not None:
        parent = (
            db.query(Comment)
            .filter(Comment.id == parent_id, Comment.post_id == post_id)
            .first()
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent.parent_id is not None:
            parent_id = parent.parent_id

    _guard_content(body, kind="comment", author_id=current_user.id)

    new_comment = Comment(
        body=body,
        author_id=current_user.id,
        post_id=post_id,
        parent_id=parent_id,
        is_anonymous=bool(comment.is_anonymous),
    )
    db.add(new_comment)
    bump_streak(db, current_user)
    if post.is_sos and not post.sos_resolved:
        post.sos_resolved = True

    # Notify the post author about new activity on their post (and, if this
    # is a reply, the parent comment's author too). We dedupe per
    # (recipient, post, kind): the unique constraint already enforces this,
    # so we just upsert by re-flagging an existing unread row instead of
    # erroring or spamming. The notification body never names the commenter
    # — the anonymity contract has to hold here too.
    notif_recipients: dict[int, str] = {}
    if post.author_id and post.author_id != current_user.id:
        notif_recipients[post.author_id] = COMMENT_NOTIFICATION_KIND
    if parent_id is not None:
        parent_author_id = (
            db.query(Comment.author_id).filter(Comment.id == parent_id).scalar()
        )
        if parent_author_id and parent_author_id != current_user.id:
            # Reply notifications take precedence over the generic
            # comment kind for the same recipient: a reply is more
            # specific signal than "your post got a comment".
            notif_recipients[parent_author_id] = REPLY_NOTIFICATION_KIND

    for recipient_id, kind in notif_recipients.items():
        existing = (
            db.query(Notification)
            .filter(
                Notification.recipient_id == recipient_id,
                Notification.post_id == post_id,
                Notification.kind == kind,
            )
            .first()
        )
        if existing is None:
            db.add(Notification(
                recipient_id=recipient_id,
                post_id=post_id,
                kind=kind,
                read=False,
            ))
        else:
            # Re-arm the existing notification so the bell pops again
            # rather than silently leaving it as already-read. Also bump
            # created_at so it floats back to the top of the list — the
            # default ordering is desc(created_at), and a stale row would
            # quietly appear among week-old notifications.
            existing.read = False
            existing.created_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(new_comment)

    new_comment = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.id == new_comment.id)
        .first()
    )
    # Author sees their own author info — no anonymization on create response.
    return new_comment


@router.put("/{post_id}/comments/{comment_id}", response_model=CommentResponse)
@limiter.limit("30/minute")
def update_comment(
    request: Request,
    post_id: int,
    comment_id: int,
    patch: CommentUpdate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Author-only edit. Mods delete rather than edit (same reasoning
    as posts: edits must preserve the author's voice)."""
    c = (
        db.query(Comment)
        .filter(Comment.id == comment_id, Comment.post_id == post_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    if c.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")
    body = patch.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment body cannot be empty")
    c.body = body
    db.commit()
    c = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.id == c.id)
        .first()
    )
    return c


@router.delete("/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Author OR moderator can delete. Unlike edit, moderation has
    legitimate reasons to remove a comment (rule violation) even when
    the author disagrees."""
    c = (
        db.query(Comment)
        .filter(Comment.id == comment_id, Comment.post_id == post_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    is_mod = current_user.role in ("admin", "moderator")
    if c.author_id != current_user.id and not is_mod:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    # Cascade replies in application code so SQLite (which ignores
    # ON DELETE CASCADE unless PRAGMA foreign_keys=ON) behaves the same as
    # Postgres. Only top-level deletes can have replies — depth-1 cap.
    by_mod = is_mod and c.author_id != current_user.id
    if c.parent_id is None:
        db.query(Comment).filter(Comment.parent_id == c.id).delete(synchronize_session=False)
    db.delete(c)
    db.commit()
    return {"detail": "Comment deleted", "by_mod": by_mod}


@router.post("/{post_id}/comments/{comment_id}/vote")
@limiter.limit("60/minute")
def vote_comment(
    request: Request,
    post_id: int,
    comment_id: int,
    vote: VoteRequest,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Toggle/change/cast a vote on a comment. Mirrors vote_post: same
    request body, same toggle semantics (re-voting the same direction
    cancels, voting the opposite direction flips). Returns the new
    denormalized counts so the client can reconcile its optimistic
    update."""
    comment = (
        db.query(Comment)
        .filter(Comment.id == comment_id, Comment.post_id == post_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = (
        db.query(CommentVote)
        .filter(CommentVote.user_id == current_user.id, CommentVote.comment_id == comment_id)
        .first()
    )

    if existing:
        if existing.vote_type == vote.vote_type:
            # Toggle off
            if vote.vote_type == "up":
                comment.upvotes = max(0, comment.upvotes - 1)
            else:
                comment.downvotes = max(0, comment.downvotes - 1)
            db.delete(existing)
        else:
            # Change direction
            if existing.vote_type == "up":
                comment.upvotes = max(0, comment.upvotes - 1)
                comment.downvotes += 1
            else:
                comment.downvotes = max(0, comment.downvotes - 1)
                comment.upvotes += 1
            existing.vote_type = vote.vote_type
    else:
        db.add(CommentVote(user_id=current_user.id, comment_id=comment_id, vote_type=vote.vote_type))
        if vote.vote_type == "up":
            comment.upvotes += 1
        else:
            comment.downvotes += 1

    db.commit()
    db.refresh(comment)
    return {"upvotes": comment.upvotes, "downvotes": comment.downvotes}
