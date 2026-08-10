# Tasking

## 1. System Overview

**Tasking** is a Smart Task Allocation web app for small and medium-sized enterprises (SMEs) that hire and manage casual workers alongside internal staff. Work is assigned down a company hierarchy — each role sees and manages everything below it. The headline feature is **task allocation**, not just scheduling: shifts define *when* someone works, tasks define *what* they do during that shift. The platform also covers recruitment, attendance, communication, reporting, and platform-level administration.

## 2. Technology Stack

- **Framework:** Next.js (App Router) + React, TypeScript
- **Backend:** Supabase (Postgres, Auth, Storage)
- **Hosting:** Vercel
- **Email:** Resend
- **Payments:** Stripe (subscription tiers)
- **AI:** OpenAI (AI-assisted job posting, task assignment, scheduling, anomaly detection in reports)
- **Testing:** Vitest (unit), Playwright (API integration + E2E)

## 3. User Roles

Internal company hierarchy is a strict superset chain — a higher role has every feature of the roles below it:

```
Owner ⊇ Partner ⊇ Manager ⊇ Employee
```

- **Owner** — all departments/companies; only role that can delete a company.
- **Partner** — Owner clone except a handful of Owner-only company-management actions.
- **Manager** — scoped to their assigned department(s).
- **Employee** — own shifts/tasks; supervises Casual Workers under them.

Plus two external roles, never inherited by the hierarchy above:

- **Casual Worker** — manages their own shifts, attendance, and profile.
- **Guest User** — browses the public job board; registering turns them into a Casual Worker applicant.

And two platform-level roles, independent of any single company:

- **Marketing Admin** — manages the public marketing site content.
- **User Admin** — manages platform-wide users and company accounts.

All roles share **one** UI/component system — the same components, layouts, and interaction design — differing only in which features are visible, which actions are permitted, and a per-role accent color.

## 4. System Modules

1. Shift — scheduling, swaps, templates
2. Task — assignment, sub-tasks, delay alerts
3. Team / Company — departments, members, invitations
4. Recruitment — job postings, applicants, hiring pipeline
5. Attendance — clock in/out, shift swap & fixed day-off requests
6. Communication — announcements and direct messages
7. Report — analytics and AI-assisted anomaly detection
8. Account & Authentication — registration, login, company creation
9. Marketing CMS — public marketing site content management
10. User & Company Admin — platform-level account administration

## 5. System Architecture

The codebase follows **MVC + Repository**, kept strict so that call flow doubles as the sequence diagram:

```
page.tsx → route.ts (controller) → service.ts (business logic) → repository.ts (Supabase access)
```

- **Frontend** — `page.tsx` (UI only, calls API routes, never a service or the DB directly)
- **Backend** — `route.ts` (controller: parses the request, validates input, calls the service, returns the response) → `service.ts` (business logic only)
- **Database** — `repository.ts` (Supabase queries only) → Supabase Postgres

## 6. Live System

**https://fyp-tasking.vercel.app/**

