// Single source of truth for Free/Paid feature gating.
// Mirrors docs/Feature_Tier_List.md — update both together.
// A company's plan is a company-level field (companies.plan), so every internal role
// (Owner/Partner/Manager/Employee) in that company shares the same tier automatically.
// Casual Worker, Guest User, and the platform admin roles are never gated by this.

export type PaidOnlyUcId =
  // Module 1 — Shift
  | 'UC2' | 'UC6' | 'UC7' | 'UC9' | 'UC10' | 'UC11'
  // Module 2 — Task
  | 'UC14' | 'UC16' | 'UC17' | 'UC19' | 'UC20' | 'UC22' | 'UC23'
  // Module 3 — Team / Company
  | 'UC29' | 'UC32' | 'UC33'
  // Module 4 — Recruitment
  | 'UC36' | 'UC39' | 'UC47' | 'UC48'
  // Module 5 — Attendance
  | 'UC57'
  // Module 7 — Report (gated as a whole page, not per-control — ids kept for completeness)
  | 'UC62' | 'UC63' | 'UC64'

const PAID_ONLY_UCS = new Set<PaidOnlyUcId>([
  'UC2', 'UC6', 'UC7', 'UC9', 'UC10', 'UC11',
  'UC14', 'UC16', 'UC17', 'UC19', 'UC20', 'UC22', 'UC23',
  'UC29', 'UC32', 'UC33',
  'UC36', 'UC39', 'UC47', 'UC48',
  'UC57',
  'UC62', 'UC63', 'UC64',
])

export function isPaidPlan(plan: string | null | undefined): boolean {
  return plan === 'Paid'
}

/** True when the given UC's UI should render for this company's plan. */
export function isFeatureEnabled(plan: string | null | undefined, ucId: PaidOnlyUcId): boolean {
  if (!PAID_ONLY_UCS.has(ucId)) return true
  return isPaidPlan(plan)
}
