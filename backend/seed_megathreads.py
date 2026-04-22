"""Seed four pinned megathreads.

Creates the canonical discussion threads the essentials spec called out:
admissions Q&A, course reviews, roommate search, dorm tours. Each is posted
by the first admin user in the DB (falls back to the first user) so there's
a real author_id for /api/posts to return.

The "pin" treatment is driven by a title prefix ("Megathread:") that the
frontend feed picks up and renders with a pinned banner at the top of the
feed. When the DB schema grows an `is_pinned` column, swap the marker for
that field and remove the prefix — the public titles can stay the same.

Idempotent: re-running skips any megathread whose title already exists
(case-insensitive).

Run from c:/BearBoard/backend:

    python seed_megathreads.py
"""
from __future__ import annotations

import sys
from sqlalchemy import func

from core.database import SessionLocal
from models.post import Post
from models.user import User


MEGATHREADS: list[tuple[str, str, str]] = [
    (
        "Megathread: Admissions Q&A",
        # Uses "general" while the "admissions" flair is still on its way
        # through review (see the Post flairs PR). Re-run the seed after
        # that merges if you want to re-categorize.
        "general",
        (
            "Welcome incoming Bears and future applicants. Drop your admissions questions here so the "
            "thread stays in one place instead of scattering across the feed.\n\n"
            "What belongs here:\n"
            "- Application timelines, required documents, recommendation letters\n"
            "- Transfer credit evaluations and placement tests\n"
            "- Housing deposit deadlines, orientation dates\n"
            "- Financial aid, scholarships, work-study\n"
            "- Questions for current students about what Morgan is really like\n\n"
            "What doesn't belong here:\n"
            "- Personal info (DM a moderator or admissions office directly)\n"
            "- Essay writing help (see the Academic flair)\n"
            "- \"Chance me\" posts — admissions won't come from a student forum\n\n"
            "Moderators: please pin replies answering the most common questions."
        ),
    ),
    (
        "Megathread: Course reviews",
        "academic",
        (
            "The permanent home for course reviews. If you're asking \"how was COSC 350 with Dr. Wang?\" "
            "start here, and if you just finished a class, leave a review for whoever comes next semester.\n\n"
            "Good review format:\n"
            "- Course code + section + instructor (e.g. COSC 350 · 101 · Wang)\n"
            "- Semester taken\n"
            "- Workload (light / moderate / heavy — hours per week)\n"
            "- Grading: exam-heavy, project-heavy, attendance-based?\n"
            "- One thing you wish you'd known on day one\n"
            "- Would you take it again?\n\n"
            "Remember: attack the class, not the professor. Personal attacks get removed. "
            "For a structured ratings UI, /professors already has the full Rate-My-Prof experience."
        ),
    ),
    (
        "Megathread: Roommate search",
        "housing",
        (
            "Looking for a roommate for next semester? Post here instead of making a dozen one-off listings.\n\n"
            "Include in your comment:\n"
            "- Fall/Spring/Summer + year you need housing\n"
            "- On-campus (which dorm preference) or off-campus (neighborhood)\n"
            "- Budget range\n"
            "- Your sleep schedule, cleanliness, noise tolerance\n"
            "- Dealbreakers (smoking, pets, guests, etc.)\n"
            "- How to reach you (preferred DM, school email)\n\n"
            "Never share your address publicly. Meet first at the library or student center. "
            "If something feels off, it probably is — trust that instinct and move on."
        ),
    ),
    (
        "Megathread: Dorm tours",
        "housing",
        (
            "Crowdsourced dorm tour thread. Drop photos, floor plans, and honest takes on each hall so incoming "
            "students can pick with more than the Housing brochure to go on.\n\n"
            "Please include:\n"
            "- Dorm name + which year you lived there\n"
            "- Room type (single / double / suite)\n"
            "- Noise level, AC situation, water pressure reality-check\n"
            "- How far it feels to McMechen, Tyler, the library at 11pm\n"
            "- What you'd bring that nobody mentioned at orientation\n\n"
            "Blur out roommate names / photos when posting pictures. "
            "Don't share building access codes or door codes here."
        ),
    ),
]


def _author_id(db) -> int | None:
    admin = db.query(User).filter(User.role == "admin").order_by(User.id).first()
    if admin:
        return admin.id
    first = db.query(User).order_by(User.id).first()
    return first.id if first else None


def main() -> int:
    db = SessionLocal()
    added = 0
    skipped = 0
    try:
        author_id = _author_id(db)
        if author_id is None:
            print("error: no users in DB; create an account first.", file=sys.stderr)
            return 2
        for title, category, body in MEGATHREADS:
            existing = (
                db.query(Post)
                .filter(func.lower(Post.title) == title.lower())
                .first()
            )
            if existing:
                skipped += 1
                continue
            db.add(Post(
                title=title,
                body=body,
                category=category,
                author_id=author_id,
                upvotes=0,
                downvotes=0,
            ))
            added += 1
        db.commit()
        print(f"Seeded megathreads: {added} added, {skipped} skipped.")
        return 0
    except Exception as e:
        db.rollback()
        print(f"error: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
