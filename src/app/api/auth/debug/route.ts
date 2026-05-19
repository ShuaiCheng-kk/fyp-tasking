// TEMPORARY DEBUG ROUTE — delete after fixing auth
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  const sbCookies = allCookies.filter(c => c.name.startsWith('sb-'))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  return NextResponse.json({
    serverSideSession: session ? { uid: session.user.id, expires_at: session.expires_at } : null,
    sbCookiesPresent: sbCookies.map(c => c.name),
    allCookieNames: allCookies.map(c => c.name),
    reqCookieNames: req.cookies.getAll().map(c => c.name),
  })
}
