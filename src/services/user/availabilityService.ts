// LAYER: Service
// RULE: Business logic only. No HTTP handling, no direct DB access.

import { availabilityRepository, FixedOffDay, LeaveRequest } from '@/repositories/user/availabilityRepository'
import { ShiftSwapRequest } from '@/types/Attendance'

export const availabilityService = {
  async getFixedOffDays(user_id: string): Promise<FixedOffDay[]> {
    return availabilityRepository.getFixedOffDaysByUser(user_id)
  },

  async setFixedOffDays(user_id: string, company_id: string, weekdays: number[]): Promise<void> {
    const valid = weekdays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
    const unique = [...new Set(valid)]
    await availabilityRepository.setFixedOffDays(user_id, company_id, unique)
  },

  async getBreakWaiverRequests(user_id: string): Promise<LeaveRequest[]> {
    return availabilityRepository.getBreakWaiverRequestsByUser(user_id)
  },

  async submitBreakWaiverRequest(input: {
    user_id: string
    company_id: string
    request_type: string
    reason: string | null
    shift_assignment_id?: string | null
  }): Promise<LeaveRequest> {
    if (input.request_type !== 'break_waiver') {
      throw new Error('Invalid request type: only break_waiver is supported')
    }
    return availabilityRepository.createBreakWaiverRequest({
      user_id: input.user_id,
      company_id: input.company_id,
      request_type: 'break_waiver',
      reason: input.reason ?? null,
      shift_assignment_id: input.shift_assignment_id ?? null,
    })
  },

  async submitShiftSwapRequest(input: {
    company_id: string
    requester_id: string
    requester_assignment_id: string
    counterpart_id: string
    counterpart_assignment_id: string
    reason: string | null
  }): Promise<ShiftSwapRequest> {
    if (input.requester_id === input.counterpart_id) {
      throw new Error('Cannot swap with yourself')
    }
    return availabilityRepository.createShiftSwapRequest(input)
  },
}
