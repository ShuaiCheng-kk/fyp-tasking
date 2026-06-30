// LAYER: Service
// RULE: Business logic only. No HTTP handling, no direct DB access.

import { availabilityRepository, FixedOffDay, LeaveRequest } from '@/repositories/user/availabilityRepository'
import { ShiftSwapRequest, TimeOffRequestType } from '@/types/Attendance'

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
    shift_assignment_id?: string | null
  }): Promise<LeaveRequest> {
    const allowed: TimeOffRequestType[] = ['time_off', 'break_waiver', 'leave']
    if (!allowed.includes(input.request_type as TimeOffRequestType)) {
      throw new Error('Invalid request type')
    }
    return availabilityRepository.createLeaveRequest({
      user_id: input.user_id,
      company_id: input.company_id,
      request_type: input.request_type as TimeOffRequestType,
      reason: input.reason ?? null,
      shift_assignment_id: input.shift_assignment_id ?? null,
    })
  },

  async submitShiftSwapRequest(input: {
    company_id: string
    shift_assignment_id: string
    requester_id: string
    replacement_user_id: string
    reason: string | null
  }): Promise<ShiftSwapRequest> {
    if (input.requester_id === input.replacement_user_id) {
      throw new Error('Replacement user must be different from requester')
    }
    return availabilityRepository.createShiftSwapRequest(input)
  },
}
