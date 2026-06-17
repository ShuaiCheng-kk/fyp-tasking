// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { schedulingRuleService } from '@/services/owner/schedulingRuleService'
import { ShiftTypeInput } from '@/types/SchedulingRule'

function normalizeDateKey(value: string) {
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

function isDateKey(value: string) {
  const normalized = normalizeDateKey(value)
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const [, year, month, day] = match
  const date = new Date(`${normalized}T00:00:00Z`)
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
  )
}

function countDaysInclusive(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00`)
  const to = new Date(`${dateTo}T00:00:00`)
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.company_id !== 'string' || !b.company_id)
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (typeof b.user_id !== 'string' || !b.user_id)
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  if (typeof b.date_from !== 'string' || !b.date_from)
    return NextResponse.json({ success: false, message: 'date_from is required' }, { status: 400 })
  if (typeof b.date_to !== 'string' || !b.date_to)
    return NextResponse.json({ success: false, message: 'date_to is required' }, { status: 400 })
  const dateFrom = normalizeDateKey(b.date_from)
  const dateTo = normalizeDateKey(b.date_to)
  if (!isDateKey(dateFrom) || !isDateKey(dateTo))
    return NextResponse.json({ success: false, message: 'Select a valid date range' }, { status: 400 })
  if (dateFrom > dateTo)
    return NextResponse.json({ success: false, message: 'date_from must be before or equal to date_to' }, { status: 400 })
  if (countDaysInclusive(dateFrom, dateTo) > 31)
    return NextResponse.json({ success: false, message: 'AI schedule date range cannot exceed 31 days' }, { status: 400 })
  if (!Array.isArray(b.department_ids) || b.department_ids.length === 0)
    return NextResponse.json({ success: false, message: 'department_ids is required' }, { status: 400 })
  if (!Array.isArray(b.shift_types) || b.shift_types.length === 0)
    return NextResponse.json({ success: false, message: 'shift_types is required' }, { status: 400 })

  const shiftTypes = b.shift_types
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => ({
      label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : `Shift ${index + 1}`,
      start_time: typeof item.start_time === 'string' ? item.start_time : '',
      end_time: typeof item.end_time === 'string' ? item.end_time : '',
    }))
    .filter(item => item.start_time && item.end_time)
  if (shiftTypes.length === 0)
    return NextResponse.json({ success: false, message: 'At least one valid shift type is required' }, { status: 400 })

  try {
    const result = await schedulingRuleService.generateScheduleWithAI({
      company_id: b.company_id,
      user_id: b.user_id,
      date_from: dateFrom,
      date_to: dateTo,
      department_ids: b.department_ids as string[],
      shiftTypes: shiftTypes as ShiftTypeInput[],
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[POST /api/owner/scheduling-rules/generate]', err)
    const message = err instanceof Error ? err.message : 'Failed to generate schedule'
    return NextResponse.json({ success: false, message }, { status: message.includes('Only Owner') ? 403 : 500 })
  }
}
