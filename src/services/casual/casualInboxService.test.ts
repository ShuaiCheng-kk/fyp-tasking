import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/casual/casualInboxRepository', () => ({
  casualInboxRepository: {
    getUserByAuthId: vi.fn(),
    getMessagesBetweenUsers: vi.fn(),
    markMessagesAsRead: vi.fn(),
    insertMessage: vi.fn(),
  },
}))

vi.mock('@/repositories/casual/casualDashboardRepository', () => ({
  casualDashboardRepository: {
    getUserByAuthId: vi.fn(),
    getUpcomingAssignments: vi.fn(),
    getJobPostingsByIds: vi.fn(),
    getUsersByIds: vi.fn(),
  },
}))

vi.mock('@/repositories/casual/casualAttendanceRepository', () => ({
  casualAttendanceRepository: {
    getAttendanceRecordsByAssignmentIds: vi.fn(),
  },
}))

import { casualInboxService } from './casualInboxService'
import { casualInboxRepository } from '@/repositories/casual/casualInboxRepository'
import { casualDashboardRepository } from '@/repositories/casual/casualDashboardRepository'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'

const worker = { id: 'cw-1', full_name: 'Alicia Tan' }

// Builds an assignment whose shift starts at the given offset from real "now", encoded exactly
// the way the service re-parses it (sgtInstant, i.e. shift_date/start_time as the Singapore
// wall-clock reading of that instant), so window math is precise.
function assignmentStartingIn(minutesFromNow: number, overrides: Partial<{
  id: string
  supervisor_employee_id: string | null
}> = {}) {
  const start = new Date(Date.now() + minutesFromNow * 60000)
  const iso = new Date(start.getTime() + 8 * 60 * 60 * 1000).toISOString()
  return {
    id: overrides.id ?? 'a-1',
    supervisor_employee_id: overrides.supervisor_employee_id ?? 'emp-1',
    shift: {
      id: 's-1',
      company_id: 'company-1',
      department_id: 'dept-1',
      title: 'Barista',
      shift_date: iso.slice(0, 10),
      start_time: iso.slice(11, 19),
      end_time: iso.slice(11, 19),
      is_open_ended: false,
      source_job_posting_id: null,
    },
  }
}

describe('casualInboxService.sendMessage — work-action availability gate', () => {
  // Pin the clock to a stable SGT noon — assignmentStartingIn's relative offsets (±120min,
  // ±1440min) must land on predictable calendar days; left on the real clock, this suite goes
  // flaky for the ~2 hours a day (SGT midnight onward) where a -120min or +1440min offset crosses
  // a day boundary the test didn't intend (2026-07-31).
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-15T04:00:00.000Z')) // 2026-07-15T12:00:00+08:00
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualInboxRepository.getUserByAuthId).mockResolvedValue(worker)
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
    vi.mocked(casualInboxRepository.insertMessage).mockResolvedValue({ id: 'm-1' } as never)
  })

  it('rejects when the worker has no current job at all', async () => {
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([])
    await expect(casualInboxService.sendMessage('auth-1', 'emp-1', 'company-1', 'hello'))
      .rejects.toThrow('only available while you have an active job')
  })

  it('rejects before the Clock In window opens (more than 30 minutes before start)', async () => {
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      assignmentStartingIn(60),
    ])
    await expect(casualInboxService.sendMessage('auth-1', 'emp-1', 'company-1', 'hello'))
      .rejects.toThrow('opens 30 minutes before your job starts')
  })

  it('rejects a recipient who is not the current job\'s supervisor', async () => {
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      assignmentStartingIn(10),
    ])
    await expect(casualInboxService.sendMessage('auth-1', 'emp-other', 'company-1', 'hello'))
      .rejects.toThrow('only message the supervisor or backup contact of your current job')
  })

  it('sends once the window is open (inside the 30-minute pre-start window)', async () => {
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      assignmentStartingIn(10),
    ])
    await casualInboxService.sendMessage('auth-1', 'emp-1', 'company-1', '  hello  ')
    expect(casualInboxRepository.insertMessage).toHaveBeenCalledWith('cw-1', 'emp-1', 'company-1', 'hello', 'Alicia Tan')
  })

  it('still sends while clocked in (window stays open until clock out)', async () => {
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      assignmentStartingIn(-120),
    ])
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
      { shift_assignment_id: 'a-1', clock_in_time: new Date().toISOString(), clock_out_time: null } as never,
    ])
    await casualInboxService.sendMessage('auth-1', 'emp-1', 'company-1', 'still here')
    expect(casualInboxRepository.insertMessage).toHaveBeenCalled()
  })

  it('stays open for the rest of the day after clocking out, instead of handing off to tomorrow\'s not-yet-open job (2026-07-31)', async () => {
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      assignmentStartingIn(-120, { id: 'a-done' }),
      assignmentStartingIn(24 * 60, { id: 'a-next' }),
    ])
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
      { shift_assignment_id: 'a-done', clock_in_time: '2026-01-01T09:00:00Z', clock_out_time: '2026-01-01T17:00:00Z' } as never,
    ])
    // "current" stays anchored to today's a-done (findCurrentAssignment, casualDashboardService)
    // rather than jumping to a-next just because a-done is finished — so its already-open window
    // still governs the gate, and the message goes through.
    await casualInboxService.sendMessage('auth-1', 'emp-1', 'company-1', 'hello')
    expect(casualInboxRepository.insertMessage).toHaveBeenCalled()
  })

  it('blocks once nothing is left today and the next job\'s window has not opened yet', async () => {
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      assignmentStartingIn(24 * 60, { id: 'a-next' }),
    ])
    await expect(casualInboxService.sendMessage('auth-1', 'emp-1', 'company-1', 'hello'))
      .rejects.toThrow('opens 30 minutes before your job starts')
  })

  it('rejects empty content before doing any lookups', async () => {
    await expect(casualInboxService.sendMessage('auth-1', 'emp-1', 'company-1', '   '))
      .rejects.toThrow('Message content cannot be empty')
    expect(casualInboxRepository.getUserByAuthId).not.toHaveBeenCalled()
  })

  it('throws when the casual worker cannot be found', async () => {
    vi.mocked(casualInboxRepository.getUserByAuthId).mockResolvedValue(null)
    await expect(casualInboxService.sendMessage('auth-1', 'emp-1', 'company-1', 'hello'))
      .rejects.toThrow('Casual worker not found')
  })
})

describe('casualInboxService.getMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualInboxRepository.getUserByAuthId).mockResolvedValue(worker)
    vi.mocked(casualInboxRepository.getMessagesBetweenUsers).mockResolvedValue([{ id: 'm-1' }] as never)
    vi.mocked(casualInboxRepository.markMessagesAsRead).mockResolvedValue(undefined)
  })

  it('returns the thread and marks incoming messages read', async () => {
    const result = await casualInboxService.getMessages('auth-1', 'emp-1')
    expect(result.self_id).toBe('cw-1')
    expect(result.messages).toHaveLength(1)
    expect(casualInboxRepository.markMessagesAsRead).toHaveBeenCalledWith('cw-1', 'emp-1')
  })
})
