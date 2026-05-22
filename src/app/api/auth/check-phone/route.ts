// LAYER: Controller
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'


export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone) return NextResponse.json({ exists: false })

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phone)
      .single()

    return NextResponse.json({ exists: !!data })
  } catch {
    return NextResponse.json({ exists: false })
  }
}
