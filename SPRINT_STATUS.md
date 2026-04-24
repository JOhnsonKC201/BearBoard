# Sprint 1 — Actual Status (2026-04-24)

`DEVELOPER_TASKS.txt` is stale. This doc is grounded in an audit of the
current `main` branch. Treat this as the authoritative punchlist for the
final push before demo.

## TL;DR

The codebase is **~95% demo-ready**. Backend is fully wired (9 routers,
no stubs). Frontend feed + auth + groups + professors + leaderboard all
talk to real APIs. 13 Alembic migrations are ordered and match the
models. Scheduler jobs (resurface, morgan_events, 3 weekly threads) are
configured. Auth + rate-limiting + CORS are set up.

**Remaining work is small and per-person.** See below.

---

## Aayush Shrestha — API, AI Agent & Backend

### Done on `main`
- Posts / comments / votes / events CRUD (including SOS throttle +
  auto-resolve on first comment, anonymous post handling).
- Existing `agents/client.py` with Gemini-first failover.
- Existing `agents/moderation.py` + `POST /api/ai/moderate`.

### Open PR
- [#23 — AI agents: summarizer + insights](https://github.com/JOhnsonKC201/BearBoard/pull/23)
  (branch `feature/ai-agents`): adds `POST /api/ai/summarize` and
  `POST /api/ai/insights` on top of the existing client.

### Still on my plate (will open separate PRs)
- [ ] Wire `agents.moderation.moderate()` into `create_post` / `create_comment`
      in `backend/routers/posts.py`. Discuss with Johnson whether we
      store the verdict on the row or just log it — adds a column if so.
- [ ] End-to-end smoke test against the Supabase instance (run alembic,
      start uvicorn, hit every `/api/ai/*` endpoint with curl).

---

## Johnson KC — Database, Auth, Profile

### Done on `main` (per code, not per `DEVELOPER_TASKS.txt`)
- `config.py` reads from env, refuses to boot on the placeholder
  `SECRET_KEY` — this is the correct production posture.
- 24h JWT expiry, `GET /api/auth/me`, `PUT /api/users/{id}` with 403.
- All models (`user`, `post`, `comment`, `vote`, `event`, `group`,
  `group_member`, `notification`, `professor`, `professor_rating`).
- **13 Alembic migrations already shipped.** `DEVELOPER_TASKS.txt` says
  "No `alembic.ini` or `alembic/` directory exists yet" — that's wrong,
  both exist.
- `.env.example` exists with Supabase + SQLite + RDS patterns.

### Actually remaining
- [ ] **Ship `backend/seed.py`.** Migrations leave DB empty; the demo
      needs 6 users + 10-15 posts + 3 events + 3 groups + some votes and
      comments for the feed to look populated. `seed_morgan.py`,
      `seed_professors.py`, `seed_megathreads.py`, `seed_roles.py` exist
      but there's no one-shot `seed.py` that runs them all.
- [ ] **Sanity-check Supabase connection** from a fresh checkout. The
      `.env` is gitignored (correct) so every teammate has to copy
      `.env.example` manually. Consider adding a `make seed` or a
      `scripts/dev-bootstrap.sh` that does `alembic upgrade head && python seed.py`.

### Do NOT touch (locked by other owners)
- The AI agent endpoints in `routers/ai.py` / `agents/` — that's my PR #23.

---

## Sameer Shiwakoti — Frontend / UI

### Done on `main`
- Login/Register with validation, grad year check, confirm password.
- `AuthContext` provider + JWT storage + Navbar avatar/auth state.
- Home feed fetches `/api/posts`, `/api/trending`, `/api/events`,
  `/api/groups` with loading + empty states.
- Sort tabs, category chips (server-side), vote buttons with optimistic
  UI, `+ New Post` modal.
- ChatWidget wired to `/api/chat`.
- `client.js` reads `VITE_API_URL`.

### Actually remaining
- [ ] **AI affordances on the frontend** — once my PR #23 lands,
      `PostDetail.jsx` needs a "Summarize thread" button that calls
      `POST /api/ai/summarize` with `post_id`, and a "BearBoard bot
      suggests…" chip that calls `POST /api/ai/insights`. Coordinate
      with me on the loading/error state — both endpoints return
      `{provider: "heuristic"}` when the LLM key is missing, so the UI
      should not treat that as an error.
- [ ] Decide whether the team section's hardcoded `TEAM_DATA` and
      `SAMPLE_POSTS` in `Home.jsx` should stay static for demo or move
      to a `/api/team` stub. Static is fine for Sprint 1.

### Do NOT touch
- `PostDetail.jsx` as a file — Rohan owns the page structure.
- The `/api/*` endpoints themselves — backend is Aayush + Johnson.

---

## Rohan Sainju — UI/UX Design & Experience

### Done on `main`
- Navbar (sticky, 52px, search, avatar, hamburger).
- Full Tailwind color palette matching design tokens.
- Archivo + Libre Franklin fonts.
- Sidebar (trending, events, groups).
- Team section + task overlay.
- **`PostDetail.jsx` exists and is routed** (`App.jsx:59`). Audit says
  the earlier claim that it didn't exist is outdated.
- **`EditProfileModal` component exists** and is imported in
  `Profile.jsx:9` — profile edit is wired, not missing.
- Basic responsive layout.

### Actually remaining
- [ ] Confirm reusable component extraction: are `PostCard`,
      `CategoryBadge`, `SideBox` already in `frontend/src/components/`,
      or still inlined in `Home.jsx`? Audit left this as "unclear."
      If still inlined, extract them so `PostDetail.jsx` can reuse.
- [ ] Responsive pass at 375px on Login, Register, PostDetail — the
      audit only confirmed Home + Profile.

### Do NOT touch
- The API endpoints or routing structure.

---

## Oluwajomiloju King — Scrum Master

All items remain from the original plan (they're process, not code):

- [ ] Branch protection on `main` — require 1 approving review, no
      direct push.
- [ ] `.github/pull_request_template.md` with Summary / Changes /
      Testing / Screenshots sections.
- [ ] Document the branch naming convention (`feature/S1-XX-*`).
- [ ] Trello columns + cards for every open item in this file.
- [ ] Sprint 1 review doc + demo script: login → feed → vote → create
      post → AI summarize a thread → AI insights chip → team section.

---

## Config / ops (anyone)

- [ ] Anyone running the backend for the first time needs to copy
      `.env.example` to `.env` and fill in `DATABASE_URL` + `SECRET_KEY`
      (and `GEMINI_API_KEY` if they want the AI endpoints to call a
      real model instead of the heuristic fallback).
- [ ] `render.yaml` exists in repo root — confirm the Render service
      picks up the Supabase `DATABASE_URL` as a secret and not a
      committed value.

---

## Why this doc exists

`DEVELOPER_TASKS.txt` was last updated 2026-04-15 and has drifted
significantly from the real state of `main`. Rather than rewrite that
file in place (and risk stepping on Johnson's ownership of the planning
doc), this PR adds a parallel status file grounded in an audit of the
actual code as of 2026-04-24. Once this is merged, the old
`DEVELOPER_TASKS.txt` can either be deleted or kept as historical
reference.
