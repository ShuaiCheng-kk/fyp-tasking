// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'

// GET /api/jobs/public/filters
// Public endpoint — returns distinct industries and locations from all companies.
export async function GET() {
  try {
    const filters = await companyService.getJobBoardFilters()
    return NextResponse.json({ success: true, ...filters })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
