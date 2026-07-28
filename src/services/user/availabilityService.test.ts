import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/user/availabilityRepository', () => ({
  availabilityRepository: {
    createShiftSwapRequest: vi.fn(),
  },
}))

import { availabilityService } from './availabilityService'
import { availabilityRepository } from '@/repositories/user/availabilityRepository'

describe('availabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
