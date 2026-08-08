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
scripts/           # seed.js and NFR verification scripts (compatibility/perf/security/scale)
```

## 10. Testing

### Unit Testing

Co-located next to each service file as `*.test.ts` (Vitest), mocking the repository layer. No env vars or network access needed.

### E2E Testing

Playwright browser tests for core user journeys (e.g. job posting → hire → schedule → assign task → clock in → attendance), grouped by module under `tests/module<N>/`. Integration/API-level Playwright specs (hitting real routes without a browser) live alongside them in the same folders.

### NFR Testing

Standalone scripts under `scripts/` verify the non-functional requirements directly against a running instance:

- `perf-test.js` — performance (response time under concurrent access)
- `compatibility-test.js` — cross-browser/cross-viewport layout correctness
- `security-auth-test.js` — API-layer session/role enforcement
- `security-rls-isolation-test.js` — database-level cross-company isolation (RLS)
- `seed-scale-test.js` — fixture generator for scalability testing (50-employee company)

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

*(Coming soon.)*

## 12. Known Limitations / Notes

- Server-side session/role validation has been added to most API routes (111/135); the remaining ones are intentionally public (job board, marketing content, reviews), auth-entry endpoints (sign in/up, password reset), or authenticated via a different mechanism (Stripe webhook signature, cron secret).
- Row Level Security (RLS) is currently disabled in the database and is a pre-launch requirement.
- Per-use-case Test Case Description documents (with pass/fail evidence) and the manual test plan are maintained separately, outside this repo's `README.md`.
