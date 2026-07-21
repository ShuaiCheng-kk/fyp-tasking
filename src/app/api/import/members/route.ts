// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { importService } from '@/services/owner/importService'
import { userService } from '@/services/auth/userService'
import { MemberImportRow } from '@/types/Import'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.company_id !== 'string' || typeof b.invited_by !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id and invited_by are required' }, { status: 400 })
  }
  if (!Array.isArray(b.members)) {
    return NextResponse.json({ success: false, message: 'members must be an array' }, { status: 400 })
  }
  try {
    await userService.assertOwnerOrPartnerRole(b.invited_by)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Forbidden'
    return NextResponse.json({ success: false, message }, { status: 403 })
  }

  try {
    const result = await importService.importMembers({
      company_id: b.company_id,
      invited_by: b.invited_by,
      members: b.members as MemberImportRow[],
    })
    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import members'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
