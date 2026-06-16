// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('job_applicants')
      .select('resume_url, cover_letter')
      .eq('user_id', user_id)
      .order('applied_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      application: data ?? { resume_url: null, cover_letter: null },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to fetch application' },
      { status: 500 }
    )
  }
}
