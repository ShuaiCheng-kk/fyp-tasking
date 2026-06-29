// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { marketingService } from '@/services/marketing/marketingService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { admin_user_id, page_id, block_key, block_type, label, value, sort_order } = body

    if (!admin_user_id) return NextResponse.json({ success: false, message: 'admin_user_id is required' }, { status: 400 })
    if (!page_id || !block_key || !block_type || !label) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
    }

    const block = await marketingService.createMarketingContentBlock(admin_user_id, {
      page_id,
      block_key,
      block_type,
      label,
      value: value ?? '',
      sort_order: sort_order ?? 0,
    })
    return NextResponse.json({ success: true, block }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create block'
    const status = message.includes('access') ? 403 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin_user_id = req.nextUrl.searchParams.get('admin_user_id')
    const block_id = req.nextUrl.searchParams.get('id')

    if (!admin_user_id) return NextResponse.json({ success: false, message: 'admin_user_id is required' }, { status: 400 })
    if (!block_id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

    await marketingService.deleteMarketingContentBlock(admin_user_id, block_id)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete block'
    const status = message.includes('access') ? 403 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
