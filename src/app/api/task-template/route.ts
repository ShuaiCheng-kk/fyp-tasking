// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { taskTemplateService } from '@/services/owner/taskTemplateService'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  try {
    const templates = await taskTemplateService.listTemplates(company_id)
    return NextResponse.json({ success: true, templates })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch task templates'
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

  const { company_id, name, title, description, priority, sub_task_titles, created_by } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!name || typeof name !== 'string')
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  if (!title || typeof title !== 'string')
    return NextResponse.json({ success: false, message: 'title is required' }, { status: 400 })
  if (!created_by || typeof created_by !== 'string')
    return NextResponse.json({ success: false, message: 'created_by is required' }, { status: 400 })

  try {
    const template = await taskTemplateService.createTemplate({
      company_id,
      name,
      title,
      description: typeof description === 'string' ? description : null,
      priority: typeof priority === 'string' ? priority : null,
      sub_task_titles: Array.isArray(sub_task_titles) ? sub_task_titles.filter((t): t is string => typeof t === 'string') : undefined,
      created_by,
    })
    return NextResponse.json({ success: true, template }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create task template'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
