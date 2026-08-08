// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { offDaySettingsService } from '@/services/owner/offDaySettingsService'
import { getServerSessionUser } from '@/lib/serverAuth'

// CHANGE TYPE: Code only

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const resource = searchParams.get('resource')

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own company\'s settings' }, { status: 403 })
  }

  try {
    if (resource === 'quota') {
      const owner_id = searchParams.get('owner_id')
      if (!owner_id) return NextResponse.json({ success: false, message: 'owner_id is required' }, { status: 400 })
      const settings = await offDaySettingsService.getQuotaSettings(company_id, owner_id)
      return NextResponse.json({ success: true, settings })
    }

    if (resource === 'deadline') {
      const owner_id = searchParams.get('owner_id')
      if (!owner_id) return NextResponse.json({ success: false, message: 'owner_id is required' }, { status: 400 })
      const deadline = await offDaySettingsService.getDeadline(company_id, owner_id)
      return NextResponse.json({ success: true, deadline })
    }

    if (resource === 'my_quota') {
      const user_id = searchParams.get('user_id')
      if (!user_id) return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
      const max_days_per_week = await offDaySettingsService.getEffectiveQuota(company_id, user_id)
      return NextResponse.json({ success: true, max_days_per_week })
    }

    return NextResponse.json({ success: false, message: 'Unsupported resource' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch off-day settings'
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
    if (action === 'set_default_quota') {
      if (
        typeof b.company_id !== 'string' ||
        (b.role !== 'Manager' && b.role !== 'Employee') ||
        typeof b.max_days_per_week !== 'number'
      ) {
        return NextResponse.json({ success: false, message: 'company_id, role and max_days_per_week are required' }, { status: 400 })
      }
      if (session.user.company_id !== b.company_id) {
        return NextResponse.json({ success: false, message: 'You can only manage your own company\'s settings' }, { status: 403 })
      }
      const setting = await offDaySettingsService.setDefaultQuota({
        company_id: b.company_id,
        owner_id: session.user.id,
        role: b.role,
        max_days_per_week: b.max_days_per_week,
      })
      return NextResponse.json({ success: true, setting })
    }

    if (action === 'set_user_quota_override') {
      if (
        typeof b.company_id !== 'string' ||
        typeof b.user_id !== 'string' ||
        typeof b.max_days_per_week !== 'number'
      ) {
        return NextResponse.json({ success: false, message: 'company_id, user_id and max_days_per_week are required' }, { status: 400 })
      }
      if (session.user.company_id !== b.company_id) {
        return NextResponse.json({ success: false, message: 'You can only manage your own company\'s settings' }, { status: 403 })
      }
      const setting = await offDaySettingsService.setUserQuotaOverride({
        company_id: b.company_id,
        owner_id: session.user.id,
        user_id: b.user_id,
        max_days_per_week: b.max_days_per_week,
      })
      return NextResponse.json({ success: true, setting })
    }

    if (action === 'remove_user_quota_override') {
      if (typeof b.company_id !== 'string' || typeof b.user_id !== 'string') {
        return NextResponse.json({ success: false, message: 'company_id and user_id are required' }, { status: 400 })
      }
      if (session.user.company_id !== b.company_id) {
        return NextResponse.json({ success: false, message: 'You can only manage your own company\'s settings' }, { status: 403 })
      }
      await offDaySettingsService.removeUserQuotaOverride({
        company_id: b.company_id,
        owner_id: session.user.id,
        user_id: b.user_id,
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'set_deadline') {
      if (
        typeof b.company_id !== 'string' ||
        typeof b.deadline_weekday !== 'number' ||
        typeof b.deadline_time !== 'string'
      ) {
        return NextResponse.json({ success: false, message: 'company_id, deadline_weekday and deadline_time are required' }, { status: 400 })
      }
      if (session.user.company_id !== b.company_id) {
        return NextResponse.json({ success: false, message: 'You can only manage your own company\'s settings' }, { status: 403 })
      }
      const deadline = await offDaySettingsService.setDeadline({
        company_id: b.company_id,
        owner_id: session.user.id,
        deadline_weekday: b.deadline_weekday,
        deadline_time: b.deadline_time,
      })
      return NextResponse.json({ success: true, deadline })
    }

    return NextResponse.json({ success: false, message: 'Unsupported action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update off-day settings'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
