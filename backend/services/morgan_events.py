"""Sync events from the morgan.edu public iCal feed.

Pulls https://events.morgan.edu/calendar/1.ics, parses each VEVENT, and
upserts rows into the local `events` table keyed by the iCal UID. Re-running
the job is idempotent: existing rows are updated in place rather than
duplicated, and rows whose UID disappears upstream are left alone (so the
manual /api/events/sync trigger can be safely cron'd).
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Optional

import requests
from icalendar import Calendar
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.event import Event

MORGAN_ICS_URL = "https://events.morgan.edu/calendar/1.ics"
SOURCE_TAG = "morgan.edu"
DEFAULT_HORIZON_DAYS = 30
USER_AGENT = "BearBoard/0.1 (events sync; morgan.edu)"
REQUEST_TIMEOUT_SECONDS = 15

logger = logging.getLogger("bearboard.morgan_events")


def _coerce_date(value) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _coerce_time_str(value) -> Optional[str]:
    if isinstance(value, datetime):
        return value.strftime("%H:%M")
    return None


def _truncate(value: Optional[str], limit: int) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text if len(text) <= limit else text[: limit - 1] + "\u2026"


def fetch_morgan_ics(url: str = MORGAN_ICS_URL) -> bytes:
    response = requests.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "text/calendar"},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.content


def sync_morgan_events(
    db: Optional[Session] = None,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
    ics_bytes: Optional[bytes] = None,
) -> dict:
    """Fetch + upsert. Returns counts for monitoring.

    `ics_bytes` lets tests inject a fixture without hitting the network.
    `horizon_days` skips events more than that far in the future to keep
    the local table focused on the immediate calendar window.
    """
    own_session = db is None
    db = db or SessionLocal()
    try:
        if ics_bytes is None:
            ics_bytes = fetch_morgan_ics()
        cal = Calendar.from_ical(ics_bytes)

        cutoff = date.today() + timedelta(days=horizon_days)
        today = date.today()
        created = 0
        updated = 0
        skipped = 0

        for component in cal.walk("VEVENT"):
            uid = str(component.get("UID") or "").strip()
            title = _truncate(str(component.get("SUMMARY") or ""), 200)
            event_date = _coerce_date(component.get("DTSTART").dt) if component.get("DTSTART") else None
            if not uid or not title or not event_date:
                skipped += 1
                continue

            # Window: skip past events and far-future events.
            if event_date < today or event_date > cutoff:
                skipped += 1
                continue

            description = _truncate(str(component.get("DESCRIPTION") or "") or None, 2000)
            location = _truncate(str(component.get("LOCATION") or "") or None, 200)
            start_time = _coerce_time_str(component.get("DTSTART").dt) if component.get("DTSTART") else None
            end_time = _coerce_time_str(component.get("DTEND").dt) if component.get("DTEND") else None
            url_field = component.get("URL")
            source_url = _truncate(str(url_field) if url_field else None, 500)

            existing = db.query(Event).filter(Event.external_id == uid).first()
            if existing:
                existing.title = title
                existing.description = description
                existing.location = location
                existing.event_date = event_date
                existing.start_time = start_time
                existing.end_time = end_time
                existing.source = SOURCE_TAG
                existing.source_url = source_url
                updated += 1
            else:
                db.add(Event(
                    title=title,
                    description=description,
                    location=location,
                    event_date=event_date,
                    start_time=start_time,
                    end_time=end_time,
                    external_id=uid,
                    source=SOURCE_TAG,
                    source_url=source_url,
                ))
                created += 1

        db.commit()
        result = {"created": created, "updated": updated, "skipped": skipped}
        logger.info("morgan_events sync %s", result)
        return result
    finally:
        if own_session:
            db.close()
