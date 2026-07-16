// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { reportService } from '@/services/owner/reportService'
import { AIAnomaly } from '@/types/AI'
import { CompanyReport, DepartmentPerformanceRow, ReportFilters, ReportOverview, ReportPeriod, TaskWorkloadRow } from '@/types/Report'

// 'internal' = Owner Report's Internal tab: Manager/Employee shift coverage, task delivery,
// attendance, and department-level hiring/cost performance only — no individual Casual Worker
// attendance/reliability or job-posting-level detail is fed to the AI (that lives on the
// Casual Worker tab, which is out of scope for this panel).
// 'all' = every signal the report computes, both internal and casual (legacy Partner report page).
export type AnomalyScope = 'all' | 'internal'

// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PANEL IS FOR
//
// Recent Anomalies sits beside five charts that already plot, per department, the current
// period's attendance rate, on-time task rate, hiring success rate, time to fill, and casual
// cost share. So "department X has the worst attendance" is worthless here — the Owner reads
// that off the bar chart in one glance, and spending an anomaly card on it wastes the panel.
//
// This service therefore only surfaces what those charts structurally CANNOT show:
//   1. Work that ran on one person's back — every chart aggregates by department, so a period
//      in which most of a department's tasks went to a single member is invisible. This is the
//      only signal here that is about allocation itself, which is what this product does.
//   2. Period-over-period movement per department — the charts plot the current period only,
//      and the KPI cards trend company-wide totals, so a department going from 5% to 21% is
//      indistinguishable from one that has been at 21% all along.
//   3. Cross-measure contradictions that require aligning two charts by department by eye.
//
// Sample-size caveats are also computed, but they are a GUARDRAIL, not a finding: they exist
// to tell the AI which rates are too small to be worth reporting (a 0% over one task renders
// at full height on the bar chart, and the AI used to report it as a crisis). They must never
// become a card of their own.
//
// A single-measure ranking must never be emitted from here again.
// ─────────────────────────────────────────────────────────────────────────────

// Overview fields that describe internal-staff/company-level performance, safe to hand to the
// AI under 'internal' scope — excludes the casual-worker-only rate/cost breakdowns.
const INTERNAL_OVERVIEW_KEYS = [
  'on_time_attendance_rate', 'on_time_attendance_late_rate', 'on_time_attendance_absent_rate',
  'on_time_task_completion_rate', 'hiring_success_rate', 'average_time_to_fill_days',
  'total_casual_worker_cost', 'total_shifts', 'total_assignments', 'total_tasks',
  'labor_cost', 'uncosted_assignments',
] as const

// Department fields that mean the same thing as the internal overview KPIs above, bucketed per
// department. Deliberately excludes the columns that mix Casual Workers into the number
// (late_count/absent_count/on_time_rate) — under 'internal' scope the AI must not see a figure
// it could mistake for internal-staff performance.
const INTERNAL_DEPT_KEYS = [
  'department_name', 'manager_names', 'shifts', 'assignments', 'tasks_total', 'tasks_completed',
  'rework_count', 'overdue_open', 'internal_attendance_rate', 'internal_attendance_late_rate',
  'internal_attendance_absent_rate', 'internal_attendance_records', 'internal_task_on_time_rate',
  'internal_tasks_due', 'hiring_success_rate', 'average_time_to_fill_days', 'casual_labor_cost',
] as const

// Below this many records/tasks a percentage swings wildly on a single event, so it carries no
// signal on its own — the charts render it at full height regardless, which is exactly the trap
// this panel must not fall into.
const MIN_MEANINGFUL_SAMPLE = 5
// Percentage points a department's rate must move period-over-period before it is worth a card.
const MIN_MEANINGFUL_SWING = 15
// Cost is money, not a rate, so it moves in relative terms — and a swing between trivial amounts
// is not news however large the percentage, hence the floor.
const MIN_COST_SWING_PCT = 50
const MIN_COST_FLOOR = 200
// A department is only "running on one person" if there was a real body of work to divide and
// one member took most of it. Below this many tasks, a majority share is just a small week.
const MIN_DEPT_TASKS_FOR_CONCENTRATION = 8
const MIN_CONCENTRATION_SHARE = 60
// The owner pages through cards one at a time — nobody reads dozens. Only the worst few survive.
const MAX_ANOMALIES = 5

function pickInternalOverview(overview: ReportOverview) {
  return Object.fromEntries(INTERNAL_OVERVIEW_KEYS.map(key => [key, overview[key]]))
}

function pickInternalDepartmentRow(row: DepartmentPerformanceRow) {
  return Object.fromEntries(INTERNAL_DEPT_KEYS.map(key => [key, row[key]]))
}

