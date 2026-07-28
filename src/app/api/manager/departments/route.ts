// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { ownerTeamService as teamService } from '@/services/owner/ownerTeamService'

export async function GET(req: NextRequest) {
  const manager_id = req.nextUrl.searchParams.get('manager_id')
  const company_id = req.nextUrl.searchParams.get('company_id')

  if (!manager_id || !company_id) {
    return NextResponse.json({ success: false, message: 'manager_id and company_id are required' }, { status: 400 })
  }

  try {
    const departments = await teamService.getManagerDepartments(manager_id, company_id)
    return NextResponse.json({ success: true, departments }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch manager departments'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: { manager_id?: string; company_id?: string; department_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const { manager_id, company_id, department_id } = body
  if (!manager_id || !company_id || !department_id) {
    return NextResponse.json({ success: false, message: 'manager_id, company_id, and department_id are required' }, { status: 400 })
  }

  try {
    await teamService.assignManagerToDepartment(manager_id, company_id, department_id)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to assign department'
    const status = message === 'ALREADY_ASSIGNED' ? 400 : 500
    return NextResponse.json({ success: false, message: status === 400 ? 'Manager is already assigned to this department' : message }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  let body: { manager_id?: string; department_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const { manager_id, department_id } = body
  if (!manager_id || !department_id) {
    return NextResponse.json({ success: false, message: 'manager_id and department_id are required' }, { status: 400 })
  }

  try {
    await teamService.removeManagerFromDepartment(manager_id, department_id)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove department'
    const status = message.includes('primary') ? 400 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
