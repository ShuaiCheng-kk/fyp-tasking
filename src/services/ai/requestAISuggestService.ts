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
    requester_id: string
    counterpart_id: string
    requester_name: string
    counterpart_name: string
    requester_role: string
    department_name: string | null
    requester_shift_date: string | null
    requester_start_time: string | null
    requester_end_time: string | null
    counterpart_shift_date: string | null
    counterpart_start_time: string | null
    counterpart_end_time: string | null
    requester_task_count: number
    counterpart_task_count: number
    reason: string | null
    company_id: string
  }): Promise<RequestAISuggestion> {
    // 1. Time conflict check — does each person have other shifts that overlap with their new shift?
    const timeConflicts: string[] = []

    const checkOverlap = (shifts: Awaited<ReturnType<typeof attendanceRepository.getAssignmentsByUserDateRange>>, newDate: string | null, newStart: string | null, newEnd: string | null, personName: string, excludeDate: string | null, excludeStart: string | null) => {
      if (!newDate || !newStart || !newEnd) return
      const newStartMs = new Date(`${newDate}T${newStart}Z`).getTime()
      const newEndMs = new Date(`${newDate}T${newEnd}Z`).getTime()
      for (const a of shifts) {
        const s = a.shifts
        if (!s || s.shift_date !== newDate) continue
        // Skip the shift being swapped itself
        if (s.shift_date === excludeDate && s.start_time === excludeStart) continue
        const sStart = new Date(`${s.shift_date}T${s.start_time}Z`).getTime()
        const sEnd = new Date(`${s.shift_date}T${s.end_time}Z`).getTime()
        if (newStartMs < sEnd && newEndMs > sStart) {
          timeConflicts.push(`${personName} will have a time conflict on ${newDate} (${newStart}–${newEnd} overlaps with existing shift ${s.start_time}–${s.end_time})`)
        }
      }
    }

    const lookAhead = 30
    const startDate = new Date(); startDate.setDate(startDate.getDate() - 1)
    const endDate = new Date(); endDate.setDate(endDate.getDate() + lookAhead)
    const fromStr = startDate.toISOString().slice(0, 10)
    const toStr = endDate.toISOString().slice(0, 10)

    const [reqShifts, ctrShifts] = await Promise.all([
      attendanceRepository.getAssignmentsByUserDateRange(request.requester_id, fromStr, toStr),
      attendanceRepository.getAssignmentsByUserDateRange(request.counterpart_id, fromStr, toStr),
    ])

    // Requester will receive counterpart's shift
    checkOverlap(reqShifts, request.counterpart_shift_date, request.counterpart_start_time, request.counterpart_end_time, request.requester_name, request.requester_shift_date, request.requester_start_time)
    // Counterpart will receive requester's shift
    checkOverlap(ctrShifts, request.requester_shift_date, request.requester_start_time, request.requester_end_time, request.counterpart_name, request.counterpart_shift_date, request.counterpart_start_time)

    const availabilityIssues: string[] = []

    const context: Record<string, unknown> = {
      request_type: 'Shift Swap',
      department: request.department_name,
      role: request.requester_role,
      requester: request.requester_name,
      counterpart: request.counterpart_name,
      requester_shift: `${request.requester_shift_date} ${request.requester_start_time}–${request.requester_end_time}`,
      counterpart_shift: `${request.counterpart_shift_date} ${request.counterpart_start_time}–${request.counterpart_end_time}`,
      reason: request.reason,
      time_conflicts: timeConflicts,
      availability_issues: availabilityIssues,
      requester_tasks_on_shift: request.requester_task_count,
      counterpart_tasks_on_shift: request.counterpart_task_count,
      task_note: (request.requester_task_count + request.counterpart_task_count) > 0
        ? `Tasks are attached to shifts and will move with them after the swap.`
        : 'No tasks attached to either shift.',
    }

    return openAIService.generateStructuredJson<RequestAISuggestion>({
      schemaName: 'shift_swap_suggestion',
      maxOutputTokens: 700,
      instructions: [
        'You are an HR assistant reviewing a bilateral shift swap request.',
        'Check 4 things: (1) time conflicts — does either person get overlapping shifts after the swap? (2) availability — does either person have approved leave on their new shift date? (3) role/dept match — both must be same role/dept (already validated, just note it is OK). (4) task impact — how many tasks will move with the shifts.',
        'If time_conflicts or availability_issues arrays are non-empty, recommend reject. If tasks are involved, mention them as a note.',
        'recommendation must be one of: approve, reject, review.',
        'confidence is 0–100. reason is a 2-3 sentence plain-English summary. concerns is a list of bullet issues. alternatives is a list of suggestions (empty if none).',
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

}