// ── 1. Sample size — the denominator the charts drop ─────────────────────────
// Stated as an explicit caveat per department so the AI cannot read a tiny-sample rate as a
// crisis. This is the single biggest cause of the useless cards this panel used to produce.
function sampleSizeCaveats(rows: DepartmentPerformanceRow[]): string[] {
  return rows.flatMap(row => {
    const caveats: string[] = []
    if (row.internal_task_on_time_rate !== null && row.internal_tasks_due > 0 && row.internal_tasks_due < MIN_MEANINGFUL_SAMPLE) {
      caveats.push(
        `${row.department_name}: on-time task completion rate of ${row.internal_task_on_time_rate}% is based on only ` +
        `${row.internal_tasks_due} task${row.internal_tasks_due === 1 ? '' : 's'} with a deadline this period — too small ` +
        `a sample to be an anomaly on its own. Do not report this rate as a problem.`,
      )
    }
    if (row.internal_attendance_rate !== null && row.internal_attendance_records > 0 && row.internal_attendance_records < MIN_MEANINGFUL_SAMPLE) {
      caveats.push(
        `${row.department_name}: attendance rates are based on only ${row.internal_attendance_records} attendance ` +
        `record${row.internal_attendance_records === 1 ? '' : 's'} this period — too small a sample to be an anomaly ` +
        `on its own. Do not report them as a problem.`,
      )
    }
    return caveats
  })
}

// ── 1. A department that ran on one person's back ────────────────────────────
// Casual Workers are excluded outright: this reports on internal staff (Manager/Employee), and
// a department leaning on one casual worker is a different story told on a different tab.
// Stated as what happened over the period, never as a claim about anyone's workload right now —
// this is a report, and current load lives on the dashboard.
function concentrationFacts(workload: TaskWorkloadRow[]): string[] {
  const internal = workload.filter(row => row.role === 'Manager' || row.role === 'Employee')

  const byDepartment = new Map<string, TaskWorkloadRow[]>()
  for (const row of internal) {
    const key = row.department_id ?? 'none'
    byDepartment.set(key, [...(byDepartment.get(key) ?? []), row])
  }

  const facts: string[] = []
  for (const members of byDepartment.values()) {
    // One member cannot be a concentration — there was nobody to share with.
    if (members.length < 2) continue
    const total = members.reduce((sum, row) => sum + row.tasks_assigned, 0)
    if (total < MIN_DEPT_TASKS_FOR_CONCENTRATION) continue

    const top = members.reduce((most, row) => (row.tasks_assigned > most.tasks_assigned ? row : most))
    const share = Math.round((top.tasks_assigned / total) * 100)
    if (share < MIN_CONCENTRATION_SHARE) continue

    const others = members.length - 1
    facts.push(
      `${top.department_name}: ${top.full_name} was assigned ${top.tasks_assigned} of the department's ${total} tasks ` +
      `this period, while the other ${others} member${others === 1 ? '' : 's'} shared the remaining ${total - top.tasks_assigned}.`,
    )
  }

  return facts
}

// ── 2. Period-over-period movement per department — invisible in every chart ──
// Only two rates earn a card, deliberately:
//   - absent rate: staff suddenly not turning up is the sharpest operational risk.
//   - on-time task rate: delivery capability sliding is the headline KPI of this product.
// Excluded on purpose, to avoid reporting one event as several anomalies:
//   - attendance (present) rate is the arithmetic complement of absent rate here — the same
//     movement, told twice.
//   - late rate is the third bucket of that same split and generally moves with absence.
//   - hiring success rate / time to fill turn on a handful of postings, so over a week-long
//     window their period-over-period movement is noise, not signal.
// Cost moves too, but it is money rather than a percentage — handled in costTrendFacts below.
type TrendKey = 'internal_attendance_absent_rate' | 'internal_task_on_time_rate'

// Labels are what the OWNER reads (the AI copies signals into visible evidence): plain business
// English, no "internal" qualifier — the whole analysis covers internal staff, so the word adds
// nothing — and never a machine field name.
const TREND_LABELS: Record<TrendKey, { label: string; worseWhen: 'higher' | 'lower' }> = {
  internal_attendance_absent_rate: { label: 'absent rate', worseWhen: 'higher' },
  internal_task_on_time_rate: { label: 'on-time task completion rate', worseWhen: 'lower' },
}

// Enough data on BOTH sides of the comparison, or the movement is noise dressed up as a trend.
function hasSample(row: DepartmentPerformanceRow, key: TrendKey): boolean {
  return key === 'internal_task_on_time_rate'
    ? row.internal_tasks_due >= MIN_MEANINGFUL_SAMPLE
    : row.internal_attendance_records >= MIN_MEANINGFUL_SAMPLE
}

