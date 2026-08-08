// LAYER: Controller only

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'
import { getServerSessionUser } from '@/lib/serverAuth'

const CLIENT_ERRORS = [
  'This is your primary company created during registration and cannot be deleted.',
]

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { company_id } = body

    if (!company_id) {
      return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
    }

    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    if (session.user.company_id !== company_id) {
      return NextResponse.json({ success: false, message: 'You can only delete your own company' }, { status: 403 })
    }
    if (session.user.role !== 'Owner' && session.user.role !== 'Partner') {
      return NextResponse.json({ success: false, message: 'Only an Owner or Partner can delete a company' }, { status: 403 })
    }

    await companyService.deleteCompany(company_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete company'
    const status = CLIENT_ERRORS.includes(message) ? 200 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
