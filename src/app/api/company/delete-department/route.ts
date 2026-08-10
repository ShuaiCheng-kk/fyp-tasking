// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'
import { userService } from '@/services/auth/userService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function DELETE(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { department_id } = body as Record<string, unknown>

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

  try {
    await companyService.deleteDepartment(department_id, session.user.company_id ?? '')
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete department'
    const status = message.includes('own company') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}
