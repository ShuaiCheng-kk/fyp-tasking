// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, department_id, company_id } = body

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
    }
    if (!department_id) {
      return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
    }

    // Resolve company_id from users table if not provided
    let resolvedCompanyId = company_id
    if (!resolvedCompanyId) {
      const { data: user } = await supabase.from('users').select('company_id').eq('id', user_id).single()
      resolvedCompanyId = user?.company_id
    }
    if (!resolvedCompanyId) {
      return NextResponse.json({ success: false, message: 'Cannot resolve company_id for user' }, { status: 400 })
    }

    const { error } = await supabase
      .from('manager_departments')
      .upsert({ manager_id: user_id, department_id, company_id: resolvedCompanyId }, { onConflict: 'manager_id,department_id' })

    if (error) throw new Error(error.message)

    await supabase
      .from('users')
      .update({ department_id })
      .eq('id', user_id)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
