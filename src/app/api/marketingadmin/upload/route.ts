// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { marketingAdminService } from '@/services/marketingadmin/marketingAdminService'

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid form data' }, { status: 400 })
  }

  const admin_user_id = formData.get('admin_user_id')
  const block_key = formData.get('block_key')
  const file = formData.get('file')

  if (!admin_user_id || typeof admin_user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'admin_user_id is required' }, { status: 400 })
  }
  if (!block_key || typeof block_key !== 'string') {
    return NextResponse.json({ success: false, message: 'block_key is required' }, { status: 400 })
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, message: 'file is required' }, { status: 400 })
  }

  try {
    const { publicUrl } = await marketingAdminService.uploadMedia(admin_user_id, block_key, file)
    return NextResponse.json({ success: true, publicUrl }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    const status = message.includes('access') ? 403 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
