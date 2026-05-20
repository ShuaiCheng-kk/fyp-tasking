// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { emailService } from '@/services/emailService'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

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

  if (error) {
    return NextResponse.redirect(new URL('/signin', req.url))
  }

  try {
    const authUser = sessionData?.user
    if (authUser?.id && authUser?.email) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )

      const { data: dbUser } = await adminClient
        .from('users')
        .select('full_name, company_id')
        .eq('supabase_auth_id', authUser.id)
        .single()

      if (dbUser?.company_id) {
        const { data: company } = await adminClient
          .from('companies')
          .select('name, description, plan')
          .eq('id', dbUser.company_id)
          .single()

        if (company) {
          await emailService.sendAccountConfirmationEmail({
            to: authUser.email,
            fullName: dbUser.full_name,
            companyName: company.name,
            companyDescription: company.description ?? null,
            plan: company.plan ?? 'Free',
          })
        }
      }
    }
  } catch (emailError) {
    console.error('Failed to send account ready email:', emailError)
  }

  return NextResponse.redirect(new URL('/signin?confirmed=true', req.url))
}
