// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { reviewsService } from '@/services/marketing/reviewsService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET() {
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    const reviews = await reviewsService.listAllReviewsForAdmin(session.auth_id)
    return NextResponse.json({ success: true, reviews }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch reviews'
    const status = message.includes('access') ? 403 : 500
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

  const { review_id, approved } = body as Record<string, unknown>

  if (!review_id || typeof review_id !== 'string') {
    return NextResponse.json({ success: false, message: 'review_id is required' }, { status: 400 })
  }
  if (typeof approved !== 'boolean') {
    return NextResponse.json({ success: false, message: 'approved must be a boolean' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    const review = approved
      ? await reviewsService.approveReview(session.auth_id, review_id)
      : await reviewsService.rejectReview(session.auth_id, review_id)
    return NextResponse.json({ success: true, review }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update review'
    const status = message.includes('access') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  const review_id = req.nextUrl.searchParams.get('id')

  if (!review_id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    await reviewsService.deleteReview(session.auth_id, review_id)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete review'
    const status = message.includes('access') ? 403 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
