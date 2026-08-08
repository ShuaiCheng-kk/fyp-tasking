import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/casual/casualInboxRepository', () => ({
  casualInboxRepository: {
    getUserByAuthId: vi.fn(),
    insertMessage: vi.fn(),
  },
}))

vi.mock('@/repositories/casual/casualAttendanceRepository', () => ({
  casualAttendanceRepository: {
    getJobPostingsByIds: vi.fn(),
  },
}))

vi.mock('@/services/casual/casualDashboardService', () => ({
  findCurrentAssignment: vi.fn(),
}))

import { casualInboxService } from './casualInboxService'
import { casualInboxRepository } from '@/repositories/casual/casualInboxRepository'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'
import { findCurrentAssignment } from '@/services/casual/casualDashboardService'

// Job shift: 2026-08-10, 09:00-17:00 SGT — messaging window opens 30 minutes before, at 08:30 SGT.
const activeAssignment = {
  assignment: {
    id: 'assign-1', supervisor_employee_id: 'emp-1',
    shift: { source_job_posting_id: 'job-1', shift_date: '2026-08-10', start_time: '09:00' },
  },
  record: { clock_out_time: null },
  all: [],
}

describe('UC65 Send Direct Message (Casual Worker)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualInboxRepository.getUserByAuthId).mockResolvedValue({ id: 'cw-1', full_name: 'Casual Chris' } as never)
    vi.mocked(casualInboxRepository.insertMessage).mockImplementation(async (fromUserId, toUserId, companyId, content) =>
      ({ id: 'msg-1', from_user_id: fromUserId, to_user_id: toUserId, content } as never))
    vi.mocked(casualAttendanceRepository.getJobPostingsByIds).mockResolvedValue([{ id: 'job-1', created_by: 'owner-1' }] as never)
    vi.setSystemTime(new Date('2026-08-10T02:00:00.000Z')) // 10:00 SGT — within the job's window
  })

  it('UC65-M-UT-CW: Casual Worker sends a direct message to their supervising Employee while clocked into their current job', async () => {
    vi.mocked(findCurrentAssignment).mockResolvedValue(activeAssignment as never)

    const result = await casualInboxService.sendMessage('auth-1', 'emp-1', 'comp-1', 'Running 5 minutes late.')

    expect(result).toMatchObject({ from_user_id: 'cw-1', to_user_id: 'emp-1' })
  })

  it('UC65-BR-UT-CW-1: Casual Worker is blocked from messaging anyone other than their job\'s supervisor or backup contact', async () => {
    vi.mocked(findCurrentAssignment).mockResolvedValue(activeAssignment as never)

    await expect(casualInboxService.sendMessage('auth-1', 'someone-else', 'comp-1', 'Hello'))
      .rejects.toThrow('You can only message the supervisor or backup contact of your current job')
  })

  it('UC65-BR-UT-CW-2: Casual Worker is blocked from messaging after clocking out of their job', async () => {
    vi.mocked(findCurrentAssignment).mockResolvedValue({ ...activeAssignment, record: { clock_out_time: '2026-08-10T09:00:00.000Z' } } as never)

    await expect(casualInboxService.sendMessage('auth-1', 'emp-1', 'comp-1', 'Hello'))
      .rejects.toThrow('Messaging closes once you clock out of your job')
  })

  it('UC65-BR-UT-CW-3: Casual Worker is blocked from messaging before their job\'s messaging window opens', async () => {
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z')) // 08:00 SGT — 1 hour before the job starts
    vi.mocked(findCurrentAssignment).mockResolvedValue(activeAssignment as never)

    await expect(casualInboxService.sendMessage('auth-1', 'emp-1', 'comp-1', 'Hello'))
      .rejects.toThrow('Messaging opens 30 minutes before your job starts')
  })
})
