// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authService } from '@/services/auth/authService'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { full_name, email, password, phone, date_of_birth, home_location, job_id } = body as Record<string, unknown>

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

  // Check for existing users row (fully registered account)
  const { data: existingUser } = await (supabase
    .from('users')
    .select('id')
    .eq('email_address', email)
    .single() as unknown as Promise<{ data: { id: string } | null; error: unknown }>)

  if (existingUser) {
    return NextResponse.json(
      { success: false, message: 'An account with this email already exists. Please sign in instead.' },
      { status: 400 },
    )
  }

  // Check phone uniqueness
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

  try {
    const result = await authService.registerGuest({
      email,
      password,
      full_name,
      phone,
      date_of_birth: typeof date_of_birth === 'string' ? date_of_birth : null,
      home_location: typeof home_location === 'string' ? home_location : null,
      job_id: typeof job_id === 'string' ? job_id : null,
    })
    return NextResponse.json({ success: true, user_id: result.user_id, email_confirmed: result.email_confirmed })
  } catch (err) {
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    if (msg.includes('already registered') || msg.includes('duplicate') || msg.includes('unique')) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ success: false, message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
