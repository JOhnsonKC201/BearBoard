# Operational notes

Things that aren't bugs or features but matter for whoever's keeping
the lights on. Add new entries at the top, dated.

## Supabase dashboard access (2026-04-29)

Dashboard access to the Supabase project `zyiwnoxuaxurazcfblao` is
currently lost (OAuth login can't find the right account). The
database itself is fully operational:

- Local: `DATABASE_URL` in `.env` (gitignored, never committed)
- Production: `DATABASE_URL` env var on the Render `bearboard-api` service

What still works without dashboard access:

- All reads/writes via `psql` or the SQLAlchemy app code
- `alembic upgrade head` (Render runs this automatically before booting uvicorn)
- Render auto-deploys
- All app traffic

What requires dashboard access (not currently needed):

- Rotating the DB password
- Viewing the project's compute / bandwidth / storage metrics in the UI
- Browsing the schema in the web SQL editor
- Inviting teammates to the project

If any of the above becomes necessary, the recovery path is to migrate
to a new project (Supabase under a confirmed-access account, Neon, or
Railway). The migration prompt is below — fill in the path choice + new
connection string, then run it from a Claude Code session opened in
this repo.

**Do not delete the current Supabase project until the new one is
verified end-to-end** (migrations applied, data restored if Path A,
Render `DATABASE_URL` updated, smoke test on `/health` and
`/api/professors?limit=3` both green).

### Sidenote on the .env "leak" finding

A 2026-04-29 audit flagged `.env` as a critical leak — that was a
false positive. `git log --all -- .env` returns empty, the file has
been gitignored from day one, and nothing in commit history exposes
the connection string or `SECRET_KEY`. The credentials live only on
the laptop running this repo and on Render's encrypted env-var store.
Rotation is good hygiene but not urgent.
