import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/ai/openAIService', () => ({
  openAIService: { generateStructuredJson: vi.fn() },
}))

vi.mock('@/services/owner/attendanceService', () => ({
  attendanceService: {
    getAttendanceDashboard: vi.fn(),
    finalReviewAttendance: vi.fn(),
  },
}))

import { timesheetAutoApprovalService } from './timesheetAutoApprovalService'
import { openAIService } from '@/services/ai/openAIService'
import { attendanceService } from '@/services/owner/attendanceService'

const pendingRow = {
  assignee_name: 'Aaron Wong',
  department_name: 'Marketing',
  shift: { shift_date: '2026-07-01', start_time: '09:00', end_time: '17:00' },
  record: { id: 'record-1', owner_status: 'pending', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z', employee_notes: null, manager_notes: null },
  exceptions: [],
} as any

const approvedRow = {
  ...pendingRow,
  record: { ...pendingRow.record, id: 'record-2', owner_status: 'approved' },
}

describe('timesheetAutoApprovalService — Generate AI Timesheet Approval Suggestion (UC54)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('reviewTimesheets', () => {
    it('returns no decisions when there are no pending records', async () => {
      vi.mocked(attendanceService.getAttendanceDashboard).mockResolvedValue({ records: [approvedRow], summary: {} as any })

      const result = await timesheetAutoApprovalService.reviewTimesheets('company-1')

      expect(result).toEqual([])
      expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
    })

    it('sends only pending records (capped at 50) to the AI and returns its decisions', async () => {
      vi.mocked(attendanceService.getAttendanceDashboard).mockResolvedValue({ records: [pendingRow, approvedRow], summary: {} as any })
      vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
        decisions: [{ record_id: 'record-1', decision: 'auto_approve', confidence: 95, reason: 'Clean record' }],
      })

      const result = await timesheetAutoApprovalService.reviewTimesheets('company-1')

      const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
      expect(call.input.pending_timesheets).toHaveLength(1)
      expect(call.input.pending_timesheets[0].record_id).toBe('record-1')
      expect(result).toEqual([{ record_id: 'record-1', decision: 'auto_approve', confidence: 95, reason: 'Clean record' }])
    })
  })

  describe('applyAutoApprovals', () => {
    it('only finalizes decisions that are auto_approve and meet the confidence threshold', async () => {
      vi.mocked(attendanceService.getAttendanceDashboard).mockResolvedValue({ records: [pendingRow], summary: {} as any })
      vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
        decisions: [
          { record_id: 'record-1', decision: 'auto_approve', confidence: 90, reason: 'Clean record' },
          { record_id: 'record-2', decision: 'auto_approve', confidence: 50, reason: 'Low confidence' },
          { record_id: 'record-3', decision: 'flag', confidence: 99, reason: 'Needs review' },
        ],
      })

      await timesheetAutoApprovalService.applyAutoApprovals('company-1', 'owner-1', 85)

      expect(attendanceService.finalReviewAttendance).toHaveBeenCalledTimes(1)
      expect(attendanceService.finalReviewAttendance).toHaveBeenCalledWith({
        id: 'record-1',
        owner_id: 'owner-1',
        decision: 'approved',
        owner_notes: 'AI auto-approved: Clean record',
      })
    })

    it('finalizes nothing when no decision clears the confidence bar', async () => {
      vi.mocked(attendanceService.getAttendanceDashboard).mockResolvedValue({ records: [pendingRow], summary: {} as any })
      vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
        decisions: [{ record_id: 'record-1', decision: 'auto_approve', confidence: 40, reason: 'Uncertain' }],
      })

      await timesheetAutoApprovalService.applyAutoApprovals('company-1', 'owner-1', 85)

      expect(attendanceService.finalReviewAttendance).not.toHaveBeenCalled()
    })
  })
})
