"""
Seed the BearBoard database with real Morgan State news as dummy posts.

Scrapes morgan.edu/news for the latest articles, fetches each detail page for
the lede + hero image, and inserts them as Post records authored (in rotation)
by the six team members. Also ensures those team members exist as users.

Idempotent: skips any post whose title already exists in the DB.

Run from the backend directory:
    cd backend
    python seed_morgan.py
"""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from passlib.context import CryptContext

from core.database import SessionLocal
from models.user import User
from models.post import Post

NEWS_INDEX_URL = "https://www.morgan.edu/news"
BASE = "https://www.morgan.edu"
USER_AGENT = "BearBoardSeeder/1.0 (+https://bearboard.onrender.com)"
REQUEST_TIMEOUT = 15
MAX_ARTICLES = 10
DEV_PASSWORD = "bearboard123"

TEAM_USERS = [
    {"name": "Kyndal Maclin", "email": "kyndal@morgan.edu", "major": "Computer Science", "graduation_year": 2026},
    {"name": "Oluwajomiloju King", "email": "olu@morgan.edu", "major": "Information Systems", "graduation_year": 2026},
    {"name": "Aayush Shrestha", "email": "aayush@morgan.edu", "major": "Computer Science", "graduation_year": 2027},
    {"name": "Johnson KC", "email": "johnson@morgan.edu", "major": "Computer Science", "graduation_year": 2026},
    {"name": "Sameer Shiwakoti", "email": "sameer@morgan.edu", "major": "Computer Science", "graduation_year": 2027},
    {"name": "Rohan Sainju", "email": "rohan@morgan.edu", "major": "Computer Science", "graduation_year": 2027},
]

# Maps Morgan's news taxonomy (as rendered on their listing) onto the 9-way
# category set the BearBoard UI already styles. Anything unmatched falls back
# to "general".
CATEGORY_MAP = {
    "awards": "general",
    "grants": "general",
    "philanthropy/giving": "general",
    "office of the president": "general",
    "commencement": "events",
    "students": "academic",
    "education": "academic",
    "athletics/sports": "social",
    "athletics": "social",
    "sports": "social",
    "research": "academic",
    "faculty": "academic",
}


@dataclass
class Article:
    title: str
    url: str
    category_raw: str
    date_raw: str
    summary: str = ""
    image_url: str = ""


def http_get(url: str) -> str:
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.text


def parse_listing(html: str) -> list[Article]:
    """Pull article cards from the /news listing page.

    Morgan's newsroom renders each article as a <div class="news"> block:
      .news > .row
        > .col-md-4 > .img-wrap > a[href=/news/<slug>] > img[src]
        > .col-md-8
            > .news-info
                > a.secondary-text       (category)
                > span                   (date, "April 08, 2026")
            > h4 > a[href=/news/<slug>]  (title)
            > p                          (summary lede)
    """
    soup = BeautifulSoup(html, "html.parser")
    articles: list[Article] = []
    seen_slugs: set[str] = set()

    for card in soup.select("div.news"):
        title_link = card.select_one("h4 a[href]")
        if not title_link:
            continue
        href = title_link.get("href", "").strip()
        if not href.startswith("/news/"):
            continue
        slug = href[len("/news/"):].strip("/")
        # Real article slugs are long and multi-hyphenated; landing nav links
        # like /news/releases or /news/publications have <=1 hyphen.
        if slug.count("-") < 3 or slug in seen_slugs:
            continue

        title = title_link.get_text(strip=True)
        if not title or len(title) < 10:
            continue

        category_raw = ""
        cat_link = card.select_one(".news-info .secondary-text")
        if cat_link:
            category_raw = cat_link.get_text(strip=True)

        date_raw = ""
        # Date is the <span> inside .news-info that isn't the "pipe" separator.
        for span in card.select(".news-info span"):
            txt = span.get_text(strip=True)
            if txt and txt != "|" and "pipe" not in (span.get("class") or []):
                date_raw = txt
                break

        summary = ""
        summary_p = card.select_one("h4 ~ p")
        if summary_p:
            summary = summary_p.get_text(strip=True)

        image_url = ""
        img = card.select_one(".col-md-4 img[src]") or card.select_one("img[src]")
        if img:
            image_url = urljoin(BASE, img.get("src", ""))

        seen_slugs.add(slug)
        articles.append(
            Article(
                title=title,
                url=urljoin(BASE, href),
                category_raw=category_raw,
                date_raw=date_raw,
                summary=summary,
                image_url=image_url,
            )
        )
        if len(articles) >= MAX_ARTICLES:
            break

    return articles


