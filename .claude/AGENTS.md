# AGENTS.md — Tasking Project Rules

> Read this and `docs/Use_Cases_List.md` before writing any code. This file is the source of truth and overrides the PRD. If a request conflicts with this file, stop and flag it instead of guessing.

---

## 1. What Tasking is

A **Smart Task Allocation** web app for SMEs. Work is assigned down a hierarchy; higher roles see everything below. The headline feature is **task allocation**, not scheduling. Stack: Next.js + React (TypeScript), Supabase (Postgres / Auth / Storage), Vercel, Resend for email.

We build **Owner first as the full superset**, then create lower roles by removing features and narrowing scope — never by rebuilding.

---

## 2. Roles and inheritance

Internal company hierarchy is a strict superset chain — a higher role has every feature of all roles below it:
```
Owner  ⊇  Partner  ⊇  Manager  ⊇  Employee
```
- **Owner** — all departments/companies; can schedule & assign across all departments; only role that can delete a company.
- **Partner** — identical to Owner, EXCEPT cannot delete a company they were *invited into*. Implement as an Owner clone with that one guard.
- **Manager** — scoped to their assigned department(s).
- **Employee** — own shifts/tasks; supervises Casual Workers under them. Employees ARE scheduled on shifts and assigned tasks (full-time internal staff).

External roles are independent and **never inherited** by Owner:
- **Casual Worker** — own work only: accept/reject shifts, clock in/out, profile, availability, skills.
- **Guest User** — public job board only; on register becomes a Casual Worker (pending applicant).

Platform-level roles — manage the SaaS platform itself, not scoped to a single company, separate from the company hierarchy above and **never inherited** by Owner:
- **Marketing Admin** — manages marketing-page content only (the public marketing site). Login redirects to `/admin/dashboard`. Cannot manage users, companies, recruitment/job-board data, or any Owner/Partner/Manager/Employee/Casual Worker operational module.
- **User Admin** — manages platform-wide users and company accounts at the SaaS-operator level (e.g. account status, company onboarding/removal across the whole platform). Exact feature list to be finalized when this role is built.

**UI principle — applies to every role above:** there is exactly **one shared UI/component system** for the whole app. Owner is built first as the full feature superset; every other role (Partner, Manager, Employee, Marketing Admin, User Admin, Casual Worker, Guest) reuses the *same* components, layouts, and visual design — never a separate theme, never a rebuilt page. The only thing that changes per role is **which features/menu items are visible and which actions are permitted**, gated by permissions — not a visually distinct UI. Each role can still have its own Next.js route group (`src/app/owner/`, `src/app/partner/`, etc.) for access-control routing, but it must render the shared components, not a duplicated bespoke version.

**Subscription tier (Free/Paid) is a second, independent axis — same shared-UI principle, gated separately from role.** Build every feature assuming the Paid tier first (the full feature set per `docs/Use_Cases_List.md`), then gate Free-tier restrictions through **one shared mechanism** (e.g. a single `isFeatureEnabled(plan, ucId)` check or a `<PaidGate>` wrapper component) — never by duplicating "if Free, hide this" logic separately on each role's page. Role scope and tier gating both apply at once and independently: a Manager on a Free-plan company still only sees their own department (role scope) and, within that, only the Free-tier features (tier gating). Gating happens at the individual feature/action level inside the existing shared page (e.g. one button on the Shifts page shows an upgrade prompt instead of running) — never by building a separate "Free" page or duplicating a page per tier.

---

## 3. Data model — live schema is the source of truth, not this file

**Do not trust hardcoded column lists in docs (including this section) — they go stale the moment anyone edits the DB directly in Supabase.** Before writing any query or migration:
1. Confirm the live schema first — via `supabase db pull` (pulls the current remote schema into a local migration) or by inspecting it through the Supabase MCP server (see tooling below). Never assume from memory or old docs.
2. If a feature needs a column that doesn't exist, add it via a migration file in `supabase/migrations/` and push it — don't silently assume it exists.

**Conceptual map (tables and relationships, not exact columns — verify columns live):**
- `shifts` / `shift_assignments` — a Shift and its assignment are separate tables; a shift can be assigned to one or more users via `shift_assignments`. There is no `assigned_user_id` on `shifts` itself.
- `tasks` — belongs to a Shift; status flow `Todo` → `In Progress` → `Done`; supports sub-tasks via `parent_task_id`.
- `attendance_records` — encodes the 4-tier approval chain described below.
- `job_postings`, `job_applicants`, `job_invitations` — recruitment.
- `manager_departments`, `employee_departments`, `casualworker_departments` — role↔department membership; authoritative for "who belongs to which department."

**Business rules that hold regardless of column changes:**
- **Task assignment is strictly one level down**: Owner→Manager, Manager→Employee, Employee→Casual Worker. No self-assign, no skipping levels.
- **Both Employees and Casual Workers** are scheduled (via `shift_assignments`) and assigned tasks.
- **Attendance approval = 4 tiers**: Casual Worker clocks in/out → supervising **Employee** confirms and submits → **Manager** reviews → **Owner** final approval. Each tier can approve, reject, or send back.

**Local DB tooling — so schema changes never require manual copy-paste into the Supabase dashboard:**
- The project uses the **Supabase CLI**, linked to the live project. Schema changes are written as migration files under `supabase/migrations/` and applied with `supabase db push` — directly from the terminal/VSCode.
- A **Supabase MCP server** is configured so the assistant can inspect the live schema and apply migrations directly via tool calls during development.
- Whenever the live schema changes (via migration or directly in the Supabase dashboard), run `supabase db pull` to resync local migration history before continuing work.

