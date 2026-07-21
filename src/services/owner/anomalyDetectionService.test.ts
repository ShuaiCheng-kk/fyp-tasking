import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {}, createClient: () => ({}) }))
vi.mock('@/services/owner/reportService', () => ({
  reportService: { getCompanyReport: vi.fn() },
}))
vi.mock('@/services/ai/openAIService', () => ({
  openAIService: { generateStructuredJson: vi.fn() },
}))

import { openAIService } from '@/services/ai/openAIService'
import { reportService } from '@/services/owner/reportService'
import { anomalyDetectionService } from '@/services/owner/anomalyDetectionService'
import { CompanyReport, DepartmentPerformanceRow, RecruitmentPostingRow, ReportOverview, TaskWorkloadRow } from '@/types/Report'

function worker(overrides: Partial<TaskWorkloadRow>): TaskWorkloadRow {
  return {
    user_id: 'user-x',
    full_name: 'Someone',
    role: 'Employee',
    department_id: 'eng',
    department_name: 'Engineering',
    tasks_assigned: 2,
    tasks_open: 0,
    ...overrides,
  }
}

const FILTERS = {
  company_id: 'company-1',
  date_from: '2026-07-08',
  date_to: '2026-07-14',
  department_id: null,
}

function department(overrides: Partial<DepartmentPerformanceRow>): DepartmentPerformanceRow {
  return {
    department_id: 'dept-x',
    department_name: 'Dept X',
    manager_names: [],
    shifts: 5,
    assignments: 5,
    tasks_total: 4,
    tasks_completed: 2,
    on_time_rate: 50,
    rework_count: 0,
    overdue_open: 0,
    late_count: 0,
    absent_count: 0,
    labor_cost: 1000,
    internal_attendance_rate: 80,
    internal_attendance_late_rate: 10,
    internal_attendance_absent_rate: 10,
    internal_attendance_records: 20,
    internal_task_on_time_rate: 50,
    internal_tasks_due: 20,
    hiring_success_rate: null,
    average_time_to_fill_days: null,
    casual_labor_cost: 400,
    hiring_positions_requested: 0,
    hiring_positions_hired: 0,
    ...overrides,
  }
}

function posting(overrides: Partial<RecruitmentPostingRow>): RecruitmentPostingRow {
  return {
    posting_id: 'posting-x',
    title: 'Posting X',
    department_id: 'dept-x',
    department_name: 'Dept X',
    status: 'closed',
    openings: 2,
    applicants: 0,
    accepted: 0,
    confirmed: 0,
    days_to_fill: null,
    created_at: '2026-07-08T09:00:00Z',
    ...overrides,
  }
}

function overview(overrides: Partial<ReportOverview> = {}): ReportOverview {
  return {
    attendance_rate: 80,
    on_time_completion_rate: 50,
    recruitment_fill_rate: null,
    labor_cost: 3000,
    uncosted_assignments: 0,
    total_shifts: 10,
    total_assignments: 10,
    total_tasks: 8,
    total_hires: 0,
    on_time_attendance_rate: 72,
    on_time_attendance_late_rate: 9,
    on_time_attendance_absent_rate: 19,
    on_time_task_completion_rate: 50,
    hiring_success_rate: 80,
    average_time_to_fill_days: 3.3,
    total_casual_worker_cost: 4706,
    casual_rehire_rate: null,
    casual_reliable_worker_rate: null,
    casual_on_time_attendance_rate: null,
    casual_on_time_task_completion_rate: null,
    ...overrides,
  }
}

function reportWith(overrides: Partial<CompanyReport>): CompanyReport {
  return {
    period: { date_from: '2026-07-08', date_to: '2026-07-14' },
    previous_period: { date_from: '2026-07-01', date_to: '2026-07-07' },
    overview: overview(),
    previous_overview: overview(),
    departments: [],
    previous_departments: [],
    workload: [],
    casual: {
      funnel: { applied: 0, accepted: 0, confirmed: 0 },
      fill_rate: null,
      postings: [],
      workers: [],
      pool: [],
      labor_cost: 4706,
      skill_distribution: [],
    },
    ...overrides,
  }
}

type AiCall = { instructions: string; input: Record<string, unknown> }

function lastAiCall(): AiCall {
  const mock = vi.mocked(openAIService.generateStructuredJson)
  return mock.mock.calls[mock.mock.calls.length - 1][0] as unknown as AiCall
}

