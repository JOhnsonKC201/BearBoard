import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the repo root (one level above backend/) so both the API
# process and Alembic pick up the same DATABASE_URL / SECRET_KEY.
_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://admin:password@localhost:3306/bearboard")
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours
