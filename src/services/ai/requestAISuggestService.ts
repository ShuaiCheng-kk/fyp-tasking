// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { MIN_MANAGERS_PER_DAY, MIN_EMPLOYEES_PER_DAY, weekStart } from '@/lib/schedulingConstants'

export interface RequestAISuggestion {
  recommendation: 'approve' | 'reject' | 'review'
  confidence: number
  reason: string
  concerns: string[]
  alternatives: string[]
}

// Local-time date arithmetic, matching weekStart()'s convention in schedulingConstants.ts.
function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const requestAISuggestService = {
  // Analyzes every date in one weekly submission together and returns a single overall
  // recommendation, since a Manager/Employee's week-off request is decided as one unit
  // (see decideFixedOffDayRequestGroup), not date-by-date.
  async suggestFixedOffDayGroup(request: {
    requester_name: string
    requester_role: string
    request_dates: string[]
    department_id: string | null
    company_id: string
    user_id: string
  }): Promise<RequestAISuggestion> {
    const role: 'Manager' | 'Employee' = request.requester_role === 'Manager' ? 'Manager' : 'Employee'
    const departmentId = request.department_id

    const perDate = await Promise.all(request.request_dates.map(async date => {
      const headcount = departmentId
        ? await attendanceRepository.getScheduledHeadcountForDeptDate(request.company_id, departmentId, date)
        : { managers: 0, employees: 0 }
      const managersAfter = role === 'Manager' ? Math.max(0, headcount.managers - 1) : headcount.managers
      const employeesAfter = role === 'Employee' ? Math.max(0, headcount.employees - 1) : headcount.employees
      return {
        date,
        scheduled_managers: headcount.managers,
        scheduled_employees: headcount.employees,
        would_be_understaffed: managersAfter < MIN_MANAGERS_PER_DAY || employeesAfter < MIN_EMPLOYEES_PER_DAY,
      }
    }))

    const anyUnderstaffed = perDate.some(d => d.would_be_understaffed)

    // Safe alternatives: the other days of the same week(s) covered by this submission, deduped,
    // that would NOT cause understaffing — same deterministic pre-compute-then-constrain-the-LLM
    // approach as the single-date version.
    const weekStarts = [...new Set(request.request_dates.map(weekStart))]
    const requestedSet = new Set(request.request_dates)
    const candidateDates = [...new Set(weekStarts.flatMap(ws => Array.from({ length: 7 }, (_, i) => addDaysToDateKey(ws, i))))]
      .filter(date => !requestedSet.has(date))

    const safeAlternativeDates: string[] = []
    for (const date of candidateDates) {
      if (!departmentId) break
      const altHeadcount = await attendanceRepository.getScheduledHeadcountForDeptDate(request.company_id, departmentId, date)
      const altManagersAfter = role === 'Manager' ? Math.max(0, altHeadcount.managers - 1) : altHeadcount.managers
      const altEmployeesAfter = role === 'Employee' ? Math.max(0, altHeadcount.employees - 1) : altHeadcount.employees
      if (altManagersAfter >= MIN_MANAGERS_PER_DAY && altEmployeesAfter >= MIN_EMPLOYEES_PER_DAY) {
        safeAlternativeDates.push(date)
      }
      if (safeAlternativeDates.length >= 3) break
    }

    const context = {
      request_type: 'Weekly Day Off',
      requester: request.requester_name,
      requester_role: role,
      requested_dates: perDate,
      any_date_would_be_understaffed: anyUnderstaffed,
      min_managers_required: MIN_MANAGERS_PER_DAY,
      min_employees_required: MIN_EMPLOYEES_PER_DAY,
      safe_alternative_dates: safeAlternativeDates,
    }

    return openAIService.generateStructuredJson<RequestAISuggestion>({
      schemaName: 'fixed_off_day_group_suggestion',
      maxOutputTokens: 700,
      instructions: [
        'You are an HR assistant helping a business owner decide whether to approve a weekly day off request that covers multiple requested dates, submitted together as one weekly request.',
        'requested_dates lists each date with the scheduled headcount for the requester\'s department and whether approving would drop that specific date below the minimum required headcount.',
        'Give ONE overall recommendation covering the whole request: if any date in requested_dates has would_be_understaffed true, recommend reject or review (mention which date(s) are the problem in the reason/concerns); otherwise lean toward approve.',
        'recommendation must be one of: approve, reject, review.',
        'confidence is 0–100. concerns is a list of issues, one per problematic date if any (empty if none).',
        'alternatives must ONLY reference dates from safe_alternative_dates if any are provided — never invent a date. If safe_alternative_dates is empty, alternatives must be empty.',
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
