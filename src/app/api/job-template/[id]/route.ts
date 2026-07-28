// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { jobTemplateService } from '@/services/owner/jobTemplateService'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

  try {
    await jobTemplateService.deleteTemplate(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete job template'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

  try {
    const body = await req.json()
    const template = await jobTemplateService.updateTemplate(id, {
      title: body.title,
      responsibilities: body.responsibilities,
      skills: body.skills,
      job_type: body.job_type,
      department_id: body.department_id,
      salary_amount: body.salary_amount,
      uniform_type: body.uniform_type,
      uniform_details: body.uniform_details,
      experience_required: body.experience_required,
      minimum_age:
        typeof body.minimum_age === 'number' && Number.isInteger(body.minimum_age)
          ? body.minimum_age
          : typeof body.minimum_age === 'string' && body.minimum_age.trim() && !Number.isNaN(parseInt(body.minimum_age, 10))
            ? parseInt(body.minimum_age, 10)
            : body.minimum_age === null ? null : undefined,
      estimated_hours: body.estimated_hours,
      urgency: body.urgency,
    })
    return NextResponse.json({ success: true, template })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update job template'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
