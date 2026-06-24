# CLAUDE.md — Tasking Project Rules

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
- A **Supabase MCP server** is configured so Claude Code can inspect the live schema and apply migrations directly via tool calls during development.
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
- No subtitles/helper-text captions under section headings or toggles (e.g. a small gray line under a heading like "Repeat this shift" explaining what it does). The control and its label must be self-explanatory; don't add a second line of descriptive copy underneath.
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

## 6. Every Claude Code prompt must

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

## 8. Per-use-case development workflow

Reference `docs/Use_Cases_List.md` for the UC list. **Every UC must go through this exact order, end to end, before starting the next UC.** Do not jump ahead to UI before tests pass, and do not start the next UC while this one has an open issue.

1. **Build the backend** for the UC: `route.ts` -> `service.ts` -> `repository.ts` (MVC + Repository, section 4).
2. **Write and run a Unit Test** for the service-layer logic — Vitest, co-located next to the service file as `xxxService.test.ts` (e.g. `src/services/company/companyService.test.ts`). Mock the repository module it calls, and always mock `@/lib/supabase` (`vi.mock('@/lib/supabase', () => ({ supabase: {}, createClient: () => ({}) }))`) so unit tests need no real env vars or network access. Run with `npm test`.
3. **Write and run an Integration/API Test** for the route — Playwright `request` fixture (no browser) hitting the real `route.ts` endpoint against the real dev Supabase project, in `tests/module<N>/<feature>.spec.ts` (one folder per module, e.g. `tests/module6/communication.spec.ts`). Use the seeding helper pattern in `tests/helpers/seed.ts` (create a throwaway Owner+Company via the service-role client, clean it up in `afterAll`). Run with `npm run test:playwright -- tests/module<N>`.
4. **If a test fails, fix the implementation (or the test, if the test was wrong) before continuing.** Never move forward with a known-failing test.
5. **After any fix, re-run the full existing Unit + Integration suite** (`npm test` and `npm run test:playwright`), not just the one use case you were working on — this is the regression check that catches a fix breaking something else.
6. **Only once Unit + Integration pass, build the UI** for the UC (`page.tsx`, calling the API route only).
7. **Hand the UI/usage back to the user for review.** If the user finds a problem (logic or UI), fix it, then go back to step 2 and re-run the full Unit + Integration suite again before re-presenting.
8. **User does a manual real-use pass** once they're satisfied with the review in step 7. Once the user confirms no issues, move to the next UC — no diagram or use-case-description doc needs to be generated per UC; the code itself (per the conventions in section 5) is sufficient to draw the Class Diagram and Sequence Diagram on demand later.

**E2E is the exception — it is NOT required per use case.** Reserve Playwright browser tests (`tests/module<N>/<flow>-ui.spec.ts`, `page` fixture, run with `npm run test:playwright -- tests/module<N>`) for the P1 core user journeys (the ones tied to Smart Task Allocation, e.g. job posting -> hire -> schedule -> assign task -> clock in -> attendance approval) once that journey's UI is wired end to end. Add to it incrementally and re-run it as regression whenever related code changes — do not write a new E2E spec for every use case.

**Test folder structure:** all Playwright specs (both Integration/API and E2E) live under `tests/module<N>/`, grouped by module rather than by test type — e.g. `tests/module1/shift.spec.ts` (API) sits next to `tests/module1/shift-ui.spec.ts` (E2E) if one exists. Shared seeding helpers live in `tests/helpers/`, not under any module folder.

**File-naming rule to avoid the two test runners colliding:** Unit Test files use the `.test.ts` suffix and live under `src/`; Integration and E2E files use the `.spec.ts` suffix and live under `tests/`. Vitest is configured to only look at `src/**/*.test.ts`; Playwright's `testDir` is `./tests`. Keep this split — do not rename across it.

---

## 9. Module build order & autonomous per-module execution

Modules 10 (Marketing CMS) and 11 (User & Company Admin) are **out of scope** — owned by a separate team. Build order for the remaining 9 modules, derived from data/feature dependencies (earlier modules are depended on by later ones):

1. **Module 9 — Account & Authentication** (UC85–91) — foundation; nothing else works without registration/login/company creation.
2. **Module 3 — Team / Company** (UC29–43) — departments, members, company profile that every other module references.
3. **Module 1 — Shift** (UC1–14) — scheduling is the base Task and Attendance sit on.
4. **Module 2 — Task** (UC15–28) — tasks are assigned on shifts.
5. **Module 5 — Attendance** (UC62–72) — clock in/out and the approval chain depend on shift assignment existing.
6. **Module 4 — Recruitment** (UC44–61) — hiring pipeline that feeds Casual Workers, which Shift/Task/Attendance then consume for that role.
7. **Module 6 — Communication** (UC73–76) — independent; announcements and messages.
8. **Module 8 — Settings & Billing** (UC80–84) — multi-company switching and subscription management, gated onto features that already exist by this point.
9. **Module 7 — Report** (UC77–79) — downstream consumer of Shift/Task/Attendance data; build last.

**Autonomous execution rule:** When the user names a module to start (e.g. "做 Module 1" / "开始 Module 3"), pull every UC belonging to that module from `docs/Use_Cases_List.md` and run each one through the full workflow in section 8 — back-to-back, without asking the user which UC to do next or how to do it. Only stop and surface work to the user at the review checkpoints in section 8 steps 7–8 (UI/usage review, then the user's manual real-use pass). Iterate on the user's feedback (fix → re-run the full Unit + Integration suite → re-present) until the user signs the module off (e.g. "pass" / "OK" / "没问题"). Once signed off, automatically continue to the next module in the build order above without waiting to be told — the user only needs to speak up to skip ahead, switch to a different module, or pause. This rule applies in any conversation, new or resumed, since this file is loaded at the start of every session.

**A module is not "done" without its tests in the matching folder.** Every time you build or touch UCs for Module N — UI, backend, or a bugfix — the corresponding Integration/API and (if applicable) E2E spec files must exist under `tests/module<N>/` before you consider that UC finished, per section 8 step 3. Do not leave a module's tests scattered in old `tests/api/`/`tests/e2e/`-style locations, do not skip writing the test "for speed," and do not wait for the user to ask for it separately — it is part of building the module, not an optional add-on. If you discover an existing UC in that module has no test (e.g. while reviewing or extending it), backfill it in the same `tests/module<N>/` folder before moving on, even if that UC was supposedly finished in an earlier session.
