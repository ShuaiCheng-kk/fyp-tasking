// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, name } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  }

  try {
    const department = await companyService.createDepartment({ company_id, name })
    return NextResponse.json(
      { success: true, department: { id: department.id, name: department.name } },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Department creation failed'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
