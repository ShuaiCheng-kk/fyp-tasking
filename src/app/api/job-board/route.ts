// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextResponse } from 'next/server'
import { recruitmentService } from '@/services/owner/recruitmentService'

export async function GET() {
  try {
    const postings = await recruitmentService.getPublicJobPostings()
    return NextResponse.json({ success: true, postings })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch job postings'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
