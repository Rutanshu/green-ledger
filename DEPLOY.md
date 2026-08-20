# DEPLOY.md — Getting Green Ledger live, for £0

**Verified 20 August 2026.** Free tiers change; re-check before you rely on any number here.

Goal: a working multi-tenant app on a public URL that strangers can try from a LinkedIn post, at zero cost.

---

## 1. The stack

| Layer | Service | Free tier | Why this one |
|---|---|---|---|
| App hosting | **Vercel Hobby** | 100 GB transfer, 4 CPU-hrs active CPU, 1M function invocations, 360 GB-hrs memory, 100 deploys/day | Next.js is theirs; zero-config deploys from git push |
| Database | **Neon Free** | 0.5 GB storage per project, 100 CU-hours/month, up to 100 projects, autoscaling to 2 CU | Real Postgres, **scales to zero after 5 min and wakes on the next connection** |
| Auth | **Auth.js v5** (self-hosted) | free forever, no vendor | Lives in your app; no MAU ceiling to trip over |
| File storage | **Cloudflare R2** | 10 GB storage, 1M Class A ops, 10M Class B ops, **zero egress fees** | S3-compatible, so the code stays portable |
| Transactional email | **Resend** free | ~3,000 emails/month (verify current) | Magic links and site invites |
| Repo + CI | **GitHub** | unlimited public repos, free Actions on public repos | Also doubles as your portfolio artifact |
| Errors | **Sentry** free | 5k errors/month | You will need this the first time a stranger hits it |

**Total: £0/month**, until the traffic numbers in §5 say otherwise.

### Why not Supabase for the database
Supabase Free is generous (500 MB DB, 50k MAU auth, 1 GB storage) but **free projects pause after 1 week of inactivity**. That is fatal for a demo you post once and hope people click for months — someone opens your link in October and gets a dead app. Neon scales to zero instead: the compute sleeps, the next request wakes it in under a second, and it never permanently pauses. For a link that has to stay alive unattended, that difference decides it.

---

## 2. The three things that will actually bite you

### 2.1 Vercel Hobby is non-commercial use only — read this carefully
Vercel's fair-use terms restrict Hobby teams to **non-commercial personal use**. Their definition of commercial is broad: *"any Deployment used for the purpose of financial gain of anyone involved in any part of the production of the project."* Payment processing, advertising a product or service, ads, affiliate links — and **donation requests** are explicitly included.

**A free public demo with no payments, no ads, and no "buy this" is fine.** What is not fine:
- adding a pricing page or a "start free trial → card" flow
- a client paying you to build or host it
- running ads or a donate button

The moment any of that is true, it's Pro at $20/developer/month. Plan for that as the success case, not a failure.

### 2.2 Hobby cannot connect to GitHub *organisation* repos
Vercel does not support linking a Hobby project to a repo owned by a GitHub organisation — personal account repos only. If you plan to move it under an org later, budget for Pro at the same time.

### 2.3 Serverless functions time out, and CSV import is exactly the wrong shape
Hobby functions default to **10 seconds**, max **60 seconds**. `SPEC.md §8` targets 10,000 CSV rows in under 60s — that will not survive a serverless function.

Fix it in the design, not with a longer timeout:
- Upload the CSV to R2 first, return immediately.
- Process in chunks of ~200 rows per invocation, tracking progress on the `ImportBatch` row.
- Poll from the client for progress.

This is better architecture anyway — it's how it would work at scale — so do it once and never revisit.

### 2.4 Postgres connections and serverless don't mix by default
Every serverless invocation opening its own Postgres connection will exhaust the pool fast. Use **Neon's pooled connection string** and Prisma's pgbouncer mode:

