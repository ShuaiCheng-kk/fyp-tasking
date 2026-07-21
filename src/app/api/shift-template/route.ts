// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftTemplateService } from '@/services/owner/shiftTemplateService'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const created_by = searchParams.get('created_by')

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!created_by) {
    return NextResponse.json({ success: false, message: 'created_by is required' }, { status: 400 })
  }

  try {
    const templates = await shiftTemplateService.listTemplates(company_id, created_by)
    return NextResponse.json({ success: true, templates })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch shift templates'
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

  const { company_id, name, start_time, end_time, created_by } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!name || typeof name !== 'string')
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  if (!start_time || typeof start_time !== 'string')
    return NextResponse.json({ success: false, message: 'start_time is required' }, { status: 400 })
  if (!end_time || typeof end_time !== 'string')
    return NextResponse.json({ success: false, message: 'end_time is required' }, { status: 400 })
  if (!created_by || typeof created_by !== 'string')
    return NextResponse.json({ success: false, message: 'created_by is required' }, { status: 400 })

  try {
    const template = await shiftTemplateService.createTemplate({
      company_id,
      name,
      start_time,
      end_time,
      created_by,
    })
    return NextResponse.json({ success: true, template }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create shift template'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
