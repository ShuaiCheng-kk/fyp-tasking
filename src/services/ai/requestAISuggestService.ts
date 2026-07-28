// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { MIN_MANAGERS_PER_DAY, MIN_EMPLOYEES_PER_DAY, weekStart } from '@/lib/schedulingConstants'
import { FixedOffDayRequestView } from '@/types/Attendance'

// One pending weekly submission's verdict inside a whole-queue analysis. `key` matches the
// frontend's group key convention (`${user_id}_${requested_week}`, see groupFixedOff) so results can
// be mapped straight back onto the Requests-queue cards.
export interface FixedOffDayQueueItemVerdict {
  key: string
  user_id: string
  requester_name: string
  requested_week: string
  ids: string[]
  requested_dates: string[]
  verdict: 'safe' | 'flagged'
  problem_dates: string[]
  problem_reasons: Record<string, string>
  // The recommended full replacement day set: safe requested days kept as-is, each flagged day
  // swapped for the next staffing-safe day (same week first, then the following week). For a safe
  // item this is simply requested_dates. Pre-seeds the Owner's Modify picker.
  suggested_dates: string[]
}

export interface FixedOffDayQueueSuggestion {
  safe_count: number
  flagged_count: number
  items: FixedOffDayQueueItemVerdict[]
}

