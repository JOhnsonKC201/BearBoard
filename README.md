# BearBoard

A campus social platform built by Morgan State students, for Morgan State students.

Live: <https://bearboard.onrender.com>
API: <https://bearboard-api.onrender.com> (FastAPI auto-docs at `/docs`)

This started as our COSC 458 capstone (Spring 2026) and grew into something we actually use to find study groups, share class intel, and complain about the dining hall lines.

## What's in it

The short version of what you can do once you sign up with a `.edu` email:

- Post to a feed (general, academic, housing, swap, safety, memes, advice, lost & found, admissions, anonymous, events)
- Comment with threaded replies. Both posts and comments support an "anonymous" toggle that the API enforces server-side, not just visually
- Hit the SOS button if you genuinely need help fast. The post pins to the top and notifies students sharing your major
- Browse and join study groups. Owners can run admin actions (invite, promote, transfer, ban), set the group private, or require approval to join
- Read and write professor reviews on a 5-axis rubric (clarity, engagement, accessibility, fairness, exam prep) with the practical "intel" most students actually want (attendance policy, exam types, workload, would-take-again)
- See campus events. The site syncs Morgan's iCal feed every six hours and merges it with student-created event posts
- Rate professors, see leaderboards, find related communities, all the usual

There's also a `BearBoard Bot` account that posts a short MSU-positive note every morning and either another note or a motivational quote in the afternoon. It's there so the feed isn't empty during quiet stretches.

## Stack

**Backend** is FastAPI on Python 3.11. SQLAlchemy + Alembic for the data layer, hitting Supabase Postgres in production. APScheduler runs the cron jobs (resurface, weekly threads, daily notes, Morgan event sync). JWT auth via `python-jose`, bcrypt for password hashing.

**Frontend** is React 18 with Vite and Tailwind. React Router for navigation. No state management library, just React state and a small in-memory API cache with stale-while-revalidate.

**Infra** is Render free tier for both the backend and the static site. Database is Supabase. The free Render tier sleeps the backend after about 15 minutes of inactivity, which used to mean a 30 to 60 second cold boot for the next visitor. We keep it warm with a GitHub Actions cron pinging `/health` every 10 minutes.

## Running it locally

You'll need Python 3.11+ and Node 18+.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

You need a `DATABASE_URL`. For local hacking, SQLite works fine:

```bash
export DATABASE_URL="sqlite:///./bearboard.db"
alembic upgrade head
```

Then:

```bash
uvicorn main:app --reload
```

API is at <http://localhost:8000>, interactive docs at <http://localhost:8000/docs>.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dev server at <http://localhost:3000>. By default it talks to `http://localhost:8000` for the API. To point at the deployed backend instead, drop a `.env.local` with:

```ini
VITE_API_URL=https://bearboard-api.onrender.com
```

### Optional environment

For Cloudinary image uploads (post images, group avatars), add to `frontend/.env.local`:

```ini
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset
```

Without these the image uploader falls back to a paste-a-URL field.

For the AI chat widget and content moderation, the backend reads `GEMINI_API_KEY` if set, otherwise falls back to a deterministic keyword router (good enough for development, way cheaper than calling Gemini for every comment).

## Repo layout

```text
BearBoard/
  backend/
    main.py              # FastAPI app + APScheduler setup
    routers/             # one file per domain: posts, groups, professors, etc.
    models/              # SQLAlchemy models
    schemas/             # Pydantic request/response shapes
    services/            # business logic (resurface, weekly threads, daily posts, morgan event sync, etc.)
    agents/              # AI moderation + chat agents
    alembic/             # database migrations
    core/                # config, database, rate limiting
  frontend/
    src/
      pages/             # one component per route
      components/        # shared UI (PostCard, AuthorAvatar, NewPostModal, etc.)
      api/               # fetch wrapper with retry + in-memory cache
      context/           # AuthContext
      utils/             # formatting, avatar palette, flair helpers
  .github/workflows/
    keep-warm.yml        # 10-minute /health ping cron
  render.yaml            # Render Blueprint for one-shot deploy
```

## Things worth knowing if you're contributing

- **Migrations are required to merge.** Render auto-runs `alembic upgrade head` before booting uvicorn on every deploy, so a missing migration wedges the production process. If you change a SQLAlchemy model, generate a migration in the same PR.
- **Anonymous posts and comments are real.** The API strips `author_id` from response payloads for non-author/non-mod viewers. The DB still holds the real author for moderation. If you add a new endpoint that returns post or comment data, double check it goes through the existing anonymizer.
- **Branch protection is on for `main`.** All work goes through a feature branch and a PR. Solo merges via the bypass-rules checkbox are fine when you're working alone.
- **The frontend retry layer matters.** `frontend/src/api/client.js` does exponential backoff on 502/503/504 and network errors, with budget enough to absorb a Render cold boot. If you write a new fetch path, use `apiFetch`, not raw `fetch`, so you get the retry + auth header + cache for free.

## Built by

| Who | What |
| --- | --- |
| Kyndal Maclin | Product Owner |
| Oluwajomiloju King | Scrum Master |
| Aayush Shrestha | API, AI Agent, Backend |
| Rohan Sainju | UI / UX |
| Sameer Shiwakoti | Frontend |
| Johnson KC | Full Stack |

Sprint board: <https://trello.com/b/ZVVEpSeC/my-trello-board>

## License

No formal license yet. Code is here so the team can collaborate and so it's reviewable for the course. If you want to use any of it elsewhere, ask.