function trendFacts(current: DepartmentPerformanceRow[], previous: DepartmentPerformanceRow[]): string[] {
  const previousByDept = new Map(previous.map(row => [row.department_id ?? 'none', row]))
  const facts: string[] = []

  for (const row of current) {
    const before = previousByDept.get(row.department_id ?? 'none')
    if (!before) continue

    for (const key of Object.keys(TREND_LABELS) as TrendKey[]) {
      const now = row[key]
      const then = before[key]
      if (now === null || then === null) continue
      if (!hasSample(row, key) || !hasSample(before, key)) continue

      const delta = now - then
      if (Math.abs(delta) < MIN_MEANINGFUL_SWING) continue

      const { label, worseWhen } = TREND_LABELS[key]
      const worsened = worseWhen === 'higher' ? delta > 0 : delta < 0
      facts.push(
        `${row.department_name}: ${label} ${worsened ? 'worsened' : 'improved'} from ${then}% in the previous period ` +
        `to ${now}% in this period.`,
      )
    }
  }

  return facts
}

// Casual worker spend per department, period over period. The cost pie plots each department's
// SHARE of the current period only, so a department whose spend quintupled while its share held
// steady looks completely static on the page.
function costTrendFacts(current: DepartmentPerformanceRow[], previous: DepartmentPerformanceRow[]): string[] {
  const previousByDept = new Map(previous.map(row => [row.department_id ?? 'none', row]))
  const facts: string[] = []

  for (const row of current) {
    const before = previousByDept.get(row.department_id ?? 'none')
    if (!before) continue

    const now = row.casual_labor_cost
    const then = before.casual_labor_cost
    // Both sides trivial: a jump between pocket change is not news at any percentage.
    if (Math.max(now, then) < MIN_COST_FLOOR) continue
    // Spend appearing from nothing has no percentage to quote, so it is stated in money.
    if (then === 0) {
      facts.push(
        `${row.department_name}: casual worker cost went from $0 in the previous period to $${now} in this period.`,
      )
      continue
    }

    const changePct = Math.round(((now - then) / then) * 100)
    if (Math.abs(changePct) < MIN_COST_SWING_PCT) continue
    facts.push(
      `${row.department_name}: casual worker cost ${changePct > 0 ? 'rose' : 'fell'} from $${then} in the previous period ` +
      `to $${now} in this period.`,
    )
  }

  return facts
}

// ── 2. Cross-measure contradictions — need two charts aligned by department ───
// Deliberately NOT here: "department took a large share of casual worker cost while its internal
// tasks missed deadlines". That compares money spent on Casual Workers against delivery by
// Manager/Employee staff — two different groups of people, so the comparison implies a causal
// link that does not exist. Cost still earns a card, but only as its own period-over-period
// movement (costTrendFacts), never as a stick to beat internal delivery with.
function crossMeasureFacts(report: CompanyReport): string[] {
  const facts: string[] = []

  for (const row of report.departments) {
    // Staff show up but work still misses deadlines — points at allocation/workload rather than
    // attendance, and the two bar charts sit in different cards.
    if (
      row.internal_attendance_rate !== null && row.internal_attendance_rate >= 80 &&
      row.internal_task_on_time_rate !== null && row.internal_task_on_time_rate < 50 &&
      row.internal_attendance_records >= MIN_MEANINGFUL_SAMPLE && row.internal_tasks_due >= MIN_MEANINGFUL_SAMPLE
    ) {
      facts.push(
        `${row.department_name}: staff attendance was ${row.internal_attendance_rate}% across ${row.internal_attendance_records} records ` +
        `this period, yet only ${row.internal_task_on_time_rate}% of its ${row.internal_tasks_due} tasks finished on time — people were ` +
        `there, so the shortfall came from workload or task allocation, not absence.`,
      )
    }
  }

  return facts
}

function buildSignals(report: CompanyReport, scope: AnomalyScope): string[] {
  return [
    ...sampleSizeCaveats(report.departments),
    ...concentrationFacts(report.workload),
    ...trendFacts(report.departments, report.previous_departments),
    ...costTrendFacts(report.departments, report.previous_departments),
    ...crossMeasureFacts(report),
    ...(scope === 'internal' ? [] : [
      ...report.casual.workers
        .filter(row => row.absent + row.late + row.rejected_shifts > 0)
        .slice(0, 20)
        .map(row => `${row.full_name}: ${row.absent} absent, ${row.late} late, ${row.rejected_shifts} rejected shift(s) this period`),
      ...report.casual.postings
        .filter(row => row.openings !== null && row.openings > 0 && row.confirmed < row.openings)
        .map(row => `Posting "${row.title}": ${row.confirmed}/${row.openings} openings filled (${row.applicants} applicant(s))`),
    ]),
  ]
}

