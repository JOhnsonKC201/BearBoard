from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from core.config import DATABASE_URL

# Per-dialect engine tuning:
#   - SQLite: share the in-process connection across FastAPI's threadpool.
#   - Supabase transaction pooler (pgbouncer at :6543): disable SQLAlchemy's
#     own pool (pgbouncer already pools), and turn off psycopg2's
#     prepared-statement cache since pgbouncer in transaction mode multiplexes
#     server connections per statement and cannot carry prepared state.
_engine_kwargs: dict = {}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
elif ":6543/" in DATABASE_URL and ".pooler.supabase.com" in DATABASE_URL:
    # pgbouncer in transaction mode multiplexes server connections per
    # statement, so SQLAlchemy's own connection pool is redundant and server
    # state cannot be relied on. NullPool hands each request a fresh
    # connection out of pgbouncer, which is the supported pattern.
    _engine_kwargs["poolclass"] = NullPool

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