def enrich_article(art: Article) -> None:
    """Fetch the article detail page and populate summary, hero image,
    category, and publish date. The listing page doesn't expose these
    reliably, but the detail page's OpenGraph and article:* meta tags do.
    """
    try:
        html = http_get(art.url)
    except Exception as exc:  # noqa: BLE001 — best-effort enrichment
        print(f"  ! could not fetch detail for {art.url}: {exc}")
        return
    soup = BeautifulSoup(html, "html.parser")

    def meta(prop: str) -> str:
        tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
        return (tag.get("content") if tag and tag.get("content") else "").strip()

    # Hero image.
    og_image = meta("og:image")
    if og_image:
        art.image_url = urljoin(BASE, og_image)
    else:
        img = soup.find("img")
        if img and img.get("src"):
            art.image_url = urljoin(BASE, img["src"])

    # Summary.
    og_desc = meta("og:description")
    if og_desc:
        art.summary = og_desc
    else:
        for p in soup.find_all("p"):
            text = p.get_text(strip=True)
            if len(text) >= 80:
                art.summary = text
                break

    # Category — article:section, then article:tag, then any category label
    # rendered on the page.
    section = meta("article:section") or meta("article:tag")
    if section:
        art.category_raw = section
    if not art.category_raw:
        # Some templates render the category as a link like
        # <a href="/news?category=Awards">Awards</a>. Grab the first such.
        cat_link = soup.find("a", href=lambda h: h and "category=" in h)
        if cat_link:
            art.category_raw = cat_link.get_text(strip=True)

    # Publish date — prefer article:published_time (ISO 8601).
    pub = meta("article:published_time")
    if pub:
        art.date_raw = pub
    if not art.date_raw:
        time_tag = soup.find("time")
        if time_tag:
            art.date_raw = (time_tag.get("datetime") or time_tag.get_text(strip=True) or "").strip()


def parse_morgan_date(raw: str) -> datetime | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    # ISO 8601 from article:published_time, e.g. "2026-04-08T09:00:00-04:00".
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        pass
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%B %d %Y"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def map_category(raw: str) -> str:
    return CATEGORY_MAP.get((raw or "").strip().lower(), "general")


def ensure_team_users(db) -> list[User]:
    ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed = ctx.hash(DEV_PASSWORD)
    users: list[User] = []
    created = 0
    for spec in TEAM_USERS:
        existing = db.query(User).filter(User.email == spec["email"]).one_or_none()
        if existing is None:
            u = User(
                email=spec["email"],
                password_hash=hashed,
                name=spec["name"],
                major=spec["major"],
                graduation_year=spec["graduation_year"],
                role="student",
            )
            db.add(u)
            db.flush()
            users.append(u)
            created += 1
        else:
            users.append(existing)
    if created:
        db.commit()
        print(f"Created {created} team user(s). Dev password: {DEV_PASSWORD!r}")
    else:
        print("Team users already exist; skipping user creation.")
    return users


def main() -> int:
    print(f"Fetching Morgan newsroom: {NEWS_INDEX_URL}")
    try:
        index_html = http_get(NEWS_INDEX_URL)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not fetch news index: {exc}", file=sys.stderr)
        return 1

    articles = parse_listing(index_html)
    if not articles:
        print("ERROR: no articles parsed from the listing page.", file=sys.stderr)
        return 1
    print(f"Found {len(articles)} article(s) on the listing page.")

    # Only fetch detail pages for articles that are missing a summary or image.
    for i, art in enumerate(articles, 1):
        if art.summary and art.image_url:
            continue
        print(f"  [{i}/{len(articles)}] enriching: {art.title[:70]}...")
        enrich_article(art)
        time.sleep(0.3)

    db = SessionLocal()
    try:
        users = ensure_team_users(db)

        inserted = 0
        skipped = 0
        for i, art in enumerate(articles):
            exists = db.query(Post).filter(Post.title == art.title).one_or_none()
            if exists is not None:
                skipped += 1
                continue
            author = users[i % len(users)]
            body_parts = []
            if art.summary:
                body_parts.append(art.summary)
            body_parts.append(f"Read more: {art.url}")
            post = Post(
                title=art.title[:200],
                body="\n\n".join(body_parts),
                category=map_category(art.category_raw),
                author_id=author.id,
                image_url=art.image_url or None,
                created_at=parse_morgan_date(art.date_raw) or datetime.utcnow(),
            )
            db.add(post)
            inserted += 1
        db.commit()
        print(f"Seeded posts: {inserted} inserted, {skipped} skipped (already present).")
    finally:
        db.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
