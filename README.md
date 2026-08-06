# Tasking

A **Smart Task Allocation** web app for small and medium-sized enterprises (SMEs). Work is assigned down a company hierarchy — each role sees and manages everything below it. The headline feature is **task allocation**, not just scheduling: shifts define *when* someone works, tasks define *what* they do during that shift.

## Tech Stack

- **Framework:** Next.js (App Router) + React, TypeScript
- **Backend:** Supabase (Postgres, Auth, Storage)
- **Hosting:** Vercel
- **Email:** Resend
- **Payments:** Stripe (subscription tiers)
- **AI:** OpenAI (AI-assisted job posting, task assignment, anomaly detection in reports)
- **Testing:** Vitest (unit), Playwright (API integration + E2E)

## Architecture

The codebase follows **MVC + Repository**, kept strict so that call flow doubles as the sequence diagram:

```
page.tsx → route.ts (controller) → service.ts (business logic) → repository.ts (Supabase access)
```

- `route.ts` — parses the request, validates input, calls the service, returns the response. No business logic, no direct DB access.
- `service.ts` — business logic only. No HTTP handling, no direct DB access.
- `repository.ts` — Supabase queries only. No business logic.
- `page.tsx` — UI only. Calls API routes, never a service or the DB directly.

## Roles

Internal company hierarchy is a strict superset chain — a higher role has every feature of the roles below it:

```
Owner ⊇ Partner ⊇ Manager ⊇ Employee
```

Plus two external roles that are never inherited by the hierarchy above:

- **Casual Worker** — manages their own shifts, attendance, and profile.
- **Guest User** — browses the public job board; registering turns them into a Casual Worker applicant.

And two platform-level roles, independent of any single company:

- **Marketing Admin** — manages the public marketing site content.
- **User Admin** — manages platform-wide users and company accounts.

All roles share **one** UI/component system — the same components, layouts, and interaction design — differing only in which features are visible, which actions are permitted, and a per-role accent color.

## Modules

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

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (Postgres + Auth)
- API keys for Resend, Stripe, and OpenAI (optional features degrade gracefully without them)

### Setup

```bash
npm install
npm run dev
```

Create a `.env.local` file in the project root with the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_MAX_OUTPUT_TOKENS=
OPENAI_TIMEOUT_MS=
```

### Seeding data

```bash
node scripts/seed.js          # wipes and rebuilds a full demo dataset (companies, users, shifts, tasks, etc.)
node scripts/reset.js --yes   # wipes to a brand-new empty system (0 companies, 0 users)
```

The app has no data until `node scripts/seed.js` is run. Do this once after `.env.local` is set up, before logging in or exploring the app. `node scripts/reset.js --yes` wipes everything back to an empty system (used to test first-time-registration/empty-state flows); it keeps the two platform admin accounts but removes all companies and demo users, so run `node scripts/seed.js` again afterwards to restore the demo dataset.

### Test accounts

All accounts created by `scripts/seed.js` share the password `111111`.

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

`scripts/seed.js` creates more accounts than this (8 Managers, 8 Employees, 5 Guests, 8 Casual Workers across 4 departments). See the header comment in that file for the full list and department mapping.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:playwright` | Run integration/API and E2E tests (Playwright) |

## Testing

- **Unit tests** — co-located next to each service file as `*.test.ts`, mocking the repository layer.
- **Integration/API tests** — Playwright `request` fixture hitting real API routes, grouped by module under `tests/module<N>/`.
- **E2E tests** — Playwright browser tests for core user journeys (e.g. job posting → hire → schedule → assign task → clock in → attendance).

### Running the test suite

```bash
npm test                    # unit tests (Vitest) — no env vars or network needed, repository layer is mocked
npm run test:playwright     # integration/API + E2E tests (Playwright)
npm run test:playwright -- tests/module5   # run a single module's tests only
```

Unit tests run standalone with no setup. Playwright tests need `.env.local` configured (they hit the real dev Supabase project) and, for E2E specs, the dev server running (`npm run dev`). They create and clean up their own throwaway company/user data (`tests/helpers/seed.ts`), so they do not depend on `scripts/seed.js` having been run first.

Per-use-case Test Case Description documents (with pass/fail evidence) are maintained outside this repo. `docs/testing/` holds the manual test plan, and `docs/testing/BUGLOG.md` tracks defects found during testing.

## Project Structure

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
  lib/              # Supabase client, shared utilities
tests/             # Playwright integration + E2E specs, grouped by module
scripts/           # seed.js / reset.js and one-off data scripts
```
