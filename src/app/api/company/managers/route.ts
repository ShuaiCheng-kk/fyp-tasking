// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/companyService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const company_id = searchParams.get('company_id')
    const department_id = searchParams.get('department_id')

    if (!company_id || !department_id) {
      return NextResponse.json(
        { success: false, message: 'company_id and department_id are required' },
        { status: 400 },
      )
    }

    const managers = await companyService.getManagersByDepartment(company_id, department_id)
    return NextResponse.json({ success: true, managers })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
