// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { attendanceService } from '@/services/owner/attendanceService'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (user_id !== session.user.id && user_id !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own profile' }, { status: 403 })
  }

  try {
    const [userRow, fixedOffDates] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, role')
        .eq('id', user_id)
        .single(),
      attendanceService.getUpcomingApprovedOffDates(user_id),
    ])

    if (userRow.error) throw new Error(userRow.error.message)
    const u = userRow.data

    return NextResponse.json({
      success: true,
      summary: {
        user_id: u.id,
        full_name: u.full_name,
        role: u.role,
        fixed_off_days: fixedOffDates,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load profile summary'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
