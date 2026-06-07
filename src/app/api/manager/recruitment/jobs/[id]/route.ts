import { NextRequest, NextResponse } from 'next/server'
import { managerRecruitmentService } from '@/services/manager/managerRecruitmentService'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/manager/recruitment/jobs/:id
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 })

    const body = await req.json()

    // Build update object — only include keys that were actually sent
    const updates: Record<string, any> = {}
    const fields = [
      'title', 'description', 'requirements', 'location', 'employment_type',
      'is_recurring', 'recurrence_interval', 'recurrence_unit',
      'company_name', 'industry', 'salary_amount', 'salary_type', 'status',
      // Extended fields
      'benefits', 'urgency', 'openings', 'expires_at', 'expiry_preset',
      'shift_start_time', 'shift_end_time', 'shift_days',
      'job_date', 'job_end_date', 'estimated_hours',
    ]
    for (const field of fields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }
    // formType comes in as 'formType' from the client, stored as 'form_type'
    if (body.formType !== undefined) updates.form_type = body.formType

    const job = await managerRecruitmentService.updateJob(id, updates)
    return NextResponse.json({ success: true, job })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 })
  }
}

// DELETE /api/manager/recruitment/jobs/:id
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 })

    await managerRecruitmentService.deleteJob(id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 })
  }
}