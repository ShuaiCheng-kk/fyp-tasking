// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { casualWorkerProfileService } from '@/services/team/casualWorkerProfileService'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }

  try {
    const certificates = await casualWorkerProfileService.getCertificates(user_id)
    return NextResponse.json({ success: true, certificates })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}
