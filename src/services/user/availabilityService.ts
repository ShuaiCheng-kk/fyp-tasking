// LAYER: Service
// RULE: Business logic only. No HTTP handling, no direct DB access.

import { availabilityRepository, LeaveRequest } from '@/repositories/user/availabilityRepository'
import { ShiftSwapRequest } from '@/types/Attendance'

export const availabilityService = {
  async getBreakWaiverRequests(user_id: string): Promise<LeaveRequest[]> {
    return availabilityRepository.getLeaveRequestsByUser(user_id)
  },

  async submitBreakWaiverRequest(input: {
    user_id: string
    company_id: string
    request_type: string
    reason: string | null
    shift_assignment_id?: string | null
  }): Promise<LeaveRequest> {
    if (!['time_off', 'break_waiver', 'leave'].includes(input.request_type)) {
      throw new Error('Invalid request type')
    }
    return availabilityRepository.createLeaveRequest({
      user_id: input.user_id,
      company_id: input.company_id,
      request_type: input.request_type as 'time_off' | 'break_waiver' | 'leave',
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

  async submitLegacyShiftSwapRequest(input: {
    company_id: string
    requester_id: string
    shift_assignment_id: string
    replacement_user_id: string
    reason: string | null
  }): Promise<ShiftSwapRequest> {
    if (input.requester_id === input.replacement_user_id) {
      throw new Error('Cannot swap with yourself')
    }
    const requesterAssignment = await availabilityRepository.getShiftAssignmentById(input.shift_assignment_id)
    if (!requesterAssignment) throw new Error('Shift assignment not found')
    let replacementAssignment = await availabilityRepository.getShiftAssignmentForUser(requesterAssignment.shift_id, input.replacement_user_id)
    if (!replacementAssignment) {
      replacementAssignment = await availabilityRepository.createShiftAssignment({
        shift_id: requesterAssignment.shift_id,
        user_id: input.replacement_user_id,
        assigned_by: requesterAssignment.assigned_by ?? input.requester_id,
      })
    }
    return availabilityRepository.createShiftSwapRequest({
      company_id: input.company_id,
      requester_id: input.requester_id,
      requester_assignment_id: input.shift_assignment_id,
      counterpart_id: input.replacement_user_id,
      counterpart_assignment_id: replacementAssignment.id,
      reason: input.reason,
      counterpart_status: 'approved',
      counterpart_reviewed_at: new Date().toISOString(),
    })
  },
}
