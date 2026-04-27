"""One-shot seeder for a fresh BearBoard database.

Runs every existing `seed_*.py` script in dependency order and adds a
small set of demo events + groups (which don't have their own seed
scripts yet) so a brand-new DB has enough content for the feed,
events page, groups page, and professor directory to all look alive.

Idempotent — each step inherits the dedupe semantics of its underlying
script (existing email/title/name skips re-creation), so re-running is
safe.

Run from the backend directory:

    cd backend
    python seed.py

Network-dependent steps (Morgan newsroom scrape) are best-effort: if
they fail we log and keep going so a missing internet connection does
not block local devs from seeding the rest of the demo content.
"""
from __future__ import annotations

import sys
import traceback
from datetime import date, timedelta

from core.database import SessionLocal
from models.event import Event
from models.group import Group
from models.user import User

import seed_morgan
import seed_roles
import seed_megathreads
import seed_professors


# Demo events — three near-future Morgan-shaped events. event_date is
# resolved at run-time so they always land in the future relative to
# whatever day the seed is invoked.
_DEMO_EVENTS = [
    {
        "title": "CS Department Open House",
        "description": "Meet the faculty, tour the labs, and grab free pizza. Open to all majors.",
        "location": "McMechen Hall, Room 308",
        "days_out": 3,
        "start_time": "5:00 PM",
        "end_time": "7:00 PM",
    },
    {
        "title": "Spring Career Fair",
        "description": "200+ employers on campus. Bring 20 copies of your resume.",
        "location": "University Student Center, Ballroom",
        "days_out": 7,
        "start_time": "10:00 AM",
        "end_time": "3:00 PM",
    },
    {
        "title": "Bears Basketball vs. Howard",
        "description": "Rivalry game. Student tickets are free with Bear Card.",
        "location": "Hill Field House",
        "days_out": 12,
        "start_time": "7:00 PM",
        "end_time": "9:30 PM",
    },
]


# Demo study/interest groups. course_code is empty for non-class groups
# so the group page can render either kind correctly.
_DEMO_GROUPS = [
    {
        "name": "COSC 220 Study Group",
        "course_code": "COSC 220",
        "description": "Object-oriented programming. We meet Tuesdays in the library.",
    },
    {
        "name": "Bears Hackathon Club",
        "course_code": "",
        "description": "Weekend builders, hackathon prep, and side-project show-and-tell.",
    },
    {
        "name": "First-Gen Engineers",
        "course_code": "",
        "description": "Community + mentorship for first-generation college students in engineering.",
    },
]


def _step(label: str, fn) -> int:
    """Run a seeder step, return its exit code, never raise. Errors are
    printed but don't abort the rest of the seed — if the Morgan scrape
    is down, we still want events/groups/professors to seed."""
    print(f"\n=== {label} ===")
    try:
        rc = fn() or 0
    except Exception:  # noqa: BLE001
        print(f"  step '{label}' raised:", file=sys.stderr)
        traceback.print_exc()
        return 1
    if rc != 0:
        print(f"  step '{label}' returned exit code {rc}")
    return rc


def _seed_events(db) -> int:
    """Insert the demo events under whichever user shows up first
    (typically the first team member after seed_morgan ran)."""
    creator = db.query(User).order_by(User.id.asc()).first()
    if creator is None:
        print("  no users in DB — skipping events (run seed_morgan first).")
        return 1
    today = date.today()
    inserted = 0
    skipped = 0
    for spec in _DEMO_EVENTS:
        existing = db.query(Event).filter(Event.title == spec["title"]).one_or_none()
        if existing is not None:
            skipped += 1
            continue
        ev = Event(
            title=spec["title"],
            description=spec["description"],
            location=spec["location"],
            event_date=today + timedelta(days=spec["days_out"]),
            start_time=spec["start_time"],
            end_time=spec["end_time"],
            created_by=creator.id,
        )
        db.add(ev)
        inserted += 1
    db.commit()
    print(f"  events: {inserted} inserted, {skipped} skipped (already present).")
    return 0


def _seed_groups(db) -> int:
    creator = db.query(User).order_by(User.id.asc()).first()
    if creator is None:
        print("  no users in DB — skipping groups.")
        return 1
    inserted = 0
    skipped = 0
    for spec in _DEMO_GROUPS:
        existing = db.query(Group).filter(Group.name == spec["name"]).one_or_none()
        if existing is not None:
            skipped += 1
            continue
        g = Group(
            name=spec["name"],
            course_code=spec["course_code"] or None,
            description=spec["description"],
            created_by=creator.id,
            member_count=1,
        )
        db.add(g)
        inserted += 1
    db.commit()
    print(f"  groups: {inserted} inserted, {skipped} skipped (already present).")
    return 0


def main() -> int:
    print("BearBoard one-shot seeder.")
    print("Each step is idempotent; re-running is safe.")

    failures: list[str] = []

    # 1. Users + Morgan news posts. Network-dependent — degrades to a
    #    failure marker but the rest still runs.
    if _step("seed_morgan (team users + Morgan news posts)", seed_morgan.main):
        failures.append("seed_morgan")

    # 2. Promote known team members to their real roles.
    if _step("seed_roles (assign moderator/admin/developer roles)", seed_roles.main):
        failures.append("seed_roles")

    # 3. Pinned megathreads. Needs at least one user to exist.
    if _step("seed_megathreads (4 pinned discussion threads)", seed_megathreads.main):
        failures.append("seed_megathreads")

    # 4. Professor directory. Independent of the user table.
    if _step("seed_professors (Morgan faculty directory)", seed_professors.main):
        failures.append("seed_professors")

    # 5. Events + groups (no dedicated scripts; inline so this PR stays small).
    db = SessionLocal()
    try:
        if _step("seed_events (3 upcoming campus events)", lambda: _seed_events(db)):
            failures.append("seed_events")
        if _step("seed_groups (3 study/interest groups)", lambda: _seed_groups(db)):
            failures.append("seed_groups")
    finally:
        db.close()

    print("\n=== Summary ===")
    if failures:
        print(f"Completed with {len(failures)} failed step(s): {', '.join(failures)}")
        print("(Other steps still ran; re-run after fixing the underlying issue.)")
        return 1
    print("All seed steps completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
