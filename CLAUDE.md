# CLAUDE.md — Tasking Project Rules

> Read this and `Owner_Use_Cases.md` before writing any code. This file is the source of truth and overrides the PRD. If a request conflicts with this file, stop and flag it instead of guessing.

---

## 1. What Tasking is

A **Smart Task Allocation** web app for SMEs. Work is assigned down a hierarchy; higher roles see everything below. The headline feature is **task allocation**, not scheduling. Stack: Next.js + React (TypeScript), Supabase (Postgres / Auth / Storage), Vercel, Resend for email.

We build **Owner first as the full superset**, then create lower roles by removing features and narrowing scope — never by rebuilding.

---

## 2. Roles (6) and inheritance

Internal roles form a strict superset chain — a higher role has every feature of all roles below it:
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

**No shared UI components between roles.** Each role has its own route group, layout, sidebar, theme (Owner: black/orange · Partner: white/orange · Manager: dark blue/white · Employee: dark green/white).

---

## 3. Data model (the spine — this reflects the REAL Supabase schema; do not deviate)

> This is the actual database. If code assumes a column that isn't here (e.g. `shifts.assigned_user_id`), the code is wrong — fix the code to match this, do NOT add the column. Always confirm against the live schema before coding.

**Scheduling — a Shift and its assignment are SEPARATE tables (a shift can be assigned to one or more users):**

- **`shifts`**: `id`, `company_id`, `department_id`, `title` (default ''), `instruction`, `shift_date`, `start_time`, `end_time`, `status` (default `'active'`), `created_by`, `created_at`, `updated_at`. **No assigned_user_id.**
- **`shift_assignments`**: `id`, `shift_id`, `user_id` (the assignee), `assigned_by`, `assignment_status` (default `'assigned'`), `supervisor_employee_id` (the Employee overseeing), `created_at`, `updated_at`. **This is where "who is on a shift" lives.** To assign a shift to someone, insert a row here.

**Tasks** (not built yet — block 2 will create the `tasks` table). A Task belongs to a Shift; fields to confirm at build time: `id`, `shift_id`, `company_id`, `department_id`, `title`, `description`, `assigned_user_id`, `assigned_by`, `status` (`Todo`→`In Progress`→`Done`), `percentage_complete` (0–100 int, default 0), `parent_task_id` (nullable, for sub-tasks), `priority` (opt), `due_at` (opt), `created_at`.

**Attendance — already exists:**
- **`attendance_records`**: `id`, `shift_assignment_id`, `casual_worker_id`, `clock_in_time`, `clock_out_time`, `confirmed_by_employee_id`, `submitted_by_employee_id`, `status` (default `'pending'`), `employee_notes`, `manager_notes`, `created_at`, `updated_at`. The columns encode the 4-tier chain (Employee confirms/submits → Manager notes → Owner final).

**Recruitment — already exists:** `job_postings`, `job_applicants`, `job_invitations`. (See live schema for fields; postings carry title/description/requirements/location/employment_type/status/salary/recurrence.)

**Role↔department membership tables:** `manager_departments`, `employee_departments`, `casualworker_departments`. Use these to list people in a department. (`users` also has a denormalized `department_id`, but the membership tables are authoritative for who belongs where.)

**Rules that still hold:**
- **Task assignment is strictly one level down**: Owner→Manager, Manager→Employee, Employee→Casual Worker. No self-assign, no skipping levels.
- **Both Employees and Casual Workers** are scheduled (via `shift_assignments`) and assigned tasks.
- **Attendance approval = 4 tiers**: Casual Worker clocks in/out → supervising **Employee** confirms (`confirmed_by_employee_id`) and submits → **Manager** reviews (`manager_notes`) → **Owner** final approval. Each tier can approve, reject, or send back.

If a feature needs a column not in the live schema, add it via a clearly listed SQL migration — and note it here so this stays the single source of truth.

---

## 4. Timeline (the centrepiece)

The Timeline lives **inside the Dashboard module** — not a separate sidebar item. The Dashboard is the command centre: the Timeline (scheduling + task allocation + anomaly highlights) is the main panel; existing Dashboard widgets (department management, etc.) are sub-sections of the same page.