export interface RequestAISuggestion {
  recommendation: 'approve' | 'modify'
  confidence: number
  reason: string
  concerns: string[]
  alternatives: string[]
  // Which of the requester's OWN requested_dates actually need a replacement — the rest of the group
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
    requested_dates: string[]
    department_id: string | null
    company_id: string
    user_id: string
  }): Promise<RequestAISuggestion> {
    const role: 'Manager' | 'Employee' = request.requester_role === 'Manager' ? 'Manager' : 'Employee'
    const departmentId = request.department_id
    const weekStarts = [...new Set(request.requested_dates.map(weekStart))]
    // Fallback weeks — only actually offered as alternatives when the requested week itself has no
    // safe day left (see safeAlternativeDates below), e.g. the whole week is short-staffed already.
    const nextWeekStarts = weekStarts.map(ws => addDaysToDateKey(ws, 7))
    const requestedSet = new Set(request.requested_dates)
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
        if (row.requested_date !== date || row.user_id === request.user_id) continue
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

    const perDate = request.requested_dates.map(date => {
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
        if (safeAlternativeDates.length >= request.requested_dates.length) break
      }
      if (safeAlternativeDates.length < request.requested_dates.length) {
        for (const date of nextWeekDates) {
          if (!wouldBeUnderstaffed(date)) safeAlternativeDates.push(date)
          if (safeAlternativeDates.length >= request.requested_dates.length) break
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

  // Analyzes the ENTIRE pending queue in one pass, first-come-first-served: walk the pending
  // weekly submissions in submission order, and for each one check its dates against the
  // department roster minus everyone already decided off PLUS everyone earlier in the queue whose
  // request came back safe (simulated as approved, since the Owner is about to approve them in
  // bulk). A submission whose every date survives that check is 'safe' — the Owner can approve it
  // without looking; one that collides with an already-taken day is 'flagged' and stays in the
  // queue for the per-request Suggestion/modify flow.
  //
  // Deliberately no LLM call here: the safe/flagged rule is fully deterministic, and running one
  // structured-output call per queue entry would make the button slow for no added signal. The
  // per-request suggestFixedOffDayGroup above keeps the LLM for picking replacement dates.
  async suggestFixedOffDayQueue(input: {
    company_id: string
    rows: FixedOffDayRequestView[]
  }): Promise<FixedOffDayQueueSuggestion> {
    const pendingRows = input.rows.filter(r => r.status === 'pending')

    // Group by requester + week — same unit the Owner decides on (see groupFixedOff frontend-side
    // and decideFixedOffDayRequestGroup service-side).
    const groups = new Map<string, {
      key: string
      user_id: string
      requester_name: string
      requester_role: string
      department_id: string | null
      requested_week: string
      created_at: string
      ids: string[]
      requested_dates: string[]
    }>()
    for (const row of pendingRows) {
      const key = `${row.user_id}_${row.requested_week}`
      const existing = groups.get(key)
      if (existing) {
        existing.ids.push(row.id)
        existing.requested_dates.push(row.requested_date)
        if (new Date(row.created_at ?? 0).getTime() < new Date(existing.created_at ?? 0).getTime()) existing.created_at = row.created_at
      } else {
        groups.set(key, {
          key, user_id: row.user_id, requester_name: row.requester_name, requester_role: row.requester_role,
          department_id: row.department_id, requested_week: row.requested_week, created_at: row.created_at,
          ids: [row.id], requested_dates: [row.requested_date],
        })
      }
    }
    const orderedGroups = [...groups.values()].sort((a, b) => {
      const diff = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
      return diff !== 0 ? diff : a.key.localeCompare(b.key)
    })

    // Department rosters — one lookup per distinct department across the queue.
    const departmentIds = [...new Set(orderedGroups.map(g => g.department_id).filter((id): id is string => id !== null))]
    const [employees, managersPerDept] = await Promise.all([
      departmentIds.length > 0 ? attendanceRepository.getEmployeesByCompany(input.company_id) : Promise.resolve([]),
      Promise.all(departmentIds.map(id => ownerTeamRepository.findManagersByDepartment(input.company_id, id))),
    ])
    const rosters = new Map(departmentIds.map((deptId, i) => [deptId, {
      managerIds: new Set(managersPerDept[i].map(m => m.id)),
      employeeIds: new Set(employees.filter(e => e.department_id === deptId).map(e => e.id)),
    }]))

    // Same reservation rule as suggestFixedOffDayGroup: only ALREADY-DECIDED off-days reserve a
    // date. Simulated entries are the safe queue entries approved-so-far during this walk.
    const decidedRows = input.rows.filter(r => r.status === 'approved' || r.status === 'modified')
    const simulated: Array<{ department_id: string; date: string; user_id: string; isManager: boolean }> = []
    const othersAlreadyOff = (departmentId: string, date: string, selfId: string): { managers: number; employees: number } => {
      const roster = rosters.get(departmentId)
      let managers = 0
      let employees = 0
      if (!roster) return { managers, employees }
      for (const row of decidedRows) {
        if (row.requested_date !== date || row.user_id === selfId) continue
        if (roster.managerIds.has(row.user_id)) managers++
        else if (roster.employeeIds.has(row.user_id)) employees++
      }
      for (const sim of simulated) {
        if (sim.date !== date || sim.department_id !== departmentId || sim.user_id === selfId) continue
        if (sim.isManager) managers++
        else employees++
      }
      return { managers, employees }
    }

    const items: FixedOffDayQueueItemVerdict[] = []
    for (const group of orderedGroups) {
      const role: 'Manager' | 'Employee' = group.requester_role === 'Manager' ? 'Manager' : 'Employee'
      const departmentId = group.department_id
      const roster = departmentId ? rosters.get(departmentId) : undefined
      const staffingFlags = (date: string): { managerShort: boolean; employeeShort: boolean } => {
        if (!departmentId || !roster) return { managerShort: false, employeeShort: false }
        const { managers, employees } = othersAlreadyOff(departmentId, date, group.user_id)
        const managersRemaining = roster.managerIds.size - managers - (role === 'Manager' ? 1 : 0)
        const employeesRemaining = roster.employeeIds.size - employees - (role === 'Employee' ? 1 : 0)
        return { managerShort: managersRemaining < MIN_MANAGERS_PER_DAY, employeeShort: employeesRemaining < MIN_EMPLOYEES_PER_DAY }
      }
      const wouldBeUnderstaffed = (date: string): boolean => {
        const flags = staffingFlags(date)
        return flags.managerShort || flags.employeeShort
      }
      const perDate = group.requested_dates.map(date => ({ date, ...staffingFlags(date) }))
      const problems = perDate.filter(d => d.managerShort || d.employeeShort)
      if (problems.length === 0) {
        if (departmentId) {
          for (const date of group.requested_dates) {
            simulated.push({ department_id: departmentId, date, user_id: group.user_id, isManager: role === 'Manager' })
          }
        }
        items.push({
          key: group.key, user_id: group.user_id, requester_name: group.requester_name,
          requested_week: group.requested_week, ids: group.ids, requested_dates: group.requested_dates,
          verdict: 'safe', problem_dates: [], problem_reasons: {},
          suggested_dates: group.requested_dates,
        })
      } else {
        // Recommended replacement set: keep the safe requested days, and swap each flagged day
        // for the next staffing-safe day — same week first, spilling into the following week.
        const problemDates = problems.map(p => p.date)
        const suggested = group.requested_dates.filter(d => !problemDates.includes(d))
        const candidateDates = Array.from({ length: 14 }, (_, i) => addDaysToDateKey(group.requested_week, i))
        for (let n = 0; n < problemDates.length; n++) {
          const pick = candidateDates.find(date =>
            !group.requested_dates.includes(date) && !suggested.includes(date) && !wouldBeUnderstaffed(date))
          if (pick) suggested.push(pick)
        }
        items.push({
          key: group.key, user_id: group.user_id, requester_name: group.requester_name,
          requested_week: group.requested_week, ids: group.ids, requested_dates: group.requested_dates,
          verdict: 'flagged',
          problem_dates: problemDates,
          problem_reasons: Object.fromEntries(problems.map(p => [p.date, buildDateReason(p)])),
          suggested_dates: suggested,
        })
      }
    }

    return {
      safe_count: items.filter(i => i.verdict === 'safe').length,
      flagged_count: items.filter(i => i.verdict === 'flagged').length,
      items,
    }
  },

}
