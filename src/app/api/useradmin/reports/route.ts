// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { getReportStats } from '@/services/userAdmin/userAdminService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (session.user.role !== 'User Admin') {
      return NextResponse.json({ error: 'Only a User Admin can perform this action' }, { status: 403 })
    }
    const from = req.nextUrl.searchParams.get('from') ?? undefined
    const to = req.nextUrl.searchParams.get('to') ?? undefined
    const stats = await getReportStats(from, to)
    return NextResponse.json(stats)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
