import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/reportRepository', () => ({
  reportRepository: {
    getDepartments: vi.fn(),
    getDepartmentManagers: vi.fn(),
    getShifts: vi.fn(),
    getTasksInRange: vi.fn(),
    getJobPostingsCreatedInRange: vi.fn(),
    getTasksByDeadlineRange: vi.fn(),
    getWorkerCancellationsInRange: vi.fn(),
    getAssignmentsByShiftIds: vi.fn(),
    getAttendanceByAssignmentIds: vi.fn(),
    getUsersByIds: vi.fn(),
    getApplicantsByJobIds: vi.fn(),
    getInvitationsByJobIds: vi.fn(),
    getPriorAttendedCasualUserIds: vi.fn(),
    getLifetimeCompletedShiftsByUserIds: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    getVerifiedPoolWorkers: vi.fn(),
    getClosedPostingsByDateRange: vi.fn(),
    getApplicantCounts: vi.fn(),
    getDepartmentsByIds: vi.fn(),
  },
}))

import { reportService, previousPeriod } from './reportService'
import { reportRepository } from '@/repositories/owner/reportRepository'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'

describe('UC66 Generate Workforce Analytics Report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reportRepository.getDepartments).mockResolvedValue([])
    vi.mocked(reportRepository.getDepartmentManagers).mockResolvedValue([])
    vi.mocked(reportRepository.getShifts).mockResolvedValue([])
    vi.mocked(reportRepository.getTasksInRange).mockResolvedValue([])
    vi.mocked(reportRepository.getJobPostingsCreatedInRange).mockResolvedValue([])
    vi.mocked(reportRepository.getTasksByDeadlineRange).mockResolvedValue([])
    vi.mocked(reportRepository.getWorkerCancellationsInRange).mockResolvedValue([])
    vi.mocked(reportRepository.getAssignmentsByShiftIds).mockResolvedValue([])
    vi.mocked(reportRepository.getAttendanceByAssignmentIds).mockResolvedValue([])
    vi.mocked(reportRepository.getUsersByIds).mockResolvedValue([])
    vi.mocked(reportRepository.getApplicantsByJobIds).mockResolvedValue([])
    vi.mocked(reportRepository.getInvitationsByJobIds).mockResolvedValue([])
    vi.mocked(reportRepository.getPriorAttendedCasualUserIds).mockResolvedValue([])
    vi.mocked(reportRepository.getLifetimeCompletedShiftsByUserIds).mockResolvedValue([])
    vi.mocked(recruitmentRepository.getVerifiedPoolWorkers).mockResolvedValue([])
  })

  it('UC66-M-UT-O: Owner opens the Report page and the system computes the report for both the selected period and the equivalent prior period', async () => {
    const result = await reportService.getCompanyReport({ company_id: 'comp-1', date_from: '2026-08-07', date_to: '2026-08-13' })

    expect(result.period).toEqual({ date_from: '2026-08-07', date_to: '2026-08-13' })
    expect(result.overview).toBeDefined()
    expect(result.previous_overview).toBeDefined()
    expect(result.departments).toBeDefined()
    expect(result.previous_departments).toBeDefined()
    expect(reportRepository.getShifts).toHaveBeenCalledTimes(2)
    expect(reportRepository.getShifts).toHaveBeenCalledWith(expect.objectContaining({ date_from: '2026-08-07', date_to: '2026-08-13' }))
    expect(reportRepository.getShifts).toHaveBeenCalledWith(expect.objectContaining({ date_from: '2026-07-31', date_to: '2026-08-06' }))
  })

  it('UC66-M-UT-P: Partner opens the Report page and the system computes the report for both the selected period and the equivalent prior period', async () => {
    const result = await reportService.getCompanyReport({ company_id: 'comp-1', date_from: '2026-08-07', date_to: '2026-08-13' })

    expect(result.overview).toBeDefined()
    expect(result.previous_overview).toBeDefined()
    expect(reportRepository.getShifts).toHaveBeenCalledTimes(2)
  })

  it('UC66-BR-UT-O: Every figure is computed for both the selected period and the immediately preceding period of the same length', () => {
    const previous = previousPeriod({ date_from: '2026-07-07', date_to: '2026-07-13' })

    expect(previous).toEqual({ date_from: '2026-06-30', date_to: '2026-07-06' })
  })
})
