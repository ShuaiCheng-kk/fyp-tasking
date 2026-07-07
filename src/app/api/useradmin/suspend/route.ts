// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import {
  suspendCompany,
  unsuspendCompany,
  suspendUser,
  unsuspendUser,
} from '@/services/userAdmin/userAdminService'

export async function POST(req: NextRequest) {
  try {
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
