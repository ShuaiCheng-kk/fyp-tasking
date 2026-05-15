// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { authService } from '@/services/authService'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { full_name, email, password, phone, company_name, company_description, departments, plan } = body

  console.log('complete-owner-setup called with:', email)

  if (!full_name || !email || !password || !company_name) {
    return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
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
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('supabase_auth_id', existingAuthUser.id)
      .single()

    if (dbUser && dbUser.company_id) {
      // Fully registered — tell them to sign in
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 },
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
  const { data: orphanByEmail } = await supabase
    .from('users')
    .select('id, company_id')
    .eq('email_address', email)
    .single()

  if (orphanByEmail) {
    if (orphanByEmail.company_id) {
      // Has a company — fully registered, tell them to sign in
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 },
      )
    }
    // No company — orphaned row from a previous partial failure, delete it
    await supabase.from('users').delete().eq('id', orphanByEmail.id)
    console.log('Cleaned up orphaned users row (by email) for:', email)
  }

  try {
    const result = await authService.completeOwnerSetup({
      full_name,
      email,
      password,
      phone: phone || '',
      company_name,
      company_description: company_description || '',
      departments: Array.isArray(departments) ? departments : [],
      plan: plan || 'Free',
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    console.error('complete-owner-setup error:', error)
    const msg = (error instanceof Error ? error.message : '').toLowerCase()
    if (msg.includes('foreign key')) {
      return NextResponse.json({ success: false, message: 'Setup failed. Please try again.' }, { status: 500 })
    }
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already registered')) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ success: false, message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
