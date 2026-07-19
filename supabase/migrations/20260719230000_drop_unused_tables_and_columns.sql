-- Cleanup pass: drop tables/columns confirmed to have zero real UI reachability
-- (no input control anywhere lets a user set them, AND no page anywhere displays them).
-- See conversation audit 2026-07-19 for the per-column evidence trail.

-- ── Orphaned tables ──────────────────────────────────────────────────────────

-- Superseded by employee_off_day_requests; only remaining reference is a defensive
-- cleanup DELETE in ownerTeamRepository.removeMember that tolerates "table does not exist".
drop table if exists employee_fixed_off_days;

-- Full admin CRUD exists (GET/PATCH /api/owner/scheduling-rules) but no page anywhere calls
-- it, and shift-publish validation uses a hardcoded MIN_MANAGERS_PER_DAY constant instead of
-- reading this table — the entire table is unreachable from any live code path.
drop table if exists scheduling_rule_settings;

-- ── job_postings ─────────────────────────────────────────────────────────────

-- Legacy parallel approval-tracking columns, superseded by status ('pending_approval'/
-- 'rejected') + rejection_reason. Zero references anywhere in src/.
alter table job_postings
  drop column if exists approval_status,
  drop column if exists approved_by,
  drop column if exists approved_at,
  drop column if exists approval_notes;

-- Declared in one TypeScript type, never rendered by JobPresentation.tsx (the shared job
-- card/detail component used across owner/guest/casual job views).
alter table job_postings
  drop column if exists benefits,
  drop column if exists job_end_date;

-- Form state declared but never bound to a real input control; the values actually shown to
-- users come from the parent company's own fields (company_industry/company_location) or are
-- derived (salary_type from job type), not these columns.
alter table job_postings
  drop column if exists industry,
  drop column if exists location,
  drop column if exists salary_type,
  drop column if exists recurrence_interval,
  drop column if exists recurrence_unit;

-- ── job_applicants ───────────────────────────────────────────────────────────

-- Written on every AI run but the displayed score is re-derived by parsing ai_summary's JSON,
-- never read from this column. age_at_apply is captured but never rendered anywhere.
alter table job_applicants
  drop column if exists ai_score,
  drop column if exists age_at_apply;

-- ── job_invitations ──────────────────────────────────────────────────────────

-- Always a hardcoded default string; no textarea ever supplies a custom value, and even the
-- one place that captures it into local state never renders it.
alter table job_invitations
  drop column if exists message;

-- ── recruitment_cancellations ────────────────────────────────────────────────

-- Written on every insert but never selected back by any subsequent query.
alter table recruitment_cancellations
  drop column if exists scope;

-- ── announcement_reads ───────────────────────────────────────────────────────

-- Repository only ever selects announcement_id back; read_at is written (likely via a DB
-- default) but never read.
alter table announcement_reads
  drop column if exists read_at;

-- ── shift_swap_requests ──────────────────────────────────────────────────────

-- UC57 (AI Review Requests) was only ever implemented for Fixed Day Off — zero write path
-- exists for these on the Shift Swap side.
alter table shift_swap_requests
  drop column if exists ai_recommendation,
  drop column if exists ai_reason;

-- ── shifts ───────────────────────────────────────────────────────────────────

-- Round-trips silently through the edit-shift form state but no real input control is bound
-- to it, and it's never rendered anywhere a Casual Worker could see the deadline.
alter table shifts
  drop column if exists acceptance_deadline_at;

-- ── task_templates ───────────────────────────────────────────────────────────

-- Written from the same input as `title` on every save, but every render site reads `title`,
-- never `name` — a redundant duplicate of a column that's actually used.
alter table task_templates
  drop column if exists name;

-- ── marketing_pages / marketing_content_blocks ───────────────────────────────

-- title: KEPT — re-audit found it IS displayed: AdminSidebar.tsx nav item label,
-- the URL-picker datalist option label, and the selected-page header, all in the
-- admin CMS (src/app/admin/dashboard/page.tsx). Original audit was wrong on this one.
-- created_at/updated_at: selected but never rendered to any role.
alter table marketing_pages
  drop column if exists created_at,
  drop column if exists updated_at;

alter table marketing_content_blocks
  drop column if exists updated_at;

-- ── messages ─────────────────────────────────────────────────────────────────

-- sender_name: KEPT — re-audit found it IS displayed: ownerInboxService.ts /
-- employeeInboxService.ts use it as conv.lastKnownSenderName, the fallback shown as
-- conv.partnerName when the sender's user record has since been deleted (rendered in
-- owner/communication/page.tsx and equivalents). Original audit was wrong on this one.

-- ── inbox ────────────────────────────────────────────────────────────────────

-- department_id: KEPT — re-audit found it is NOT dead, it's functionally load-bearing:
-- src/app/api/inbox/invites/accept/route.ts reads invite.department_id on invite accept
-- to set the new member's users.department_id and upsert them into manager_departments /
-- employee_departments. Dropping this would silently break department-scoped invitations.
-- Original audit was wrong on this one (checked display only, missed the write-side use).
