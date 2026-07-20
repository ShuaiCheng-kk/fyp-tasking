// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'
import { userService } from '@/services/auth/userService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, name, color, requester_user_id } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!requester_user_id || typeof requester_user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'requester_user_id is required' }, { status: 400 })
  }
  try {
    await userService.assertOwnerRole(requester_user_id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Forbidden'
    return NextResponse.json({ success: false, message }, { status: 403 })
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  }
  if (color !== undefined && color !== null && typeof color !== 'string') {
    return NextResponse.json({ success: false, message: 'color must be a string' }, { status: 400 })
  }

  try {
    const department = await companyService.createDepartment({ company_id, name, color: color as string | null | undefined })
    return NextResponse.json(
      { success: true, department: { id: department.id, name: department.name } },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Department creation failed'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
