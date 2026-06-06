// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { marketingService } from '@/services/marketing/marketingService'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ success: false, message: 'slug is required' }, { status: 400 })
  }

  try {
    const page = await marketingService.getPublicMarketingPage(slug)
    return NextResponse.json({ success: true, page }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch marketing page'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
