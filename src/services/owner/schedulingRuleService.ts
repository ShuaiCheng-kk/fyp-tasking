// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import OpenAI from 'openai'
import { authRepository } from '@/repositories/auth/authRepository'
import { schedulingRuleRepository } from '@/repositories/owner/schedulingRuleRepository'
import {
  ScheduleRuleViolation,
  ScheduleValidationItem,
  ScheduleValidationResult,
  SchedulingRule,
  SchedulingRuleKey,
  ShiftTypeInput,
  AiShiftSlot,
} from '@/types/SchedulingRule'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: Number(process.env.OPENAI_TIMEOUT_MS ?? 30000),
})

const MAX_WEEKLY_HOURS = 44
const MIN_MANAGERS_PER_DAY = 1
const MIN_EMPLOYEES_PER_DAY = 1
const MAX_CONSECUTIVE_DAYS = 3

export const DEFAULT_SCHEDULING_RULES: SchedulingRule[] = [
  {
    key: 'approved_leave_block',
    name: 'Approved leave cannot be scheduled',
    description: 'Employees and managers with approved leave must not receive a shift on the approved leave date.',
    rule_type: 'Hard Rule',
    value_type: 'text',
    value: 'Always enforced',
    editable: false,
    active: true,
    system_protected: true,
  },
  {
    key: 'fixed_off_day_block',
    name: 'Fixed off day cannot be scheduled',
    description: 'Employees and managers must not be scheduled on their fixed off day.',
    rule_type: 'Hard Rule',
    value_type: 'text',
    value: 'Always enforced',
    editable: false,
    active: true,
    system_protected: true,
  },
  {
    key: 'weekly_hours_limit',
    name: 'Employee or manager cannot exceed remaining weekly working hours',
    description: 'Assigned shift hours must stay within the worker weekly hour limit.',
    rule_type: 'Hard Rule',
    value_type: 'text',
    value: 'Always enforced',
    editable: false,
    active: true,
    system_protected: true,
  },
  {
    key: 'min_managers_per_department_day',
    name: 'Minimum managers per department per day',
    description: 'Minimum number of managers required in each scheduled department each day.',
    rule_type: 'Hard Rule',
    value_type: 'number',
    value: MIN_MANAGERS_PER_DAY,
    editable: false,
    active: true,
    system_protected: true,
  },
  {
    key: 'min_employees_per_department_day',
    name: 'Minimum employees per department per day',
    description: 'Minimum number of employees required in each scheduled department each day.',
    rule_type: 'Hard Rule',
    value_type: 'number',
    value: MIN_EMPLOYEES_PER_DAY,
    editable: false,
    active: true,
    system_protected: true,
  },
  {
    key: 'max_consecutive_working_days',
    name: 'Maximum consecutive working days',
    description: 'Warn when a worker is scheduled for too many consecutive working days.',
    rule_type: 'Soft Rule',
    value_type: 'number',
    value: MAX_CONSECUTIVE_DAYS,
    editable: false,
    active: true,
    system_protected: true,
  },
  {
    key: 'fair_weekend_rotation',
    name: 'Weekend duty should be fairly rotated',
    description: 'Warn when weekend duties are concentrated on the same worker.',
    rule_type: 'Soft Rule',
    value_type: 'boolean',
    value: true,
    editable: false,
    active: true,
    system_protected: true,
  },
  {
    key: 'fair_workload_distribution',
    name: 'Workload should be fairly distributed',
    description: 'Warn when schedule workload is uneven across active workers.',
    rule_type: 'Soft Rule',
    value_type: 'boolean',
    value: true,
    editable: false,
    active: true,
    system_protected: true,
  },
]

