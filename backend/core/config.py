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

# Explicit CORS allow-list. Override in prod via ALLOWED_ORIGINS env var
# (comma-separated). Defaulting to local dev only prevents accidental open CORS.
_default_origins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")
    if o.strip()
]
