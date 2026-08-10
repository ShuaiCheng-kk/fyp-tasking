// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { ownerTeamService } from '@/services/owner/ownerTeamService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own company\'s departments' }, { status: 403 })
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

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    await ownerTeamService.removeManagerFromDepartment(manager_id, department_id, session.user.company_id ?? undefined)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove manager from department'
    const status = message.includes('own company') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
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

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only manage your own company\'s departments' }, { status: 403 })
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
