"""Sync events from the morgan.edu Localist JSON API.

Localist (the CMS powering events.morgan.edu) exposes a paginated JSON API at
`/api/2/events`. We prefer it over the iCal feed because iCal drops images —
the JSON payload carries `photo_url`, `event_instances[].start/end`, category
filters, and the canonical event page URL. Re-running the job is idempotent:
existing rows are updated in place, keyed on the Localist event id stored in
`external_id`. Rows whose id disappears upstream are left alone so manual
`POST /api/events/sync` calls can be cron'd safely.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Iterable, Optional

import requests
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.event import Event

MORGAN_API_BASE = "https://events.morgan.edu/api/2/events"
SOURCE_TAG = "morgan.edu"
DEFAULT_HORIZON_DAYS = 365
PAGE_SIZE = 100
MAX_PAGES = 20  # hard stop: 20 * 100 = 2000 events is plenty for a year
USER_AGENT = "BearBoard/0.1 (events sync; morgan.edu)"
REQUEST_TIMEOUT_SECONDS = 30

logger = logging.getLogger("bearboard.morgan_events")


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        # Localist returns ISO-8601 timestamps with timezone, e.g.
        # "2026-04-18T09:30:00-04:00". We only care about the calendar date
        # in the event's local tz — strip the tz and parse the first 10 chars.
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _parse_time(value: Optional[str]) -> Optional[str]:
    if not value or "T" not in value:
        return None
    try:
        # "2026-04-18T09:30:00-04:00" -> "09:30"
        return value.split("T", 1)[1][:5]
    except (IndexError, ValueError):
        return None


def _truncate(value: Optional[str], limit: int) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text if len(text) <= limit else text[: limit - 1] + "\u2026"


def fetch_localist_page(page: int, days: int) -> dict:
    """One paginated request to the Localist events API."""
    params = {
        "pp": PAGE_SIZE,
        "page": page,
        "days": days,
    }
    response = requests.get(
        MORGAN_API_BASE,
        params=params,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def iter_localist_events(horizon_days: int) -> Iterable[dict]:
    """Yield `event` dicts across all pages. Stops once the server signals the
    last page, or at MAX_PAGES as a safety bound."""
    for page in range(1, MAX_PAGES + 1):
        payload = fetch_localist_page(page, horizon_days)
        items = payload.get("events") or []
        if not items:
            return
        for wrapper in items:
            ev = wrapper.get("event") if isinstance(wrapper, dict) else None
            if ev:
                yield ev
        # Pagination meta lives at payload["page"]; if absent, fall back to len
        meta = payload.get("page") or {}
        current = meta.get("current") or page
        total = meta.get("total")
        if total is not None and current >= total:
            return
        if len(items) < PAGE_SIZE:
            return


def _pick_first_instance(ev: dict) -> tuple[Optional[date], Optional[str], Optional[str]]:
    """Localist events can repeat. We store the next upcoming instance.

    Returns (event_date, start_time, end_time) using the earliest instance
    whose start date is today or later.
    """
    instances = ev.get("event_instances") or []
    today = date.today()
    best: Optional[tuple[date, Optional[str], Optional[str]]] = None
    for wrapper in instances:
        inst = wrapper.get("event_instance") if isinstance(wrapper, dict) else None
        if not inst:
            continue
        start_raw = inst.get("start")
        end_raw = inst.get("end")
        d = _parse_date(start_raw)
        if not d:
            continue
        if d < today:
            continue
        candidate = (d, _parse_time(start_raw), _parse_time(end_raw))
        if best is None or candidate[0] < best[0]:
            best = candidate
    if best is None:
        # Fall back to the first instance if nothing upcoming (caller will
        # decide whether to skip)
        for wrapper in instances:
            inst = wrapper.get("event_instance") if isinstance(wrapper, dict) else None
            if not inst:
                continue
            d = _parse_date(inst.get("start"))
            if d:
                return d, _parse_time(inst.get("start")), _parse_time(inst.get("end"))
        return None, None, None
    return best


def _extract_location(ev: dict) -> Optional[str]:
    room = (ev.get("room_number") or "").strip()
    name = (ev.get("location_name") or ev.get("venue_name") or "").strip()
    if name and room:
        return f"{name}, {room}"
    return name or room or None


def _extract_image(ev: dict) -> Optional[str]:
    # Localist usually returns `photo_url`. Some deployments also expose
    # `photo_url_modified`. Fall back to any valid http URL we find.
    for key in ("photo_url", "photo_url_modified"):
        value = ev.get(key)
        if isinstance(value, str) and value.startswith("http"):
            return value
    return None


def sync_morgan_events(
    db: Optional[Session] = None,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
    events_iter: Optional[Iterable[dict]] = None,
) -> dict:
    """Fetch + upsert. Returns counts for monitoring.

    `events_iter` lets tests inject fixture events without network.
    """
    own_session = db is None
    db = db or SessionLocal()
    try:
        source_iter = events_iter if events_iter is not None else iter_localist_events(horizon_days)

        today = date.today()
        created = 0
        updated = 0
        skipped = 0

        for ev in source_iter:
            ev_id = ev.get("id")
            uid = str(ev_id).strip() if ev_id is not None else ""
            title = _truncate(ev.get("title"), 200)
            event_date, start_time, end_time = _pick_first_instance(ev)
            if not uid or not title or not event_date:
                skipped += 1
                continue
            if event_date < today:
                skipped += 1
                continue

            description = _truncate(ev.get("description_text") or ev.get("description"), 2000)
            location = _truncate(_extract_location(ev), 200)
            source_url = _truncate(ev.get("url"), 500)
            image_url = _truncate(_extract_image(ev), 500)

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
                existing.image_url = image_url
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
                    image_url=image_url,
                ))
                created += 1

        db.commit()
        result = {"created": created, "updated": updated, "skipped": skipped}
        logger.info("morgan_events sync %s", result)
        return result
    finally:
        if own_session:
            db.close()
