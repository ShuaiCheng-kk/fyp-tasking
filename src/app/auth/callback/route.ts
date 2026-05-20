// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { emailService } from '@/services/emailService'

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

  try {
    const authUser = sessionData?.user
    console.log('Auth user:', authUser?.id, authUser?.email)

    if (authUser?.id && authUser?.email) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )

      console.log('Fetching user row from DB...')
      const { data: dbUser, error: dbUserError } = await adminClient
        .from('users')
        .select('id, full_name, company_id')
        .eq('supabase_auth_id', authUser.id)
        .single()
      console.log('DB user result:', dbUser, dbUserError)

      if (dbUser?.company_id) {
        console.log('Fetching company from DB...')
        const { data: company, error: companyError } = await adminClient
          .from('companies')
          .select('name, description, plan')
          .eq('id', dbUser.company_id)
          .single()
        console.log('Company result:', company, companyError)

        if (company) {
          console.log('Sending Email 2 (account ready) to:', authUser.email)
          await emailService.sendAccountConfirmationEmail({
            to: authUser.email,
            fullName: dbUser.full_name,
            companyName: company.name,
            companyDescription: company.description ?? null,
            plan: company.plan ?? 'Free',
          })
          console.log('Email 2 sent successfully')
        } else {
          console.log('No company found — skipping Email 2')
        }
      } else {
        console.log('No company_id on user — skipping Email 2')
      }
    } else {
      console.log('No auth user in session — skipping Email 2')
    }
  } catch (err) {
    console.error('Email 2 failed (non-fatal):', err)
  }

  return NextResponse.redirect(new URL('/signin?confirmed=true', req.url))
}
