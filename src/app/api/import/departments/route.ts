// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { importService } from '@/services/owner/importService'
import { userService } from '@/services/auth/userService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== b.company_id) {
    return NextResponse.json({ success: false, message: 'You can only import departments into your own company' }, { status: 403 })
  }
  try {
    await userService.assertOwnerRole(session.user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Forbidden'
    return NextResponse.json({ success: false, message }, { status: 403 })
  }
  if (!Array.isArray(b.departments)) {
    return NextResponse.json({ success: false, message: 'departments must be an array' }, { status: 400 })
  }

  try {
    const result = await importService.importDepartments(
      b.company_id,
      b.departments.filter((item): item is string => typeof item === 'string'),
    )
    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import departments'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
