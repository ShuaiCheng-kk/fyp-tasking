// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('companies')
      .select('owner_id')
      .eq('id', company_id)
      .single()
    if (error || !data) {
      return NextResponse.json({ success: false, message: 'Company not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, owner_id: data.owner_id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch company owner'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
