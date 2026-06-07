import { NextRequest, NextResponse } from 'next/server'
import { managerRecruitmentService } from '@/services/manager/managerRecruitmentService'

// GET /api/manager/recruitment/jobs?company_id=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const company_id = searchParams.get('company_id')
    if (!company_id) return NextResponse.json({ success: false, error: 'company_id is required' }, { status: 400 })

    const jobs = await managerRecruitmentService.getJobsByCompany(company_id)
    return NextResponse.json({ success: true, jobs })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// POST /api/manager/recruitment/jobs
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { company_id, created_by, title, description } = body
    if (!company_id || !created_by || !title || !description) {
      return NextResponse.json(
        { success: false, error: 'company_id, created_by, title, and description are required' },
        { status: 400 }
      )
    }

    const job = await managerRecruitmentService.postJob({
      company_id,
      department_id:       body.department_id       ?? null,
      created_by,
      title,
      description,
      requirements:        body.requirements        ?? null,
      location:            body.location            ?? null,
      employment_type:     body.employment_type     ?? null,
      is_recurring:        body.is_recurring        ?? false,
      recurrence_interval: body.recurrence_interval ?? null,
      recurrence_unit:     body.recurrence_unit     ?? null,
      company_name:        body.company_name        ?? null,
      industry:            body.industry            ?? null,
      salary_amount:       body.salary_amount       ?? null,
      salary_type:         body.salary_type         ?? null,
      // Extended fields
      benefits:            body.benefits            ?? null,
      urgency:             body.urgency             ?? 'normal',
      openings:            body.openings            ?? 1,
      expires_at:          body.expires_at          ?? null,
      expiry_preset:       body.expiry_preset       ?? 'none',
      form_type:           body.formType            ?? null,
      // Shift-specific
      shift_start_time:    body.shift_start_time    ?? null,
      shift_end_time:      body.shift_end_time      ?? null,
      shift_days:          body.shift_days          ?? null,
      // One-off specific
      job_date:            body.job_date            ?? null,
      job_end_date:        body.job_end_date        ?? null,
      estimated_hours:     body.estimated_hours     ?? null,
    })

    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 })
  }
}