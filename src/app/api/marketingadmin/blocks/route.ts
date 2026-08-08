// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { marketingAdminService } from '@/services/marketingadmin/marketingAdminService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { page_id, block_key, block_type, label, value, sort_order } = body

    if (!page_id || !block_key || !block_type || !label) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

    const block = await marketingAdminService.createMarketingContentBlock(session.auth_id, {
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
    const block_id = req.nextUrl.searchParams.get('id')

    if (!block_id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

    await marketingAdminService.deleteMarketingContentBlock(session.auth_id, block_id)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete block'
    const status = message.includes('access') ? 403 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
