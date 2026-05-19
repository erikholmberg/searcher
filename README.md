# Searcher

Personal job search dashboard: define **searches** (tracks like “Staff backend” or “ML platform”), attach **sources** that pull listings from job boards and aggregators, then **refresh** and **find more** without duplicating rows. Sign in with GitHub; favorites and hidden jobs persist per user.

Built with **Next.js 16**, **React 19**, **Prisma** (Postgres), **Auth.js**, **Tailwind** + **shadcn/ui**, and **Vercel AI Gateway** for AI features.

## Features

- **Searches** — Name, optional intent (used for AI fit summaries), and multiple sources per search.
- **Create from a job URL** — Paste or **drag a public `https` posting URL** onto the dashboard; the app fetches the page (SSRF-safe), adds **one source** from that URL, uses AI for name/intent, creates the search, and **attaches that job** immediately.
- **All Jobs** — Header link to see every job across searches (favorites first, then date added).
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
| **Ashby board** | Jobs page name (e.g. from `jobs.ashbyhq.com/<name>`). |
| **Public job page** | Single `https` posting URL; HTML extract + refresh snapshot. |
| **Careers site** | Paste a company careers listing URL; AI scores similar-looking job links and ingests the best matches. |

Structured ATS URLs (Greenhouse, Lever, Playlist careers pages that embed Greenhouse) resolve via public APIs when pasted in **Suggest from job URL**. Other hosts use generic HTML extraction.

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

   UI primitives live in-repo under `components/ui`. Add more with `npx shadcn@latest add <component>`.

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

## API rate limits

Expensive endpoints enforce per-user + IP rate limits and return `429` when exceeded.

- Response shape: `{ error, retryAfterSeconds }`
- Header: `Retry-After: <seconds>`
- Current guarded routes:
  - `POST /api/ai/fit`
  - `POST /api/role-types/suggest-from-job-url`
  - `POST /api/role-types/:id/find-more`
  - `POST /api/role-types/:id/refresh`

Tune limits in [`lib/rate-limit.ts`](lib/rate-limit.ts) and each route’s `enforceRateLimit(...)` call.

## Deploying

Typical target: **Vercel** + **Supabase Postgres**.

- Set the same env vars as in `.env.example` in the Vercel project (and GitHub OAuth callback for your production domain).
- **`AUTH_URL`** in production must be your public site origin, e.g. `https://the-searcher.vercel.app` (no trailing slash). Add the same URL’s callback in the GitHub OAuth app: `https://the-searcher.vercel.app/api/auth/callback/github`.
- Set **`AUTH_TRUST_HOST=true`** on Vercel (see `.env.example`).
- Use Supabase **pooled** `DATABASE_URL` and **direct** `DIRECT_URL` as described in `.env.example`.
- Run migrations against production (`db:migrate` with production `DIRECT_URL`) or `db push` for early setups.

If the home page still errors after deploy, open **Vercel → your project → Logs** while loading the site. Common causes: missing **`AUTH_SECRET`**, wrong or missing **`DATABASE_URL`**, or Prisma schema not applied to the production DB (tables missing).

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
