import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/user/availabilityRepository', () => ({
  availabilityRepository: {
    getFixedOffDaysByUser: vi.fn(),
    setFixedOffDays: vi.fn(),
    getLeaveRequestsByUser: vi.fn(),
    createLeaveRequest: vi.fn(),
    createShiftSwapRequest: vi.fn(),
  },
}))

import { availabilityService } from './availabilityService'
import { availabilityRepository } from '@/repositories/user/availabilityRepository'

describe('availabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setFixedOffDays (UC55: Submit Fixed Day Off)', () => {
    it('passes the deduplicated, validated weekday set through to the repository', async () => {
      vi.mocked(availabilityRepository.setFixedOffDays).mockResolvedValue(undefined)

      await availabilityService.setFixedOffDays('user-1', 'company-1', [1, 1, 3, 9, -1])

      expect(availabilityRepository.setFixedOffDays).toHaveBeenCalledWith('user-1', 'company-1', [1, 3])
    })
  })

  describe('submitLeaveRequest (UC57: Submit Leave Request)', () => {
    it('accepts the distinct "leave" request type', async () => {
      const created = { id: 'req-1', company_id: 'company-1', requester_id: 'user-1', shift_assignment_id: null, request_type: 'leave', reason: null, status: 'pending', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01', updated_at: '2026-01-01' }
      vi.mocked(availabilityRepository.createLeaveRequest).mockResolvedValue(created)

      const result = await availabilityService.submitLeaveRequest({ user_id: 'user-1', company_id: 'company-1', request_type: 'leave', reason: null })

      expect(availabilityRepository.createLeaveRequest).toHaveBeenCalledWith(expect.objectContaining({ request_type: 'leave' }))
      expect(result).toEqual(created)
    })

    it('still accepts time_off and break_waiver', async () => {
      vi.mocked(availabilityRepository.createLeaveRequest).mockResolvedValue({} as any)

      await availabilityService.submitLeaveRequest({ user_id: 'user-1', company_id: 'company-1', request_type: 'time_off', reason: null })
      await availabilityService.submitLeaveRequest({ user_id: 'user-1', company_id: 'company-1', request_type: 'break_waiver', reason: null })

      expect(availabilityRepository.createLeaveRequest).toHaveBeenCalledTimes(2)
    })

    it('rejects an unsupported request type before touching the repository', async () => {
      await expect(availabilityService.submitLeaveRequest({ user_id: 'user-1', company_id: 'company-1', request_type: 'vacation', reason: null }))
        .rejects.toThrow('Invalid request type')
      expect(availabilityRepository.createLeaveRequest).not.toHaveBeenCalled()
    })
  })

  describe('submitShiftSwapRequest (UC52: Submit Shift Swap Request)', () => {
    it('blocks a requester from naming themself as the replacement', async () => {
      await expect(availabilityService.submitShiftSwapRequest({
        company_id: 'company-1', shift_assignment_id: 'asn-1', requester_id: 'user-1', replacement_user_id: 'user-1', reason: null,
      })).rejects.toThrow('Replacement user must be different from requester')
      expect(availabilityRepository.createShiftSwapRequest).not.toHaveBeenCalled()
    })

    it('creates the swap request when requester and replacement differ', async () => {
      vi.mocked(availabilityRepository.createShiftSwapRequest).mockResolvedValue({ id: 'swap-1' } as any)

      await availabilityService.submitShiftSwapRequest({
        company_id: 'company-1', shift_assignment_id: 'asn-1', requester_id: 'user-1', replacement_user_id: 'user-2', reason: null,
      })

      expect(availabilityRepository.createShiftSwapRequest).toHaveBeenCalled()
    })
  })
})
