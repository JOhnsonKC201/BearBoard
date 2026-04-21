import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from core.database import get_db
from core.rate_limit import limiter
from schemas.user import UserCreate, UserLogin, UserResponse
from models.user import User
from passlib.context import CryptContext
from jose import jwt, JWTError
from core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Only allow signups from verified school addresses. Case-insensitive; accepts
# any .edu TLD (morgan.edu, umd.edu, etc.) so partner schools can use the same
# deployment later without a code change.
_EDU_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.edu$", re.IGNORECASE)


def _require_edu_email(email: str) -> str:
    normalized = (email or "").strip().lower()
    if not _EDU_EMAIL_RE.match(normalized):
        raise HTTPException(
            status_code=400,
            detail="BearBoard is for students only. Sign up with your .edu email.",
        )
    return normalized

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_current_user(db: Session = Depends(get_db), token: str = None):
    """Reusable dependency to extract user from JWT token."""
    from fastapi import Header
    # This is used via get_current_user_dep below
    pass


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()


def get_current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        try:
            user_id = int(sub)
        except (TypeError, ValueError):
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/register", response_model=UserResponse)
@limiter.limit("10/hour")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    email = _require_edu_email(user.email)

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        # Password "!pending" means the row was pre-provisioned by an admin
        # via grant_role.py; let the student claim it by setting a real password.
        if existing.password_hash == "!pending":
            existing.password_hash = pwd_context.hash(user.password)
            existing.name = user.name or existing.name
            existing.major = user.major or existing.major
            existing.graduation_year = user.graduation_year or existing.graduation_year
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = pwd_context.hash(user.password)
    db_user = User(
        email=email,
        password_hash=hashed_pw,
        name=user.name,
        major=user.major,
        graduation_year=user.graduation_year,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, user: UserLogin, db: Session = Depends(get_db)):
    email = (user.email or "").strip().lower()
    db_user = db.query(User).filter(User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Pre-provisioned admin rows store '!pending' as the password hash.
    # passlib.bcrypt.verify on that raises UnknownHashError; treat it as
    # "you must register first to claim this account" instead of crashing.
    if not db_user.password_hash or db_user.password_hash.startswith("!"):
        raise HTTPException(
            status_code=401,
            detail="This email is reserved by an admin. Use the Register form to claim it.",
        )

    try:
        valid = pwd_context.verify(user.password, db_user.password_hash)
    except Exception:  # malformed/unknown hash format → fail closed
        valid = False
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # JWT spec requires `sub` to be a string; python-jose enforces this on
    # decode and would otherwise raise JWTClaimsError, returning 401 for
    # every authenticated request right after login.
    token = jwt.encode({"sub": str(db_user.id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user_dep)):
    return current_user
