import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/ai/openAIService', () => ({
  openAIService: {
    generateStructuredJson: vi.fn(),
  },
}))

vi.mock('@/services/owner/reportService', () => ({
  reportService: {
    getCompanyReport: vi.fn(),
  },
}))

import { anomalyDetectionService } from './anomalyDetectionService'
import { openAIService } from '@/services/ai/openAIService'
import { reportService } from '@/services/owner/reportService'

const overview = {
  attendance_rate: 80, on_time_completion_rate: 70, recruitment_fill_rate: 60, labor_cost: 5000, uncosted_assignments: 0,
  total_shifts: 20, total_assignments: 20, total_tasks: 20, total_hires: 3,
  on_time_attendance_rate: 90, on_time_attendance_late_rate: 10, on_time_attendance_absent_rate: 0,
  on_time_task_completion_rate: 50, hiring_success_rate: null, average_time_to_fill_days: null,
  total_casual_worker_cost: 300, casual_rehire_rate: 50, casual_reliable_worker_rate: 60,
  casual_on_time_attendance_rate: 70, casual_on_time_task_completion_rate: 80,
}

// Retail: 10 tasks total, on-time rate based on only 2 due tasks (sample-size guardrail trigger).
const retailRow = {
  department_id: 'dept-1', department_name: 'Retail', manager_names: ['Mgr One'],
  shifts: 10, assignments: 10, tasks_total: 10, tasks_completed: 8, on_time_rate: 50,
  rework_count: 0, overdue_open: 1, late_count: 1, absent_count: 0, labor_cost: 500,
  internal_attendance_rate: 90, internal_attendance_late_rate: 10, internal_attendance_absent_rate: 0,
  internal_task_on_time_rate: 50, hiring_success_rate: null, average_time_to_fill_days: null,
  casual_labor_cost: 100, internal_attendance_records: 10, internal_tasks_due: 2,
  hiring_positions_requested: 0, hiring_positions_hired: 0,
}

// Alex holds 8 of Retail's 10 tasks this period — a concentration signal (share >= 60%, total >= 8).
const workload = [
  { user_id: 'u1', full_name: 'Alex', role: 'Employee', department_id: 'dept-1', department_name: 'Retail', tasks_assigned: 8, tasks_open: 2 },
  { user_id: 'u2', full_name: 'Sam', role: 'Employee', department_id: 'dept-1', department_name: 'Retail', tasks_assigned: 2, tasks_open: 0 },
]

function buildReport() {
  return {
    period: { date_from: '2026-08-01', date_to: '2026-08-07' },
    previous_period: { date_from: '2026-07-25', date_to: '2026-07-31' },
    overview, previous_overview: overview,
    departments: [retailRow], previous_departments: [],
    workload,
    casual: {
      funnel: { applied: 5, accepted: 3, confirmed: 2 }, fill_rate: 60, postings: [], workers: [],
      labor_cost: 300, skill_distribution: [], pool: [],
    },
  }
}

