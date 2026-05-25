import { NextRequest, NextResponse } from 'next/server'
import { managerRecruitmentService } from '@/services/manager/managerRecruitmentService'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/manager/recruitment/jobs/:id
// Body: any subset of job fields + optional { status: 'open' | 'closed' | 'archived' }
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 })

    const body = await req.json()

    const job = await managerRecruitmentService.updateJob(id, {
      ...(body.title               !== undefined && { title:               body.title }),
      ...(body.description         !== undefined && { description:         body.description }),
      ...(body.requirements        !== undefined && { requirements:        body.requirements }),
      ...(body.location            !== undefined && { location:            body.location }),
      ...(body.employment_type     !== undefined && { employment_type:     body.employment_type }),
      ...(body.is_recurring        !== undefined && { is_recurring:        body.is_recurring }),
      ...(body.recurrence_interval !== undefined && { recurrence_interval: body.recurrence_interval }),
      ...(body.recurrence_unit     !== undefined && { recurrence_unit:     body.recurrence_unit }),
      ...(body.company_name        !== undefined && { company_name:        body.company_name }),
      ...(body.industry            !== undefined && { industry:            body.industry }),
      ...(body.salary_amount       !== undefined && { salary_amount:       body.salary_amount }),
      ...(body.salary_type         !== undefined && { salary_type:         body.salary_type }),
      ...(body.status              !== undefined && { status:              body.status }),
    })

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