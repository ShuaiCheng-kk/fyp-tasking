import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/casual/casualAttendanceRepository', () => ({
  casualAttendanceRepository: {
    getUserByAuthId: vi.fn(),
    getAssignmentById: vi.fn(),
    getAttendanceRecordByAssignmentId: vi.fn(),
    updateAttendanceRecord: vi.fn(),
  },
}))

import { casualAttendanceService } from './casualAttendanceService'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'

const assignment = { id: 'assign-1', user_id: 'cw-1', shifts: { id: 'shift-1', shift_date: '2026-08-10', start_time: '09:00', end_time: '17:00', is_open_ended: false } }

describe('UC52 Break In (Casual Worker)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'cw-1', full_name: 'Casual Chris', role: 'Casual Worker' } as never)
    vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment as never)
    vi.mocked(casualAttendanceRepository.updateAttendanceRecord).mockImplementation(async (id, fields) => ({ id, ...fields } as never))
  })

  it('UC52-M-UT-CW: Casual Worker starts a break after clocking in', async () => {
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null, break_in_time: null, break_out_time: null } as never)

    const result = await casualAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assign-1', break_time: '2026-08-10T05:00:00.000Z' })

    expect(result).toMatchObject({ id: 'rec-1', break_in_time: '2026-08-10T05:00:00.000Z' })
  })

  it('UC52-BR-UT-CW-1: Casual Worker is blocked from starting a break while already on an active break', async () => {
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null, break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: null } as never)

    await expect(casualAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assign-1' }))
      .rejects.toThrow('Already on a break')
  })

  it('UC52-BR-UT-CW-2: Casual Worker is blocked from starting a second break in the same shift, since One Break Per Shift is enforced server-side for them', async () => {
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null, break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: '2026-08-10T05:15:00.000Z' } as never)

    await expect(casualAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assign-1' }))
      .rejects.toThrow('Break already taken for this shift')
  })
})
