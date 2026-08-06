// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import {
  suspendCompany,
  unsuspendCompany,
  suspendUser,
  unsuspendUser,
} from '@/services/userAdmin/userAdminService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (session.user.role !== 'User Admin') {
      return NextResponse.json({ error: 'Only a User Admin can perform this action' }, { status: 403 })
    }

    const body = await req.json()
    const { action, company_id, user_id, reason } = body

    if (action === 'suspend_company') {
      await suspendCompany({ company_id, reason })
    } else if (action === 'unsuspend_company') {
      await unsuspendCompany({ company_id })
    } else if (action === 'suspend_user') {
      await suspendUser({ user_id, reason })
    } else if (action === 'unsuspend_user') {
      await unsuspendUser({ user_id })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
