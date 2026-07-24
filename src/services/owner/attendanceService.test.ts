import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Pin the clock (Date only — real timers stay live for async) so date math is deterministic.
// Several suites below derive "yesterday's weekday" locally while the service compares against
// UTC deadline instants; with the real clock, runs between local midnight and the UTC-offset
// hour land on different local/UTC dates and those tests fail spuriously. Wednesday noon UTC
// keeps the local and UTC calendar date identical for any timezone within UTC-11..UTC+11.
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-07-08T12:00:00.000Z'))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getAssignmentsByCompany: vi.fn(),
    getAssignmentsByCompanyAndDateRange: vi.fn(),
    getAttendanceRecordsByAssignmentIds: vi.fn(),
    getAttendanceRecordById: vi.fn(),
    getAttendanceRecordContext: vi.fn(),
    updateAttendanceRecord: vi.fn(),
    getUsersByIds: vi.fn(),
    getDepartmentsByIds: vi.fn(),
    getShiftSwapRequestsByCompany: vi.fn(),
    getShiftSwapRequestById: vi.fn(),
    updateShiftSwapRequest: vi.fn(),
    updateShiftAssignmentUser: vi.fn(),
    getShiftAssignmentById: vi.fn(),
    getShiftAssignmentsByIds: vi.fn(),
    getPendingSwapRequestsByAssignment: vi.fn(),
    createShiftSwapRequest: vi.fn(),
    getTasksByShiftAssignment: vi.fn(),
    getMovableTasksByShiftAssignment: vi.fn(),
    getTasksByShiftIds: vi.fn(),
    getMovableTasksByShiftIds: vi.fn(),
    getOffDayRequestsByCompany: vi.fn(),
    getFixedOffDayRequestById: vi.fn(),
    getFixedOffDayRequestsByIds: vi.fn(),
    updateFixedOffDayRequest: vi.fn(),
    decideFixedOffDayRequestGroupAtomic: vi.fn(),
    createFixedOffDayRequests: vi.fn(),
    deleteFixedOffDayRequestsByUserAndWeek: vi.fn(),
    getFixedOffDayRequestsByUser: vi.fn(),
    getFixedOffDayRequestsByUserAndWeek: vi.fn(),
    getOffDayRequestsByCompanyAndWeek: vi.fn(),
    getEmployeeIdsByDepartments: vi.fn(),
    getEmployeesByCompany: vi.fn(),
    getManagersByCompany: vi.fn(),
    countApprovedShiftSwapsForUser: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/offDaySettingsRepository', () => ({
  offDaySettingsRepository: {
    getQuotaForUser: vi.fn(),
    getCompanyDefaultQuota: vi.fn(),
    getDeadline: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/shiftSwapSettingsRepository', () => ({
  shiftSwapSettingsRepository: {
    getSettings: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/shiftSwapDepartmentSettingsRepository', () => ({
  shiftSwapDepartmentSettingsRepository: {
    getSettings: vi.fn(),
    getSettingsForDepartments: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByAuthIdOrInternalId: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    reassignTasksForShiftSwap: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/ownerTeamRepository', () => ({
  ownerTeamRepository: {
    findManagerDepartments: vi.fn(),
  },
}))

import { attendanceService } from './attendanceService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { offDaySettingsRepository } from '@/repositories/owner/offDaySettingsRepository'
import { shiftSwapSettingsRepository } from '@/repositories/owner/shiftSwapSettingsRepository'
import { shiftSwapDepartmentSettingsRepository } from '@/repositories/owner/shiftSwapDepartmentSettingsRepository'
import { taskRepository } from '@/repositories/owner/taskRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { authRepository } from '@/repositories/auth/authRepository'
import { weekStart } from '@/lib/schedulingConstants'

const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const dayAfterStr = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const todayStr = new Date().toISOString().slice(0, 10)

