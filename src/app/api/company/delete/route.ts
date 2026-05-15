// LAYER: Controller only

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/companyService'

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

    await companyService.deleteCompany(company_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete company'
    const status = CLIENT_ERRORS.includes(message) ? 200 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
