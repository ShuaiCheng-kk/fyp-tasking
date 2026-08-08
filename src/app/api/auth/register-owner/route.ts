// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { authService } from '@/services/auth/authService'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { full_name, email, password, phone } = body as Record<string, unknown>

  if (!full_name || typeof full_name !== 'string') {
    return NextResponse.json({ success: false, message: 'full_name is required' }, { status: 400 })
  }
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ success: false, message: 'email is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ success: false, message: 'password is required' }, { status: 400 })
  }
  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ success: false, message: 'phone is required' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Clean up any partial prior registration for this email
  const { data: listData } = await adminClient.auth.admin.listUsers()
  const existingAuthUser = listData?.users?.find(u => u.email === email)

  if (existingAuthUser) {
    const { data: dbUser } = await (supabase
      .from('users')
      .select('id, company_id')
      .eq('supabase_auth_id', existingAuthUser.id)
      .single() as unknown as Promise<{ data: { id: string; company_id: string | null } | null; error: unknown }>)

    if (dbUser?.company_id) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 },
      )
    }
    // Partial registration — clean up
    await supabase.from('users').delete().eq('supabase_auth_id', existingAuthUser.id)
    await adminClient.auth.admin.deleteUser(existingAuthUser.id)
  }

  // Also purge orphaned users row
  const { data: orphan } = await (supabase
    .from('users')
    .select('id, company_id')
    .eq('email_address', email)
    .single() as unknown as Promise<{ data: { id: string; company_id: string | null } | null; error: unknown }>)

  if (orphan) {
    if (orphan.company_id) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 },
      )
    }
    await supabase.from('users').delete().eq('id', orphan.id)
  }

  // Check phone uniqueness
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

  try {
    const result = await authService.registerOwner({ full_name, email, password, phone })
    return NextResponse.json({ success: true, user_id: result.user_id })
  } catch (err) {
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    if (msg.includes('phone') && (msg.includes('duplicate') || msg.includes('unique'))) {
      return NextResponse.json(
        { success: false, message: 'This phone number is already registered to another account.' },
        { status: 400 },
      )
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
