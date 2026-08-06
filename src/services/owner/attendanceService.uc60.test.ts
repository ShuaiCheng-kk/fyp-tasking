import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getAttendanceRecordById: vi.fn(),
    getAttendanceRecordContext: vi.fn(),
    getUsersByIds: vi.fn(),
    updateAttendanceRecord: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/ownerTeamRepository', () => ({
  ownerTeamRepository: {
    findManagerDepartments: vi.fn(),
  },
}))

import { attendanceService } from './attendanceService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'

const users: Record<string, { id: string; role: string }> = {
  'owner-1': { id: 'owner-1', role: 'Owner' },
  'partner-1': { id: 'partner-1', role: 'Partner' },
  'mgr-1': { id: 'mgr-1', role: 'Manager' },
  'mgr-2': { id: 'mgr-2', role: 'Manager' },
  'emp-1': { id: 'emp-1', role: 'Employee' },
}

function baseRecord() {
  return {
    id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: '2026-08-10T09:00:00.000Z',
    break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: '2026-08-10T05:15:00.000Z', modified_by: null,
    modified_clock_in_time: null, modified_clock_out_time: null, modified_break_in_time: null, modified_break_out_time: null,
  }
}

describe('UC60 Modify Clock Time', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(attendanceRepository.getUsersByIds).mockImplementation(async (ids) => ids.map(id => users[id]).filter(Boolean) as never)
    vi.mocked(attendanceRepository.updateAttendanceRecord).mockImplementation(async (id, fields) => ({ id, ...fields } as never))
    vi.mocked(attendanceRepository.getAttendanceRecordContext).mockResolvedValue({ assignee_user_id: 'emp-1', department_id: 'dept-1', company_id: 'comp-1' } as never)
    vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-1', department_name: 'Retail' }] as never)
  })

  it('UC60-M-UT-O: Owner corrects a Clock In time with a reason', async () => {
    vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseRecord() as never)

    const result = await attendanceService.modifyAttendanceTimes({
      id: 'rec-1', actor_id: 'owner-1', reason: 'Forgot to clock in on time',
      clock_in_time: '2026-08-10T00:55:00.000Z', clock_out_time: null, break_in_time: null, break_out_time: null,
    })

    expect(result).toMatchObject({ modified_clock_in_time: '2026-08-10T00:55:00.000Z', modified_reason: 'Forgot to clock in on time' })
  })

  it('UC60-M-UT-P: Partner corrects a Clock Out time with a reason', async () => {
    vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseRecord() as never)

    const result = await attendanceService.modifyAttendanceTimes({
      id: 'rec-1', actor_id: 'partner-1', reason: 'Forgot to clock out on time',
      clock_in_time: null, clock_out_time: '2026-08-10T09:30:00.000Z', break_in_time: null, break_out_time: null,
    })

    expect(result).toMatchObject({ modified_clock_out_time: '2026-08-10T09:30:00.000Z', modified_reason: 'Forgot to clock out on time' })
  })

  it('UC60-M-UT-M: Manager corrects an Employee\'s Clock In time within their own department', async () => {
    vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseRecord() as never)

    const result = await attendanceService.modifyAttendanceTimes({
      id: 'rec-1', actor_id: 'mgr-1', reason: 'Forgot to clock in on time',
      clock_in_time: '2026-08-10T00:55:00.000Z', clock_out_time: null, break_in_time: null, break_out_time: null,
    })

    expect(result).toMatchObject({ modified_clock_in_time: '2026-08-10T00:55:00.000Z', modified_reason: 'Forgot to clock in on time' })
  })

  it('UC60-A1-UT-O: Owner is blocked from saving a Clock In later than Clock Out', async () => {
    vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseRecord() as never)

    await expect(attendanceService.modifyAttendanceTimes({
      id: 'rec-1', actor_id: 'owner-1', reason: 'Typo fix',
      clock_in_time: '2026-08-10T10:00:00.000Z', clock_out_time: null, break_in_time: null, break_out_time: null,
    })).rejects.toThrow('Clock In cannot be later than Clock Out')
  })

  it('UC60-A1-UT-P: Partner is blocked from saving a Break In later than Break Out', async () => {
    vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseRecord() as never)

    await expect(attendanceService.modifyAttendanceTimes({
      id: 'rec-1', actor_id: 'partner-1', reason: 'Typo fix',
      clock_in_time: null, clock_out_time: null, break_in_time: '2026-08-10T05:20:00.000Z', break_out_time: null,
    })).rejects.toThrow('Break In cannot be later than Break Out')
  })

  it('UC60-A1-UT-M: Manager is blocked from saving a break time outside the Clock In/Out window', async () => {
    vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseRecord() as never)

    await expect(attendanceService.modifyAttendanceTimes({
      id: 'rec-1', actor_id: 'mgr-1', reason: 'Typo fix',
      clock_in_time: null, clock_out_time: null,
      break_in_time: '2026-08-10T09:15:00.000Z', break_out_time: '2026-08-10T09:20:00.000Z',
    })).rejects.toThrow('Break In must be between Clock In and Clock Out')
  })

  it('UC60-BR-UT-O-1: Owner is blocked from saving a changed time without typing a reason', async () => {
    vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseRecord() as never)

    await expect(attendanceService.modifyAttendanceTimes({
      id: 'rec-1', actor_id: 'owner-1', reason: null,
      clock_in_time: '2026-08-10T00:55:00.000Z', clock_out_time: null, break_in_time: null, break_out_time: null,
    })).rejects.toThrow('A reason is required when modifying attendance times')
  })

  it('UC60-BR-UT-M-1: Manager is blocked from modifying a peer Manager\'s attendance record', async () => {
    vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseRecord() as never)
    vi.mocked(attendanceRepository.getAttendanceRecordContext).mockResolvedValue({ assignee_user_id: 'mgr-2', department_id: 'dept-1', company_id: 'comp-1' } as never)

    await expect(attendanceService.modifyAttendanceTimes({
      id: 'rec-1', actor_id: 'mgr-1', reason: 'Correction',
      clock_in_time: '2026-08-10T00:55:00.000Z', clock_out_time: null, break_in_time: null, break_out_time: null,
    })).rejects.toThrow("A Manager may only modify an Employee or Casual Worker's attendance record")
  })

  it('UC60-BR-UT-M-2: Manager is blocked from modifying an Employee\'s record outside their own department', async () => {
    vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(baseRecord() as never)
    vi.mocked(attendanceRepository.getAttendanceRecordContext).mockResolvedValue({ assignee_user_id: 'emp-1', department_id: 'dept-2', company_id: 'comp-1' } as never)

    await expect(attendanceService.modifyAttendanceTimes({
      id: 'rec-1', actor_id: 'mgr-1', reason: 'Correction',
      clock_in_time: '2026-08-10T00:55:00.000Z', clock_out_time: null, break_in_time: null, break_out_time: null,
    })).rejects.toThrow('Not authorized to modify attendance records outside your department')
  })

  it('UC60-BR-UT-M-3: Manager is blocked from modifying a record already modified by Owner/Partner', async () => {
    vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
      ...baseRecord(),
      clock_in_time: '2026-08-10T00:50:00.000Z', // true original differs from the already-modified value below
      modified_clock_in_time: '2026-08-10T00:55:00.000Z',
      modified_by: 'owner-1',
    } as never)

    await expect(attendanceService.modifyAttendanceTimes({
      id: 'rec-1', actor_id: 'mgr-1', reason: 'Correction',
      clock_in_time: '2026-08-10T00:55:00.000Z', clock_out_time: null, break_in_time: null, break_out_time: null,
    })).rejects.toThrow('This record was last modified by Owner/Partner and can no longer be modified by a Manager')
  })
})
