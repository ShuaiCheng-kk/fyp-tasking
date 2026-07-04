// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { marketingService } from '@/services/marketing/marketingService'

export async function GET(req: NextRequest) {
  const admin_user_id = req.nextUrl.searchParams.get('admin_user_id')
  const slug = req.nextUrl.searchParams.get('slug')

  if (!admin_user_id) {
    return NextResponse.json({ success: false, message: 'admin_user_id is required' }, { status: 400 })
  }

  try {
    if (slug) {
      const page = await marketingService.getMarketingPageForAdmin(admin_user_id, slug)
      return NextResponse.json({ success: true, page }, { status: 200 })
    }

    const pages = await marketingService.listMarketingPages(admin_user_id)
    return NextResponse.json({ success: true, pages }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch marketing pages'
    const status = message.includes('access') ? 403 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { admin_user_id, updates } = body as Record<string, unknown>

  if (!admin_user_id || typeof admin_user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'admin_user_id is required' }, { status: 400 })
  }
  if (!Array.isArray(updates)) {
    return NextResponse.json({ success: false, message: 'updates must be an array' }, { status: 400 })
  }

  try {
    await marketingService.reorderMarketingContentBlocks(admin_user_id, updates as { id: string; sort_order: number }[])
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reorder blocks'
    const status = message.includes('access') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { admin_user_id, block_id, value } = body as Record<string, unknown>

  if (!admin_user_id || typeof admin_user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'admin_user_id is required' }, { status: 400 })
  }
  if (!block_id || typeof block_id !== 'string') {
    return NextResponse.json({ success: false, message: 'block_id is required' }, { status: 400 })
  }
  if (typeof value !== 'string') {
    return NextResponse.json({ success: false, message: 'value is required' }, { status: 400 })
  }

  try {
    const block = await marketingService.updateMarketingContentBlock(admin_user_id, { block_id, value })
    return NextResponse.json({ success: true, block }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update content'
    const status = message.includes('access') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}
