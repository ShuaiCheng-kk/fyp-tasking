// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { taskTemplateService } from '@/services/owner/taskTemplateService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    await taskTemplateService.deleteTemplate(id, session.user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete task template'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    const body = await req.json()
    const template = await taskTemplateService.updateTemplate(id, {
      department_id: body.department_id,
      title: body.title,
      description: body.description,
      priority: body.priority,
      sub_task_titles: body.sub_task_titles,
    }, session.user.id)
    return NextResponse.json({ success: true, template })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update task template'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
