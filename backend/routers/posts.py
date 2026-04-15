from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from schemas.post import PostCreate, PostResponse
from models.post import Post

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("/", response_model=list[PostResponse])
def get_posts(db: Session = Depends(get_db)):
    # TODO: Add pagination (limit/offset or page/per_page)
    # TODO: Add sorting (newest, popular)
    # TODO: Add category filter
    posts = db.query(Post).all()
    return posts


@router.post("/", response_model=PostResponse)
def create_post(post: PostCreate, db: Session = Depends(get_db)):
    # BUG: author_id is hardcoded — needs to come from authenticated user
    db_post = Post(
        title=post.title,
        body=post.body,
        category=post.category,
        author_id=1,
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


# TODO: GET /api/posts/{id} — get single post with comments
# TODO: DELETE /api/posts/{id} — delete post (author only)
# TODO: POST /api/posts/{id}/vote — upvote/downvote endpoint
