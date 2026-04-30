# Operational notes

Things that aren't bugs or features but matter for whoever's keeping
the lights on. Add new entries at the top, dated.

## Database moved to Neon (2026-04-29, later that day)

After the Supabase access situation below, we migrated the Postgres
database off Supabase onto Neon. The app is now running entirely on
Neon (free tier).

- New host: `ep-lively-forest-a4240m0c.us-east-1.aws.neon.tech`
- Database: `neondb`, role: `neondb_owner`
- SSL required: yes (`?sslmode=require` on the connection string)
- Region: AWS US East 1 (N. Virginia)

Migration was a one-shot via `backend/migrate_to_new_db.py` (the
script is in the repo as documentation; no need to run it again).
Row counts checked out post-copy on every table:

    users 14, events 64, groups 1, group_members 1, professors 81,
    posts 12, comments 2, votes 5, notifications 40,
    password_reset_tokens 3

The OLD Supabase project (`zyiwnoxuaxurazcfblao`) is still alive on
the free tier as a fallback but is no longer being read or written.
Delete it from the Supabase side whenever someone has access; until
then it's harmless dead weight.

`DATABASE_URL` is updated in two places:

- Local `.env` (gitignored)
- Render `bearboard-api` service → Environment

The Render deploy completed and the live API serves Neon-backed data
end to end (smoke-tested via `/api/stats` returning the post-migration
counts).

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
