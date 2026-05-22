// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { department_id, name } = body as Record<string, unknown>

  if (!department_id || typeof department_id !== 'string') {
    return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  }

  try {
    await companyService.updateDepartment(department_id, name)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update department'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
