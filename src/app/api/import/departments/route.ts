// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { importService } from '@/services/owner/importService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!Array.isArray(b.departments)) {
    return NextResponse.json({ success: false, message: 'departments must be an array' }, { status: 400 })
  }

  try {
    const result = await importService.importDepartments(
      b.company_id,
      b.departments.filter((item): item is string => typeof item === 'string'),
    )
    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import departments'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
