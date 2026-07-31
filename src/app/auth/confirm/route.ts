// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.
//
// Supabase sends the session as a hash fragment (#access_token=...) directly to
// this URL in implicit flow. The server never sees the hash — only the browser
// does. So we cannot verify server-side. We redirect to /email-verified and let
// the client-side Supabase SDK pick up the session from the hash automatically.

import { NextRequest, NextResponse } from 'next/server'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://fyp-tasking.vercel.app'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const error = searchParams.get('error')

  // Supabase appends error params when the link is invalid/expired
  if (error) {
    return NextResponse.redirect(`${BASE}/email-verified?error=1`)
  }

  // Success: redirect to email-verified; the browser hash (#access_token=...)
  // will be preserved by the browser and Supabase client picks it up.
  return NextResponse.redirect(`${BASE}/email-verified`)
}
