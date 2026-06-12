// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type JoinedUser = { id: string; full_name: string }

function getJoinedUser(row: { users?: JoinedUser | JoinedUser[] | null }): JoinedUser | null {
  if (!row.users) return null
  return Array.isArray(row.users) ? row.users[0] ?? null : row.users
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const department_id = searchParams.get('department_id')

  if (!company_id || !department_id) {
    return NextResponse.json(
      { success: false, message: 'company_id and department_id are required' },
      { status: 400 },
    )
  }

  try {
    // Get all shifts for this department
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('id, shift_date, start_time, end_time')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
      .order('shift_date', { ascending: true })

    if (shiftsError) throw new Error(shiftsError.message)
    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ success: true, employees: [] })
    }

    const shiftIds = shifts.map(s => s.id)

    // Get assignments for those shifts
    const { data: assignments, error: assignError } = await supabase
      .from('shift_assignments')
      .select('user_id, shift_id')
      .in('shift_id', shiftIds)

    if (assignError) throw new Error(assignError.message)

    // Get all members of this department (employees + managers) as potential assignees
    const { data: empDepts, error: empError } = await supabase
      .from('employee_departments')
      .select('employee_id, users!inner(id, full_name)')
      .eq('department_id', department_id)

    if (empError) throw new Error(empError.message)

    const shiftMap = new Map(shifts.map(s => [s.id, s]))

    if (assignments && assignments.length > 0) {
      // Only keep assigned users who are actual Employees in this department
      const empIds = new Set((empDepts ?? []).map((row: any) => getJoinedUser(row)?.id).filter(Boolean))
      const employeeMap = new Map<string, { id: string; full_name: string; shifts: { shift_date: string; start_time: string; end_time: string }[] }>()

      for (const a of assignments) {
        if (!empIds.has(a.user_id)) continue
        const shift = shiftMap.get(a.shift_id)
        const empRow = (empDepts ?? []).find((row: any) => getJoinedUser(row)?.id === a.user_id)
        const full_name = empRow ? getJoinedUser(empRow)?.full_name : null
        if (!shift || !full_name) continue
        if (!employeeMap.has(a.user_id)) {
          employeeMap.set(a.user_id, { id: a.user_id, full_name, shifts: [] })
        }
        employeeMap.get(a.user_id)!.shifts.push({
          shift_date: shift.shift_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
        })
      }
      return NextResponse.json({ success: true, employees: Array.from(employeeMap.values()) })
    }

    // No assignments — return department employees each paired with all shifts
    const deptEmployees = (empDepts ?? []).map((row: any) => {
      const user = getJoinedUser(row)
      if (!user) return null
      return {
        id: user.id,
        full_name: user.full_name,
        shifts: shifts.map(s => ({
          shift_date: s.shift_date,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      }
    }).filter(Boolean)

    return NextResponse.json({ success: true, employees: deptEmployees })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch department employees'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
