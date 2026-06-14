// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BASE = 'https://fyp-tasking.vercel.app'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (!token_hash || !type) {
    return NextResponse.redirect(`${BASE}/get-started?error=invalid_link`)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as Parameters<typeof supabase.auth.verifyOtp>[0]['type'],
  })

  if (error) {
    return NextResponse.redirect(`${BASE}/get-started?error=invalid_link`)
  }

  return NextResponse.redirect(`${BASE}/get-started?verified=true`)
}
