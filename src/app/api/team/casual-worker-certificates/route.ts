// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { casualWorkerProfileService } from '@/services/team/casualWorkerProfileService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    const certificates = await casualWorkerProfileService.getCertificates(user_id, session.user.company_id ?? '')
    return NextResponse.json({ success: true, certificates })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch certificates'
    const status = message.includes('own company') ? 403 : message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
