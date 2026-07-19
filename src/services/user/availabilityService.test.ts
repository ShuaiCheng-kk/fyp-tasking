import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/user/availabilityRepository', () => ({
  availabilityRepository: {
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

  describe('submitBreakWaiverRequest (Leave Requests)', () => {
    it.each(['time_off', 'break_waiver'])('accepts the %s request type', async requestType => {
      const created = { id: 'req-1', company_id: 'company-1', requester_id: 'user-1', shift_assignment_id: null, request_type: requestType, reason: null, status: 'pending', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01', updated_at: '2026-01-01' }
      vi.mocked(availabilityRepository.createLeaveRequest).mockResolvedValue(created)

      const result = await availabilityService.submitBreakWaiverRequest({ user_id: 'user-1', company_id: 'company-1', request_type: requestType, reason: null })

      expect(availabilityRepository.createLeaveRequest).toHaveBeenCalledWith(expect.objectContaining({ request_type: requestType }))
      expect(result).toEqual(created)
    })

    it('rejects unsupported request types before touching the repository', async () => {
      await expect(availabilityService.submitBreakWaiverRequest({ user_id: 'user-1', company_id: 'company-1', request_type: 'vacation', reason: null }))
        .rejects.toThrow('Invalid request type')
      expect(availabilityRepository.createLeaveRequest).not.toHaveBeenCalled()
    })
  })

  describe('submitShiftSwapRequest (UC52: Submit Shift Swap Request)', () => {
    it('blocks a requester from swapping with themselves', async () => {
      await expect(availabilityService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-1', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('Cannot swap with yourself')
      expect(availabilityRepository.createShiftSwapRequest).not.toHaveBeenCalled()
    })

    it('creates the swap request when requester and counterpart differ', async () => {
      vi.mocked(availabilityRepository.createShiftSwapRequest).mockResolvedValue({ id: 'swap-1' } as any)

      await availabilityService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })

      expect(availabilityRepository.createShiftSwapRequest).toHaveBeenCalled()
    })
  })
})
