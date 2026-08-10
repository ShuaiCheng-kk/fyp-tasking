// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'
import { userService } from '@/services/auth/userService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { department_id, name, color } = body as Record<string, unknown>

  if (!department_id || typeof department_id !== 'string') {
    return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  try {
    await userService.assertOwnerRole(session.user.id)
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
    await companyService.updateDepartment(department_id, name, color as string | null | undefined, session.user.company_id ?? '')
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update department'
    const status = message.includes('own company') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}
