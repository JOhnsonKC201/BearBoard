"""Bootstrap / transfer admin access without needing an existing admin.

Usage:
  python grant_role.py <email> <role>

Examples:
  python grant_role.py jokc1@morgan.edu admin
  python grant_role.py sameer@morgan.edu moderator

Run this from c:/BearBoard/backend (so `core.config` finds the .env).
Creates a placeholder user row if the email isn't registered yet so you
can pre-grant a role before the person signs up.
"""
from __future__ import annotations

import sys

from core.database import SessionLocal
from models.user import ROLES, User


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    email = argv[1].strip()
    role = argv[2].strip()
    if role not in ROLES:
        print(f"error: role must be one of {', '.join(ROLES)}")
        return 2

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            print(f"note: no user registered as {email}. Creating a placeholder.")
            user = User(email=email, name=email.split("@", 1)[0], password_hash="!pending")
            db.add(user)
        user.role = role
        db.commit()
        db.refresh(user)
        print(f"ok: {user.email} is now {user.role}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