---

## 4. Architecture (non-negotiable)

Strictly follow MVC + Repository:
- **`route.ts` = Controller only** — parse request, validate, call service, return response. No business logic, no DB access.
- **`service.ts` = Business logic only** — no HTTP handling, no direct DB access.
- **`repository.ts` = DB access only** — Supabase queries only, no business logic.
- **`page.tsx` = UI only** — call API routes only; no direct service or DB calls.

**Folders:** `src/app/(marketing)/` · `src/app/(auth)/` · `src/app/api/` (controllers) · `src/app/owner|partner|manager|employee|admin/` (pages) · `src/services/` · `src/repositories/` · `src/types/` · `src/lib/supabase.ts`.

**Other firm rules:**
- Branch-per-feature on GitHub.
- Auth via Supabase `supabase_auth_id`; passwords never stored in `users`.
- Invitation codes: Manager/Employee = 5-digit numeric; Owner/Partner = 8-char alphanumeric; expire in 7 days; role values title-case (`'Manager'`).
- Existing users get inbox notifications (not emails) for subsequent company invites.
- FK ordering: never set `used_by` before the user row exists in `users`.
- Import departments = read data only, **no emails**. Import members = **sends invitation emails**. Keep these separate.
- Announcements + Messages = one "Communication" module, two tabs.
- Any clickable non-button surface (for example cards, badges, tiles, rows, and plan/subscription chips) must have a visible interaction motion such as hover lift, shadow, or border/accent change. Buttons already have their own button states; this rule is for clickable surfaces that might otherwise look static.
- RLS disabled in dev; re-enable before production.
- Read existing files before creating new ones. Don't change unrelated pages or API routes.

---

## 5. Diagram-friendly code conventions

Code must be readable enough that a teammate (or an AI given the code) can draw the MVC class diagram and sequence diagrams directly from it:
1. One feature = one consistently named set of files across all four layers (e.g. `shift/route.ts`, `shiftService.ts`, `shiftRepository.ts`, `types/Shift.ts`).
2. Every entity = one interface in `src/types/`, one per file, all fields explicitly typed.
3. Service functions named **verb + Entity** (`createShift`, `assignTask`, `approveAttendance`). No `handle`/`process`/`doStuff`.
4. Calls flow strictly one direction, never skipping a layer: `page → route → service → repository → Supabase`, returning back up the same path. This call order IS the sequence diagram.
5. Function signatures are explicit and typed using the `types/` interfaces (`createShift(input: ShiftInput): Promise<Shift>`).

---

## 6. Every Codex prompt must

1. **Begin** with the MVC + Repository block from section 4.
2. **Follow** the structure: READ files first → PROBLEM → numbered FIX steps → constraints → CHANGE TYPE.
3. **End** with one of: `CHANGE TYPE: Code only` or `CHANGE TYPE: Supabase SQL first, then code` (SQL listed separately).
4. **Bug fixes**: don't narrate what was changed back to the user in detail — just confirm it's fixed, unless asked for specifics.

---

## 7. Known open issues (don't re-break)

- Middleware/session cookie timing: signin redirect can fire before cookie is fully written.
- Navbar shows Dashboard/Logout in unauthenticated/incognito state (T-21, T-22).
- `src/proxy.ts` contains role-based route-guard logic (redirects unauthenticated/wrong-role users) but is named wrong for Next.js to load it as middleware — it currently does nothing. No route-protection middleware is active. Needs a decision: rename to `src/middleware.ts` to wire it up, or remove if route guarding is meant to stay page-level.

---

## 8. Testing requirement per use case

Reference `docs/Use_Cases_List.md` for the UC list. For every use case's backend work (`route.ts` -> `service.ts` -> `repository.ts`), before touching its UI or moving to the next use case:

1. **Write and run a Unit Test** for the service-layer logic — Vitest, co-located next to the service file as `xxxService.test.ts` (e.g. `src/services/company/companyService.test.ts`). Mock the repository module it calls, and always mock `@/lib/supabase` (`vi.mock('@/lib/supabase', () => ({ supabase: {}, createClient: () => ({}) }))`) so unit tests need no real env vars or network access. Run with `npm test`.
2. **Write and run an Integration/API Test** for the route — Playwright `request` fixture (no browser) hitting the real `route.ts` endpoint against the real dev Supabase project, in `tests/api/<feature>.spec.ts`. Use the seeding helper pattern in `tests/helpers/seed.ts` (create a throwaway Owner+Company via the service-role client, clean it up in `afterAll`). Run with `npm run test:api`.
3. **If a test fails, fix the implementation (or the test, if the test was wrong) before continuing.** Never move to the next use case with a known-failing test.
4. **After any fix, re-run the full existing Unit + Integration suite** (`npm test` and `npm run test:api`), not just the one use case you were working on — this is the regression check that catches a fix breaking something else.

**E2E is the exception — it is NOT required per use case.** Reserve Playwright browser tests (`tests/e2e/<flow>.spec.ts`, `page` fixture, run with `npm run test:e2e`) for the P1 core user journeys (the ones tied to Smart Task Allocation, e.g. job posting -> hire -> schedule -> assign task -> clock in -> attendance approval) once that journey's UI is wired end to end. Add to it incrementally and re-run it as regression whenever related code changes — do not write a new E2E spec for every use case.

**File-naming rule to avoid the two test runners colliding:** Unit Test files use the `.test.ts` suffix and live under `src/`; Integration and E2E files use the `.spec.ts` suffix and live under `tests/`. Vitest is configured to only look at `src/**/*.test.ts`; Playwright's `testDir` is `./tests`. Keep this split — do not rename across it.
