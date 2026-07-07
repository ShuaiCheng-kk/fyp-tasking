// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftSwapSettingsService } from '@/services/owner/shiftSwapSettingsService'

// CHANGE TYPE: Code only

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const owner_id = searchParams.get('owner_id')

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!owner_id) {
    return NextResponse.json({ success: false, message: 'owner_id is required' }, { status: 400 })
  }

  try {
    const settings = await shiftSwapSettingsService.getSettings(company_id, owner_id)
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

  try {
    if (action === 'set_settings') {
      if (
        typeof b.company_id !== 'string' ||
        typeof b.owner_id !== 'string' ||
        typeof b.auto_approval_enabled !== 'boolean' ||
        (b.monthly_swap_limit !== null && typeof b.monthly_swap_limit !== 'number') ||
        (b.deadline_weekday !== null && typeof b.deadline_weekday !== 'number') ||
        (b.deadline_time !== null && typeof b.deadline_time !== 'string') ||
        typeof b.require_review_on_limit_exceeded !== 'boolean' ||
        typeof b.require_review_on_deadline_exceeded !== 'boolean'
      ) {
        return NextResponse.json({ success: false, message: 'company_id, owner_id, auto_approval_enabled, monthly_swap_limit, deadline_weekday, deadline_time, require_review_on_limit_exceeded and require_review_on_deadline_exceeded are required' }, { status: 400 })
      }
      const settings = await shiftSwapSettingsService.setSettings({
        company_id: b.company_id,
        owner_id: b.owner_id,
        auto_approval_enabled: b.auto_approval_enabled,
        monthly_swap_limit: b.monthly_swap_limit as number | null,
        deadline_weekday: b.deadline_weekday as number | null,
        deadline_time: b.deadline_time as string | null,
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
