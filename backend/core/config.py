import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the repo root (one level above backend/) so both the API
# process and Alembic pick up the same DATABASE_URL / SECRET_KEY.
_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://admin:password@localhost:3306/bearboard")

# SECRET_KEY must be set explicitly. The old committed default is rejected so
# a missing .env never silently ships a known-secret JWT signer. The .env file
# bundled in the repo uses a different string, so local dev still boots.
_INSECURE_DEFAULT = "super-secret-key-change-me"
SECRET_KEY = os.getenv("SECRET_KEY", _INSECURE_DEFAULT)
if not SECRET_KEY or SECRET_KEY == _INSECURE_DEFAULT:
    raise RuntimeError(
        "SECRET_KEY is missing or equals the committed placeholder. "
        "Set SECRET_KEY in your .env to a long random string before starting the server."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours
RESET_TOKEN_EXPIRE_MINUTES = 60  # 1 hour

# SMTP settings for password-reset emails. All optional; if SMTP_USER /
# SMTP_PASSWORD are unset the server logs the reset link instead of emailing.
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER

# Base URL of the frontend (used to build the password-reset link in emails).
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

# Explicit CORS allow-list. Override in prod via ALLOWED_ORIGINS env var
# (comma-separated). Accepts bare hostnames ("bearboard.onrender.com") too;
# we prepend https:// automatically since Render Blueprint `fromService`
# interpolation emits just the host.
_default_origins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"


def _normalize_origin(raw: str) -> str:
    value = raw.strip().rstrip("/")
    if not value:
        return value
    if "://" in value:
        return value
    return f"https://{value}"


ALLOWED_ORIGINS = [
    o for o in (_normalize_origin(x) for x in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")) if o
]