async function signalsFor(report: CompanyReport): Promise<string[]> {
  vi.mocked(reportService.getCompanyReport).mockResolvedValue(report)
  await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
  return lastAiCall().input.signals as string[]
}

describe('anomalyDetectionService.detectAnomalies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reportService.getCompanyReport).mockResolvedValue(reportWith({}))
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({ anomalies: [] })
  })

  it('scopes the report it analyses to the caller-selected date range', async () => {
    await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    expect(reportService.getCompanyReport).toHaveBeenCalledWith(FILTERS)
  })

  it('states the selected period in the input and the instructions', async () => {
    await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    const call = lastAiCall()
    expect(call.input.period).toEqual({ date_from: '2026-07-08', date_to: '2026-07-14' })
    expect(call.instructions).toContain('2026-07-08 to 2026-07-14')
  })

  // ── The panel sits next to the charts: chart-visible facts are worthless ────

  it('never emits a single-measure department ranking, however bad the number', async () => {
    const signals = await signalsFor(reportWith({
      departments: [
        department({ department_id: 'ops', department_name: 'Operations', internal_attendance_absent_rate: 18 }),
        department({ department_id: 'eng', department_name: 'Engineering', internal_attendance_absent_rate: 21, internal_task_on_time_rate: 0 }),
      ],
    }))
    // "Engineering is worst on X" is what the bar charts already show at a glance.
    expect(signals.some(s => /highest|lowest|worst of any|best of any/i.test(s))).toBe(false)
  })

  it('forbids chart-visible rankings in the instructions', async () => {
    await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    const { instructions } = lastAiCall()
    expect(instructions).toContain('FORBIDDEN')
    expect(instructions).toContain('single-measure ranking')
    expect(instructions).toContain('Returning an empty anomalies array is the correct, expected answer')
  })

  // Title and evidence used to tell the same fact twice (vague headline + numbers repeated
  // below). Each anomaly must now be one self-contained sentence with the figures inline.
  it('demands one self-contained sentence per anomaly, not a headline plus restated numbers', async () => {
    await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    const { instructions } = lastAiCall()
    expect(instructions).toContain('ONE self-contained sentence')
    expect(instructions).toContain('never restate or paraphrase the title')
  })

  // ── 1. Sample size — the denominator the charts drop ──────────────────────

  it('flags a dramatic-looking rate that rests on a tiny sample as not reportable', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({
        department_name: 'Engineering', internal_task_on_time_rate: 0, internal_tasks_due: 1,
      })],
    }))
    const caveat = signals.find(s => s.includes('on-time task completion rate of 0%'))
    expect(caveat).toContain('based on only 1 task with a deadline')
    expect(caveat).toContain('Do not report this rate as a problem')
  })

  it('does not caveat a rate backed by an adequate sample', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({ department_name: 'Engineering', internal_task_on_time_rate: 0, internal_tasks_due: 30 })],
    }))
    expect(signals.some(s => s.includes('too small a sample'))).toBe(false)
  })

  // ── 1. A department that ran on one person's back ─────────────────────────

  it('reports a period whose work was concentrated on one member', async () => {
    const signals = await signalsFor(reportWith({
      workload: [
        worker({ user_id: 'u1', full_name: 'Li Si', tasks_assigned: 17 }),
        worker({ user_id: 'u2', full_name: 'Wang Wu', tasks_assigned: 4 }),
        worker({ user_id: 'u3', full_name: 'Zhao Liu', tasks_assigned: 4 }),
      ],
    }))
    const fact = signals.find(s => s.includes('Li Si'))
    expect(fact).toContain("Li Si was assigned 17 of the department's 25 tasks this period")
    expect(fact).toContain('other 2 members shared the remaining 8')
  })

  // Report = what happened. A claim about anyone's load right now belongs on the dashboard.
  it('states concentration in the past tense, not as a current workload claim', async () => {
    const signals = await signalsFor(reportWith({
      workload: [
        worker({ user_id: 'u1', full_name: 'Li Si', tasks_assigned: 17 }),
        worker({ user_id: 'u2', full_name: 'Wang Wu', tasks_assigned: 8 }),
      ],
    }))
    const fact = signals.find(s => s.includes('Li Si'))!
    expect(fact).toContain('was assigned')
    expect(fact).not.toMatch(/is overloaded|currently|right now|holds \d+ tasks/)
  })

  it('instructs the AI that this reports a finished period, not live state', async () => {
    await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    expect(lastAiCall().instructions).toContain('THIS IS A REPORT ON A FINISHED PERIOD')
  })

  it('ignores Casual Workers when judging concentration', async () => {
    const signals = await signalsFor(reportWith({
      workload: [
        worker({ user_id: 'u1', full_name: 'Casual Cat', role: 'Casual Worker', tasks_assigned: 40 }),
        worker({ user_id: 'u2', full_name: 'Wang Wu', tasks_assigned: 5 }),
        worker({ user_id: 'u3', full_name: 'Zhao Liu', tasks_assigned: 5 }),
      ],
    }))
    expect(signals.some(s => s.includes('Casual Cat'))).toBe(false)
  })

  it('does not call a one-member department a concentration', async () => {
    const signals = await signalsFor(reportWith({
      workload: [worker({ user_id: 'u1', full_name: 'Solo Sam', tasks_assigned: 20 })],
    }))
    expect(signals.some(s => s.includes('Solo Sam'))).toBe(false)
  })

  it('does not call a quiet week a concentration', async () => {
    const signals = await signalsFor(reportWith({
      workload: [
        worker({ user_id: 'u1', full_name: 'Li Si', tasks_assigned: 4 }),
        worker({ user_id: 'u2', full_name: 'Wang Wu', tasks_assigned: 1 }),
      ],
    }))
    expect(signals.some(s => s.includes('Li Si'))).toBe(false)
  })

  it('does not report work that was shared reasonably evenly', async () => {
    const signals = await signalsFor(reportWith({
      workload: [
        worker({ user_id: 'u1', full_name: 'Li Si', tasks_assigned: 7 }),
        worker({ user_id: 'u2', full_name: 'Wang Wu', tasks_assigned: 6 }),
        worker({ user_id: 'u3', full_name: 'Zhao Liu', tasks_assigned: 5 }),
      ],
    }))
    expect(signals.some(s => s.includes('were assigned to'))).toBe(false)
  })

  // ── 2. Period-over-period movement per department ─────────────────────────

  it('reports a department whose rate moved sharply since the previous period', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({ department_id: 'eng', department_name: 'Engineering', internal_attendance_absent_rate: 21 })],
      previous_departments: [department({ department_id: 'eng', department_name: 'Engineering', internal_attendance_absent_rate: 4 })],
    }))
    const trend = signals.find(s => s.includes('absent rate'))
    expect(trend).toContain('worsened from 4% in the previous period to 21% in this period')
  })

  it('calls a falling on-time task rate a worsening, not an improvement', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({ department_id: 'eng', department_name: 'Engineering', internal_task_on_time_rate: 20 })],
      previous_departments: [department({ department_id: 'eng', department_name: 'Engineering', internal_task_on_time_rate: 90 })],
    }))
    expect(signals.some(s => s.includes('on-time task completion rate worsened from 90% in the previous period to 20%'))).toBe(true)
  })

  it('ignores a movement too small to matter', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({ department_id: 'eng', department_name: 'Engineering', internal_attendance_absent_rate: 12 })],
      previous_departments: [department({ department_id: 'eng', department_name: 'Engineering', internal_attendance_absent_rate: 10 })],
    }))
    expect(signals.some(s => s.includes('absent rate'))).toBe(false)
  })

  it('ignores a large movement that rests on a tiny sample on either side', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({ department_id: 'eng', department_name: 'Engineering', internal_attendance_absent_rate: 50, internal_attendance_records: 2 })],
      previous_departments: [department({ department_id: 'eng', department_name: 'Engineering', internal_attendance_absent_rate: 0, internal_attendance_records: 30 })],
    }))
    expect(signals.some(s => s.includes('absent rate worsened'))).toBe(false)
  })

  // Attendance (present) rate is the complement of absent rate, and late rate is the third
  // bucket of the same split — reporting them would tell one story as three anomalies.
  it('does not report attendance or late rate movement, only absence', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({
        department_id: 'eng', department_name: 'Engineering',
        internal_attendance_rate: 60, internal_attendance_late_rate: 30, internal_attendance_absent_rate: 10,
      })],
      previous_departments: [department({
        department_id: 'eng', department_name: 'Engineering',
        internal_attendance_rate: 90, internal_attendance_late_rate: 5, internal_attendance_absent_rate: 5,
      })],
    }))
    expect(signals.some(s => s.includes('late rate'))).toBe(false)
    expect(signals.some(s => /attendance rate (worsened|improved)/.test(s))).toBe(false)
  })

  // ── Cost movement — the pie plots share, never direction ──────────────────

  it('reports a department whose casual worker cost jumped, though its pie share may not move', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({ department_id: 'eng', department_name: 'Engineering', casual_labor_cost: 4000 })],
      previous_departments: [department({ department_id: 'eng', department_name: 'Engineering', casual_labor_cost: 800 })],
    }))
    const cost = signals.find(s => s.includes('casual worker cost'))
    expect(cost).toContain('rose from $800 in the previous period to $4000 in this period')
  })

  it('states new spend in money when there is no previous cost to divide by', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({ department_id: 'eng', department_name: 'Engineering', casual_labor_cost: 900 })],
      previous_departments: [department({ department_id: 'eng', department_name: 'Engineering', casual_labor_cost: 0 })],
    }))
    expect(signals.some(s => s.includes('casual worker cost went from $0 in the previous period to $900'))).toBe(true)
  })

  it('ignores a large percentage swing between trivial amounts', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({ department_id: 'eng', department_name: 'Engineering', casual_labor_cost: 60 })],
      previous_departments: [department({ department_id: 'eng', department_name: 'Engineering', casual_labor_cost: 10 })],
    }))
    expect(signals.some(s => s.includes('casual worker cost'))).toBe(false)
  })

  it('ignores routine cost drift', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({ department_id: 'eng', department_name: 'Engineering', casual_labor_cost: 1100 })],
      previous_departments: [department({ department_id: 'eng', department_name: 'Engineering', casual_labor_cost: 1000 })],
    }))
    expect(signals.some(s => s.includes('casual worker cost'))).toBe(false)
  })

  // Everything the five charts don't plot but the owner would not act on — dropped by design.
  it('no longer reports unassigned shifts, overdue tasks, rework, or uncosted work', async () => {
    const signals = await signalsFor(reportWith({
      overview: overview({ uncosted_assignments: 7 }),
      departments: [department({ department_name: 'Marketing', shifts: 6, assignments: 0, overdue_open: 4, rework_count: 3 })],
    }))
    expect(signals.some(s => /nobody assigned|past their deadline|rejected back for rework|neither a shift flat rate/.test(s))).toBe(false)
  })

  // ── 2. Cross-measure contradictions ───────────────────────────────────────

  // Money spent on Casual Workers vs deadlines met by Manager/Employee staff compares two
  // different groups of people, implying a causal link that isn't there.
  it('never weighs casual worker spend against internal delivery', async () => {
    const signals = await signalsFor(reportWith({
      overview: overview({ total_casual_worker_cost: 1000 }),
      departments: [department({
        department_name: 'Engineering', casual_labor_cost: 400,
        internal_task_on_time_rate: 20, internal_tasks_due: 15,
      })],
    }))
    expect(signals.some(s => /% of casual worker cost.*while only/.test(s))).toBe(false)
  })

  it('reports staff present but work still late — points at allocation, not absence', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({
        department_name: 'Customer Support',
        internal_attendance_rate: 95, internal_attendance_records: 40,
        internal_task_on_time_rate: 30, internal_tasks_due: 25,
        casual_labor_cost: 0,
      })],
    }))
    expect(signals.some(s => s.includes('people were there, so the shortfall came from workload or task allocation'))).toBe(true)
  })

  // ── 4. Hiring success rate gap, explained by the posting funnel ───────────

  it('reports a department whose hiring success rate trails a peer, with the funnel behind it', async () => {
    const signals = await signalsFor(reportWith({
      departments: [
        department({ department_id: 'eng', department_name: 'Engineering', hiring_success_rate: 33, hiring_positions_requested: 3, hiring_positions_hired: 1 }),
        department({ department_id: 'mkt', department_name: 'Marketing', hiring_success_rate: 100, hiring_positions_requested: 3, hiring_positions_hired: 3 }),
      ],
      casual: {
        funnel: { applied: 0, accepted: 0, confirmed: 0 }, fill_rate: null, workers: [], pool: [], labor_cost: 0, skill_distribution: [],
        postings: [posting({ posting_id: 'p1', department_id: 'eng', title: 'IT Helpdesk Temp Support', status: 'closed', openings: 3, applicants: 1, accepted: 1, confirmed: 1 })],
      },
    }))
    const fact = signals.find(s => s.includes('Engineering') && s.includes('hiring success rate'))
    expect(fact).toContain('hiring success rate was 33% this period, well behind Marketing\'s 100%')
    expect(fact).toContain('Engineering ran 1 job posting this period')
    expect(fact).toContain('"IT Helpdesk Temp Support" closed and needed 3 people, drew 1 applicant, accepted 1 of them, and ended with 1 confirmed hire')
  })

  it('includes a still-open posting with zero applicants in the funnel facts', async () => {
    const signals = await signalsFor(reportWith({
      departments: [
        department({ department_id: 'eng', department_name: 'Engineering', hiring_success_rate: 0, hiring_positions_requested: 4, hiring_positions_hired: 0 }),
        department({ department_id: 'mkt', department_name: 'Marketing', hiring_success_rate: 100, hiring_positions_requested: 3, hiring_positions_hired: 3 }),
      ],
      casual: {
        funnel: { applied: 0, accepted: 0, confirmed: 0 }, fill_rate: null, workers: [], pool: [], labor_cost: 0, skill_distribution: [],
        postings: [posting({ posting_id: 'p1', department_id: 'eng', title: 'Warehouse Temp', status: 'open', openings: 4, applicants: 0, accepted: 0, confirmed: 0 })],
      },
    }))
    const fact = signals.find(s => s.includes('Engineering') && s.includes('hiring success rate'))
    expect(fact).toContain('"Warehouse Temp" is still open and needed 4 people, drew 0 applicants, accepted 0 of them, and ended with 0 confirmed hires')
  })

  it('ignores a hiring gap that rests on too few requested positions', async () => {
    const signals = await signalsFor(reportWith({
      departments: [
        department({ department_id: 'eng', department_name: 'Engineering', hiring_success_rate: 0, hiring_positions_requested: 1, hiring_positions_hired: 0 }),
        department({ department_id: 'mkt', department_name: 'Marketing', hiring_success_rate: 100, hiring_positions_requested: 3, hiring_positions_hired: 3 }),
      ],
      casual: {
        funnel: { applied: 0, accepted: 0, confirmed: 0 }, fill_rate: null, workers: [], pool: [], labor_cost: 0, skill_distribution: [],
        postings: [posting({ department_id: 'eng', title: 'Solo Position', status: 'closed', openings: 1, applicants: 0, accepted: 0, confirmed: 0 })],
      },
    }))
    expect(signals.some(s => s.includes('hiring success rate'))).toBe(false)
  })

  it('ignores a hiring gap too small to matter', async () => {
    const signals = await signalsFor(reportWith({
      departments: [
        department({ department_id: 'eng', department_name: 'Engineering', hiring_success_rate: 75, hiring_positions_requested: 4, hiring_positions_hired: 3 }),
        department({ department_id: 'mkt', department_name: 'Marketing', hiring_success_rate: 90, hiring_positions_requested: 4, hiring_positions_hired: 4 }),
      ],
      casual: {
        funnel: { applied: 0, accepted: 0, confirmed: 0 }, fill_rate: null, workers: [], pool: [], labor_cost: 0, skill_distribution: [],
        postings: [posting({ department_id: 'eng', title: 'Line Cook', status: 'closed', openings: 4, applicants: 6, accepted: 3, confirmed: 3 })],
      },
    }))
    expect(signals.some(s => s.includes('hiring success rate'))).toBe(false)
  })

  it('does not report a hiring gap when there is no comparable peer department', async () => {
    const signals = await signalsFor(reportWith({
      departments: [
        department({ department_id: 'eng', department_name: 'Engineering', hiring_success_rate: 20, hiring_positions_requested: 5, hiring_positions_hired: 1 }),
      ],
      casual: {
        funnel: { applied: 0, accepted: 0, confirmed: 0 }, fill_rate: null, workers: [], pool: [], labor_cost: 0, skill_distribution: [],
        postings: [posting({ department_id: 'eng', title: 'Solo Dept Posting', status: 'closed', openings: 5, applicants: 1, accepted: 1, confirmed: 1 })],
      },
    }))
    expect(signals.some(s => s.includes('hiring success rate'))).toBe(false)
  })

  it('the instructions describe the hiring funnel gap as an allowed, non-judgmental finding', async () => {
    await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    const { instructions } = lastAiCall()
    expect(instructions).toContain('ONLY four kinds of finding are allowed')
    expect(instructions).toContain('never invent a (d) finding without one of these signal lines')
    expect(instructions).toContain('low applicant interest is a normal, blameless outcome')
  })

  // ── Scope + plumbing ──────────────────────────────────────────────────────

  it('withholds casual-mixed department columns under internal scope', async () => {
    vi.mocked(reportService.getCompanyReport).mockResolvedValue(reportWith({ departments: [department({})] }))
    await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    const rows = lastAiCall().input.department_rows as Record<string, unknown>[]
    expect(rows[0]).toHaveProperty('internal_tasks_due', 20)
    for (const mixedKey of ['late_count', 'absent_count', 'on_time_rate', 'labor_cost']) {
      expect(rows[0]).not.toHaveProperty(mixedKey)
    }
  })

  it('sends previous-period department rows so movement can be judged', async () => {
    vi.mocked(reportService.getCompanyReport).mockResolvedValue(reportWith({
      departments: [department({})],
      previous_departments: [department({ internal_attendance_absent_rate: 4 })],
    }))
    await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    const previous = lastAiCall().input.previous_departments as Record<string, unknown>[]
    expect(previous[0]).toHaveProperty('internal_attendance_absent_rate', 4)
  })

  it('sends full rows and casual signals under all scope', async () => {
    vi.mocked(reportService.getCompanyReport).mockResolvedValue(reportWith({ departments: [department({})] }))
    await anomalyDetectionService.detectAnomalies(FILTERS, 'all')
    const call = lastAiCall()
    const rows = call.input.department_rows as Record<string, unknown>[]
    expect(rows[0]).toHaveProperty('labor_cost')
    expect(call.input).toHaveProperty('casual_worker_rows')
    expect(call.input).toHaveProperty('recruitment_postings')
  })

  // Signals are copied into visible evidence by the AI, so they must read as plain business
  // English: no chart/visibility meta-commentary, no machine field names (underscores), and
  // no "internal" qualifier — the whole analysis is internal staff, the reader knows.
  it('keeps meta talk, field names, and the internal qualifier out of every signal', async () => {
    const signals = await signalsFor(reportWith({
      departments: [department({ department_id: 'eng', department_name: 'Engineering', internal_attendance_absent_rate: 21, casual_labor_cost: 4000 })],
      previous_departments: [department({ department_id: 'eng', department_name: 'Engineering', internal_attendance_absent_rate: 4, casual_labor_cost: 800 })],
      workload: [
        worker({ user_id: 'u1', full_name: 'Li Si', tasks_assigned: 17 }),
        worker({ user_id: 'u2', full_name: 'Wang Wu', tasks_assigned: 8 }),
      ],
    }))
    expect(signals.length).toBeGreaterThan(0)
    // No parentheses either: bracketed asides like "(60%)" read as machine output on screen.
    expect(signals.every(s => !/chart|visible|this page|pie\b|internal|_|\(/i.test(s))).toBe(true)
  })

  // The panel shows one card at a time with no severity badge — order IS the severity signal,
  // low severity isn't worth a card at all, and nobody pages through dozens: cap at 5.
  const anomaly = (id: string, severity: 'low' | 'medium' | 'high') => ({
    id, area: 'Report' as const, severity, department: 'Engineering', title: id, evidence: [], recommended_action: 'act',
  })

  it('returns anomalies sorted most-severe first and drops low severity entirely', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      anomalies: [anomaly('a-low', 'low'), anomaly('a-high', 'high'), anomaly('a-med', 'medium')],
    })
    const result = await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    expect(result.map(a => a.id)).toEqual(['a-high', 'a-med'])
  })

  it('caps the list at 5, cutting only the least severe findings', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      anomalies: [
        anomaly('m1', 'medium'), anomaly('m2', 'medium'), anomaly('m3', 'medium'),
        anomaly('h1', 'high'), anomaly('h2', 'high'), anomaly('h3', 'high'), anomaly('h4', 'high'),
      ],
    })
    const result = await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    expect(result).toHaveLength(5)
    expect(result.map(a => a.id)).toEqual(['h1', 'h2', 'h3', 'h4', 'm1'])
  })

  it('returns the anomalies the AI produced', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      anomalies: [{
        id: 'a1', area: 'Attendance', severity: 'high', department: 'Engineering',
        title: 'Absence spike', evidence: ['Rose from 4% to 21% since last period'],
        recommended_action: 'Review staffing.',
      }],
    })
    const result = await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Absence spike')
    expect(result[0].department).toBe('Engineering')
  })

  it('passes an empty anomaly list straight through rather than padding it', async () => {
    const result = await anomalyDetectionService.detectAnomalies(FILTERS, 'internal')
    expect(result).toEqual([])
  })
})
