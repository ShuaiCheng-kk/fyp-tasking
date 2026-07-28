// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth/authService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    user_id, full_name, email_address, phone_number, date_of_birth, profile_photo_url,
    company_name, company_description,
    company_location, company_address, company_postal_code,
    company_industry, company_size,
    departments, plan,
  } = body as Record<string, unknown>

  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (!company_name || typeof company_name !== 'string') {
    return NextResponse.json({ success: false, message: 'company_name is required' }, { status: 400 })
  }
  if (!phone_number || typeof phone_number !== 'string' || !phone_number.trim()) {
    return NextResponse.json({ success: false, message: 'phone_number is required' }, { status: 400 })
  }
  if (!date_of_birth || typeof date_of_birth !== 'string') {
    return NextResponse.json({ success: false, message: 'date_of_birth is required' }, { status: 400 })
  }
  if (!profile_photo_url || typeof profile_photo_url !== 'string') {
    return NextResponse.json({ success: false, message: 'profile_photo_url is required' }, { status: 400 })
  }

  try {
    const result = await authService.completeCompanySetup({
      user_id,
      full_name: typeof full_name === 'string' ? full_name : '',
      email_address: typeof email_address === 'string' ? email_address : '',
      phone_number,
      date_of_birth,
      profile_photo_url,
      company_name,
      company_description: typeof company_description === 'string' ? company_description : '',
      company_location: typeof company_location === 'string' ? company_location : null,
      company_address: typeof company_address === 'string' ? company_address : null,
      company_postal_code: typeof company_postal_code === 'string' ? company_postal_code : null,
      company_industry: typeof company_industry === 'string' ? company_industry : null,
      company_size: typeof company_size === 'string' ? company_size : null,
      departments: Array.isArray(departments) ? departments as string[] : [],
      plan: typeof plan === 'string' ? plan : 'Free',
    })

    return NextResponse.json({ success: true, company_id: result.company_id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
