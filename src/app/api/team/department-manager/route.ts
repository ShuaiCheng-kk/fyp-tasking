// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { ownerTeamService } from '@/services/owner/ownerTeamService'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  try {
    const assignments = await ownerTeamService.getDepartmentManagers(company_id)
    return NextResponse.json({ success: true, assignments })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch department managers'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { manager_id, department_id } = body as Record<string, unknown>

  if (!manager_id || typeof manager_id !== 'string') {
    return NextResponse.json({ success: false, message: 'manager_id is required' }, { status: 400 })
  }
  if (!department_id || typeof department_id !== 'string') {
    return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
  }

  try {
    await ownerTeamService.removeManagerFromDepartment(manager_id, department_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove manager from department'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, department_id, manager_id } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!department_id || typeof department_id !== 'string') {
    return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
  }
  if (!manager_id || typeof manager_id !== 'string') {
    return NextResponse.json({ success: false, message: 'manager_id is required' }, { status: 400 })
  }

  try {
    await ownerTeamService.setDepartmentManager({
      company_id,
      department_id,
      manager_id,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update department manager'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
