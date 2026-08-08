// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { listUsers } from '@/services/userAdmin/userAdminService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (session.user.role !== 'User Admin') {
      return NextResponse.json({ error: 'Only a User Admin can perform this action' }, { status: 403 })
    }
    const search = req.nextUrl.searchParams.get('search') ?? undefined
    const roles = req.nextUrl.searchParams.getAll('role')
    const statuses = req.nextUrl.searchParams.getAll('status')
    const users = await listUsers(search, roles.length ? roles : undefined, statuses.length ? statuses : undefined)
    return NextResponse.json({ users })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
