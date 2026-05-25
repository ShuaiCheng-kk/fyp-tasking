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
// Body: { company_id, department_id?, created_by, title, description, requirements?,
//         location?, employment_type?, is_recurring, recurrence_interval?, recurrence_unit?,
//         company_name?, industry?, salary_amount?, salary_type? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      company_id, department_id, created_by,
      title, description, requirements, location, employment_type,
      is_recurring, recurrence_interval, recurrence_unit,
      company_name, industry, salary_amount, salary_type,
    } = body

    if (!company_id || !created_by || !title || !description) {
      return NextResponse.json(
        { success: false, error: 'company_id, created_by, title, and description are required' },
        { status: 400 }
      )
    }

    const job = await managerRecruitmentService.postJob({
      company_id,
      department_id: department_id ?? null,
      created_by,
      title,
      description,
      requirements: requirements ?? null,
      location: location ?? null,
      employment_type: employment_type ?? null,
      is_recurring: is_recurring ?? false,
      recurrence_interval: recurrence_interval ?? null,
      recurrence_unit: recurrence_unit ?? null,
      company_name: company_name ?? null,
      industry: industry ?? null,
      salary_amount: salary_amount ?? null,
      salary_type: salary_type ?? 'per hour',
    })

    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 })
  }
}