// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { MIN_MANAGERS_PER_DAY, MIN_EMPLOYEES_PER_DAY, weekStart } from '@/lib/schedulingConstants'

export interface RequestAISuggestion {
  recommendation: 'approve' | 'modify'
  confidence: number
  reason: string
  concerns: string[]
  alternatives: string[]
  // Which of the requester's OWN request_dates actually need a replacement — the rest of the group
  // is staffing-safe as requested and should just be approved as-is, not forced into a swap too.
  problem_dates: string[]
  // The specific reason for each date in problem_dates, keyed by date — shown under that date's own
  // card rather than one combined sentence for the whole group.
  problem_reasons: Record<string, string>
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

// "Monday [13 Jul]" — matches formatFixedOffRequestDay()'s convention on the frontend.
function formatDateLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const dayMonth = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  return `${weekday} [${dayMonth}]`
}

// One line naming exactly why THIS date is a problem — shown directly under that date's own card
// on the frontend, rather than one combined sentence floating above the whole group.
function buildDateReason(p: { date: string; managerShort: boolean; employeeShort: boolean }): string {
  const roles = [p.managerShort && 'managers', p.employeeShort && 'employees'].filter(Boolean).join(' and ')
  return `${formatDateLabel(p.date)} already has too many ${roles} off.`
}

// Built deterministically rather than left to the LLM's phrasing — the Owner just needs to know
// which date is the problem and why, not a paraphrased explanation of the whole request.
function buildReason(perDate: Array<{ date: string; managerShort: boolean; employeeShort: boolean }>): string {
  const problems = perDate.filter(d => d.managerShort || d.employeeShort)
  if (problems.length === 0) return 'This request keeps staffing balanced — safe to approve.'
  return problems.map(p => buildDateReason(p).replace(/\.$/, '')).join('; ') + '.'
}