One Timeline pattern, reused per role; only **scope** and **edit rights** differ:
- Owner / Partner: all departments, full edit.
- Manager: own department(s), full edit.
- Employee: own shifts, read-only (+ confirm attendance, update own task status).
- Casual Worker: own shifts, read-only (+ accept/reject, clock in/out).

Day view splits into two 8-hour strips: top = 07:00–15:00, bottom = 15:00–23:00. Date navigation: a compact date picker (calendar + prev/next arrows + Today), up to 2 days back, forward through next week. **Shifts are NOT created from the Timeline** — the Timeline is display-only for shifts (click an existing shift to view/edit/delete). New shifts are assigned from the Department side-drawer: open a department → pick a person → "Assign Shift". Owner Timeline surfaces anomaly highlights (uncovered = red, late/absent = orange, understaffed = warning) — the manual precursor to AI Anomaly Detection.

---

## 5. AI boundary

AI is used in **exactly four** features; everything else is manual:
- AI Candidate Recommendation (Recruitment)
- AI Job Description Generator (Recruitment)
- AI Auto-approve Timesheets (Attendance)
- AI Anomaly Detection (Dashboard / Report)

**Build-order rule for everything (AI or not):**
1. Build the feature **manually first** — it must fully work by hand.
2. Isolate the decision point behind a **service function** (e.g. `recommendCandidates(applicants)`), so swapping manual logic for an OpenAI/Gemini API call later is a one-function change, no refactor.
3. AI is "just an API behind a service function." Never let AI logic leak into routes, repositories, or UI. Do not add AI anywhere else; if it seems warranted, flag it instead.

---

## 6. Architecture (non-negotiable)

Strictly follow MVC + Repository:
- **`route.ts` = Controller only** — parse request, validate, call service, return response. No business logic, no DB access.
- **`service.ts` = Business logic only** — no HTTP handling, no direct DB access.
- **`repository.ts` = DB access only** — Supabase queries only, no business logic.
- **`page.tsx` = UI only** — call API routes only; no direct service or DB calls.

**Folders:** `src/app/(marketing)/` · `src/app/(auth)/` · `src/app/api/` (controllers) · `src/app/owner|partner|manager|employee/` (pages) · `src/services/` · `src/repositories/` · `src/types/` · `src/lib/supabase.ts`.

**Other firm rules:**
- No shared components between roles. Branch-per-feature on GitHub.
- Auth via Supabase `supabase_auth_id`; passwords never stored in `users`.
- Invitation codes: Manager/Employee = 5-digit numeric; Owner/Partner = 8-char alphanumeric; expire in 7 days; role values title-case (`'Manager'`).
- Existing users get inbox notifications (not emails) for subsequent company invites.
- FK ordering: never set `used_by` before the user row exists in `users`.
- Import departments = read data only, **no emails**. Import members = **sends invitation emails**. Keep these separate.
- Announcements + Messages = one "Communication" module, two tabs.
- RLS disabled in dev; re-enable before production.
- Read existing files before creating new ones. Don't change unrelated pages or API routes.

---

## 7. Diagram-friendly code conventions

Code must be readable enough that a teammate (or an AI given the code) can draw the MVC class diagram and sequence diagrams directly from it:
1. One feature = one consistently named set of files across all four layers (e.g. `shift/route.ts`, `shiftService.ts`, `shiftRepository.ts`, `types/Shift.ts`).
2. Every entity = one interface in `src/types/`, one per file, all fields explicitly typed.
3. Service functions named **verb + Entity** (`createShift`, `assignTask`, `approveAttendance`). No `handle`/`process`/`doStuff`.
4. Calls flow strictly one direction, never skipping a layer: `page → route → service → repository → Supabase`, returning back up the same path. This call order IS the sequence diagram.
5. Function signatures are explicit and typed using the `types/` interfaces (`createShift(input: ShiftInput): Promise<Shift>`).

---

## 8. Every Claude Code prompt must

1. **Begin** with the MVC + Repository block from section 6.
2. **Follow** the structure: READ files first → PROBLEM → numbered FIX steps → constraints → CHANGE TYPE.
3. **End** with one of: `CHANGE TYPE: Code only` or `CHANGE TYPE: Supabase SQL first, then code` (SQL listed separately).

---

## 9. Known open issues (don't re-break)

- Middleware/session cookie timing: signin redirect can fire before cookie is fully written.
- Navbar shows Dashboard/Logout in unauthenticated/incognito state (T-21, T-22).
