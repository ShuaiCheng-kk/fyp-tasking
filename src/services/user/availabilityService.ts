// LAYER: Service
// RULE: Business logic only. No HTTP handling, no direct DB access.

import { availabilityRepository, FixedOffDay, LeaveRequest } from '@/repositories/user/availabilityRepository'
import { userService } from '@/services/auth/userService'

export const availabilityService = {
  async getFixedOffDays(user_id: string): Promise<FixedOffDay[]> {
    return availabilityRepository.getFixedOffDaysByUser(user_id)
  },

  async setFixedOffDays(user_id: string, company_id: string, weekdays: number[]): Promise<void> {
    const valid = weekdays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
    const unique = [...new Set(valid)]
    await availabilityRepository.setFixedOffDays(user_id, company_id, unique)
  },

  async getLeaveRequests(user_id: string): Promise<LeaveRequest[]> {
    return availabilityRepository.getLeaveRequestsByUser(user_id)
  },

  async submitLeaveRequest(input: {
    user_id: string
    company_id: string
    request_type: string
    reason: string | null
  }): Promise<LeaveRequest> {
    const allowed = ['time_off', 'break_waiver']
    if (!allowed.includes(input.request_type)) {
      throw new Error('Invalid request type')
    }
    return availabilityRepository.createLeaveRequest({
      company_id: input.company_id,
      requester_id: input.user_id,
      request_type: input.request_type,
      reason: input.reason ?? null,
    })
  },
}
