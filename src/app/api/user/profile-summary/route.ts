// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { availabilityService } from '@/services/user/availabilityService'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })

  try {
    const [userRow, days] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, role, weekly_working_hours, max_weekly_hours, contracted_weekly_hours')
        .eq('id', user_id)
        .single(),
      availabilityService.getFixedOffDays(user_id),
    ])

    if (userRow.error) throw new Error(userRow.error.message)
    const u = userRow.data

    return NextResponse.json({
      success: true,
      summary: {
        user_id: u.id,
        full_name: u.full_name,
        role: u.role,
        weekly_working_hours: u.weekly_working_hours ?? null,
        max_weekly_hours: u.max_weekly_hours ?? null,
        contracted_weekly_hours: u.contracted_weekly_hours ?? null,
        fixed_off_days: days.map((d: { weekday: number }) => d.weekday),
        leave_requests: [],
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load profile summary'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