describe('UC67 Generate AI Report Insight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reportService.getCompanyReport).mockResolvedValue(buildReport() as never)
  })

  it('UC67-M-UT-O: Owner opens the Report page and up to 5 anomaly cards are shown, most severe first', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      anomalies: [
        { id: '1', area: 'Report', severity: 'medium', department: 'Retail', title: 'Medium finding', evidence: [], recommended_action: 'Review' },
        { id: '2', area: 'Report', severity: 'high', department: 'Retail', title: 'High finding', evidence: [], recommended_action: 'Act now' },
      ],
    } as never)

    const result = await anomalyDetectionService.detectAnomalies({ company_id: 'comp-1', date_from: '2026-08-01', date_to: '2026-08-07' })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ severity: 'high', title: 'High finding' })
    expect(result[1]).toMatchObject({ severity: 'medium', title: 'Medium finding' })
  })

  it('UC67-M-UT-P: Partner opens the Report page and up to 5 anomaly cards are shown, most severe first', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      anomalies: [
        { id: '1', area: 'Report', severity: 'high', department: 'Retail', title: 'High finding', evidence: [], recommended_action: 'Act now' },
      ],
    } as never)

    const result = await anomalyDetectionService.detectAnomalies({ company_id: 'comp-1', date_from: '2026-08-01', date_to: '2026-08-07' })

    expect(result).toEqual([expect.objectContaining({ severity: 'high', title: 'High finding' })])
  })

  it('UC67-A1-UT-O: No anomaly cards are shown when nothing qualifies for the period', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({ anomalies: [] } as never)

    const result = await anomalyDetectionService.detectAnomalies({ company_id: 'comp-1', date_from: '2026-08-01', date_to: '2026-08-07' })

    expect(result).toEqual([])
  })

  it('UC67-BR-UT-O-1: Low-severity findings are dropped and the list is capped at 5, most severe first', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      anomalies: [
        { id: '1', area: 'Report', severity: 'low', department: 'Retail', title: 'Low finding', evidence: [], recommended_action: '' },
        { id: '2', area: 'Report', severity: 'medium', department: 'Retail', title: 'Medium 1', evidence: [], recommended_action: '' },
        { id: '3', area: 'Report', severity: 'high', department: 'Retail', title: 'High 1', evidence: [], recommended_action: '' },
        { id: '4', area: 'Report', severity: 'high', department: 'Retail', title: 'High 2', evidence: [], recommended_action: '' },
        { id: '5', area: 'Report', severity: 'high', department: 'Retail', title: 'High 3', evidence: [], recommended_action: '' },
        { id: '6', area: 'Report', severity: 'medium', department: 'Retail', title: 'Medium 2', evidence: [], recommended_action: '' },
        { id: '7', area: 'Report', severity: 'high', department: 'Retail', title: 'High 4', evidence: [], recommended_action: '' },
      ],
    } as never)

    const result = await anomalyDetectionService.detectAnomalies({ company_id: 'comp-1', date_from: '2026-08-01', date_to: '2026-08-07' })

    expect(result).toHaveLength(5)
    expect(result.every(a => a.severity !== 'low')).toBe(true)
    expect(result.filter(a => a.severity === 'high')).toHaveLength(4)
    expect(result[4]).toMatchObject({ severity: 'medium' })
  })

  it('UC67-BR-UT-O-2: Numbers are never AI-invented — the concentration fact is pre-computed by the system and handed to AI as an exact sentence', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({ anomalies: [] } as never)

    await anomalyDetectionService.detectAnomalies({ company_id: 'comp-1', date_from: '2026-08-01', date_to: '2026-08-07' })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as { input: { signals: string[] } }
    expect(call.input.signals).toContain(
      "Retail: Alex was assigned 8 of the department's 10 tasks this period, while the other 1 member shared the remaining 2.",
    )
  })

  it('UC67-BR-UT-O-3: A rate based on fewer than 5 underlying records is marked not reportable as a sample-size guardrail', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({ anomalies: [] } as never)

    await anomalyDetectionService.detectAnomalies({ company_id: 'comp-1', date_from: '2026-08-01', date_to: '2026-08-07' })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as { input: { signals: string[] } }
    expect(call.input.signals).toContain(
      'Retail: on-time task completion rate of 50% is based on only 2 tasks with a deadline this period — too small a sample to be an anomaly on its own. Do not report this rate as a problem.',
    )
  })

  it('UC67-BR-UT-O-4: The Internal scope excludes Casual Worker and job-posting detail from what is sent to AI', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({ anomalies: [] } as never)

    await anomalyDetectionService.detectAnomalies({ company_id: 'comp-1', date_from: '2026-08-01', date_to: '2026-08-07' }, 'internal')

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as { input: Record<string, unknown> }
    expect(call.input.casual_worker_rows).toBeUndefined()
    expect(call.input.recruitment_funnel).toBeUndefined()
    expect(call.input.recruitment_postings).toBeUndefined()
  })

  it('UC67-BR-UT-O-5: The legacy all-scope view includes Casual Worker attendance and recruitment posting data', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({ anomalies: [] } as never)

    await anomalyDetectionService.detectAnomalies({ company_id: 'comp-1', date_from: '2026-08-01', date_to: '2026-08-07' }, 'all')

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as { input: Record<string, unknown> }
    expect(call.input.casual_worker_rows).toBeDefined()
    expect(call.input.recruitment_funnel).toBeDefined()
    expect(call.input.recruitment_postings).toBeDefined()
  })
})