The production deployment is backed by the same seeded demo data described in [Test Accounts](#8-test-accounts) below — no setup is needed to explore it.

## 7. System Usage Prerequisites

- **Browser:** verified against Chromium, Firefox, and WebKit-based browsers (Chrome/Edge recommended).
- **Browser zoom:** 100% recommended. The layout is built with fixed inline styles rather than fluid CSS, so non-100% zoom can throw off spacing/breakpoints.
- **Seed data:** the live site is already seeded — nothing to run. (For a local instance, see the separate database/seeding documentation.)
- **Screen size:** desktop/laptop widths are the primary target; every page is designed to never scroll at the page level (only individual panels scroll internally).

## 8. Test Accounts

All accounts share the password `111111`.

| Role | Email | Notes |
|---|---|---|
| Owner | `owner@test.com` | Sarah Mitchell, full company owner |
| Partner | `partner1@test.com` | James Tan |
| Manager | `manager1@test.com` | David Lim, Operations department |
| Employee | `employee1@test.com` | Ben Seah, Operations department |
| Casual Worker | `casual1@test.com` | Marcus Lee, has an open shift ready to Clock In immediately after seeding |
| Guest | `guest1@test.com` | Wei Jie Lim, job applicant, not employed by any company |
| Marketing Admin | `madmin@tasking.com` | Platform-level, manages marketing site content only |
| User Admin | `uadmin@tasking.com` | Platform-level, manages users/companies across the platform |

More accounts exist beyond this table (8 Managers, 8 Employees, 5 Guests, 8 Casual Workers across 4 departments) — see the header comment in `scripts/seed.js` for the full list and department mapping.

## 9. Project Structure

```
src/
  app/
    (auth)/        # sign in, sign up, password reset
    (marketing)/   # public marketing site
    api/           # route handlers (controllers)
    owner/ partner/ manager/ employee/   # internal role dashboards
    casual/ guest/                       # external role dashboards
    admin/ useradmin/                    # platform-level dashboards
  components/      # shared UI components, one feature system for every role
  services/        # business logic
  repositories/    # Supabase data access
  types/           # one interface per entity
  lib/             # Supabase client, shared utilities
tests/             # Playwright integration + E2E specs, grouped by module
scripts/           # database seeding + NFR verification scripts (performance/scalability/compatibility/security)
```

## 10. Testing

### Seeding

Four scripts populate the database, each for a different purpose. They are independent — running one does not affect the others' data.

- `seed.js` — the demo dataset the manual test plan's expected counts depend on. Wipes and rebuilds.
- `seed-demo.js` — a separate, larger dataset for walkthroughs and the user manual. Does not touch `seed.js`'s data.
- `seed-scale-test.js` — the 50-employee scalability fixture (see below). `--delete` tears it down.
- `seed-marketing-pages.mjs` / `seed-reviews.mjs` — marketing-site content and reviews, which the other scripts leave alone.

### Unit Testing

Co-located next to each service file as `*.test.ts` (Vitest), mocking the repository layer. No env vars or network access needed.

### E2E Testing

Playwright browser tests for core user journeys (e.g. job posting → hire → schedule → assign task → clock in → attendance), grouped by module under `tests/module<N>/`. Integration/API-level Playwright specs (hitting real routes without a browser) live alongside them in the same folders.

### NFR Testing

Standalone scripts under `scripts/` verify the non-functional requirements directly against a running instance:

- `perf-test.js` — performance at a glance: one key endpoint per module, plus the two operations the requirement names explicitly (clock-in and schedule retrieval) and a 20-way concurrent burst
- `perf-test-module<N>.js` — performance per use case: every UC in that module measured twice, as 10 sequential single requests and as 20 simultaneous ones, against the real dev server and database. Modules 1-8 have their own script; Modules 9 and 10 share `perf-test-module9-10.js`
- `compatibility-test.js` (and the per-role `compat-<role>.js` scripts) — Compatibility: for every one of the 8 roles, loads that role's actual pages as a signed-in user at desktop/laptop/mobile widths across Chromium, Firefox and WebKit, and asserts the page itself never scrolls in either direction (CLAUDE.md §4's no-page-scroll rule: the page locks to one viewport and only its internal panels scroll). Each role's page set differs, so each role is checked against its own real sidebar navigation rather than one shared list.
- `security-auth-test.js` — application layer: every route that should require a session rejects an unauthenticated call with 401 (and confirms the intentionally-public routes stay reachable)
- `security-cross-tenant-api-test.js` — application layer: a *valid* session for one company is rejected with 403 when it targets another company's data/actions (the identity-mismatch half `security-auth-test.js` doesn't cover)
- `security-rls-isolation-test.js` — database layer: even bypassing the app entirely (direct Supabase client calls), Row Level Security keeps one company's rows out of another's listing queries and direct by-id lookups
- `seed-scale-test.js` — fixture generator for scalability testing: a throwaway company at the requirement's upper bound (1 Owner, 2 Managers, 50 Employees, 4 departments, 151 shifts, 150 tasks, 5 job postings), kept entirely separate from `seed.js`'s demo dataset

#### Scalability

Scalability reuses the same `perf-test-module<N>.js` scripts rather than a separate suite. The only variable is which dataset they run against, selected by the `OWNER_EMAIL` environment variable:

| `OWNER_EMAIL` | Dataset | Measures |
|---|---|---|
| `owner@test.com` (default) | `seed.js` demo company | Performance — the small-scale baseline |
| `scaleowner@test.com` | `seed-scale-test.js` 50-employee company | Scalability — the requirement's upper bound |

Each script prints a **dataset banner** before both result blocks, showing the company, the account, and the measured row counts (employees, headcount by role, departments, shifts, tasks, job postings). The banner labels the run `SCALABILITY RUN` or `PERFORMANCE RUN` based on the employee count it actually measures, not on the account name, so a terminal screenshot is self-evidence of which dataset produced the numbers.