describe('attendanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('finalReviewAttendance (UC50: Review Attendance Record)', () => {
    beforeEach(() => {
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'owner-1', role: 'Owner' } as any])
    })

    it('approves a record and stamps the reviewer/timestamp', async () => {
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
        id: 'rec-1', clock_in_time: '09:00', clock_out_time: '17:00',
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
      } as any)
      vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

      await attendanceService.finalReviewAttendance({ id: 'rec-1', owner_id: 'owner-1', decision: 'approved' })

      expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('rec-1', expect.objectContaining({
        owner_status: 'approved',
        owner_reviewed_by: 'owner-1',
        status: 'owner_approved',
      }))
    })

    it('writes adjusted clock times and updated break times on a modified decision (UC56)', async () => {
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
        id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
        break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:30:00Z',
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
      } as any)
      vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

      await attendanceService.finalReviewAttendance({
        id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: 'Forgot to clock out on time',
        clock_in_time: '2026-07-01T09:05:00Z', clock_out_time: '2026-07-01T17:10:00Z',
        break_in_time: '2026-07-01T12:15:00Z', break_out_time: '2026-07-01T12:45:00Z',
      })

      expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('rec-1', expect.objectContaining({
        owner_adjusted_clock_in_time: '2026-07-01T09:05:00Z',
        owner_adjusted_clock_out_time: '2026-07-01T17:10:00Z',
        break_in_time: '2026-07-01T12:15:00Z',
        break_out_time: '2026-07-01T12:45:00Z',
        status: 'owner_modified',
      }))
    })

    it('keeps existing break times when a modified decision omits them, and never touches them on approve', async () => {
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
        id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
        break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:30:00Z',
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
      } as any)
      vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

      await attendanceService.finalReviewAttendance({ id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: 'No change needed, re-confirming' })

      expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('rec-1', expect.objectContaining({
        break_in_time: '2026-07-01T12:00:00Z',
        break_out_time: '2026-07-01T12:30:00Z',
      }))

      await attendanceService.finalReviewAttendance({ id: 'rec-1', owner_id: 'owner-1', decision: 'approved' })

      expect(attendanceRepository.updateAttendanceRecord).toHaveBeenLastCalledWith('rec-1', expect.objectContaining({
        break_in_time: '2026-07-01T12:00:00Z',
        break_out_time: '2026-07-01T12:30:00Z',
        owner_status: 'approved',
      }))
    })

    it('records only the time fields that actually changed, at minute precision (M badge)', async () => {
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
        id: 'rec-1', clock_in_time: '2026-07-01T09:00:23.512Z', clock_out_time: '2026-07-01T17:00:00Z',
        break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:30:00Z',
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
      } as any)
      vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

      // clock_in_time round-trips through the modal's AM/PM picker unchanged in substance
      // (only loses sub-minute precision); break_out_time is a genuine 15-min change.
      await attendanceService.finalReviewAttendance({
        id: 'rec-1', owner_id: 'mgr-1', decision: 'modified', owner_notes: 'Extended lunch break approved',
        clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
        break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:45:00Z',
      })

      expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('rec-1', expect.objectContaining({
        owner_modified_fields: ['break_out_time'],
        owner_modified_original_values: { break_out_time: '2026-07-01T12:30:00Z' },
      }))
    })

    it('does not overwrite owner_modified_fields/owner_modified_original_values on approve/reject (keeps the last modification on record)', async () => {
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
        id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
        break_in_time: null, break_out_time: null,
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
        owner_modified_fields: ['clock_in_time'],
        owner_modified_original_values: { clock_in_time: '2026-07-01T08:55:00Z' },
      } as any)
      vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

      await attendanceService.finalReviewAttendance({ id: 'rec-1', owner_id: 'owner-1', decision: 'approved' })

      expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('rec-1', expect.objectContaining({
        owner_modified_fields: ['clock_in_time'],
        owner_modified_original_values: { clock_in_time: '2026-07-01T08:55:00Z' },
      }))
    })

    it('keeps showing the TRUE original (not the previous edit) across a second modification of the same field', async () => {
      // First edit already happened: break_out went from 12:30 -> 12:45, recorded as the original.
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
        id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
        break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:45:00Z',
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
        owner_modified_fields: ['break_out_time'],
        owner_modified_original_values: { break_out_time: '2026-07-01T12:30:00Z' },
      } as any)
      vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

      // Second edit: break_out changed again, to 13:00 this time.
      await attendanceService.finalReviewAttendance({
        id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: 'Adjusting again after further review',
        break_out_time: '2026-07-01T13:00:00Z',
      })

      // The stored "original" must still be 12:30 (the very first value), never 12:45 (the prior edit).
      expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('rec-1', expect.objectContaining({
        owner_modified_fields: ['break_out_time'],
        owner_modified_original_values: { break_out_time: '2026-07-01T12:30:00Z' },
      }))
    })

    it('downgrades to approved (no reason needed, M badge cleared) when edited back to the true original', async () => {
      // Clock In was previously modified from the true original 09:00 to 09:10.
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
        id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
        break_in_time: null, break_out_time: null,
        owner_adjusted_clock_in_time: '2026-07-01T09:10:00Z', owner_adjusted_clock_out_time: null,
        owner_modified_fields: ['clock_in_time'],
        owner_modified_original_values: { clock_in_time: '2026-07-01T09:00:00Z' },
      } as any)
      vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

      // Edited back to 09:00 — exactly the true original — with no reason supplied.
      await attendanceService.finalReviewAttendance({
        id: 'rec-1', owner_id: 'owner-1', decision: 'modified',
        clock_in_time: '2026-07-01T09:00:00Z',
      })

      expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('rec-1', expect.objectContaining({
        owner_status: 'approved',
        owner_notes: null,
        owner_modified_fields: [],
        owner_modified_original_values: {},
        status: 'owner_approved',
      }))
    })

    it('stays modified (reason still required) when only some fields revert to their true original', async () => {
      // Both clock_in and break_out were previously modified.
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
        id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
        break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:45:00Z',
        owner_adjusted_clock_in_time: '2026-07-01T09:10:00Z', owner_adjusted_clock_out_time: null,
        owner_modified_fields: ['clock_in_time', 'break_out_time'],
        owner_modified_original_values: { clock_in_time: '2026-07-01T09:00:00Z', break_out_time: '2026-07-01T12:30:00Z' },
      } as any)

      // Clock In reverts to 09:00 (true original), but break_out stays changed — no reason given.
      await expect(attendanceService.finalReviewAttendance({
        id: 'rec-1', owner_id: 'owner-1', decision: 'modified',
        clock_in_time: '2026-07-01T09:00:00Z', break_out_time: '2026-07-01T13:00:00Z',
      })).rejects.toThrow('A reason is required when modifying attendance times')
      expect(attendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
    })

    it('rejects an invalid decision value before touching the repository', async () => {
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({ id: 'rec-1' } as any)

      await expect(attendanceService.finalReviewAttendance({ id: 'rec-1', owner_id: 'owner-1', decision: 'bogus' as any }))
        .rejects.toThrow('Invalid attendance decision')
      expect(attendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
    })

    it('throws when the record does not exist', async () => {
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(null)

      await expect(attendanceService.finalReviewAttendance({ id: 'missing', owner_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('Attendance record not found')
    })

    describe('UC56: modified time-range validation', () => {
      const baseExisting = {
        id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
        break_in_time: null, break_out_time: null,
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
      }

      it('rejects a Clock In later than Clock Out', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseExisting as any)

        await expect(attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: 'Testing an invalid range',
          clock_in_time: '2026-07-01T17:30:00Z', clock_out_time: '2026-07-01T17:00:00Z',
        })).rejects.toThrow('Clock In cannot be later than Clock Out')
        expect(attendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
      })

      it('rejects a Break In later than Break Out', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseExisting as any)

        await expect(attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: 'Testing an invalid range',
          break_in_time: '2026-07-01T12:30:00Z', break_out_time: '2026-07-01T12:00:00Z',
        })).rejects.toThrow('Break In cannot be later than Break Out')
        expect(attendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
      })

      it('rejects a Break In outside the Clock In/Out range', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseExisting as any)

        await expect(attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: 'Testing an invalid range',
          break_in_time: '2026-07-01T08:00:00Z', break_out_time: '2026-07-01T08:30:00Z',
        })).rejects.toThrow('Break In must be between Clock In and Clock Out')
        expect(attendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
      })

      it('rejects a Break Out outside the Clock In/Out range', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseExisting as any)

        await expect(attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: 'Testing an invalid range',
          break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T18:00:00Z',
        })).rejects.toThrow('Break Out must be between Clock In and Clock Out')
        expect(attendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
      })

      it('validates the modified times against the EXISTING record when the input omits them', async () => {
        // input only touches break times — clock_in/out fall back to the existing (already-invalid-if-swapped) record
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
          ...baseExisting, clock_in_time: '2026-07-01T17:00:00Z', clock_out_time: '2026-07-01T09:00:00Z',
        } as any)

        await expect(attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: 'Testing fallback to existing record',
          break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:30:00Z',
        })).rejects.toThrow('Clock In cannot be later than Clock Out')
      })

      it('allows a valid modified time range, breaks included', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseExisting as any)
        vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

        await attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: 'Corrected after reviewing timesheet',
          clock_in_time: '2026-07-01T09:05:00Z', clock_out_time: '2026-07-01T17:05:00Z',
          break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:30:00Z',
        })

        expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalled()
      })

      it('does not validate time ranges on approve/reject decisions', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
          ...baseExisting, clock_in_time: '2026-07-01T17:00:00Z', clock_out_time: '2026-07-01T09:00:00Z',
        } as any)
        vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

        await expect(attendanceService.finalReviewAttendance({ id: 'rec-1', owner_id: 'owner-1', decision: 'approved' }))
          .resolves.toBeDefined()
      })
    })

    describe('UC56: reason required on a modified decision', () => {
      it('rejects a modified decision with no reason', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
          id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
          break_in_time: null, break_out_time: null,
          owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
        } as any)

        await expect(attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'owner-1', decision: 'modified',
          clock_in_time: '2026-07-01T07:00:00Z',
        })).rejects.toThrow('A reason is required when modifying attendance times')
        expect(attendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
      })

      it('rejects a modified decision with a blank/whitespace-only reason', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
          id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
          break_in_time: null, break_out_time: null,
          owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
        } as any)

        await expect(attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: '   ',
          clock_in_time: '2026-07-01T07:00:00Z',
        })).rejects.toThrow('A reason is required when modifying attendance times')
        expect(attendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
      })

      it('does not require a reason for approve/reject decisions', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
          id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
          owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
        } as any)
        vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

        await expect(attendanceService.finalReviewAttendance({ id: 'rec-1', owner_id: 'owner-1', decision: 'approved' }))
          .resolves.toBeDefined()
      })
    })

    describe('UC56: Owner/Partner outrank Manager for modifying a record', () => {
      it('blocks a Manager from modifying a record Owner/Partner already modified', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
          id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
          break_in_time: null, break_out_time: null,
          owner_adjusted_clock_in_time: '2026-07-01T07:35:00Z', owner_adjusted_clock_out_time: null,
          owner_status: 'modified', owner_reviewed_by: 'owner-1',
        } as any)
        vi.mocked(attendanceRepository.getUsersByIds).mockImplementation(async (ids: string[]) => {
          const all = [
            { id: 'mgr-1', role: 'Manager' },
            { id: 'owner-1', role: 'Owner' },
            { id: 'emp-1', role: 'Employee' },
          ]
          return all.filter(u => ids.includes(u.id)) as any
        })
        vi.mocked(attendanceRepository.getAttendanceRecordContext).mockResolvedValue({
          assignee_user_id: 'emp-1', department_id: 'dept-ops', company_id: 'company-1',
        })
        vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-ops', department_name: 'Ops' }])

        await expect(attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'mgr-1', decision: 'modified', owner_notes: 'Trying to correct it again',
          clock_in_time: '2026-07-01T08:00:00Z',
        })).rejects.toThrow('This record was last modified by Owner/Partner and can no longer be modified by a Manager')
        expect(attendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
      })

      it('still allows Owner/Partner to modify a record a Manager already modified', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
          id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
          break_in_time: null, break_out_time: null,
          owner_adjusted_clock_in_time: '2026-07-01T07:35:00Z', owner_adjusted_clock_out_time: null,
          owner_status: 'modified', owner_reviewed_by: 'mgr-1',
        } as any)
        vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'owner-1', role: 'Owner' } as any])
        vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

        await attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'owner-1', decision: 'modified', owner_notes: 'Owner overriding the manager\'s edit',
          clock_in_time: '2026-07-01T07:00:00Z',
        })

        expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalled()
        // Owner/Partner short-circuit before any department/context lookup is needed.
        expect(attendanceRepository.getAttendanceRecordContext).not.toHaveBeenCalled()
      })

      it('allows a Manager to modify a record never touched by Owner/Partner', async () => {
        vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
          id: 'rec-1', clock_in_time: '2026-07-01T09:00:00Z', clock_out_time: '2026-07-01T17:00:00Z',
          break_in_time: null, break_out_time: null,
          owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
          owner_status: 'pending', owner_reviewed_by: null,
        } as any)
        vi.mocked(attendanceRepository.getUsersByIds).mockImplementation(async (ids: string[]) => {
          const all = [{ id: 'mgr-1', role: 'Manager' }, { id: 'emp-1', role: 'Employee' }]
          return all.filter(u => ids.includes(u.id)) as any
        })
        vi.mocked(attendanceRepository.getAttendanceRecordContext).mockResolvedValue({
          assignee_user_id: 'emp-1', department_id: 'dept-ops', company_id: 'company-1',
        })
        vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-ops', department_name: 'Ops' }])
        vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

        await attendanceService.finalReviewAttendance({
          id: 'rec-1', owner_id: 'mgr-1', decision: 'modified', owner_notes: 'Employee forgot to clock in on time',
          clock_in_time: '2026-07-01T09:10:00Z',
        })

        expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalled()
      })
    })
  })

  describe('getAttendanceDashboard (UC51: View Attendance Status)', () => {
    it('computes summary counts from real queried rows, not invented numbers', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompany).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'rec-1', shift_assignment_id: 'asn-1', casual_worker_id: 'user-1', confirmed_by_employee_id: 'user-1', submitted_by_employee_id: 'user-1', clock_in_time: '2026-01-01T09:00:00Z', clock_out_time: '2026-01-01T17:00:00Z', owner_status: 'approved' },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const dashboard = await attendanceService.getAttendanceDashboard('company-1')

      expect(dashboard.records).toHaveLength(1)
      expect(dashboard.summary.total_assignments).toBe(1)
      expect(dashboard.summary.approved).toBe(1)
      expect(dashboard.summary.pending_final_review).toBe(0)
    })

    it('does not flag a clock-in inside the 10-minute grace period as late (UC49)', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompany).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'rec-1', shift_assignment_id: 'asn-1', casual_worker_id: 'user-1', confirmed_by_employee_id: 'user-1', submitted_by_employee_id: 'user-1', clock_in_time: '2026-01-01T09:10:00Z', clock_out_time: null, owner_status: 'pending' },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const dashboard = await attendanceService.getAttendanceDashboard('company-1')

      expect(dashboard.records[0].exceptions).not.toContain('late')
    })

    it('flags a clock-in past the 10-minute grace period as late (UC49)', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompany).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'rec-1', shift_assignment_id: 'asn-1', casual_worker_id: 'user-1', confirmed_by_employee_id: 'user-1', submitted_by_employee_id: 'user-1', clock_in_time: '2026-01-01T09:11:00Z', clock_out_time: null, owner_status: 'pending' },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const dashboard = await attendanceService.getAttendanceDashboard('company-1')

      expect(dashboard.records[0].exceptions).toContain('late')
    })

    it('surfaces who last reviewed/modified a record, so the UI can tell a Manager correction apart from an Owner one', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompany).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'rec-1', shift_assignment_id: 'asn-1', casual_worker_id: 'user-1', confirmed_by_employee_id: 'user-1', submitted_by_employee_id: 'user-1', clock_in_time: '2026-01-01T09:00:00Z', clock_out_time: '2026-01-01T17:00:00Z', owner_status: 'modified', owner_reviewed_by: 'mgr-1' },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'user-1', full_name: 'Alice', role: 'Employee' },
        { id: 'mgr-1', full_name: 'David Lim', role: 'Manager' },
      ] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const dashboard = await attendanceService.getAttendanceDashboard('company-1')

      expect(dashboard.records[0].modifier_name).toBe('David Lim')
      expect(dashboard.records[0].modifier_role).toBe('Manager')
    })
  })

  describe('getAttendanceByDateRange (UC50: Review Attendance Record, UC51: View Attendance Status)', () => {
    it('queries assignments scoped to the given date window, not the whole company history', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompanyAndDateRange).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-06-29', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const records = await attendanceService.getAttendanceByDateRange('company-1', '2026-06-29', '2026-06-29')

      expect(attendanceRepository.getAssignmentsByCompanyAndDateRange).toHaveBeenCalledWith('company-1', '2026-06-29', '2026-06-29')
      expect(attendanceRepository.getAssignmentsByCompany).not.toHaveBeenCalled()
      expect(records).toHaveLength(1)
      expect(records[0].assignee_name).toBe('Alice')
    })

    it('returns an empty array when there are no assignments in the window', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompanyAndDateRange).mockResolvedValue([])
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const records = await attendanceService.getAttendanceByDateRange('company-1', '2026-06-01', '2026-06-30')

      expect(records).toEqual([])
    })

    it('still computes exceptions (e.g. absent) per record the same way the dashboard does', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompanyAndDateRange).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const records = await attendanceService.getAttendanceByDateRange('company-1', '2026-01-01', '2026-01-01')

      // No record + shift already in the past (relative to "now" the test runs) => absent.
      expect(records[0].exceptions).toContain('absent')
    })
  })

  describe('decideShiftSwapRequest (UC53: Approve Shift Swap Request)', () => {
    const futureAssignment = (id: string, user_id: string, shift_id: string, shift_date: string) => ({
      id, user_id, shift_id,
      shifts: { id: shift_id, department_id: 'dept-1', shift_date, start_time: '09:00', end_time: '17:00', title: 'Shift' },
    })

    it('swaps both assignment users and reassigns each party\'s active tasks on approval', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue({
        id: 'swap-1',
        requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2',
        counterpart_status: 'approved', status: 'pending',
      } as any)
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return futureAssignment('asn-1', 'user-1', 'shift-1', tomorrowStr) as any
        if (id === 'asn-2') return futureAssignment('asn-2', 'user-2', 'shift-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.updateShiftAssignmentUser).mockResolvedValue({} as any)
      vi.mocked(taskRepository.reassignTasksForShiftSwap).mockResolvedValue(undefined)
      vi.mocked(attendanceRepository.updateShiftSwapRequest).mockResolvedValue({ id: 'swap-1', status: 'approved' } as any)

      await attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'approved' })

      expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('asn-1', 'user-2')
      expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('asn-2', 'user-1')
      expect(taskRepository.reassignTasksForShiftSwap).toHaveBeenCalledWith('shift-1', 'user-1', 'user-2')
      expect(taskRepository.reassignTasksForShiftSwap).toHaveBeenCalledWith('shift-2', 'user-2', 'user-1')
      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenCalledWith('swap-1', expect.objectContaining({ status: 'approved', reviewed_by: 'owner-1' }))
    })

    it('does not reassign shifts or tasks on rejection', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue({
        id: 'swap-1',
        requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2',
        counterpart_status: 'approved', status: 'pending',
      } as any)
      vi.mocked(attendanceRepository.updateShiftSwapRequest).mockResolvedValue({ id: 'swap-1', status: 'rejected' } as any)

      await attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'rejected' })

      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
      expect(taskRepository.reassignTasksForShiftSwap).not.toHaveBeenCalled()
    })

    it('throws if counterpart has not agreed', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue({
        id: 'swap-1',
        counterpart_status: 'pending', status: 'pending',
      } as any)

      await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('Counterpart has not agreed yet')
    })

    it('auto-rejects and blocks approval if a shift has become today by decision time', async () => {
      // A pending request that sat unreviewed long enough for one of its two shift dates to
      // arrive can no longer be approved — it must be closed out as 'rejected' automatically
      // instead of erroring out while remaining stuck in the pending queue forever.
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue({
        id: 'swap-1',
        requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2',
        counterpart_status: 'approved', status: 'pending',
      } as any)
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        // Requester's shift has aged into "today" since the request was submitted
        if (id === 'asn-1') return futureAssignment('asn-1', 'user-1', 'shift-1', todayStr) as any
        if (id === 'asn-2') return futureAssignment('asn-2', 'user-2', 'shift-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.updateShiftSwapRequest).mockResolvedValue({ id: 'swap-1', status: 'rejected' } as any)

      await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('Request is no longer pending')

      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenCalledWith('swap-1', expect.objectContaining({ status: 'rejected' }))
      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
      expect(taskRepository.reassignTasksForShiftSwap).not.toHaveBeenCalled()
    })
  })

  describe('submitShiftSwapRequest (UC52: Submit Shift Swap Request)', () => {
    const baseAssignment = (id: string, user_id: string, shift_date: string) => ({
      id, user_id,
      shifts: { id: `shift-${id}`, department_id: 'dept-1', shift_date, start_time: '09:00', end_time: '17:00', title: 'Shift' },
    })
    const sameRoleUsers = [
      { id: 'user-1', full_name: 'Alice', role: 'Employee' },
      { id: 'user-2', full_name: 'Bob', role: 'Employee' },
    ]

    it('rejects a self-swap before touching assignment data', async () => {
      await expect(attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-1', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('Cannot swap shifts with yourself')
      expect(attendanceRepository.getShiftAssignmentById).not.toHaveBeenCalled()
    })

    it('rejects when the requester\'s own shift is today', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return baseAssignment('asn-1', 'user-1', todayStr) as any
        if (id === 'asn-2') return baseAssignment('asn-2', 'user-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue(sameRoleUsers as any)

      await expect(attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('tomorrow or later')
      expect(attendanceRepository.createShiftSwapRequest).not.toHaveBeenCalled()
    })

    it('rejects when the counterpart\'s shift is in the past', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return baseAssignment('asn-1', 'user-1', dayAfterStr) as any
        if (id === 'asn-2') return baseAssignment('asn-2', 'user-2', '2020-01-01') as any
        return null
      })
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue(sameRoleUsers as any)

      await expect(attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('tomorrow or later')
      expect(attendanceRepository.createShiftSwapRequest).not.toHaveBeenCalled()
    })

    it('rejects when the two shifts belong to different departments', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return { id: 'asn-1', user_id: 'user-1', shifts: { id: 'shift-1', department_id: 'dept-1', shift_date: tomorrowStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } } as any
        if (id === 'asn-2') return { id: 'asn-2', user_id: 'user-2', shifts: { id: 'shift-2', department_id: 'dept-2', shift_date: dayAfterStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } } as any
        return null
      })

      await expect(attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('same department')
      expect(attendanceRepository.getUsersByIds).not.toHaveBeenCalled()
      expect(attendanceRepository.createShiftSwapRequest).not.toHaveBeenCalled()
    })

    it('rejects when the requester and counterpart have different roles (e.g. Manager vs Employee)', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return baseAssignment('asn-1', 'user-1', tomorrowStr) as any
        if (id === 'asn-2') return baseAssignment('asn-2', 'user-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'user-1', full_name: 'Alice', role: 'Manager' },
        { id: 'user-2', full_name: 'Bob', role: 'Employee' },
      ] as any)

      await expect(attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('same role')
      expect(attendanceRepository.createShiftSwapRequest).not.toHaveBeenCalled()
    })

    it('accepts shifts scheduled tomorrow or later', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return baseAssignment('asn-1', 'user-1', tomorrowStr) as any
        if (id === 'asn-2') return baseAssignment('asn-2', 'user-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue(sameRoleUsers as any)
      vi.mocked(attendanceRepository.getPendingSwapRequestsByAssignment).mockResolvedValue([])
      vi.mocked(attendanceRepository.createShiftSwapRequest).mockResolvedValue({ id: 'swap-1' } as any)

      await attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })

      expect(attendanceRepository.createShiftSwapRequest).toHaveBeenCalled()
    })
  })

  describe('submitShiftSwapRequest — rules deferred to accept time', () => {
    const baseAssignment = (id: string, user_id: string, shift_date: string) => ({
      id, user_id,
      shifts: { id: `shift-${id}`, department_id: 'dept-1', shift_date, start_time: '09:00', end_time: '17:00', title: 'Shift' },
    })
    const sameRoleUsers = [
      { id: 'user-1', full_name: 'Alice', role: 'Employee' },
      { id: 'user-2', full_name: 'Bob', role: 'Employee' },
    ]

    it('does not evaluate limit/deadline rules at submission — they run when the counterpart accepts', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return baseAssignment('asn-1', 'user-1', tomorrowStr) as any
        if (id === 'asn-2') return baseAssignment('asn-2', 'user-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue(sameRoleUsers as any)
      vi.mocked(attendanceRepository.getPendingSwapRequestsByAssignment).mockResolvedValue([])
      vi.mocked(attendanceRepository.createShiftSwapRequest).mockResolvedValue({ id: 'swap-1' } as any)

      await attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })

      expect(shiftSwapSettingsRepository.getSettings).not.toHaveBeenCalled()
      expect(attendanceRepository.countApprovedShiftSwapsForUser).not.toHaveBeenCalled()
      expect(attendanceRepository.createShiftSwapRequest).toHaveBeenCalled()
    })
  })

  describe('respondShiftSwapRequest (accept-time validation & auto-approval)', () => {
    const futureAssignment = (id: string, user_id: string, shift_id: string, shift_date: string) => ({
      id, user_id, shift_id,
      shifts: { id: shift_id, department_id: 'dept-1', shift_date, start_time: '09:00', end_time: '17:00', title: 'Shift' },
    })
    const baseSettings = {
      company_id: 'company-1', auto_approval_enabled: true,
      monthly_swap_limit: null as number | null, deadline_hours_before_shift: null as number | null,
      require_review_on_limit_exceeded: true, require_review_on_deadline_exceeded: true,
      updated_by: 'owner-1', updated_at: '2026-01-01T00:00:00Z',
    }
    const pendingRequest = () => ({
      id: 'swap-1', company_id: 'company-1',
      requester_id: 'user-1', requester_assignment_id: 'asn-1',
      counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2',
      counterpart_status: 'pending', status: 'pending', requires_owner_review: false, owner_review_reason: null,
    })

    beforeEach(() => {
      // Shifts are tomorrow / the day after — always more than 9h and less than 48h from "now",
      // which the deadline tests below rely on (no fake timers needed).
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return futureAssignment('asn-1', 'user-1', 'shift-1', tomorrowStr) as any
        if (id === 'asn-2') return futureAssignment('asn-2', 'user-2', 'shift-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.updateShiftSwapRequest).mockImplementation(async (_id, fields) => ({ ...pendingRequest(), ...fields }) as any)
      vi.mocked(attendanceRepository.countApprovedShiftSwapsForUser).mockResolvedValue(0)
      vi.mocked(attendanceRepository.updateShiftAssignmentUser).mockResolvedValue({} as any)
      vi.mocked(taskRepository.reassignTasksForShiftSwap).mockResolvedValue(undefined)
      // Default requester is a Manager, so these tests exercise the company-wide (Owner/Partner)
      // settings path unless a test overrides this to 'Employee' for the department-scoped path.
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Manager' }] as any)
    })

    const accept = () => attendanceService.respondShiftSwapRequest({ id: 'swap-1', counterpart_id: 'user-2', decision: 'approved' })

    it('closes the request on rejection without checking settings or touching assignments', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)

      await attendanceService.respondShiftSwapRequest({ id: 'swap-1', counterpart_id: 'user-2', decision: 'rejected' })

      expect(shiftSwapSettingsRepository.getSettings).not.toHaveBeenCalled()
      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
    })

    it('leaves the request pending for the Owner when auto-approval is off and no rule is breached', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue({ ...baseSettings, auto_approval_enabled: false })

      await accept()

      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenCalledTimes(1)
    })

    it('auto-approves and swaps assignments immediately once both parties have agreed, with reviewed_by=null', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue(baseSettings)

      await accept()

      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenNthCalledWith(1, 'swap-1', expect.objectContaining({ counterpart_status: 'approved' }))
      expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('asn-1', 'user-2')
      expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('asn-2', 'user-1')
      expect(taskRepository.reassignTasksForShiftSwap).toHaveBeenCalledWith('shift-1', 'user-1', 'user-2')
      expect(taskRepository.reassignTasksForShiftSwap).toHaveBeenCalledWith('shift-2', 'user-2', 'user-1')
      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenLastCalledWith('swap-1', expect.objectContaining({ status: 'approved', reviewed_by: null }))
    })

    it('checks the monthly limit against SUCCESSFUL swaps only, via countApprovedShiftSwapsForUser', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue({ ...baseSettings, monthly_swap_limit: 3 })

      await accept()

      expect(attendanceRepository.countApprovedShiftSwapsForUser).toHaveBeenCalledWith('company-1', 'user-1', expect.any(String), expect.any(String))
      expect(attendanceRepository.countApprovedShiftSwapsForUser).toHaveBeenCalledWith('company-1', 'user-2', expect.any(String), expect.any(String))
      // 0 approved swaps this month — under the limit, so it auto-approves
      expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalled()
    })

    it('escalates to the Owner with a reason when the monthly limit is hit and the rule action is Send to Owner', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue({ ...baseSettings, monthly_swap_limit: 3, require_review_on_limit_exceeded: true })
      vi.mocked(attendanceRepository.countApprovedShiftSwapsForUser).mockImplementation(async (_company, userId) => (userId === 'user-1' ? 3 : 0))

      const result = await accept()

      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenLastCalledWith('swap-1', {
        requires_owner_review: true,
        owner_review_reason: 'Monthly swap limit exceeded',
      })
      expect(result.status).toBe('pending')
      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
    })

    it('auto-rejects with a reason when the monthly limit is hit and the rule action is Auto Reject', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue({ ...baseSettings, monthly_swap_limit: 3, require_review_on_limit_exceeded: false })
      vi.mocked(attendanceRepository.countApprovedShiftSwapsForUser).mockImplementation(async (_company, userId) => (userId === 'user-2' ? 3 : 0))

      const result = await accept()

      expect(result.status).toBe('rejected')
      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenLastCalledWith('swap-1', expect.objectContaining({
        status: 'rejected',
        owner_review_reason: 'Monthly swap limit exceeded',
      }))
      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
    })

    it('auto-rejects on a rule breach even when auto-approval is off — the rule action is company policy', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue({ ...baseSettings, auto_approval_enabled: false, monthly_swap_limit: 1, require_review_on_limit_exceeded: false })
      vi.mocked(attendanceRepository.countApprovedShiftSwapsForUser).mockResolvedValue(1)

      const result = await accept()

      expect(result.status).toBe('rejected')
      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
    })

    it('escalates when accepted less than N hours before the earliest shift and the rule action is Send to Owner', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
      // Earliest shift (tomorrow 09:00) is always under 48h away — past a 48h deadline
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue({ ...baseSettings, deadline_hours_before_shift: 48, require_review_on_deadline_exceeded: true })

      const result = await accept()

      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenLastCalledWith('swap-1', {
        requires_owner_review: true,
        owner_review_reason: 'Submitted after deadline',
      })
      expect(result.status).toBe('pending')
      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
    })

    it('auto-rejects when accepted less than N hours before the earliest shift and the rule action is Auto Reject', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue({ ...baseSettings, deadline_hours_before_shift: 48, require_review_on_deadline_exceeded: false })

      const result = await accept()

      expect(result.status).toBe('rejected')
      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenLastCalledWith('swap-1', expect.objectContaining({
        status: 'rejected',
        owner_review_reason: 'Submitted after deadline',
      }))
      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
    })

    it('passes the deadline check and auto-approves when accepted early enough', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
      // Earliest shift (tomorrow 09:00) is always at least 9h away — within a 1h deadline
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue({ ...baseSettings, deadline_hours_before_shift: 1 })

      await accept()

      expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalled()
    })

    describe('settings scope by requester role (confirmed 2026-07-23)', () => {
      it('uses the company-wide Owner/Partner settings when the requester is a Manager', async () => {
        vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
        vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Manager' }] as any)
        vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue(baseSettings)

        await accept()

        expect(shiftSwapSettingsRepository.getSettings).toHaveBeenCalledWith('company-1')
        expect(shiftSwapDepartmentSettingsRepository.getSettings).not.toHaveBeenCalled()
      })

      it('uses that department\'s own settings when the requester is an Employee — never the company-wide row', async () => {
        vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(pendingRequest() as any)
        vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
        vi.mocked(shiftSwapDepartmentSettingsRepository.getSettings).mockResolvedValue({ ...baseSettings, department_id: 'dept-1' } as any)

        await accept()

        expect(shiftSwapDepartmentSettingsRepository.getSettings).toHaveBeenCalledWith('company-1', 'dept-1')
        expect(shiftSwapSettingsRepository.getSettings).not.toHaveBeenCalled()
      })
    })
  })

  describe('getShiftSwapRequests (task-impact preview)', () => {
    it('attaches each side\'s movable tasks from getMovableTasksByShiftAssignment', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestsByCompany).mockResolvedValue([
        {
          id: 'swap-1', company_id: 'company-1',
          requester_id: 'user-1', requester_assignment_id: 'asn-1',
          counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2',
          counterpart_status: 'approved', status: 'pending',
        } as any,
      ])
      vi.mocked(attendanceRepository.getShiftAssignmentsByIds).mockResolvedValue([
        { id: 'asn-1', user_id: 'user-1', shift_id: 'shift-1', shifts: { department_id: 'dept-1', shift_date: tomorrowStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
        { id: 'asn-2', user_id: 'user-2', shift_id: 'shift-2', shifts: { department_id: 'dept-1', shift_date: dayAfterStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'user-1', full_name: 'Alice', role: 'Manager' },
        { id: 'user-2', full_name: 'Bob', role: 'Manager' },
      ] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([{ id: 'dept-1', name: 'Ops' }] as any)
      vi.mocked(attendanceRepository.getTasksByShiftIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getMovableTasksByShiftIds).mockResolvedValue([
        { id: 'task-1', title: 'Restock shelves', description: null, status: 'Assigned', priority: 'Medium', due_at: '2026-07-03T17:00:00Z', created_at: '2026-07-01T09:00:00Z', shift_id: 'shift-1', assigned_user_id: 'user-1' },
        { id: 'task-2', title: 'Close register', description: null, status: 'In Progress', priority: 'Low', due_at: null, created_at: '2026-07-01T09:00:00Z', shift_id: 'shift-2', assigned_user_id: 'user-2' },
      ] as any)

      const requests = await attendanceService.getShiftSwapRequests('company-1')

      expect(requests[0].requester_movable_tasks).toEqual([{ id: 'task-1', title: 'Restock shelves', description: null, status: 'Assigned', priority: 'Medium', due_at: '2026-07-03T17:00:00Z', created_at: '2026-07-01T09:00:00Z' }])
      expect(requests[0].counterpart_movable_tasks).toEqual([{ id: 'task-2', title: 'Close register', description: null, status: 'In Progress', priority: 'Low', due_at: null, created_at: '2026-07-01T09:00:00Z' }])
    })
  })

  describe('getShiftSwapRequests (Owner vs Manager queue split)', () => {
    const twoSwaps = [
      {
        id: 'swap-mgr', company_id: 'company-1',
        requester_id: 'mgr-1', requester_assignment_id: 'asn-mgr-1',
        counterpart_id: 'mgr-2', counterpart_assignment_id: 'asn-mgr-2',
        counterpart_status: 'approved', status: 'pending',
      },
      {
        id: 'swap-emp', company_id: 'company-1',
        requester_id: 'emp-1', requester_assignment_id: 'asn-emp-1',
        counterpart_id: 'emp-2', counterpart_assignment_id: 'asn-emp-2',
        counterpart_status: 'approved', status: 'pending',
      },
    ]

    beforeEach(() => {
      vi.mocked(attendanceRepository.getShiftSwapRequestsByCompany).mockResolvedValue(twoSwaps as any)
      vi.mocked(attendanceRepository.getShiftAssignmentsByIds).mockResolvedValue([
        { id: 'asn-mgr-1', user_id: 'mgr-1', shift_id: 'shift-mgr-1', shifts: { department_id: 'dept-ops', shift_date: tomorrowStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
        { id: 'asn-mgr-2', user_id: 'mgr-2', shift_id: 'shift-mgr-2', shifts: { department_id: 'dept-ops', shift_date: dayAfterStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
        { id: 'asn-emp-1', user_id: 'emp-1', shift_id: 'shift-emp-1', shifts: { department_id: 'dept-ops', shift_date: tomorrowStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
        { id: 'asn-emp-2', user_id: 'emp-2', shift_id: 'shift-emp-2', shifts: { department_id: 'dept-ops', shift_date: dayAfterStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'mgr-1', full_name: 'Manager One', role: 'Manager' },
        { id: 'mgr-2', full_name: 'Manager Two', role: 'Manager' },
        { id: 'emp-1', full_name: 'Employee One', role: 'Employee' },
        { id: 'emp-2', full_name: 'Employee Two', role: 'Employee' },
      ] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([{ id: 'dept-ops', name: 'Ops' }] as any)
      vi.mocked(attendanceRepository.getTasksByShiftIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getMovableTasksByShiftIds).mockResolvedValue([])
    })

    it('Owner queue (no managerId) only returns the Manager<->Manager swap', async () => {
      const requests = await attendanceService.getShiftSwapRequests('company-1')

      expect(requests.map(r => r.id)).toEqual(['swap-mgr'])
      expect(ownerTeamRepository.findManagerDepartments).not.toHaveBeenCalled()
    })

    it('Manager queue only returns the Employee<->Employee swap within a department they manage', async () => {
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-ops', department_name: 'Ops' }])

      const requests = await attendanceService.getShiftSwapRequests('company-1', { managerId: 'mgr-1' })

      expect(requests.map(r => r.id)).toEqual(['swap-emp'])
    })

    it('Manager queue excludes an Employee<->Employee swap outside their managed departments', async () => {
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-other', department_name: 'Other' }])

      const requests = await attendanceService.getShiftSwapRequests('company-1', { managerId: 'mgr-1' })

      expect(requests).toEqual([])
    })

    it('hides requests still awaiting the counterpart from the approval queue', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestsByCompany).mockResolvedValue([
        { ...twoSwaps[0], counterpart_status: 'pending' },
      ] as any)

      const requests = await attendanceService.getShiftSwapRequests('company-1')

      expect(requests).toEqual([])
    })

    it('computes live rule status and each party\'s remaining monthly quota for pending requests', async () => {
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue({
        company_id: 'company-1', auto_approval_enabled: false,
        monthly_swap_limit: 3, deadline_hours_before_shift: 1,
        require_review_on_limit_exceeded: true, require_review_on_deadline_exceeded: true,
        updated_by: 'owner-1', updated_at: '2026-01-01T00:00:00Z',
      } as any)
      vi.mocked(attendanceRepository.countApprovedShiftSwapsForUser).mockImplementation(async (_company, userId) => (userId === 'mgr-1' ? 3 : 1))

      const requests = await attendanceService.getShiftSwapRequests('company-1')

      expect(requests[0].monthly_swap_limit).toBe(3)
      expect(requests[0].requester_swaps_left).toBe(0)   // mgr-1 already used all 3 this month
      expect(requests[0].counterpart_swaps_left).toBe(2) // mgr-2 used 1 of 3
      expect(requests[0].limit_exceeded).toBe(true)
      // Both shifts are tomorrow or later — comfortably clear of a 1h deadline
      expect(requests[0].deadline_exceeded).toBe(false)
    })

    it('leaves rule fields null when no settings are configured', async () => {
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue(null)

      const requests = await attendanceService.getShiftSwapRequests('company-1')

      expect(requests[0].requester_swaps_left).toBeNull()
      expect(requests[0].limit_exceeded).toBeNull()
      expect(requests[0].deadline_exceeded).toBeNull()
      expect(attendanceRepository.countApprovedShiftSwapsForUser).not.toHaveBeenCalled()
    })

    it('Owner queue reads the company-wide settings row, never a department row', async () => {
      await attendanceService.getShiftSwapRequests('company-1')

      expect(shiftSwapSettingsRepository.getSettings).toHaveBeenCalledWith('company-1')
      expect(shiftSwapDepartmentSettingsRepository.getSettingsForDepartments).not.toHaveBeenCalled()
    })

    it('Manager queue reads that department\'s own settings row, never the company-wide row', async () => {
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-ops', department_name: 'Ops' }])
      vi.mocked(shiftSwapDepartmentSettingsRepository.getSettingsForDepartments).mockResolvedValue([
        { company_id: 'company-1', department_id: 'dept-ops', auto_approval_enabled: false, monthly_swap_limit: 2, deadline_hours_before_shift: null, require_review_on_limit_exceeded: true, require_review_on_deadline_exceeded: true, updated_by: 'mgr-1', updated_at: '2026-01-01T00:00:00Z' },
      ] as any)
      vi.mocked(attendanceRepository.countApprovedShiftSwapsForUser).mockResolvedValue(1)

      const requests = await attendanceService.getShiftSwapRequests('company-1', { managerId: 'mgr-1' })

      expect(shiftSwapDepartmentSettingsRepository.getSettingsForDepartments).toHaveBeenCalledWith('company-1', ['dept-ops'])
      expect(shiftSwapSettingsRepository.getSettings).not.toHaveBeenCalled()
      expect(requests[0].monthly_swap_limit).toBe(2)
      expect(requests[0].requester_swaps_left).toBe(1)
    })
  })

  describe('decideFixedOffDayRequest (UC55: Approve Fixed Day Off)', () => {
    it('approves a pending fixed day off request', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-10', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
      } as any)
      vi.mocked(attendanceRepository.updateFixedOffDayRequest).mockResolvedValue({ id: 'fod-1', status: 'approved' } as any)

      await attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'approved' })

      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-1', expect.objectContaining({ status: 'approved', reviewed_by: 'owner-1' }))
    })

    it('rejects an invalid decision value', async () => {
      await expect(attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'bogus' as any }))
        .rejects.toThrow('Invalid request decision')
      expect(attendanceRepository.getFixedOffDayRequestById).not.toHaveBeenCalled()
    })

    it('throws when the request does not exist', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue(null)

      await expect(attendanceService.decideFixedOffDayRequest({ id: 'missing', reviewer_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('Weekly day off request not found')
    })

    it('throws when trying to decide an already-approved auto-assigned row', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-auto', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-10', week_start: '2026-07-06', status: 'approved', source: 'auto_assigned', reviewed_by: null, reviewed_at: '2026-01-01', created_at: '2026-01-01',
      } as any)

      await expect(attendanceService.decideFixedOffDayRequest({ id: 'fod-auto', reviewer_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('auto-assigned')
      expect(attendanceRepository.updateFixedOffDayRequest).not.toHaveBeenCalled()
    })

    it('modifies the request to a replacement date within the same week', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-09', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
      } as any)
      vi.mocked(attendanceRepository.updateFixedOffDayRequest).mockResolvedValue({ id: 'fod-1', status: 'modified' } as any)

      await attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'modified', new_date: '2026-07-11' })

      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-1', expect.objectContaining({ status: 'modified', reviewed_by: 'owner-1', request_date: '2026-07-11' }))
    })

    it('rejects a modify with no new_date', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-09', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
      } as any)

      await expect(attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'modified' }))
        .rejects.toThrow('new_date is required')
    })

    it('modifies the request to a replacement date in the following week (a bonus day when this week has no safe slot)', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-09', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
      } as any)
      vi.mocked(attendanceRepository.updateFixedOffDayRequest).mockResolvedValue({ id: 'fod-1', status: 'modified' } as any)

      await attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'modified', new_date: '2026-07-14' })

      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-1', expect.objectContaining({ status: 'modified', request_date: '2026-07-14' }))
    })

    it('allows a replacement date many weeks out — Owner picks freely, no week cap', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-09', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
      } as any)
      vi.mocked(attendanceRepository.updateFixedOffDayRequest).mockResolvedValue({ id: 'fod-1', status: 'modified' } as any)

      await attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'modified', new_date: '2026-08-15' })

      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-1', expect.objectContaining({ status: 'modified', request_date: '2026-08-15' }))
    })

    it('treats a "modify" whose new_date is unchanged from the original as a plain approval', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-09', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
      } as any)
      vi.mocked(attendanceRepository.updateFixedOffDayRequest).mockResolvedValue({ id: 'fod-1', status: 'approved' } as any)

      await attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'modified', new_date: '2026-07-09' })

      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-1', expect.objectContaining({ status: 'approved' }))
    })
  })

  describe('decideFixedOffDayRequestGroup (batch approve/reject a weekly submission)', () => {
    const rowFor = (id: string, date: string) => ({
      id, user_id: 'user-1', company_id: 'company-1', request_date: date, week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
    })

    it('approves every id in the group with the same reviewer and timestamp', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)
      vi.mocked(attendanceRepository.decideFixedOffDayRequestGroupAtomic).mockResolvedValue([] as any)

      await attendanceService.decideFixedOffDayRequestGroup({ ids: ['fod-1', 'fod-2'], reviewer_id: 'mgr-1', decision: 'approved' })

      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).toHaveBeenCalledTimes(1)
      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).toHaveBeenCalledWith(expect.objectContaining({
        ids: ['fod-1', 'fod-2'],
        statuses: ['approved', 'approved'],
        request_dates: [null, null],
        reviewer_id: 'mgr-1',
      }))
    })

    it('rejects an invalid decision value before touching the repository', async () => {
      await expect(attendanceService.decideFixedOffDayRequestGroup({ ids: ['fod-1'], reviewer_id: 'mgr-1', decision: 'bogus' as any }))
        .rejects.toThrow('Invalid request decision')
      expect(attendanceRepository.getFixedOffDayRequestsByIds).not.toHaveBeenCalled()
    })

    it('rejects an empty ids array', async () => {
      await expect(attendanceService.decideFixedOffDayRequestGroup({ ids: [], reviewer_id: 'mgr-1', decision: 'approved' }))
        .rejects.toThrow('No requests to decide')
    })

    it('throws and updates nothing if any id in the group does not exist', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06')] as any)

      await expect(attendanceService.decideFixedOffDayRequestGroup({ ids: ['fod-1', 'missing'], reviewer_id: 'mgr-1', decision: 'approved' }))
        .rejects.toThrow('Weekly day off request not found')
      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).not.toHaveBeenCalled()
    })

    it('throws if any row in the group is already an approved auto-assigned row', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue([
        { ...rowFor('fod-auto', '2026-07-06'), status: 'approved', source: 'auto_assigned' },
        rowFor('fod-2', '2026-07-08'),
      ] as any)

      await expect(attendanceService.decideFixedOffDayRequestGroup({ ids: ['fod-auto', 'fod-2'], reviewer_id: 'mgr-1', decision: 'approved' }))
        .rejects.toThrow('auto-assigned')
      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).not.toHaveBeenCalled()
    })

    it('modifies each row to its paired replacement date (1:1 by array index), in a single atomic call', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)
      vi.mocked(attendanceRepository.decideFixedOffDayRequestGroupAtomic).mockResolvedValue([] as any)

      await attendanceService.decideFixedOffDayRequestGroup({
        ids: ['fod-1', 'fod-2'], reviewer_id: 'owner-1', decision: 'modified', new_dates: ['2026-07-11', '2026-07-12'],
      })

      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).toHaveBeenCalledTimes(1)
      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).toHaveBeenCalledWith(expect.objectContaining({
        ids: ['fod-1', 'fod-2'],
        statuses: ['modified', 'modified'],
        request_dates: ['2026-07-11', '2026-07-12'],
        reviewer_id: 'owner-1',
      }))
    })

    it('rejects modify when new_dates length does not match ids', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)

      await expect(attendanceService.decideFixedOffDayRequestGroup({
        ids: ['fod-1', 'fod-2'], reviewer_id: 'owner-1', decision: 'modified', new_dates: ['2026-07-11'],
      })).rejects.toThrow('1:1')
    })

    it('rejects modify with duplicate replacement dates', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)

      await expect(attendanceService.decideFixedOffDayRequestGroup({
        ids: ['fod-1', 'fod-2'], reviewer_id: 'owner-1', decision: 'modified', new_dates: ['2026-07-11', '2026-07-11'],
      })).rejects.toThrow('not repeat')
    })

    it('allows a replacement date many weeks out — Owner picks freely, no week cap', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)
      vi.mocked(attendanceRepository.decideFixedOffDayRequestGroupAtomic).mockResolvedValue([] as any)

      await attendanceService.decideFixedOffDayRequestGroup({
        ids: ['fod-1', 'fod-2'], reviewer_id: 'owner-1', decision: 'modified', new_dates: ['2026-07-11', '2026-08-20'],
      })

      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).toHaveBeenCalledWith(expect.objectContaining({
        request_dates: ['2026-07-11', '2026-08-20'],
      }))
    })

    it('allows a replacement date in the following week as a bonus day (keeps the row on this week\'s week_start)', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)
      vi.mocked(attendanceRepository.decideFixedOffDayRequestGroupAtomic).mockResolvedValue([] as any)

      await attendanceService.decideFixedOffDayRequestGroup({
        ids: ['fod-1', 'fod-2'], reviewer_id: 'owner-1', decision: 'modified', new_dates: ['2026-07-11', '2026-07-14'],
      })

      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).toHaveBeenCalledWith(expect.objectContaining({
        request_dates: ['2026-07-11', '2026-07-14'],
      }))
    })

    it('keeps a row approved (not modified) when its "replacement" is the same date it already had — lets one batch mix approve-safe with replace-only-flagged', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)
      vi.mocked(attendanceRepository.decideFixedOffDayRequestGroupAtomic).mockResolvedValue([] as any)

      await attendanceService.decideFixedOffDayRequestGroup({
        // fod-1 is safe and comes back unchanged; only fod-2 is actually being swapped to a new date.
        ids: ['fod-1', 'fod-2'], reviewer_id: 'owner-1', decision: 'modified', new_dates: ['2026-07-06', '2026-07-14'],
      })

      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).toHaveBeenCalledWith(expect.objectContaining({
        statuses: ['approved', 'modified'],
        request_dates: [null, '2026-07-14'],
      }))
    })

    it('reassigns dates that cycle among rows the user already holds without a spurious unique-constraint error', async () => {
      // Regression for the real-world bug: David Lim's replacement picks reused dates (Mon/Tue/
      // Thu/Fri) that already belong to other rows in this same weekly batch. Any implementation
      // that updates rows one at a time (not atomically) can transiently collide here even though
      // the final set of dates is conflict-free.
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue([
        rowFor('fod-1', '2026-08-03'), // Mon
        rowFor('fod-2', '2026-08-04'), // Tue
        rowFor('fod-3', '2026-08-06'), // Thu
      ] as any)
      vi.mocked(attendanceRepository.decideFixedOffDayRequestGroupAtomic).mockResolvedValue([] as any)

      await attendanceService.decideFixedOffDayRequestGroup({
        ids: ['fod-1', 'fod-2', 'fod-3'],
        reviewer_id: 'owner-1',
        decision: 'modified',
        // fod-1 takes what fod-2 had, fod-2 takes what fod-3 had, fod-3 takes what fod-1 had.
        new_dates: ['2026-08-04', '2026-08-06', '2026-08-03'],
      })

      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).toHaveBeenCalledTimes(1)
      expect(attendanceRepository.decideFixedOffDayRequestGroupAtomic).toHaveBeenCalledWith(expect.objectContaining({
        request_dates: ['2026-08-04', '2026-08-06', '2026-08-03'],
      }))
    })
  })

  describe('getFixedOffDayRequests (UC55 — Manager and Employee requests both route to Owner)', () => {
    beforeEach(() => {
      vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue(null)
    })

    it('returns both Manager- and Employee-submitted requests together, with no department scoping', async () => {
      vi.mocked(attendanceRepository.getOffDayRequestsByCompany).mockResolvedValue([
        { id: 'fod-mgr', user_id: 'mgr-1', company_id: 'company-1', request_date: '2026-07-10', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
        { id: 'fod-emp', user_id: 'emp-1', company_id: 'company-1', request_date: '2026-07-10', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'mgr-1', full_name: 'Manager One', role: 'Manager' },
        { id: 'emp-1', full_name: 'Employee One', role: 'Employee' },
      ] as any)
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-ops', department_name: 'Ops' }])
      vi.mocked(attendanceRepository.getEmployeesByCompany).mockResolvedValue([{ id: 'emp-1', full_name: 'Employee One', department_id: 'dept-elsewhere' }])

      const requests = await attendanceService.getFixedOffDayRequests('company-1')

      expect(requests.map(r => r.id).sort()).toEqual(['fod-emp', 'fod-mgr'])
      expect(requests.find(r => r.id === 'fod-mgr')).toEqual(expect.objectContaining({ requester_name: 'Manager One', requester_role: 'Manager' }))
      expect(requests.find(r => r.id === 'fod-emp')).toEqual(expect.objectContaining({ requester_name: 'Employee One', requester_role: 'Employee' }))
    })
  })

  describe('runAutoAssignmentSweepForUpcomingWeek (triggered lazily via getFixedOffDayRequests)', () => {
    // Mirrors the sweep's own date math exactly (toISOString-based todayKey -> weekStart -> +7 days)
    // so "the first day of the upcoming week" lines up with what the sweep itself computes.
    const todayKey = new Date().toISOString().slice(0, 10)
    const thisWeekStart = weekStart(todayKey)
    const addDaysUTC = (dateKey: string, days: number): string => {
      const d = new Date(`${dateKey}T00:00:00`)
      d.setDate(d.getDate() + days)
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const upcomingWeekStart = addDaysUTC(thisWeekStart, 7)
    const reservedDate = upcomingWeekStart // the first day of the upcoming week

    beforeEach(() => {
      const todayDow = new Date().getDay()
      const pastDeadlineDow = (todayDow + 6) % 7 // yesterday's weekday — guaranteed already passed
      vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue({ company_id: 'company-1', deadline_weekday: pastDeadlineDow, deadline_time: '17:00', updated_by: null, updated_at: '2026-01-01' } as any)
      vi.mocked(attendanceRepository.getManagersByCompany).mockResolvedValue([])
      vi.mocked(attendanceRepository.createFixedOffDayRequests).mockResolvedValue([] as any)
      vi.mocked(attendanceRepository.getOffDayRequestsByCompany).mockResolvedValue([])
      vi.mocked(offDaySettingsRepository.getQuotaForUser).mockResolvedValue(null)
      vi.mocked(offDaySettingsRepository.getCompanyDefaultQuota).mockResolvedValue({ company_id: 'company-1', user_id: null, max_days_per_week: 1, role: 'Employee', updated_by: null, updated_at: '2026-01-01' } as any)
    })

    it('reserves an already-submitted off-day before checking auto-assignment safety, so a non-submitter is not also assigned that date when it would drop staffing below minimum', async () => {
      vi.mocked(attendanceRepository.getEmployeesByCompany).mockResolvedValue([
        { id: 'emp-1', full_name: 'Employee One', department_id: 'dept-ops' },
        { id: 'emp-2', full_name: 'Employee Two', department_id: 'dept-ops' },
      ] as any)
      vi.mocked(attendanceRepository.getOffDayRequestsByCompanyAndWeek).mockResolvedValue([
        { id: 'fod-1', user_id: 'emp-1', company_id: 'company-1', request_date: reservedDate, week_start: upcomingWeekStart, status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
      ] as any)
      // dept-ops's roster is exactly these 2 employees (both department_id: 'dept-ops' above) — with
      // emp-1 already reserved off on reservedDate, only 1 remains there (meets the
      // MIN_EMPLOYEES_PER_DAY=1 floor only if nobody else also takes that day off), so emp-2 must
      // NOT also land on reservedDate.

      await attendanceService.getFixedOffDayRequests('company-1')

      expect(attendanceRepository.createFixedOffDayRequests).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'emp-2', source: 'auto_assigned' })
      )
      const call = vi.mocked(attendanceRepository.createFixedOffDayRequests).mock.calls.find(c => c[0].user_id === 'emp-2')
      expect(call?.[0].dates).not.toContain(reservedDate)
    })

    it('skips the per-department headcount work entirely once everyone already has a row for the week — this was the dominant cost behind the Weekly Day Off tab loading slowly on every visit', async () => {
      vi.mocked(attendanceRepository.getManagersByCompany).mockResolvedValue([{ id: 'mgr-1', full_name: 'Manager One' }] as any)
      vi.mocked(attendanceRepository.getEmployeesByCompany).mockResolvedValue([
        { id: 'emp-1', full_name: 'Employee One', department_id: 'dept-ops' },
      ] as any)
      vi.mocked(attendanceRepository.getOffDayRequestsByCompanyAndWeek).mockResolvedValue([
        { id: 'fod-1', user_id: 'mgr-1', company_id: 'company-1', request_date: reservedDate, week_start: upcomingWeekStart, status: 'approved', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
        { id: 'fod-2', user_id: 'emp-1', company_id: 'company-1', request_date: reservedDate, week_start: upcomingWeekStart, status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
      ] as any)

      await attendanceService.getFixedOffDayRequests('company-1')

      expect(ownerTeamRepository.findManagerDepartments).not.toHaveBeenCalled()
      expect(attendanceRepository.createFixedOffDayRequests).not.toHaveBeenCalled()
    })
  })

  describe('submitFixedOffDayRequest (UC54)', () => {
    // Mirrors weekStart()/addDays() in attendanceService.ts exactly: local-time Date parsing (no
    // 'Z' suffix) and formatting back out via local getters (never toISOString(), which converts
    // to UTC and would silently reintroduce the same skew this test is guarding against).
    const localDateKey = (d: Date): string => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const now = new Date()
    const todayKeyLocal = localDateKey(now)
    const upcomingMonday = (() => {
      const d = new Date(`${todayKeyLocal}T00:00:00`)
      const dow = (d.getDay() + 6) % 7
      d.setDate(d.getDate() - dow + 7)
      return localDateKey(d)
    })()
    const upcomingTuesday = (() => {
      const d = new Date(`${upcomingMonday}T00:00:00`)
      d.setDate(d.getDate() + 1)
      return localDateKey(d)
    })()
    const upcomingWednesday = (() => {
      const d = new Date(`${upcomingMonday}T00:00:00`)
      d.setDate(d.getDate() + 2)
      return localDateKey(d)
    })()

    beforeEach(() => {
      vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue(null)
      vi.mocked(offDaySettingsRepository.getQuotaForUser).mockResolvedValue(null)
      vi.mocked(offDaySettingsRepository.getCompanyDefaultQuota).mockResolvedValue({ company_id: 'company-1', user_id: null, max_days_per_week: 2, role: 'Employee', updated_by: null, updated_at: '2026-01-01' } as any)
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({ id: 'user-1', role: 'Employee', company_id: 'company-1' } as any)
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByUserAndWeek).mockResolvedValue([])
      vi.mocked(attendanceRepository.deleteFixedOffDayRequestsByUserAndWeek).mockResolvedValue(undefined)
      vi.mocked(attendanceRepository.createFixedOffDayRequests).mockResolvedValue([] as any)
    })

    it('rejects a date that is not in the future', async () => {
      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [todayKeyLocal] }))
        .rejects.toThrow('not in the future')
    })

    it('rejects dates spanning two different weeks', async () => {
      const nextWeekStart = (() => {
        const d = new Date(`${upcomingMonday}T00:00:00`)
        d.setDate(d.getDate() + 7)
        return localDateKey(d)
      })()
      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday, nextWeekStart] }))
        .rejects.toThrow('same week')
    })

    it('rejects dates not in the currently open week', async () => {
      const farFuture = (() => {
        const d = new Date(`${upcomingMonday}T00:00:00`)
        d.setDate(d.getDate() + 21)
        return localDateKey(d)
      })()
      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [farFuture] }))
        .rejects.toThrow('currently open week')
    })

    it('shifts the open week forward once its own deadline has passed, rejecting the now-closed upcoming week', async () => {
      const todayDow = now.getDay()
      const pastDeadlineDow = (todayDow + 6) % 7 // yesterday's weekday — guaranteed already passed
      vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue({ company_id: 'company-1', deadline_weekday: pastDeadlineDow, deadline_time: '17:00', updated_by: null, updated_at: '2026-01-01' } as any)

      // upcomingMonday's own deadline has passed, so that window is closed — submitting for it
      // should be rejected, pointing at the week after instead.
      const nextOpenWeek = (() => {
        const d = new Date(`${upcomingMonday}T00:00:00`)
        d.setDate(d.getDate() + 7)
        return localDateKey(d)
      })()
      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday] }))
        .rejects.toThrow(nextOpenWeek)
    })

    it('rejects submission not matching the resolved quota exactly', async () => {
      vi.mocked(offDaySettingsRepository.getCompanyDefaultQuota).mockResolvedValue({ company_id: 'company-1', user_id: null, max_days_per_week: 1, role: 'Employee', updated_by: null, updated_at: '2026-01-01' } as any)

      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday, upcomingTuesday] }))
        .rejects.toThrow('exactly 1')
    })

    it('uses a per-Manager quota override instead of the company default', async () => {
      vi.mocked(offDaySettingsRepository.getQuotaForUser).mockResolvedValue({ company_id: 'company-1', user_id: 'mgr-1', max_days_per_week: 3, role: null, updated_by: 'owner-1', updated_at: '2026-01-01' } as any)

      await attendanceService.submitFixedOffDayRequest({ user_id: 'mgr-1', company_id: 'company-1', dates: [upcomingMonday, upcomingTuesday, upcomingWednesday] })

      expect(offDaySettingsRepository.getCompanyDefaultQuota).not.toHaveBeenCalled()
      expect(attendanceRepository.createFixedOffDayRequests).toHaveBeenCalledWith(expect.objectContaining({ source: 'submitted' }))
    })

    it('rejects resubmission for a week already auto-assigned', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByUserAndWeek).mockResolvedValue([
        { id: 'fod-auto', user_id: 'user-1', company_id: 'company-1', request_date: upcomingMonday, week_start: upcomingMonday, status: 'approved', source: 'auto_assigned', reviewed_by: null, reviewed_at: '2026-01-01', created_at: '2026-01-01' },
      ] as any)

      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday, upcomingTuesday] }))
        .rejects.toThrow('closed')
    })

    it('succeeds and replaces prior pending rows for the week on the happy path', async () => {
      await attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday, upcomingTuesday] })

      expect(attendanceRepository.deleteFixedOffDayRequestsByUserAndWeek).toHaveBeenCalledWith('user-1', 'company-1', upcomingMonday, ['pending', 'rejected'])
      expect(attendanceRepository.createFixedOffDayRequests).toHaveBeenCalledWith({
        user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday, upcomingTuesday], week_start: upcomingMonday, source: 'submitted',
      })
    })
  })

  describe('resolveDeadlineDateForWeek', () => {
    it('converts a Sunday-start deadline weekday into the correct Monday-start-week date', async () => {
      const { resolveDeadlineDateForWeek } = await import('./attendanceService')
      // Week starting Monday 2026-07-06. deadline_weekday=2 (Tuesday) -> 2026-07-07.
      expect(resolveDeadlineDateForWeek('2026-07-06', 2)).toBe('2026-07-07')
      // deadline_weekday=0 (Sunday) -> last day of that Monday-start week -> 2026-07-12.
      expect(resolveDeadlineDateForWeek('2026-07-06', 0)).toBe('2026-07-12')
      // deadline_weekday=1 (Monday) -> the week_start itself.
      expect(resolveDeadlineDateForWeek('2026-07-06', 1)).toBe('2026-07-06')
    })
  })

  describe('resolveActiveSubmissionWeekStart', () => {
    const todayKey = new Date().toISOString().slice(0, 10)
    const thisWeekStart = weekStart(todayKey)
    const addDaysUTC = (dateKey: string, days: number): string => {
      const d = new Date(`${dateKey}T00:00:00`)
      d.setDate(d.getDate() + days)
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const upcomingWeekStart = addDaysUTC(thisWeekStart, 7)

    it('returns the immediate next week when there is no deadline configured', async () => {
      const { resolveActiveSubmissionWeekStart } = await import('./attendanceService')
      expect(resolveActiveSubmissionWeekStart(todayKey, null)).toBe(upcomingWeekStart)
    })

    it("returns the immediate next week when this week's deadline has not passed yet", async () => {
      const { resolveActiveSubmissionWeekStart } = await import('./attendanceService')
      // Today's own weekday, end-of-day — always still in the future relative to "now" regardless
      // of which day of the week the test happens to run on.
      const todayDow = new Date().getDay()
      expect(resolveActiveSubmissionWeekStart(todayKey, { deadline_weekday: todayDow, deadline_time: '23:59' })).toBe(upcomingWeekStart)
    })

    it("shifts to the week after once this week's deadline has passed", async () => {
      const { resolveActiveSubmissionWeekStart } = await import('./attendanceService')
      const todayDow = new Date().getDay()
      const pastDeadlineDow = (todayDow + 6) % 7 // yesterday's weekday — guaranteed already passed
      expect(resolveActiveSubmissionWeekStart(todayKey, { deadline_weekday: pastDeadlineDow, deadline_time: '17:00' }))
        .toBe(addDaysUTC(upcomingWeekStart, 7))
    })
  })

})
