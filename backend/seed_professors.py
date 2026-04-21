"""Seed the professors table with Morgan State faculty.

Pulls from a curated list of faculty currently listed on morgan.edu (fetched
April 2026). Idempotent: case-insensitive name dedupe mirrors the create
endpoint at routers/professors.py, so re-running this script just skips rows
that already exist.

Run from c:/BearBoard/backend so `core.config` finds the .env:

    python seed_professors.py

Students extend the directory organically via the `+ Add a professor` UI.
"""
from __future__ import annotations

import sys
from sqlalchemy import func

from core.database import SessionLocal
from models.professor import Professor


# (name, department) — kept minimal to match the current schema. Titles
# (Prof, Assoc Prof, Lecturer, etc.) are omitted because the Professor
# model has no title column; adding one would require a migration.
FACULTY: list[tuple[str, str]] = [
    # Computer Science
    ("Shuangbao Wang", "Computer Science"),
    ("Md Rahman", "Computer Science"),
    ("Radhouane Chouchane", "Computer Science"),
    ("Amjad Ali", "Computer Science"),
    ("Monireh Dabaghchian", "Computer Science"),
    ("Jamell Dacon", "Computer Science"),
    ("Jin Guo", "Computer Science"),
    ("Vahid Heydari", "Computer Science"),
    ("Naja Mack", "Computer Science"),
    ("Jianzhou Mao", "Computer Science"),
    ("Blessing Ojeme", "Computer Science"),
    ("Roshan Paudel", "Computer Science"),
    ("Eric Sakk", "Computer Science"),
    ("Vojislav Stojkovic", "Computer Science"),
    ("Timothy Oladunni", "Computer Science"),
    ("Guobin Xu", "Computer Science"),
    ("Grace Steele", "Computer Science"),
    ("Sam Tannouri", "Computer Science"),
    ("Rahmel Bailey", "Computer Science"),

    # Information Science and Systems
    ("Maxim Bushuev", "Information Science and Systems"),
    ("Liqian Bao", "Information Science and Systems"),
    ("Sanjay Bapna", "Information Science and Systems"),
    ("Ganesh Bhatt", "Information Science and Systems"),
    ("William Borden", "Information Science and Systems"),
    ("Dessa David", "Information Science and Systems"),
    ("Mary Dunaway", "Information Science and Systems"),
    ("Samuel Ejiaku", "Information Science and Systems"),
    ("Shirin Hasavari", "Information Science and Systems"),
    ("Farzad Moazzami", "Information Science and Systems"),
    ("Thomas Ngniatedema", "Information Science and Systems"),
    ("Abirami Radhakrishnan", "Information Science and Systems"),
    ("Ziping Wang", "Information Science and Systems"),
    ("Jigish Zaveri", "Information Science and Systems"),
    ("Xingxing Zu", "Information Science and Systems"),

    # Electrical and Computer Engineering
    ("Michael Spencer", "Electrical and Computer Engineering"),
    ("Deanna Bailey", "Electrical and Computer Engineering"),
    ("Joshua Burrow", "Electrical and Computer Engineering"),
    ("MVS Chandrashekhar", "Electrical and Computer Engineering"),
    ("Cliston L. Cole", "Electrical and Computer Engineering"),
    ("Arlene Cole-Rhodes", "Electrical and Computer Engineering"),
    ("Mulugeta Dugda", "Electrical and Computer Engineering"),
    ("Petronella James", "Electrical and Computer Engineering"),
    ("Fahmi Khalifa", "Electrical and Computer Engineering"),
    ("Kevin Kornegay", "Electrical and Computer Engineering"),
    ("Kofi Nyarko", "Electrical and Computer Engineering"),
    ("Onyema Osuagwu", "Electrical and Computer Engineering"),
    ("Craig J. Scott", "Electrical and Computer Engineering"),
    ("Peter Taiwo", "Electrical and Computer Engineering"),
    ("Gregory Wilkins", "Electrical and Computer Engineering"),

    # Mathematics
    ("Asamoah Nkwanta", "Mathematics"),
    ("Candice Marshall", "Mathematics"),
    ("Michelle Rockward", "Mathematics"),
    ("Gaston N'Guerekata", "Mathematics"),
    ("Mingchao Cai", "Mathematics"),
    ("Jonathan Farley", "Mathematics"),
    ("Jemal Mohammed-Awel", "Mathematics"),
    ("Bhamini M.P. Nayar", "Mathematics"),
    ("Dwight Anderson Williams II", "Mathematics"),
    ("Xuming Xie", "Mathematics"),
    ("Guoping Zhang", "Mathematics"),
    ("Najat Ziyadi", "Mathematics"),
    ("Olaniyi Iyiola", "Mathematics"),
    ("Isabella Kemajou-Brown", "Mathematics"),
    ("Chibuike Chiedozie Ibebuchi", "Mathematics"),
    ("Shirley Russell", "Mathematics"),
    ("Renu Ahuja", "Mathematics"),
    ("Nadia Enurah", "Mathematics"),
    ("Romario Gildas Foko Tiomela", "Mathematics"),
    ("Julian Fuller", "Mathematics"),
    ("Lubna Kadhim", "Mathematics"),
    ("Rodney Kerby", "Mathematics"),
    ("Jean-Pierre L. Liamba", "Mathematics"),
    ("Paminas Mayaka", "Mathematics"),
    ("Peter McCalla", "Mathematics"),
    ("Alicia Richardson", "Mathematics"),
    ("Papa Seck", "Mathematics"),
    ("Syafrida Syafrida", "Mathematics"),
    ("Guven Yilmaz", "Mathematics"),
    ("Patrick Wenkanaab", "Mathematics"),
    ("Pilhwa Lee", "Mathematics"),
    ("Bose Iyiola", "Mathematics"),
]


def main() -> int:
    db = SessionLocal()
    added = 0
    skipped = 0
    try:
        for name, department in FACULTY:
            # Case-insensitive dedupe mirrors create_professor() in the router.
            existing = (
                db.query(Professor)
                .filter(func.lower(Professor.name) == name.lower())
                .first()
            )
            if existing:
                skipped += 1
                continue
            db.add(Professor(name=name, department=department))
            added += 1
        db.commit()
        print(f"Seeded professors: {added} added, {skipped} skipped (already present).")
        total = db.query(Professor).count()
        print(f"Total professors now in DB: {total}")
        return 0
    except Exception as e:
        db.rollback()
        print(f"error: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
