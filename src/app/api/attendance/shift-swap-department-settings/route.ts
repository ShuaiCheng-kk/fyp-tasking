// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftSwapDepartmentSettingsService } from '@/services/owner/shiftSwapDepartmentSettingsService'
import { getServerSessionUser } from '@/lib/serverAuth'

// CHANGE TYPE: Code only

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const department_id = searchParams.get('department_id')
  const manager_id = searchParams.get('manager_id')

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!department_id) {
    return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
  }
  if (!manager_id) {
    return NextResponse.json({ success: false, message: 'manager_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own company\'s settings' }, { status: 403 })
  }

  try {
    const settings = await shiftSwapDepartmentSettingsService.getSettings(company_id, department_id, manager_id)
    return NextResponse.json({ success: true, settings })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch shift swap settings'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const action = b.action

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    if (action === 'set_settings') {
      if (
        typeof b.company_id !== 'string' ||
        typeof b.department_id !== 'string' ||
        typeof b.auto_approval_enabled !== 'boolean' ||
        (b.monthly_swap_limit !== null && typeof b.monthly_swap_limit !== 'number') ||
        (b.deadline_hours_before_shift !== null && typeof b.deadline_hours_before_shift !== 'number') ||
        typeof b.require_review_on_limit_exceeded !== 'boolean' ||
        typeof b.require_review_on_deadline_exceeded !== 'boolean'
      ) {
        return NextResponse.json({ success: false, message: 'company_id, department_id, auto_approval_enabled, monthly_swap_limit, deadline_hours_before_shift, require_review_on_limit_exceeded and require_review_on_deadline_exceeded are required' }, { status: 400 })
      }
      if (session.user.company_id !== b.company_id) {
        return NextResponse.json({ success: false, message: 'You can only manage your own company\'s settings' }, { status: 403 })
      }
      const settings = await shiftSwapDepartmentSettingsService.setSettings({
        company_id: b.company_id,
        department_id: b.department_id,
        manager_id: session.user.id,
        auto_approval_enabled: b.auto_approval_enabled,
        monthly_swap_limit: b.monthly_swap_limit as number | null,
        deadline_hours_before_shift: b.deadline_hours_before_shift as number | null,
        require_review_on_limit_exceeded: b.require_review_on_limit_exceeded,
        require_review_on_deadline_exceeded: b.require_review_on_deadline_exceeded,
      })
      return NextResponse.json({ success: true, settings })
    }

    return NextResponse.json({ success: false, message: 'Unsupported action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update shift swap settings'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
