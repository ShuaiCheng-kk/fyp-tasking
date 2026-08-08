// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { marketingAdminService } from '@/services/marketingadmin/marketingAdminService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    if (slug) {
      const page = await marketingAdminService.getMarketingPageForAdmin(session.auth_id, slug)
      return NextResponse.json({ success: true, page }, { status: 200 })
    }

    const pages = await marketingAdminService.listMarketingPages(session.auth_id)
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

  const { updates } = body as Record<string, unknown>

  if (!Array.isArray(updates)) {
    return NextResponse.json({ success: false, message: 'updates must be an array' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    await marketingAdminService.reorderMarketingContentBlocks(session.auth_id, updates as { id: string; sort_order: number }[])
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

  const { block_id, value } = body as Record<string, unknown>

  if (!block_id || typeof block_id !== 'string') {
    return NextResponse.json({ success: false, message: 'block_id is required' }, { status: 400 })
  }
  if (typeof value !== 'string') {
    return NextResponse.json({ success: false, message: 'value is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    const block = await marketingAdminService.updateMarketingContentBlock(session.auth_id, { block_id, value })
    return NextResponse.json({ success: true, block }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update content'
    const status = message.includes('access') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}
