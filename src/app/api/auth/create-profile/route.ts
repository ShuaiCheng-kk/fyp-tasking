// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/authService'
import type { User } from '@/types/index'

const VALID_ROLES: User['role'][] = [
  'Owner', 'Manager', 'Employee', 'Casual Worker', 'Guest User',
]

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { user_id, full_name, email_address, phone_number, role, company_id, department_id } =
    body as Record<string, unknown>

  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (!full_name || typeof full_name !== 'string') {
    return NextResponse.json({ success: false, message: 'full_name is required' }, { status: 400 })
  }
  if (!email_address || typeof email_address !== 'string') {
    return NextResponse.json({ success: false, message: 'email_address is required' }, { status: 400 })
  }
  if (!role || !VALID_ROLES.includes(role as User['role'])) {
    return NextResponse.json(
      { success: false, message: `role must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    await authService.createUserProfile({
      user_id,
      full_name,
      email_address,
      phone_number: typeof phone_number === 'string' ? phone_number : null,
      role: role as User['role'],
      company_id: typeof company_id === 'string' ? company_id : null,
      department_id: typeof department_id === 'string' ? department_id : null,
    })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: any) {
    console.error('CREATE PROFILE ERROR:', JSON.stringify(error, null, 2))
    return NextResponse.json({ success: false, message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
