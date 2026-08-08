// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const company_id = searchParams.get('company_id')
    const department_id = searchParams.get('department_id')

    if (!company_id) {
      return NextResponse.json(
        { success: false, message: 'company_id is required' },
        { status: 400 },
      )
    }

    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    if (session.user.company_id !== company_id) {
      return NextResponse.json({ success: false, message: 'You can only view your own company\'s managers' }, { status: 403 })
    }

    const managers = department_id
      ? await companyService.getManagersByDepartment(company_id, department_id)
      : await companyService.getAllManagersByCompany(company_id)

    return NextResponse.json({ success: true, managers })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
