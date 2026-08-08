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

describe('UC53 Break Out (Casual Worker)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'cw-1', full_name: 'Casual Chris', role: 'Casual Worker' } as never)
    vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment as never)
    vi.mocked(casualAttendanceRepository.updateAttendanceRecord).mockImplementation(async (id, fields) => ({ id, ...fields } as never))
  })

  it('UC53-M-UT-CW: Casual Worker ends an in-progress break', async () => {
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: null } as never)

    const result = await casualAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assign-1', break_time: '2026-08-10T05:15:00.000Z' })

    expect(result).toMatchObject({ id: 'rec-1', break_out_time: '2026-08-10T05:15:00.000Z' })
  })

  it('UC53-BR-UT-CW-1: Casual Worker is blocked from ending a break that was never started', async () => {
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', break_in_time: null, break_out_time: null } as never)

    await expect(casualAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assign-1' }))
      .rejects.toThrow('No break started')
  })

  it('UC53-BR-UT-CW-2: Casual Worker is blocked from ending a break that has already ended', async () => {
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: '2026-08-10T05:15:00.000Z' } as never)

    await expect(casualAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assign-1' }))
      .rejects.toThrow('Break already ended')
  })
})
