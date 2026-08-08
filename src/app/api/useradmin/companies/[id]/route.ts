// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { getCompanyDetail } from '@/services/userAdmin/userAdminService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (session.user.role !== 'User Admin') {
      return NextResponse.json({ error: 'Only a User Admin can perform this action' }, { status: 403 })
    }
    const { id } = await params
    const detail = await getCompanyDetail(id)
    if (!detail) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    return NextResponse.json({ company: detail })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
