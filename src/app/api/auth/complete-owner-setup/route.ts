// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { authService } from '@/services/auth/authService'
import { emailService } from '@/services/email/emailService'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { full_name, email, password, phone, company_name, company_description,
    company_location, company_address, company_postal_code, company_industry, company_size, company_website, company_logo_url,
    departments, plan } = body

  console.log('complete-owner-setup called with:', email)

  if (!full_name || !email || !password || !company_name) {
    return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
  }
  if (!phone || !String(phone).trim()) {
    return NextResponse.json({ success: false, message: 'phone_number is required' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Check if this email already has an Auth user
  const { data: listData } = await adminClient.auth.admin.listUsers()
  const existingAuthUser = listData?.users?.find((u) => u.email === email)

  if (existingAuthUser) {
    // Check if they have a complete users table record with company_id
    const { data: dbUser } = await (supabase
      .from('users')
      .select('id, company_id')
      .eq('supabase_auth_id', existingAuthUser.id)
      .single() as unknown as Promise<{ data: { id: string; company_id: string | null } | null; error: unknown }>)

    if (dbUser && dbUser.company_id) {
      // Fully registered — tell them to sign in
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists. Please sign in instead.' },
      )
    } else {
      // Partial registration — clean up auth + any matching users row
      await supabase.from('users').delete().eq('supabase_auth_id', existingAuthUser.id)
      await adminClient.auth.admin.deleteUser(existingAuthUser.id)
      console.log('Cleaned up partial registration (by auth id) for:', email)
    }
  }

  // Also purge any orphaned users row by email (auth user may have already been deleted
  // in a previous attempt, leaving a stale row that would cause a duplicate key error)
  const { data: orphanByEmail } = await (supabase
    .from('users')
    .select('id, company_id')
    .eq('email_address', email)
    .single() as unknown as Promise<{ data: { id: string; company_id: string | null } | null; error: unknown }>)

  if (orphanByEmail) {
    if (orphanByEmail.company_id) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists. Please sign in instead.' },
      )
    }
    await supabase.from('users').delete().eq('id', orphanByEmail.id)
    console.log('Cleaned up orphaned users row (by email) for:', email)
  }

  // Pre-check phone uniqueness to give a clear error before hitting the DB constraint
  if (phone) {
    const { data: phoneUser } = await (supabase
      .from('users')
      .select('id')
      .eq('phone_number', phone)
      .single() as unknown as Promise<{ data: { id: string } | null; error: unknown }>)
    if (phoneUser) {
      return NextResponse.json(
        { success: false, message: 'This phone number is already registered to another account. Please use a different number.' },
        { status: 400 },
      )
    }
  }

  let authUserId: string | undefined

  try {
    const result = await authService.completeOwnerSetup({
      full_name,
      email,
      password,
      phone: phone || '',
      company_name,
      company_description: company_description || '',
      company_location: company_location || null,
      company_address: company_address || null,
      company_postal_code: company_postal_code || null,
      company_industry: company_industry || null,
      company_size: company_size || null,
      company_website: company_website || null,
      company_logo_url: company_logo_url || null,
      departments: Array.isArray(departments) ? departments : [],
      plan: plan || 'Free',
    })

    authUserId = result.user_id

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'signup',
      email: email,
      password: password,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    const confirmLink = linkData?.properties?.action_link
    if (linkError || !confirmLink) {
      console.error('Failed to generate confirmation link:', linkError)
    } else {
      await emailService.sendConfirmationRequestEmail({
        to: email,
        fullName: full_name,
        confirmLink,
      })
    }

    return NextResponse.json({ success: true, requiresConfirmation: true, ...result })
  } catch (error: unknown) {
    try {
      if (authUserId) {
        await adminClient.auth.admin.deleteUser(authUserId)
        console.log('Rolled back auth user:', authUserId)
      }
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr)
    }

    const msg = (error instanceof Error ? error.message : '').toLowerCase()
    if (msg.includes('phone') && (msg.includes('duplicate') || msg.includes('unique'))) {
      return NextResponse.json(
        { success: false, message: 'This phone number is already registered to another account. Please use a different number.' },
      )
    }
    if (msg.includes('foreign key')) {
      return NextResponse.json({ success: false, message: 'Setup failed. Please try again.' }, { status: 500 })
    }
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already registered')) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists. Please sign in instead.' },
      )
    }
    return NextResponse.json({ success: false, message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
