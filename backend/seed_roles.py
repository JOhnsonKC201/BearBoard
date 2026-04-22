"""Assign BearBoard roles to the team based on their real-world job.

The app has 4 roles: student, developer, moderator, admin (defined in
models/user.py). By default every account is a `student`. This script
promotes the known team members to the role that matches what they
actually do on the project so they see the staff-only chrome
(idea banner, admin dashboard for admins, mod actions) and show the
correct badge next to their name in the feed.

The mapping mirrors the TEAM_DATA block in frontend/src/pages/Home.jsx
— Product Owner and Scrum Master run the community (moderators); the
engineers are developers; Johnson is the project admin.

Idempotent: re-running is safe. If the target user doesn't exist yet
(they haven't registered), the script logs and skips rather than
creating a placeholder row — use grant_role.py for pre-provisioning.

Run from the backend directory:

    python seed_roles.py
"""
from __future__ import annotations

import sys

from core.database import SessionLocal
from models.user import ROLES, User


# (email, target_role, note)
ASSIGNMENTS: list[tuple[str, str, str]] = [
    ("jokc1@morgan.edu",   "admin",     "Johnson KC - Full Stack, project admin"),
    ("kyndal@morgan.edu",  "moderator", "Kyndal Maclin - Product Owner"),
    ("kymac2@morgan.edu",  "moderator", "Kyndal Maclin - alternate email"),
    ("olu@morgan.edu",     "moderator", "Oluwajomiloju King - Scrum Master"),
    ("aayush@morgan.edu",  "developer", "Aayush Shrestha - Backend / AI"),
    ("sameer@morgan.edu",  "developer", "Sameer Shiwakoti - Frontend"),
    ("rohan@morgan.edu",   "developer", "Rohan Sainju - UI/UX"),
]


def main() -> int:
    db = SessionLocal()
    try:
        applied = 0
        unchanged = 0
        missing = 0
        for email, role, note in ASSIGNMENTS:
            if role not in ROLES:
                print(f"error: unknown role '{role}' for {email}", file=sys.stderr)
                return 2
            user = db.query(User).filter(User.email == email).first()
            if user is None:
                print(f"skip      {email:30s}  (not registered yet - {note})")
                missing += 1
                continue
            if user.role == role:
                print(f"unchanged {email:30s}  already {role:9s} - {note}")
                unchanged += 1
                continue
            old = user.role
            user.role = role
            applied += 1
            print(f"promote   {email:30s}  {old:9s} -> {role:9s}  ({note})")
        if applied:
            db.commit()
        print()
        print(f"Applied: {applied}  Unchanged: {unchanged}  Missing: {missing}")
        if missing:
            print("To assign a role to a user before they sign up, use:")
            print("    python grant_role.py <email> <role>")
        return 0
    except Exception as e:
        db.rollback()
        print(f"error: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
