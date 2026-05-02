import hashlib
import re
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db
from core.rate_limit import limiter
from schemas.user import UserCreate, UserLogin, UserResponse
from models.user import User
from models.password_reset import PasswordResetToken
from passlib.context import CryptContext
from jose import jwt, JWTError
from core.config import (
    SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES,
    RESET_TOKEN_EXPIRE_MINUTES, FRONTEND_URL,
)
from core.ws_auth import decode_jwt_user_id, InvalidToken
from datetime import datetime, timedelta, timezone
from services.email import send_password_reset_email

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

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    # Pin the bcrypt cost factor rather than relying on passlib's default so
    # the hashing difficulty is predictable across deploys and future passlib
    # upgrades. 13 is a modern baseline (~0.3s on commodity hardware).
    bcrypt__rounds=13,
)


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
    try:
        user_id = decode_jwt_user_id(credentials.credentials)
    except InvalidToken:
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
        # Don't confirm the email exists — that lets anyone enumerate
        # which addresses have accounts. Return a generic "couldn't
        # complete" message that nudges legitimate users toward the
        # sign-in / reset flow without revealing membership.
        raise HTTPException(
            status_code=400,
            detail="We couldn't complete that registration. If you already have an account, sign in or reset your password.",
        )

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
    # passlib.bcrypt.verify on that raises UnknownHashError; return a generic
    # "Invalid credentials" instead of "reserved by an admin" so an attacker
    # can't enumerate admin-reserved emails by probing the login form. The
    # real user claims the account via the Register form, which already has
    # logic to adopt a !pending row based on the email match.
    if not db_user.password_hash or db_user.password_hash.startswith("!"):
        raise HTTPException(status_code=401, detail="Invalid credentials")

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


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


@router.post("/forgot-password", status_code=200)
@limiter.limit("5/hour")
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = (body.email or "").strip().lower()
    user = db.query(User).filter(User.email == email).first()

    # Always return 200 so attackers can't enumerate registered emails.
    if not user or not user.password_hash or user.password_hash.startswith("!"):
        return {"detail": "If that email is registered you'll receive a reset link shortly."}

    # Invalidate any existing unused tokens for this user.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,  # noqa: E712
    ).update({"used": True})
    db.flush()

    raw_token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_token(raw_token),
        expires_at=expires,
    ))
    db.commit()

    reset_link = f"{FRONTEND_URL}/reset-password?token={raw_token}"
    background_tasks.add_task(send_password_reset_email, email, reset_link)

    return {"detail": "If that email is registered you'll receive a reset link shortly."}


@router.post("/reset-password", status_code=200)
@limiter.limit("10/hour")
def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    if not body.token or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Invalid request.")

    token_hash = _hash_token(body.token.strip())
    now = datetime.now(timezone.utc)

    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used == False,  # noqa: E712
        PasswordResetToken.expires_at > now,
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    user.password_hash = pwd_context.hash(body.password)
    record.used = True
    db.commit()

    return {"detail": "Password updated. You can now sign in with your new password."}