// The AI reads `input` as raw JSON, so anything it would otherwise have to guess about the shape
// of the numbers — units, what null means, which figures are company-wide vs per-department —
// has to be said explicitly, or it guesses wrong.
function fieldNotes(period: ReportPeriod, previousPeriod: ReportPeriod): string[] {
  return [
    `All figures cover ONLY ${period.date_from} to ${period.date_to} inclusive. Nothing outside this range is included in any number below.`,
    `previous_period (${previousPeriod.date_from} to ${previousPeriod.date_to}) is the preceding period of the same length. previous_departments holds the same per-department rows for it.`,
    'Every field ending in _rate is an integer percentage from 0 to 100 (e.g. 18 means 18%), never a fraction.',
    'A rate of null means there was no data to rate in this period — it does NOT mean 0%. Never report a null rate as 0% and never call it an anomaly.',
    '`internal_attendance_records` and `internal_tasks_due` are the DENOMINATORS of the rates next to them. A rate over a handful of records is noise, not an anomaly.',
    '`overview` figures are company-wide totals across all departments. `department_rows` figures are per-department. A company-wide figure must never be described as belonging to one department.',
    '`department_rows[].internal_*` fields cover Manager/Employee staff only; Casual Workers are excluded from them.',
    'Field names in this input are machine identifiers, never display text — refer to them in output by their plain-English meaning only.',
    '`signals` are pre-computed factual statements. They are already correct — prefer them over re-deriving anything yourself.',
  ]
}

