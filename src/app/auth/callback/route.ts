// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  console.log('Auth callback triggered')

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  console.log('Code received:', !!code)

  if (!code) {
    return NextResponse.redirect(new URL('/signin', req.url))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
  console.log('Session exchanged:', !!sessionData?.session)
  console.log('User ID:', sessionData?.user?.id)

  if (error) {
    console.error('Session exchange error:', error)
    return NextResponse.redirect(new URL('/signin', req.url))
  }

  return NextResponse.redirect(new URL('/signin?confirmed=true', req.url))
}
