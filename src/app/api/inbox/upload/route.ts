import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const companyId = formData.get('company_id') as string | null

    if (!file || !companyId) {
      return NextResponse.json({ success: false, error: 'Missing file or company_id' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `messages/${companyId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error } = await serviceSupabase.storage
      .from('message-attachments')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (error) throw error

    const { data: urlData } = serviceSupabase.storage
      .from('message-attachments')
      .getPublicUrl(path)

    return NextResponse.json({ success: true, url: urlData.publicUrl, name: file.name, type: file.type })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
