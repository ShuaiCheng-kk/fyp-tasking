// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'

export interface RequestAISuggestion {
  recommendation: 'approve' | 'reject' | 'review'
  confidence: number
  reason: string
  concerns: string[]
  alternatives: string[]
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const requestAISuggestService = {
  async suggestShiftSwap(request: {
    id: string
    requester_name: string
    replacement_name: string
    shift_date: string | null
    shift_title: string | null
    start_time: string | null
    end_time: string | null
    reason: string | null
    company_id: string
  }): Promise<RequestAISuggestion> {
    const context: Record<string, unknown> = {
      request_type: 'Shift Swap',
      requester: request.requester_name,
      replacement: request.replacement_name,
      shift_date: request.shift_date,
      shift_title: request.shift_title,
      shift_hours: request.start_time && request.end_time
        ? `${request.start_time} – ${request.end_time}`
        : null,
      reason: request.reason,
    }

    if (request.shift_date) {
      const replacementAssignments = await attendanceRepository.getAssignmentsByCompanyAndDateRange(
        request.company_id,
        request.shift_date,
        request.shift_date,
      )
      const replacementConflicts = replacementAssignments.filter(a => {
        const user = a.user_id
        return user !== request.requester_name
      })
      context.same_day_assignments_count = replacementConflicts.length
    }

    return openAIService.generateStructuredJson<RequestAISuggestion>({
      schemaName: 'shift_swap_suggestion',
      maxOutputTokens: 600,
      instructions: [
        'You are an HR assistant helping a business owner decide whether to approve a shift swap request.',
        'Assess feasibility, fairness, and operational impact.',
        'Consider: does the replacement have conflicting shifts on the same day? Is the reason valid?',
        'recommendation must be one of: approve, reject, review.',
        'confidence is 0–100. concerns is a list of issues (empty array if none). alternatives is a list of suggestions (empty array if none).',
      ].join(' '),
      input: context,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recommendation: { type: 'string', enum: ['approve', 'reject', 'review'] },
          confidence: { type: 'number' },
          reason: { type: 'string' },
          concerns: { type: 'array', items: { type: 'string' } },
          alternatives: { type: 'array', items: { type: 'string' } },
        },
        required: ['recommendation', 'confidence', 'reason', 'concerns', 'alternatives'],
      },
    })
  },

  async suggestFixedOffDay(request: {
    id: string
    requester_name: string
    weekday: number
    company_id: string
    user_id: string
  }): Promise<RequestAISuggestion> {
    const allFixedOff = await attendanceRepository.getFixedOffDaysByCompanyAndWeekday(
      request.company_id,
      request.weekday,
    )
    const otherUsersWithSameDay = allFixedOff.filter(r => r.user_id !== request.user_id)

    const context = {
      request_type: 'Fixed Day Off',
      requester: request.requester_name,
      requested_weekday: WEEKDAY_NAMES[request.weekday],
      existing_fixed_off_count_same_day: otherUsersWithSameDay.length,
      note: `${otherUsersWithSameDay.length} other employee(s) already have ${WEEKDAY_NAMES[request.weekday]} as their fixed day off.`,
    }

    return openAIService.generateStructuredJson<RequestAISuggestion>({
      schemaName: 'fixed_off_day_suggestion',
      maxOutputTokens: 600,
      instructions: [
        'You are an HR assistant helping a business owner decide whether to approve a fixed day off request.',
        'Assess the impact on staffing: if too many employees already have the same day off, the team may be understaffed.',
        'Generally: 0–1 others with same day off → likely approve; 2 others → review carefully; 3+ others → likely reject.',
        'recommendation must be one of: approve, reject, review.',
        'confidence is 0–100. concerns is a list of issues (empty if none). alternatives is a list of suggestions (empty if none).',
      ].join(' '),
      input: context,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recommendation: { type: 'string', enum: ['approve', 'reject', 'review'] },
          confidence: { type: 'number' },
          reason: { type: 'string' },
          concerns: { type: 'array', items: { type: 'string' } },
          alternatives: { type: 'array', items: { type: 'string' } },
        },
        required: ['recommendation', 'confidence', 'reason', 'concerns', 'alternatives'],
      },
    })
  },

  async suggestLeaveRequest(request: {
    id: string
    requester_name: string
    request_type: string
    shift_date: string | null
    shift_title: string | null
    start_time: string | null
    end_time: string | null
    reason: string | null
    company_id: string
    requester_id: string
  }): Promise<RequestAISuggestion> {
    const context: Record<string, unknown> = {
      request_type: request.request_type === 'leave' ? 'Leave Request' : 'Time Off Request',
      requester: request.requester_name,
      shift_date: request.shift_date,
      shift_title: request.shift_title,
      shift_hours: request.start_time && request.end_time
        ? `${request.start_time} – ${request.end_time}`
        : null,
      reason: request.reason,
    }

    let potentialCovers: string[] = []

    if (request.shift_date) {
      const dayAssignments = await attendanceRepository.getAssignmentsByCompanyAndDateRange(
        request.company_id,
        request.shift_date,
        request.shift_date,
      )
      const otherWorkers = [...new Set(
        dayAssignments
          .filter(a => a.user_id !== request.requester_id)
          .map(a => a.user_id),
      )]
      if (otherWorkers.length > 0) {
        const users = await attendanceRepository.getUsersByIds(otherWorkers)
        potentialCovers = users.map(u => `${u.full_name} (${u.role})`)
      }
      context.other_staff_working_same_day = potentialCovers.length
      context.potential_cover_staff = potentialCovers.slice(0, 5)
    }

    return openAIService.generateStructuredJson<RequestAISuggestion>({
      schemaName: 'leave_request_suggestion',
      maxOutputTokens: 700,
      instructions: [
        'You are an HR assistant helping a business owner decide whether to approve a leave or time-off request.',
        'Assess operational impact: who else is working that day and could cover the shift if approved?',
        'If no one else is scheduled, the leave may cause a staffing gap — flag that as a concern.',
        'If the reason is a clear personal/medical need, lean towards approve.',
        'recommendation must be one of: approve, reject, review.',
        'confidence is 0–100. concerns is a list of issues (empty if none). alternatives is a list of suggestions (empty if none).',
      ].join(' '),
      input: context,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recommendation: { type: 'string', enum: ['approve', 'reject', 'review'] },
          confidence: { type: 'number' },
          reason: { type: 'string' },
          concerns: { type: 'array', items: { type: 'string' } },
          alternatives: { type: 'array', items: { type: 'string' } },
        },
        required: ['recommendation', 'confidence', 'reason', 'concerns', 'alternatives'],
      },
    })
  },
}
