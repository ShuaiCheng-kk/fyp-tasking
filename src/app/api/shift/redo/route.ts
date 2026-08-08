// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id } = body as Record<string, unknown>
  if (!company_id || typeof company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only manage your own company\'s shifts' }, { status: 403 })
  }

  try {
    const result = await shiftService.redoLastUndoneAction(company_id, session.user.id)
    return NextResponse.json({ success: true, action_type: result.action_type })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to redo last undone shift action'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
