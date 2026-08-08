import { NextRequest, NextResponse } from 'next/server'
import { reviewsService } from '@/services/marketing/reviewsService'

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : undefined

  try {
    const reviews = await reviewsService.getFeaturedReviews(limit)
    return NextResponse.json({ reviews }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const review = await reviewsService.submitReview({
      name: body.name,
      email: body.email,
      rating: body.rating,
      review: body.review,
    })
    return NextResponse.json({ review }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}