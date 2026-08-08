import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/services/auth/userService'
import { authRepository as userRepository } from '@/repositories/auth/authRepository'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const owner_id = req.nextUrl.searchParams.get('owner_id')
  if (!owner_id) {
    return NextResponse.json({ success: false, message: 'owner_id is required' }, { status: 400 })
  }

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (owner_id !== session.user.id && owner_id !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own member count' }, { status: 403 })
  }

  try {
    // owner_id may be auth UID or internal ID — resolve to internal
    const user = await userRepository.findByAuthIdOrInternalId(owner_id)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const count = await userService.countMembersForOwner(user.id)
    return NextResponse.json({ success: true, count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to count members'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
