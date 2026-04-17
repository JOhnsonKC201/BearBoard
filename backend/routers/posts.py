from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from core.database import get_db
from schemas.post import PostCreate, PostResponse, PostDetailResponse, VoteRequest, EventResponse, GroupResponse, ChatRequest, ChatResponse, CommentCreate, CommentResponse
from models.post import Post
from models.vote import Vote
from models.comment import Comment
from models.event import Event
from models.group import Group
from models.user import User
from routers.auth import get_current_user_dep
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("/", response_model=list[PostResponse])
def get_posts(
    sort: str = Query("newest", regex="^(newest|popular|trending)$"),
    category: str = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Post).options(joinedload(Post.author))

    if category:
        query = query.filter(Post.category == category)

    if sort == "popular":
        query = query.order_by(desc(Post.upvotes - Post.downvotes))
    elif sort == "trending":
        day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        query = query.filter(Post.created_at >= day_ago).order_by(desc(Post.upvotes - Post.downvotes))
    else:
        query = query.order_by(desc(Post.created_at))

    posts = query.offset(offset).limit(limit).all()
    return posts


@router.post("/", response_model=PostResponse)
def create_post(
    post: PostCreate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    db_post = Post(
        title=post.title,
        body=post.body,
        category=post.category,
        author_id=current_user.id,
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


@router.get("/{post_id}", response_model=PostDetailResponse)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = (
        db.query(Post)
        .options(joinedload(Post.author), joinedload(Post.comments).joinedload(Comment.author))
        .filter(Post.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
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
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    db.delete(post)
    db.commit()
    return {"detail": "Post deleted"}


@router.post("/{post_id}/vote")
def vote_post(
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
def create_comment(
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

    new_comment = Comment(body=body, author_id=current_user.id, post_id=post_id)
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    new_comment = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.id == new_comment.id)
        .first()
    )
    return new_comment
