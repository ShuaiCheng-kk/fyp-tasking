// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { authService, classifySignInError } from '@/services/auth/authService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { email_address, password } = body as Record<string, unknown>

  if (!email_address || typeof email_address !== 'string') {
    return NextResponse.json({ success: false, message: 'email_address is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ success: false, message: 'password is required' }, { status: 400 })
  }

  try {
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
            console.log('[signin route] setting cookies:', cookiesToSet.map(c => ({ name: c.name, httpOnly: c.options?.httpOnly, maxAge: c.options?.maxAge })))
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email_address,
      password,
    })

    if (authError || !authData.user) {
      throw new Error(classifySignInError(authError?.message))
    }

    const user = await authService.getUserProfile(authData.user.id)

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          auth_id: authData.user.id,
          role: user.role,
          full_name: user.full_name,
          company_id: user.company_id,
        },
        session: {
          access_token: authData.session!.access_token,
          refresh_token: authData.session!.refresh_token,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in failed'
    return NextResponse.json({ success: false, message }, { status: 401 })
  }
}
