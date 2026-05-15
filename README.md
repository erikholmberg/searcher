# Searcher

Personal job search dashboard: define **searches** (tracks like “Staff backend” or “ML platform”), attach **sources** that pull listings from job boards and aggregators, then **refresh** and **find more** without duplicating rows. Sign in with GitHub; favorites and hidden jobs persist per user.

Built with **Next.js 16**, **React 19**, **Prisma** (Postgres), **Auth.js**, **Tailwind** + **shadcn/ui**, and **Vercel AI Gateway** for AI features.

## Features

- **Searches** — Name, optional intent (used for AI fit summaries), and multiple sources per search.
- **Create from a job URL** — Paste or **drag a public `https` posting URL** onto the dashboard; the app fetches the page (SSRF-safe), adds **one source** from that URL, uses AI for name/intent, creates the search, and **attaches that job** immediately.
- **All jobs** — Header link to see every job across searches (favorites first, then date added).
- **Job list** — Favorite (pinned), hide (dismissed from the search; ingest skips them), remove from the list, open posting URL.
- **AI fit** — Streamed “why this might fit” blurb per job vs. the search intent (requires `AI_GATEWAY_API_KEY`).

## Job sources

| Source | Notes |
|--------|--------|
| **Arbeitnow** | Keyword search; no API key. |
| **Remotive** | Remote-focused search; no API key. |
| **Adzuna** | Requires `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`. |
| **Greenhouse board** | Public board token (e.g. from `boards.greenhouse.io/<token>`). |
| **Lever board** | Site slug (e.g. from `jobs.lever.co/<site>`). |
| **Public job page** | Single `https` posting URL; HTML extract + refresh snapshot. |

Structured ATS URLs (Greenhouse, Lever, Playlist careers pages that embed Greenhouse) resolve via public APIs when pasted in **Suggest from job URL**. Other hosts use generic HTML extraction.

**Ashby** appears in the schema/UI types but is not wired in the provider registry yet.

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** (local, or [Supabase](https://supabase.com/) in production)
- **GitHub OAuth app** — [Create one](https://github.com/settings/developers); callback URL: `{AUTH_URL}/api/auth/callback/github`
- **Vercel AI Gateway** key — for suggest-from-URL and fit summaries ([docs](https://vercel.com/docs/ai-gateway))

## Setup

1. **Clone and install**

   ```bash
   git clone <your-repo-url> searcher
   cd searcher
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env.local
   ```

   Fill in at minimum:

   | Variable | Purpose |
   |----------|---------|
   | `DATABASE_URL` | Postgres connection (pooled URL in prod if using PgBouncer) |
   | `DIRECT_URL` | Direct Postgres URL (Prisma migrations; can match `DATABASE_URL` locally) |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `AUTH_URL` | `http://localhost:3000` in dev |
   | `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth |
   | `AI_GATEWAY_API_KEY` | AI suggest + fit |

   Optional: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` if you use Adzuna sources.

   Do **not** commit `.env.local`. Only `.env.example` (placeholders) belongs in git.

3. **Database**

   ```bash
   createdb searcher   # if needed
   npm run db:push
   ```

   For migration-based workflows: `npm run db:migrate`.

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), sign in with GitHub, and use **New search** on the dashboard.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply Prisma schema (`dotenv` loads `.env.local`) |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:studio` | Prisma Studio |

## Deploying

Typical target: **Vercel** + **Supabase Postgres**.

- Set the same env vars as in `.env.example` in the Vercel project (and GitHub OAuth callback for your production domain).
- Use Supabase **pooled** `DATABASE_URL` and **direct** `DIRECT_URL` as described in `.env.example`.
- Run migrations against production (`db:migrate` with production `DIRECT_URL`) or `db push` for early setups.

## Project layout

```
app/           # Routes (dashboard, API, auth)
components/    # UI (dashboard, dialogs, shadcn)
lib/jobs/      # Providers, ingest, URL resolve, seed listing
lib/           # Prisma client, schemas, AI gateway wrapper
prisma/        # Schema
auth.ts        # Auth.js config
```

## License

Private / unset — add a `LICENSE` file if you open-source the repo.