export const anomalyDetectionService = {
  // UC63 — feeds the AI nothing but facts computed from recorded data (the same CompanyReport
  // the page shows), and only the facts the page's five charts cannot convey (see the block
  // comment at the top of this file). The code states what happened; the AI decides which of
  // those facts is worth the Owner's attention and what to do about it. No hardcoded severity.
  async detectAnomalies(filters: ReportFilters, scope: AnomalyScope = 'all'): Promise<AIAnomaly[]> {
    const report = await reportService.getCompanyReport(filters)

    const baseInput = {
      field_notes: fieldNotes(report.period, report.previous_period),
      period: report.period,
      previous_period: report.previous_period,
      overview: scope === 'internal' ? pickInternalOverview(report.overview) : report.overview,
      previous_overview: scope === 'internal' ? pickInternalOverview(report.previous_overview) : report.previous_overview,
      department_rows: scope === 'internal'
        ? report.departments.map(pickInternalDepartmentRow)
        : report.departments,
      previous_departments: scope === 'internal'
        ? report.previous_departments.map(pickInternalDepartmentRow)
        : report.previous_departments,
      signals: buildSignals(report, scope),
    }
    const input = scope === 'internal' ? baseInput : {
      ...baseInput,
      casual_worker_rows: report.casual.workers,
      recruitment_funnel: report.casual.funnel,
      recruitment_postings: report.casual.postings,
    }

    const result = await openAIService.generateStructuredJson<{ anomalies: AIAnomaly[] }>({
      schemaName: 'allocation_anomalies',
      maxOutputTokens: 900,
      instructions: [
        'You are an operations analyst for a Smart Task Allocation app.',
        `Report only anomalies within ${report.period.date_from} to ${report.period.date_to}.`,
        scope === 'internal'
          ? 'Only evaluate internal staff (Manager/Employee) shift coverage, task delivery, attendance reliability, and department-level hiring/cost performance. You have not been given individual casual worker or job-posting data, so do not mention or infer anything about them.'
          : 'Prioritize anomalies that affect shift coverage, task delivery, attendance reliability, hiring, or labor cost.',
        // The panel sits next to the charts, so anything the charts already show is wasted space.
        'CRITICAL — your output sits directly beside bar charts that already plot, for every department, this period\'s attendance rate, on-time task completion rate, hiring success rate, time to fill, and share of casual worker cost.',
        'The owner can already see all of that at a glance. An anomaly that restates what those charts show is worthless and must NOT be returned.',
        'Specifically FORBIDDEN, no matter how bad the number looks:',
        '- "Department X has the lowest/highest attendance rate" or any single-measure ranking of departments.',
        '- "Department X has the lowest/highest on-time task completion rate", including a bare "X is at 0%".',
        '- "Department X has the lowest/highest hiring success rate or time to fill."',
        '- Restating a company-wide KPI or its trend arrow — the cards above the charts already show those.',
        'ONLY three kinds of finding are allowed, because only these are invisible on the charts:',
        '(a) A department whose work was concentrated on one member over the period — the charts aggregate by department and never show how work was divided between people.',
        '(b) A department whose absent rate, on-time task completion rate, or casual worker cost moved sharply versus the PREVIOUS period — the charts plot this period only, so movement cannot be seen.',
        '(c) A contradiction between two measures for the same department that requires cross-referencing two separate charts — namely staff attending reliably while their tasks still missed deadlines.',
        'Never weigh casual worker cost against internal staff delivery: that is money spent on one group of people set against work done by a different group, so the comparison is meaningless. Cost may only be discussed as its own movement versus the previous period.',
        'If a finding is none of (a), (b) or (c), do not return it.',
        // This is a report: it accounts for a closed period, it does not brief the owner on live state.
        'THIS IS A REPORT ON A FINISHED PERIOD. Every anomaly must describe what HAPPENED during it, in the past tense. Never describe a current state ("X is overloaded", "nobody is assigned to Y") and never predict what will happen next — that belongs on the dashboard, not here.',
        'The `signals` array already contains every such fact, pre-computed and correct. Build your anomalies from it. If a signal explicitly says not to report something, obey it.',
        'ACCURACY RULES:',
        '1. Read field_notes first; it defines the units and scope of every number.',
        '2. Only state numbers that appear verbatim in the input. Never estimate, round, or invent a figure.',
        '3. Never attribute a company-wide `overview` figure to a specific department.',
        '4. Check every comparison before writing it: a higher percentage is worse for absent/late rates, better for attendance/on-time rates.',
        '5. Skip any measure whose value is null — that means no data, not a problem.',
        '6. Write titles and evidence in plain business English. NEVER reproduce a machine field name from the input — any words_joined_with_underscores (e.g. a field like internal_attendance_absent_rate) must be rendered as its plain-English meaning ("absent rate"), never quoted verbatim.',
        '7. Never use the word "internal" in titles or evidence. This entire analysis covers internal staff only, so the qualifier is redundant noise to the reader.',
        'FORMAT: each anomaly is ONE self-contained sentence carried entirely in `title`, with the exact figures inline — e.g. "Absent rate sharply worsened from 4% to 21% versus the previous period" or "David Lim was assigned 6 of the department\'s 10 tasks, while the other 3 members shared the remaining 4". Never write a vague headline and then repeat it with numbers in evidence — that is the same fact told twice.',
        'Never use parentheses in titles or evidence. Weave every figure into the sentence itself — no bracketed asides like "(60%)" or "(+400%)".',
        '`department` carries the department the finding is about, exactly as named in the input. The UI shows it as a badge in front of the sentence, so `title` must NOT contain the department name. Signals are written as "Department: fact" — the prefix goes into `department`, the fact into `title`.',
        '`evidence` is ONLY for an additional fact the title genuinely could not carry; it must never restate or paraphrase the title. For most anomalies the correct evidence is an empty array.',
        'Evidence lines, when used, must contain ONLY facts about the workforce: departments, people, numbers, periods. NEVER write meta-commentary about what charts do or do not show, what is or is not visible on the page, or why the finding qualifies as an anomaly — the owner is already looking at the page.',
        'Report at most 5 anomalies, most severe first. Only "high" and "medium" severity findings are worth reporting — if something only rates "low", leave it out entirely.',
        'Returning an empty anomalies array is the correct, expected answer when nothing meets this bar. An empty result is far better than a card restating a chart. Never pad the list.',
      ].join(' '),
      input,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          anomalies: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                area: { type: 'string', enum: ['Dashboard', 'Report', 'Attendance', 'Recruitment'] },
                severity: { type: 'string', enum: ['low', 'medium', 'high'] },
                department: { type: 'string' },
                title: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } },
                recommended_action: { type: 'string' },
              },
              required: ['id', 'area', 'severity', 'department', 'title', 'evidence', 'recommended_action'],
            },
          },
        },
        required: ['anomalies'],
      },
    })

    // The UI shows one anomaly at a time and carries no severity badge — position IS the
    // severity signal, so the most severe finding must be the first card. Low severity is
    // dropped outright (not worth a card at all) and the list is capped at MAX_ANOMALIES;
    // since it's sorted first, the cut only ever discards the least severe findings.
    const severityRank: Record<AIAnomaly['severity'], number> = { high: 0, medium: 1, low: 2 }
    return [...result.anomalies]
      .filter(a => a.severity !== 'low')
      .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
      .slice(0, MAX_ANOMALIES)
  },
}