export const requestAISuggestService = {
  // Analyzes every date in one weekly submission together and returns a single overall
  // recommendation, since a Manager/Employee's week-off request is decided as one unit
  // (see decideFixedOffDayRequestGroup), not date-by-date.
  //
  // Staffing risk is measured against the department's total roster (who could possibly work that
  // day) minus everyone else who already has a live off-day request for that date — NOT against
  // already-scheduled shifts. Off-day requests are submitted for a week that hasn't been shift-
  // scheduled yet, so the shifts table is always empty for it; comparing against it would flag
  // every single date as understaffed regardless of how the off-days are actually distributed.
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
    const weekStarts = [...new Set(request.request_dates.map(weekStart))]
    // Fallback weeks — only actually offered as alternatives when the requested week itself has no
    // safe day left (see safeAlternativeDates below), e.g. the whole week is short-staffed already.
    const nextWeekStarts = weekStarts.map(ws => addDaysToDateKey(ws, 7))
    const requestedSet = new Set(request.request_dates)
    const sameWeekDates = [...new Set(weekStarts.flatMap(ws => Array.from({ length: 7 }, (_, i) => addDaysToDateKey(ws, i))))]
    const nextWeekDates = [...new Set(nextWeekStarts.flatMap(ws => Array.from({ length: 7 }, (_, i) => addDaysToDateKey(ws, i))))]

    let deptManagerIds = new Set<string>()
    let deptEmployeeIds = new Set<string>()
    let weekRows: Awaited<ReturnType<typeof attendanceRepository.getOffDayRequestsByCompanyAndWeek>> = []

    if (departmentId) {
      const [managers, employees, rowsPerWeek] = await Promise.all([
        ownerTeamRepository.findManagersByDepartment(request.company_id, departmentId),
        attendanceRepository.getEmployeesByCompany(request.company_id),
        Promise.all([...weekStarts, ...nextWeekStarts].map(ws => attendanceRepository.getOffDayRequestsByCompanyAndWeek(request.company_id, ws))),
      ])
      deptManagerIds = new Set(managers.map(m => m.id))
      deptEmployeeIds = new Set(employees.filter(e => e.department_id === departmentId).map(e => e.id))
      weekRows = rowsPerWeek.flat()
    }
    const deptManagerCount = deptManagerIds.size
    const deptEmployeeCount = deptEmployeeIds.size

    // How many OTHER department members (not this requester) already have a live (non-rejected)
    // off-day request landing on `date`.
    // Only ALREADY-DECIDED off-days (approved/modified) count as reserved — this is what makes the
    // whole thing first-come-first-served: two people's still-pending requests for the same day
    // aren't "competing" with each other yet, only whoever the Owner has already approved actually
    // reserves that day. So the very first person in the queue is measured against zero decided
    // conflicts (nothing's been approved yet) and should come back clean; a later request that
    // collides with an already-approved day is the one that gets flagged.
    const othersAlreadyOff = (date: string): { managers: number; employees: number } => {
      let managers = 0
      let employees = 0
      for (const row of weekRows) {
        if (row.request_date !== date || row.user_id === request.user_id) continue
        if (row.status !== 'approved' && row.status !== 'modified') continue
        if (deptManagerIds.has(row.user_id)) managers++
        else if (deptEmployeeIds.has(row.user_id)) employees++
      }
      return { managers, employees }
    }
    const staffingCheck = (date: string) => {
      const { managers, employees } = othersAlreadyOff(date)
      const managersRemaining = deptManagerCount - managers - (role === 'Manager' ? 1 : 0)
      const employeesRemaining = deptEmployeeCount - employees - (role === 'Employee' ? 1 : 0)
      return {
        managers,
        employees,
        managerShort: departmentId !== null && managersRemaining < MIN_MANAGERS_PER_DAY,
        employeeShort: departmentId !== null && employeesRemaining < MIN_EMPLOYEES_PER_DAY,
      }
    }
    const wouldBeUnderstaffed = (date: string): boolean => {
      const c = staffingCheck(date)
      return c.managerShort || c.employeeShort
    }

    const perDate = request.request_dates.map(date => {
      const c = staffingCheck(date)
      return {
        date,
        department_managers: deptManagerCount,
        department_employees: deptEmployeeCount,
        other_managers_already_off: c.managers,
        other_employees_already_off: c.employees,
        would_be_understaffed: c.managerShort || c.employeeShort,
        managerShort: c.managerShort,
        employeeShort: c.employeeShort,
      }
    })
    const anyUnderstaffed = perDate.some(d => d.would_be_understaffed)

    // Safe alternatives: the other days of the same week(s) covered by this submission that would
    // NOT drop the department below the minimum, deterministically pre-computed so the LLM can only
    // pick from real, already-validated options rather than invent one. Only once the requested
    // week(s) can't cover every replacement needed do we spill into the following week — a later
    // alternative there is still a real, already-validated option, just a bonus day rather than a
    // same-week swap.
    const safeAlternativeDates: string[] = []
    if (departmentId) {
      for (const date of sameWeekDates) {
        if (requestedSet.has(date)) continue
        if (!wouldBeUnderstaffed(date)) safeAlternativeDates.push(date)
        if (safeAlternativeDates.length >= request.request_dates.length) break
      }
      if (safeAlternativeDates.length < request.request_dates.length) {
        for (const date of nextWeekDates) {
          if (!wouldBeUnderstaffed(date)) safeAlternativeDates.push(date)
          if (safeAlternativeDates.length >= request.request_dates.length) break
        }
      }
    }

    const context = {
      request_type: 'Weekly Day Off',
      requester: request.requester_name,
      requester_role: role,
      department_manager_headcount: deptManagerCount,
      department_employee_headcount: deptEmployeeCount,
      requested_dates: perDate.map(({ date, department_managers, department_employees, other_managers_already_off, other_employees_already_off, would_be_understaffed }) => (
        { date, department_managers, department_employees, other_managers_already_off, other_employees_already_off, would_be_understaffed }
      )),
      any_date_would_be_understaffed: anyUnderstaffed,
      min_managers_required: MIN_MANAGERS_PER_DAY,
      min_employees_required: MIN_EMPLOYEES_PER_DAY,
      safe_alternative_dates: safeAlternativeDates,
    }

    const suggestion = await openAIService.generateStructuredJson<RequestAISuggestion>({
      schemaName: 'fixed_off_day_group_suggestion',
      maxOutputTokens: 700,
      instructions: [
        'You are an HR assistant helping a business owner decide whether to approve or modify a weekly day off request that covers multiple requested dates, submitted together as one weekly request.',
        'department_manager_headcount/department_employee_headcount is the total roster for the requester\'s department. requested_dates lists each requested date with how many OTHER department members already have an off-day request landing on it, and whether approving this requester too would drop that date below the minimum required headcount.',
        'Give ONE overall recommendation covering the whole request: if any date in requested_dates has would_be_understaffed true, recommend modify; otherwise recommend approve.',
        'recommendation must be one of: approve, modify.',
        'confidence is 0–100. reason is a brief one-sentence summary (it will be replaced by the caller with an exact templated message, so keep it short). concerns is a list of issues, one per problematic date if any (empty if none).',
        'alternatives must ONLY reference dates from safe_alternative_dates if any are provided — never invent a date and never repeat a date already in requested_dates. If safe_alternative_dates is empty, alternatives must be empty. When recommending modify, alternatives should list the best replacement date(s) from safe_alternative_dates, picking the ones that keep the week\'s off-days most evenly spread out. safe_alternative_dates may include a date from the week AFTER the requested week — that only happens when the requested week itself has no safe day left, and is expected: prefer same-week dates when available, and only fall back to a following-week date when necessary.',
      ].join(' '),
      input: context,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recommendation: { type: 'string', enum: ['approve', 'modify'] },
          confidence: { type: 'number' },
          reason: { type: 'string' },
          concerns: { type: 'array', items: { type: 'string' } },
          alternatives: { type: 'array', items: { type: 'string' } },
        },
        required: ['recommendation', 'confidence', 'reason', 'concerns', 'alternatives'],
      },
    })

    // reason/problem_dates/problem_reasons are rebuilt deterministically instead of trusting the
    // LLM — the Owner just needs to know which date is the problem and why, not a paraphrased
    // explanation, and which dates in the group are actually safe to approve as-is.
    const problems = perDate.filter(d => d.managerShort || d.employeeShort)
    return {
      ...suggestion,
      reason: buildReason(perDate),
      problem_dates: problems.map(d => d.date),
      problem_reasons: Object.fromEntries(problems.map(p => [p.date, buildDateReason(p)])),
    }
  },

}
