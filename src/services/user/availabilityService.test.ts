import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/user/availabilityRepository', () => ({
  availabilityRepository: {
    getFixedOffDaysByUser: vi.fn(),
    setFixedOffDays: vi.fn(),
    getBreakWaiverRequestsByUser: vi.fn(),
    createBreakWaiverRequest: vi.fn(),
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

  describe('submitBreakWaiverRequest (Break Waiver)', () => {
    it('accepts the break_waiver request type', async () => {
      const created = { id: 'req-1', company_id: 'company-1', requester_id: 'user-1', shift_assignment_id: null, request_type: 'break_waiver', reason: null, status: 'pending', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01', updated_at: '2026-01-01' }
      vi.mocked(availabilityRepository.createBreakWaiverRequest).mockResolvedValue(created)

      const result = await availabilityService.submitBreakWaiverRequest({ user_id: 'user-1', company_id: 'company-1', request_type: 'break_waiver', reason: null })

      expect(availabilityRepository.createBreakWaiverRequest).toHaveBeenCalledWith(expect.objectContaining({ request_type: 'break_waiver' }))
      expect(result).toEqual(created)
    })

    it('rejects request types other than break_waiver before touching the repository', async () => {
      await expect(availabilityService.submitBreakWaiverRequest({ user_id: 'user-1', company_id: 'company-1', request_type: 'leave', reason: null }))
        .rejects.toThrow('Invalid request type: only break_waiver is supported')
      expect(availabilityRepository.createBreakWaiverRequest).not.toHaveBeenCalled()
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