```
DATABASE_URL="postgres://…@ep-xxx-pooler.region.aws.neon.tech/greenledger?sslmode=require&pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgres://…@ep-xxx.region.aws.neon.tech/greenledger?sslmode=require"
```
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled — runtime queries
  directUrl = env("DIRECT_URL")     // unpooled — migrations only
}
```
Getting this wrong produces intermittent "too many connections" errors that only appear under real traffic — i.e. the day you post the link.

---

## 3. Step by step

### Step 0 — repo
```bash
npx create-next-app@latest green-ledger --typescript --tailwind --app --eslint
cd green-ledger
npm i prisma @prisma/client zod decimal.js next-auth@beta @auth/prisma-adapter
npm i -D vitest @vitest/coverage-v8
git init && git add -A && git commit -m "chore: scaffold"
gh repo create green-ledger --public --source=. --push
```
Keep it **public** — free CI, and it's the portfolio piece.

### Step 1 — database
1. neon.tech → sign up with GitHub → new project `green-ledger`, region nearest your audience.
2. Copy both connection strings (pooled and direct) into `.env`.
3. Write `prisma/schema.prisma` from `SPEC.md §3`, then `npx prisma migrate dev --name init`.
4. Write `prisma/seed.ts`: one demo org, 3–4 sites, the neutral asset-type library, the system label defaults, ~40 real DEFRA factors, and one published questionnaire template with working bindings. **The seed is the demo.** Budget real time on it.

### Step 2 — deploy early, before the app does anything
```bash
npm i -g vercel && vercel
```
Add `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` in the Vercel dashboard. Push to `main` → production; every branch gets its own preview URL free.

Deploy on day one with a "hello world" page. Finding a deployment problem when you have 40 files is a ten-minute fix; finding it when you have 400 is a weekend.

### Step 3 — auth
Auth.js v5 with the Prisma adapter. Two providers:
- **GitHub OAuth** — one click for the technical audience who'll click a LinkedIn link
- **Email magic link** via Resend — for everyone else

Do not build password auth. It's a liability and it's the least interesting code in your repo.

### Step 4 — file storage
Cloudflare R2 bucket + an API token. R2 is S3-compatible, so `@aws-sdk/client-s3` works with a custom endpoint. Use **presigned upload URLs** so files go browser → R2 directly and never occupy a serverless function.

R2 requires a card on file even on the free tier. Set a billing alert at $1.

### Step 5 — domain
A `.vercel.app` subdomain is free and works. If you want `greenledger.app`, that's ~£10–30/year — the only real money in the whole plan, and worth it for a link you're putting your name on.

---

## 4. Demo mode — this is the part people skip, and it's the part that decides whether anyone tries it

A signup form between a LinkedIn reader and your product loses most of them. Build a **sandbox**:

1. **"Try the demo" button, no signup.** Creates a throwaway organisation seeded with the full demo dataset, sets a session cookie, drops you on the dashboard. Rename it, break it, whatever.
2. **Auto-reset.** A daily cron (`vercel.json` cron, free on Hobby) deletes sandbox orgs older than 24 hours. This is also what keeps you inside Neon's 0.5 GB.
3. **Rate limit it.** One sandbox per IP per hour, and a global cap. Without this, one person with a script empties your free tier in an afternoon.
4. **Disable the expensive paths in sandbox mode** — no outbound email, no file uploads over 1 MB, no bulk CSV over 500 rows.
5. **A visible banner:** *"Demo sandbox — resets daily, don't put real data here."* Say it plainly. People will otherwise, and then email you about it.
6. **Land them on `/how-it-works`**, not the dashboard. Someone arriving cold from LinkedIn needs the four-box flow diagram before a table of numbers means anything.

Seed the demo org with **realistic, finished-looking data** — a couple of sites at 100%, one mid-progress, one untouched, and two deliberately broken factor bindings so the Factor Lab has something to show. An empty product demos terribly.

---

## 5. When free stops being enough

| Signal | What broke | Fix | Cost |
|---|---|---|---|
| ~100 GB/month transfer | Vercel Hobby data transfer | Vercel Pro | $20/mo |
| 4 CPU-hrs/month active CPU | Function compute | Vercel Pro | $20/mo |
| 0.5 GB Postgres | Neon storage | Neon Launch | ~$19/mo |
| 100 CU-hours/month | Neon compute — likely first if the DB never sleeps | Neon Launch | ~$19/mo |
| Anyone pays you anything | Vercel Hobby terms | Vercel Pro, immediately | $20/mo |

**Realistic ceiling on free: a few thousand demo sessions a month.** Comfortably more than a LinkedIn post delivers. The full paid step-up is roughly **$40/month**, and you only take it when something good has happened.

Neon compute is the one to watch. 100 CU-hours sounds like a lot until a demo that never idles burns it in a fortnight — which is exactly why scale-to-zero after 5 minutes matters, and why you shouldn't disable it.

---

## 6. Getting from mockup to working — the honest sequence

`mockup.html` is a picture. This is the work behind it, ordered so each step is demoable on its own:

| # | Step | Rough effort | Demoable? |
|---|---|---|---|
| 1 | Prisma schema + migrations + seed | 2–3 days | Only via Prisma Studio |
| 2 | Deploy skeleton to Vercel + Neon | half a day | Yes — a live URL |
| 3 | Auth + org scoping (middleware + RLS) | 1–2 days | Sign in, see your org |
| 4 | **Label layer** — `resolveLabel()`, `<Label>`, Settings → Labels | 1–2 days | Rename something, watch it change everywhere |
| 5 | Unit conversion + `FuelProperty` (pure + tested) | 1 day | Test output |
| 6 | Sites + Assets CRUD | 2 days | Yes — the Profile screen |
| 7 | Factor Lab: sets, factors table, CSV factor import | 2 days | Yes |
| 8 | Calc engine, pure + fully tested | 2 days | Test output |
| 9 | Questionnaire Builder + `Test binding` | 3–4 days | The most impressive screen |
| 10 | Data Collection + `visible_if` + autosave | 3–4 days | The screen that proves the concept |
| 11 | `projectAnswer` → records + "show the maths" | 2 days | Yes — the trust surface |
| 12 | Dashboard | 2 days | Yes |
| 13 | Demo sandbox mode + reset cron | 1 day | **This is what makes it shareable** |
| 14 | Audit pack export (XLSX) | 1 day | Yes |

**Roughly 5–7 weeks of solid part-time work.** Steps 1–4 are unglamorous and non-negotiable; steps 9–11 are what people will screenshot.

### A shortcut worth considering
If the goal is *"let people try it and see if the idea lands"* rather than *"ship a product"*, build steps 1–4 and 9–11 and stub the rest. A working Builder + Data Collection + "show the maths" is a complete story. Dashboards and exports can be static until someone asks.

---

## 7. Before you post the link

- [ ] Someone who has never seen it can get from the URL to a computed emission number without asking you anything
- [ ] The demo banner is visible on every screen
- [ ] Rate limiting is on, and you have tested it
- [ ] The reset cron has run successfully at least once
- [ ] Sentry is wired up and you have deliberately triggered one error
- [ ] Vercel spend limit set to $0, Neon and R2 billing alerts set
- [ ] `README.md` explains what it is in three sentences with one screenshot
- [ ] `LICENSE` chosen — MIT if you want people to use it, AGPL if you might commercialise it later
- [ ] You have opened it on your phone. Half of LinkedIn traffic is mobile.
- [ ] No real organisation data in the seed