Results are compared both against each UC's threshold and against the small-scale baseline, so growth in response time with data volume is visible rather than only the pass/fail outcome.

Modules 8, 9 and 10 are deliberately **not** part of the scalability run. Their operations act on a single account, page or company record and do no work that grows with company size, so measuring them at the upper bound would compare two identical workloads.

## 11. Test Commands

### Run Locally

```bash
npm run dev
```

### Unit Test

```bash
npm test                    # run once
npm run test:watch          # watch mode
```

### E2E Test

```bash
npm run test:playwright                     # integration/API + E2E tests
npm run test:playwright -- tests/module5    # a single module only
```

Playwright tests need `.env.local` configured (they hit the real dev Supabase project) and, for E2E specs, the dev server running (`npm run dev`). They create and clean up their own throwaway company/user data, so they do not depend on `scripts/seed.js` having been run first.

### NFR Test

```bash
npm run dev                                    # in one terminal — required by every script except the RLS one

# Security
node scripts/security-auth-test.js             # application layer: no session -> 401
node scripts/security-cross-tenant-api-test.js # application layer: valid session, wrong company -> 403
node scripts/security-rls-isolation-test.js    # database layer: RLS cross-company isolation (no dev server needed)

# Compatibility
node scripts/compatibility-test.js

# Performance — small-scale baseline
node scripts/perf-test.js                      # one endpoint per module
node scripts/perf-test-module1.js              # per-UC, one module at a time (1-8, and 9-10)
```

Scalability runs the same per-UC scripts against the 50-employee fixture. Build the fixture once, then point the scripts at it:

```bash
node scripts/seed-scale-test.js                # create the fixture (--delete tears it down)

# PowerShell
$env:OWNER_EMAIL = "scaleowner@test.com"
node scripts/perf-test-module1.js

# bash
OWNER_EMAIL=scaleowner@test.com node scripts/perf-test-module1.js
```

Run the module scripts **one at a time in a single terminal**. They share one dev server and one company, so running several at once would have each measure the others' load instead of its own. Each script cleans up everything it creates and reports the counts (`Deleted 60/60 ...`), so a shortfall in those lines is the signal that something was left behind; the next module's dataset banner will also show the drift.

Each script prints a per-check pass/fail line and a final `RESULT: ALL PASS` / `RESULT: FAIL` summary — the terminal output itself is the evidence (see "Evidence for reports" below).

## 12. Known Limitations / Notes

- Server-side session/role validation is in place on every API route that isn't intentionally public (job board, marketing content, reviews), an auth-entry endpoint (sign in/up, password reset), or authenticated via a different mechanism (Stripe webhook signature, cron secret).
- Row Level Security (RLS) is enabled on every table, with company-scoped policies for the tables the client subscribes to directly via Supabase Realtime; everything else is default-deny (the app's own reads/writes go through the service-role key server-side, not the client).
- Repeated failed sign-in attempts are rate-limited: 5 failures for the same email within 15 minutes locks that account out for 15 minutes (`login_attempts` table, checked before Supabase Auth is ever called).
- Per-use-case Test Case Description documents (with pass/fail evidence) and the manual test plan are maintained separately, outside this repo's `README.md`.

### Evidence for reports

For a written report (e.g. an NFR test case description), the standard evidence is a terminal screenshot of the relevant script's output, since these are integration-style tests against a real dev server / real Supabase project — not mocked:
- Run the commands above and screenshot each `RESULT: ALL PASS` block (or the full scrolled output if you want every individual check line visible).
- For performance and scalability, the per-UC scripts print the single-request and concurrent results as two separate blocks, each preceded by the dataset banner, so either block can be screenshotted on its own and still show which dataset it came from.
- To show a *specific* attack being blocked rather than just the aggregate pass count, pull one request out of a script and replay it by hand — e.g. `curl -i http://localhost:3000/api/task?company_id=<id>` with no `Cookie` header, or the same call with another company's session cookie — and screenshot the `401`/`403` response. The scripts print the exact method + path + expected status for each check, so any row can be replayed this way.
- `git log` / this repo's `docs/testing/BUGLOG.md` (not committed to git, kept locally) has dated entries for every fix with the reproduction steps and before/after behavior, useful if the report wants a specific defect writeup rather than just the aggregate NFR result.
