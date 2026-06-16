// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  try {
    const { user_id, full_name, phone_number, date_of_birth } = await req.json()
    if (!user_id) return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
    if (!full_name?.trim()) return NextResponse.json({ success: false, message: 'Full name is required' }, { status: 400 })
    const { data: user, error } = await supabase
      .from('users')
      .update({
        full_name: full_name.trim(),
        phone_number: phone_number?.trim() || null,
        date_of_birth: date_of_birth?.trim() || null,
      })
      .eq('id', user_id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, user })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to update profile' },
      { status: 500 },
    )
  }
}