export const schedulingRuleService = {
  async assertOwner(user_id: string, company_id: string): Promise<void> {
    const user = await authRepository.findByAuthIdOrInternalId(user_id)
    if (!user || user.role !== 'Owner' || user.company_id !== company_id) {
      throw new Error('Only Owner can access AI scheduling rules')
    }
  },

  async getRules(company_id: string): Promise<SchedulingRule[]> {
    if (!company_id) throw new Error('company_id is required')
    return DEFAULT_SCHEDULING_RULES
  },

  async updateRule(_input?: unknown): Promise<SchedulingRule> {
    throw new Error('Scheduling rules are system-protected and cannot be edited')
  },

  async getStaffHours(company_id: string, user_id: string) {
    await this.assertOwner(user_id, company_id)
    const users = await schedulingRuleRepository.getCompanyUsers(company_id)
    return users
      .filter(u => u.role === 'Manager' || u.role === 'Employee')
      .map(u => ({
        id: u.id,
        full_name: u.full_name,
        role: u.role,
        weekly_working_hours: u.weekly_working_hours ?? null,
        max_weekly_hours: u.max_weekly_hours ?? null,
        contracted_weekly_hours: u.contracted_weekly_hours ?? null,
      }))
  },

  async validateSchedule(input: {
    company_id: string
    date_from: string
    date_to: string
    items?: ScheduleValidationItem[]
  }): Promise<ScheduleValidationResult> {
    if (!input.company_id || !input.date_from || !input.date_to) {
      throw new Error('company_id, date_from, and date_to are required')
    }
    const [rules, users, approvedTimeOff, fixedOffDays] = await Promise.all([
      this.getRules(input.company_id),
      schedulingRuleRepository.getCompanyUsers(input.company_id),
      schedulingRuleRepository.getApprovedTimeOffByCompany(input.company_id),
      schedulingRuleRepository.getFixedOffDays(input.company_id),
    ])
    const items = input.items ?? await schedulingRuleRepository.getPublishedOrDraftScheduleItems(
      input.company_id,
      input.date_from,
      input.date_to,
    )
    return validateItems({ rules, users, approvedTimeOff, fixedOffDays, items })
  },

  async getScheduleContext(input: {
    company_id: string
    user_id: string
    date_from: string
    date_to: string
  }) {
    await this.assertOwner(input.user_id, input.company_id)
    if (!input.date_from || !input.date_to) throw new Error('date_from and date_to are required')
    if (input.date_from > input.date_to) throw new Error('date_from must be before date_to')

    const previousFrom = addDaysToDateKey(input.date_from, -28)
    const previousTo = addDaysToDateKey(input.date_from, -1)
    const [rules, users, fixedOffDays, timeOffRequests, existingSchedule, previousSchedule] = await Promise.all([
      this.getRules(input.company_id),
      schedulingRuleRepository.getCompanyUsers(input.company_id),
      schedulingRuleRepository.getFixedOffDays(input.company_id),
      schedulingRuleRepository.getTimeOffRequestsByCompany(input.company_id),
      schedulingRuleRepository.getPublishedOrDraftScheduleItems(input.company_id, input.date_from, input.date_to),
      schedulingRuleRepository.getPublishedOrDraftScheduleItems(input.company_id, previousFrom, previousTo),
    ])

    const fixedOffByUser = new Map<string, number[]>()
    for (const row of fixedOffDays) {
      fixedOffByUser.set(row.user_id, [...(fixedOffByUser.get(row.user_id) ?? []), row.weekday])
    }

    const existingHoursByUser = new Map<string, number>()
    const existingDaysByUser = new Map<string, Set<string>>()
    const existingWeekendByUser = new Map<string, number>()
    for (const item of existingSchedule) {
      if (!item.user_id) continue
      existingHoursByUser.set(item.user_id, (existingHoursByUser.get(item.user_id) ?? 0) + shiftHours(item))
      if (!existingDaysByUser.has(item.user_id)) existingDaysByUser.set(item.user_id, new Set())
      existingDaysByUser.get(item.user_id)!.add(item.shift_date)
      const day = new Date(`${item.shift_date}T00:00:00`).getDay()
      if (day === 0 || day === 6) existingWeekendByUser.set(item.user_id, (existingWeekendByUser.get(item.user_id) ?? 0) + 1)
    }

    const previousStatsByUser = new Map<string, { working_days: Set<string>; weekend_duties: number; working_hours: number }>()
    for (const item of previousSchedule) {
      if (!item.user_id) continue
      const current = previousStatsByUser.get(item.user_id) ?? { working_days: new Set<string>(), weekend_duties: 0, working_hours: 0 }
      current.working_days.add(item.shift_date)
      current.working_hours += shiftHours(item)
      const day = new Date(`${item.shift_date}T00:00:00`).getDay()
      if (day === 0 || day === 6) current.weekend_duties += 1
      previousStatsByUser.set(item.user_id, current)
    }

    const staff = users.map(user => {
      const maxWeeklyHours = MAX_WEEKLY_HOURS
      const existingHours = existingHoursByUser.get(user.id) ?? 0
      const previous = previousStatsByUser.get(user.id)
      return {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
        department_id: user.department_id,
        active: true,
        fixed_off_days: fixedOffByUser.get(user.id) ?? [],
        max_weekly_hours: maxWeeklyHours,
        scheduled_hours_in_period: existingHours,
        remaining_weekly_hours: Math.max(0, maxWeeklyHours - existingHours),
        scheduled_days_in_period: existingDaysByUser.get(user.id)?.size ?? 0,
        weekend_duties_in_period: existingWeekendByUser.get(user.id) ?? 0,
        previous_working_days: previous?.working_days.size ?? 0,
        previous_off_days: Math.max(0, 28 - (previous?.working_days.size ?? 0)),
        previous_weekend_duties: previous?.weekend_duties ?? 0,
        previous_working_hours: Number((previous?.working_hours ?? 0).toFixed(1)),
        leave_requests: timeOffRequests
          .filter(request => request.requester_id === user.id)
          .map(request => ({
            id: request.id,
            date: request.shifts?.shift_date ?? null,
            leave_type: request.request_type,
            status: request.status,
          })),
      }
    })

    return {
      rules,
      staff,
      fixed_off_days: fixedOffDays,
      leave_requests: timeOffRequests.map(request => ({
        id: request.id,
        requester_id: request.requester_id,
        date: request.shifts?.shift_date ?? null,
        leave_type: request.request_type,
        status: request.status,
      })),
      existing_schedule_items: existingSchedule,
      previous_schedule_period: { date_from: previousFrom, date_to: previousTo },
    }
  },

  async generateScheduleWithAI(input: {
    company_id: string
    user_id: string
    date_from: string
    date_to: string
    department_ids: string[]
    shiftTypes: ShiftTypeInput[]
  }): Promise<{
    suggestions: AiScheduleBlock[]
    notice: string
    context_summary: AiContextSummaryData
  }> {
    const context = await this.getScheduleContext({
      company_id: input.company_id,
      user_id: input.user_id,
      date_from: input.date_from,
      date_to: input.date_to,
    })

    const activeRules = context.rules.filter(rule => rule.active)
    const hardRules = activeRules.filter(rule => rule.rule_type === 'Hard Rule')
    const eligibleStaff = context.staff.filter(
      staff => staff.active && ['Manager', 'Employee'].includes(staff.role),
    )

    const deptStaff = input.department_ids.map(deptId => ({
      department_id: deptId,
      staff: eligibleStaff.filter(s => s.department_id === deptId),
    }))

    const dateCount = enumerateDateRange(input.date_from, input.date_to).length
    const slotCount = input.department_ids.length * dateCount * input.shiftTypes.length
    const MAX_SLOTS = 150
    if (slotCount > MAX_SLOTS) {
      throw new Error(`Too many shifts to generate at once (${slotCount}). Narrow the date range, departments, or shift types and try again.`)
    }

    const prompt = buildAiSchedulePrompt({
      date_from: input.date_from,
      date_to: input.date_to,
      rules: activeRules,
      department_staff: deptStaff,
      leave_requests: context.leave_requests,
      fixed_off_days: context.fixed_off_days,
      shiftTypes: input.shiftTypes,
    })

    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
    // Observed output runs well above a naive per-slot estimate (model verbosity, JSON overhead).
    // Always size to the slot count with generous headroom rather than capping at a fixed .env default.
    const estimatedTokens = 1000 + slotCount * 220
    const maxTokens = Math.min(16000, estimatedTokens)

    const completion = await openai.chat.completions.create({
      model,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a scheduling assistant. Generate a staff schedule in the exact JSON format requested. Respond with JSON only.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const finishReason = completion.choices[0]?.finish_reason
    console.log('[AI Schedule] finish_reason:', finishReason, 'raw length:', raw.length, 'maxTokens:', maxTokens, 'slotCount:', slotCount)
    let parsed: { schedule?: AiScheduleBlock[]; notice?: string }
    try {
      parsed = JSON.parse(raw)
    } catch (parseErr) {
      console.error('[AI Schedule] JSON parse failed. finish_reason:', finishReason, 'Raw response:', raw, parseErr)
      throw new Error('AI returned an invalid response. Please try again.')
    }

    if (!Array.isArray(parsed.schedule)) {
      console.error('[AI Schedule] schedule array missing. Parsed:', JSON.stringify(parsed).slice(0, 500))
      throw new Error('AI response did not contain a schedule array. Please try again.')
    }

    const expectedBlockCount = input.department_ids.length * dateCount
    const returnedDeptIds = new Set(parsed.schedule.map(block => block.department_id))
    if (parsed.schedule.length < expectedBlockCount || returnedDeptIds.size < input.department_ids.length) {
      console.error(
        '[AI Schedule] incomplete response. expectedBlocks:', expectedBlockCount,
        'returnedBlocks:', parsed.schedule.length,
        'expectedDepts:', input.department_ids.length, 'returnedDepts:', returnedDeptIds.size,
      )
      throw new Error('AI only generated a partial schedule. Please try again, or narrow the date range / departments.')
    }

    const suggestions = (parsed.schedule as AiScheduleBlock[]).map(block => ({
      ...block,
      slots: block.slots.map(slot => ({ ...slot, reason: resolveReasonText(slot.reason) })),
    }))

    const contextSummary: AiContextSummaryData = {
      ruleCount: activeRules.length,
      hardRuleCount: hardRules.length,
      staffCount: eligibleStaff.length,
      fixedOffCount: context.fixed_off_days.length,
      leaveCount: context.leave_requests.filter(r => r.status === 'approved' || r.status === 'pending').length,
      previousPeriod: `${context.previous_schedule_period.date_from} to ${context.previous_schedule_period.date_to}`,
    }

    const notice =
      parsed.notice ??
      `AI checked ${hardRules.length} hard rule${hardRules.length === 1 ? '' : 's'} and generated the best available draft for Owner review.`

    return { suggestions, notice, context_summary: contextSummary }
  },
}

function validateItems(input: {
  rules: SchedulingRule[]
  users: Awaited<ReturnType<typeof schedulingRuleRepository.getCompanyUsers>>
  approvedTimeOff: Awaited<ReturnType<typeof schedulingRuleRepository.getApprovedTimeOffByCompany>>
  fixedOffDays: Awaited<ReturnType<typeof schedulingRuleRepository.getFixedOffDays>>
  items: ScheduleValidationItem[]
}): ScheduleValidationResult {
  const ruleMap = new Map(input.rules.map(rule => [rule.key, rule]))
  const usersById = new Map(input.users.map(user => [user.id, user]))
  const fixedOffByUser = new Map<string, Set<number>>()
  for (const row of input.fixedOffDays) {
    if (!fixedOffByUser.has(row.user_id)) fixedOffByUser.set(row.user_id, new Set())
    fixedOffByUser.get(row.user_id)!.add(row.weekday)
  }

  const violations: ScheduleRuleViolation[] = []
  const push = (ruleKey: SchedulingRuleKey, message: string, item?: Partial<ScheduleValidationItem>) => {
    const rule = ruleMap.get(ruleKey)
    if (!rule || !rule.active) return
    violations.push({
      rule_key: ruleKey,
      rule_name: rule.name,
      severity: rule.rule_type === 'Hard Rule' ? 'error' : 'warning',
      message,
      user_id: item?.user_id ?? null,
      department_id: item?.department_id ?? null,
      shift_date: item?.shift_date ?? null,
    })
  }

  for (const item of input.items) {
    if (!item.user_id) continue
    const weekday = new Date(`${item.shift_date}T00:00:00`).getDay()
    if (fixedOffByUser.get(item.user_id)?.has(weekday)) {
      push('fixed_off_day_block', 'Worker is assigned on a fixed off day.', item)
    }

    const approvedOnDate = input.approvedTimeOff.some(request => (
      request.requester_id === item.user_id &&
      request.request_type === 'time_off' &&
      request.shifts?.shift_date === item.shift_date
    ))
    if (approvedOnDate) {
      push('approved_leave_block', 'Worker has approved leave on this shift date.', item)
    }
  }

  validateDepartmentMinimums(input.items, usersById, ruleMap, push)
  validateWeeklyHours(input.items, usersById, push)
  validateConsecutiveDays(input.items, ruleMap, push)
  validateWeekendFairness(input.items, ruleMap, push)
  validateWorkloadFairness(input.items, ruleMap, push)

  const errors = violations.filter(v => v.severity === 'error')
  const warnings = violations.filter(v => v.severity === 'warning')
  return { valid: errors.length === 0, errors, warnings }
}

function shiftHours(item: ScheduleValidationItem): number {
  const [sh, sm] = item.start_time.split(':').map(Number)
  const [eh, em] = item.end_time.split(':').map(Number)
  return Math.max(0, ((eh * 60 + (em || 0)) - (sh * 60 + (sm || 0))) / 60)
}

function validateDepartmentMinimums(
  items: ScheduleValidationItem[],
  usersById: Map<string, { role: string }>,
  ruleMap: Map<SchedulingRuleKey, SchedulingRule>,
  push: (ruleKey: SchedulingRuleKey, message: string, item?: Partial<ScheduleValidationItem>) => void,
) {
  const groups = new Map<string, { department_id: string; shift_date: string; managers: Set<string>; employees: Set<string> }>()
  for (const item of items) {
    const key = `${item.department_id}_${item.shift_date}`
    if (!groups.has(key)) groups.set(key, { department_id: item.department_id, shift_date: item.shift_date, managers: new Set(), employees: new Set() })
    if (!item.user_id) continue
    const role = usersById.get(item.user_id)?.role
    if (role === 'Manager') groups.get(key)!.managers.add(item.user_id)
    if (role === 'Employee') groups.get(key)!.employees.add(item.user_id)
  }
  for (const group of groups.values()) {
    const minManagers = MIN_MANAGERS_PER_DAY
    const minEmployees = MIN_EMPLOYEES_PER_DAY
    if (group.managers.size < minManagers) {
      push('min_managers_per_department_day', `Department has ${group.managers.size} manager(s), below required minimum ${minManagers}.`, group)
    }
    if (group.employees.size < minEmployees) {
      push('min_employees_per_department_day', `Department has ${group.employees.size} employee(s), below required minimum ${minEmployees}.`, group)
    }
  }
}

function validateWeeklyHours(
  items: ScheduleValidationItem[],
  usersById: Map<string, { weekly_working_hours?: number | null; max_weekly_hours?: number | null; contracted_weekly_hours?: number | null }>,
  push: (ruleKey: SchedulingRuleKey, message: string, item?: Partial<ScheduleValidationItem>) => void,
) {
  const byUserWeek = new Map<string, { hours: number; sample: ScheduleValidationItem }>()
  for (const item of items) {
    if (!item.user_id) continue
    const weekKey = `${item.user_id}_${weekStart(item.shift_date)}`
    const current = byUserWeek.get(weekKey) ?? { hours: 0, sample: item }
    current.hours += shiftHours(item)
    byUserWeek.set(weekKey, current)
  }
  for (const [key, value] of byUserWeek) {
    const userId = key.split('_')[0]
    const limit = MAX_WEEKLY_HOURS
    if (value.hours > limit) {
      push('weekly_hours_limit', `Worker is assigned ${value.hours.toFixed(1)} hours, above weekly limit ${limit}.`, value.sample)
    }
  }
}

function validateConsecutiveDays(
  items: ScheduleValidationItem[],
  ruleMap: Map<SchedulingRuleKey, SchedulingRule>,
  push: (ruleKey: SchedulingRuleKey, message: string, item?: Partial<ScheduleValidationItem>) => void,
) {
  const rule = ruleMap.get('max_consecutive_working_days')
  if (!rule?.active) return
  const maxDays = MAX_CONSECUTIVE_DAYS
  if (maxDays <= 0) return
  const datesByUser = new Map<string, Set<string>>()
  for (const item of items) {
    if (!item.user_id) continue
    if (!datesByUser.has(item.user_id)) datesByUser.set(item.user_id, new Set())
    datesByUser.get(item.user_id)!.add(item.shift_date)
  }
  for (const [userId, dates] of datesByUser) {
    const sorted = [...dates].sort()
    let streak = 1
    for (let i = 1; i < sorted.length; i++) {
      streak = daysBetween(sorted[i - 1], sorted[i]) === 1 ? streak + 1 : 1
      if (streak > maxDays) {
        push('max_consecutive_working_days', `Worker has more than ${maxDays} consecutive working days.`, { user_id: userId, shift_date: sorted[i] })
        break
      }
    }
  }
}

function validateWeekendFairness(
  items: ScheduleValidationItem[],
  ruleMap: Map<SchedulingRuleKey, SchedulingRule>,
  push: (ruleKey: SchedulingRuleKey, message: string, item?: Partial<ScheduleValidationItem>) => void,
) {
  const rule = ruleMap.get('fair_weekend_rotation')
  if (!rule?.active || rule.value !== true) return
  const counts = new Map<string, { count: number; sample: ScheduleValidationItem }>()
  for (const item of items) {
    if (!item.user_id) continue
    const day = new Date(`${item.shift_date}T00:00:00`).getDay()
    if (day !== 0 && day !== 6) continue
    const current = counts.get(item.user_id) ?? { count: 0, sample: item }
    current.count += 1
    counts.set(item.user_id, current)
  }
  if (counts.size < 2) return
  const values = [...counts.values()]
  const max = Math.max(...values.map(v => v.count))
  const min = Math.min(...values.map(v => v.count))
  if (max - min > 1) {
    const sample = values.find(v => v.count === max)!.sample
    push('fair_weekend_rotation', 'Weekend duty is unevenly concentrated on one worker.', sample)
  }
}

function validateWorkloadFairness(
  items: ScheduleValidationItem[],
  ruleMap: Map<SchedulingRuleKey, SchedulingRule>,
  push: (ruleKey: SchedulingRuleKey, message: string, item?: Partial<ScheduleValidationItem>) => void,
) {
  const rule = ruleMap.get('fair_workload_distribution')
  if (!rule?.active || rule.value !== true) return
  const counts = new Map<string, { count: number; sample: ScheduleValidationItem }>()
  for (const item of items) {
    if (!item.user_id) continue
    const current = counts.get(item.user_id) ?? { count: 0, sample: item }
    current.count += 1
    counts.set(item.user_id, current)
  }
  if (counts.size < 2) return
  const values = [...counts.values()]
  const max = Math.max(...values.map(v => v.count))
  const min = Math.min(...values.map(v => v.count))
  if (max - min > 2) {
    const sample = values.find(v => v.count === max)!.sample
    push('fair_workload_distribution', 'Workload is unevenly distributed across the schedule.', sample)
  }
}

function weekStart(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`)
  const dow = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - dow)
  return date.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  const one = new Date(`${a}T00:00:00`).getTime()
  const two = new Date(`${b}T00:00:00`).getTime()
  return Math.round((two - one) / 86400000)
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeDateKey(value: string): string {
  const trimmed = value.trim().replace(/[^\d/-]/g, '')
  const standardMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (standardMatch) {
    const [, year, month, day] = standardMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return trimmed
}

function parseDateKey(value: string): Date | null {
  const normalized = normalizeDateKey(value)
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(`${normalized}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) return null
  return date
}

function enumerateDateRange(dateFrom: string, dateTo: string): string[] {
  const from = parseDateKey(dateFrom)
  const to = parseDateKey(dateTo)
  if (!from || !to) throw new Error('Select a valid date range')
  if (from > to) throw new Error('date_from must be before or equal to date_to')

  const dates: string[] = []
  const cur = new Date(from)
  while (cur <= to) {
    if (dates.length >= 31) throw new Error('AI schedule date range cannot exceed 31 days')
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

// ── AI generation types ────────────────────────────────────────────────────────

export type AiScheduleBlock = {
  department_id: string
  department_name?: string
  shift_date: string
  slots: AiShiftSlot[]
  warning: string | null
}

type AiContextSummaryData = {
  ruleCount: number
  hardRuleCount: number
  staffCount: number
  fixedOffCount: number
  leaveCount: number
  previousPeriod: string
}

function buildAiSchedulePrompt(input: {
  date_from: string
  date_to: string
  rules: SchedulingRule[]
  department_staff: Array<{ department_id: string; staff: Array<{
    id: string
    full_name: string
    role: string
    active: boolean
    fixed_off_days: number[]
    max_weekly_hours: number
    remaining_weekly_hours: number
    previous_working_days: number
    previous_weekend_duties: number
    leave_requests: Array<{ date: string | null; leave_type: string; status: string }>
  }> }>
  leave_requests: Array<{ requester_id: string; date: string | null; leave_type: string; status: string }>
  fixed_off_days: Array<{ user_id: string; weekday: number }>
  shiftTypes: ShiftTypeInput[]
}): string {
  const rulesText = input.rules
    .map(r => `- [${r.rule_type}] ${r.name}: ${r.description}${r.value_type === 'number' ? ` (value: ${r.value})` : ''}`)
    .join('\n')

  const deptText = input.department_staff.map(dept => {
    const staffLines = dept.staff.map(s => {
      const offDays = s.fixed_off_days.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ') || 'none'
      const leaves = s.leave_requests.filter(l => l.status === 'approved' || l.status === 'pending')
      const leaveText = leaves.length > 0
        ? leaves.map(l => `${l.date ?? 'unknown date'} (${l.leave_type}, ${l.status})`).join(', ')
        : 'none'
      return `  - id=${s.id} name="${s.full_name}" role=${s.role} maxWeeklyHours=${s.max_weekly_hours} remainingHours=${s.remaining_weekly_hours} fixedOffDays=[${offDays}] leaves=[${leaveText}] prevWorkDays=${s.previous_working_days} prevWeekendDuties=${s.previous_weekend_duties}`
    }).join('\n')
    return `Department id=${dept.department_id}:\n${staffLines || '  (no eligible staff)'}`
  }).join('\n\n')

  const dates = enumerateDateRange(input.date_from, input.date_to)
  const datesText = dates.map(d => {
    const day = new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
    return `${d} (${day})`
  }).join(', ')

  const shiftTypesText = input.shiftTypes.map((shift, index) => {
    const label = shift.label?.trim() || `Shift ${index + 1}`
    return `- ${label}: ${shift.start_time}-${shift.end_time}`
  }).join('\n')

  const departmentCount = input.department_staff.length
  const dateCount = dates.length
  const shiftTypeCount = input.shiftTypes.length
  const expectedBlockCount = departmentCount * dateCount
  const expectedSlotCount = expectedBlockCount * shiftTypeCount
  const departmentIdList = input.department_staff.map(d => d.department_id).join(', ')

  return `You are a workforce scheduling assistant. Generate an optimal staff schedule for the period ${input.date_from} to ${input.date_to}.

SCHEDULING RULES (Hard Rules are mandatory; Soft Rules are best-effort):
${rulesText}

STAFF BY DEPARTMENT:
${deptText}

DATES TO SCHEDULE: ${datesText}

SHIFT TYPES TO SCHEDULE:
${shiftTypesText}

REQUIRED OUTPUT SIZE (do not stop early, do not skip any department):
- There are exactly ${departmentCount} departments: ${departmentIdList}
- There are exactly ${dateCount} dates to schedule.
- The "schedule" array MUST contain exactly ${expectedBlockCount} blocks (one block per department per date — every department listed above must appear for every date).
- Each block's "slots" array MUST contain exactly ${shiftTypeCount} slot(s), for a total of ${expectedSlotCount} slots across the whole response.
- Do NOT stop after finishing one department — continue until ALL ${departmentCount} departments have a block for EVERY date.

INSTRUCTIONS:
1. For each department x date, produce one schedule block. You must cover all departments listed above, not just the first one.
2. Inside each block, create one slot for every shift type listed above. Do not invent morning/evening/break shifts.
3. For each department x date x shift type, assign one eligible staff member.
4. Obey ALL Hard Rules: never schedule anyone on their fixed off day, approved leave, or when they exceed weekly hours.
5. Each department must have at least ${MIN_MANAGERS_PER_DAY} manager and ${MIN_EMPLOYEES_PER_DAY} employee per day where possible.
6. Max consecutive working days is ${MAX_CONSECUTIVE_DAYS}.
7. Weekend rotation has higher priority than workload fairness.
8. Rotate weekend duties fairly using previous_weekend_duties.
9. Distribute workload fairly using previous_work_days and remaining_weekly_hours after weekend rotation.
10. If no eligible person exists for a slot, set assigned_user_id to null.
11. For "reason", output ONLY one short code from this list (no sentences, no punctuation):
   fair_rotation | least_hours | only_eligible | weekend_rotation | manager_requirement | employee_requirement | no_eligible_staff

RESPOND ONLY WITH VALID JSON in this exact shape (no markdown, no extra text):
{
  "schedule": [
    {
      "department_id": "<string>",
      "shift_date": "<YYYY-MM-DD>",
      "slots": [
        {
          "shift_label": "<shift type label>",
          "start_time": "<HH:MM>",
          "end_time": "<HH:MM>",
          "assigned_user_id": "<user id or null>",
          "assigned_user_name": "<full name or null>",
          "reason": "<reason code>"
        }
      ],
      "warning": "<string if a hard-rule constraint could not be met, else null>"
    }
  ],
  "notice": "<one sentence summary of the generated schedule>"
}`
}

const REASON_CODE_TEXT: Record<string, string> = {
  fair_rotation: 'Assigned to keep workload distribution fair across staff.',
  least_hours: 'Assigned because this staff member had the most remaining weekly hours.',
  only_eligible: 'Only eligible staff member available for this slot.',
  weekend_rotation: 'Assigned to rotate weekend duty fairly.',
  manager_requirement: 'Manager assigned to meet daily minimum requirement.',
  employee_requirement: 'Employee assigned to meet daily minimum requirement.',
  no_eligible_staff: 'No eligible staff member available for this slot.',
}

function resolveReasonText(code: string): string {
  return REASON_CODE_TEXT[code] ?? code
}
