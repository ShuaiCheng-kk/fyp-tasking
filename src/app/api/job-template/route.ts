// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { jobTemplateService } from '@/services/owner/jobTemplateService'

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
    const templates = await jobTemplateService.listTemplates(company_id, created_by)
    return NextResponse.json({ success: true, templates })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch job templates'
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

  const { company_id, name, title, description, requirements, employment_type, form_type, department_id, salary_amount, salary_type, uniform_required, uniform_type, uniform_details, experience_required, minimum_age, estimated_hours, urgency, created_by } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!name || typeof name !== 'string')
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  if (!title || typeof title !== 'string')
    return NextResponse.json({ success: false, message: 'title is required' }, { status: 400 })
  if (!created_by || typeof created_by !== 'string')
    return NextResponse.json({ success: false, message: 'created_by is required' }, { status: 400 })

  try {
    const template = await jobTemplateService.createTemplate({
      company_id,
      name,
      title,
      description: typeof description === 'string' ? description : null,
      requirements: typeof requirements === 'string' ? requirements : null,
      employment_type: typeof employment_type === 'string' ? employment_type : null,
      form_type: typeof form_type === 'string' ? form_type : null,
      department_id: typeof department_id === 'string' && department_id ? department_id : null,
      salary_amount: typeof salary_amount === 'number' ? salary_amount : null,
      salary_type: typeof salary_type === 'string' ? salary_type : null,
      uniform_required: uniform_required === true,
      uniform_type: typeof uniform_type === 'string' && uniform_type ? uniform_type : null,
      uniform_details: typeof uniform_details === 'string' && uniform_details ? uniform_details : null,
      experience_required: typeof experience_required === 'string' && experience_required ? experience_required : null,
      minimum_age:
        typeof minimum_age === 'number' && Number.isInteger(minimum_age)
          ? minimum_age
          : typeof minimum_age === 'string' && minimum_age.trim() && !Number.isNaN(parseInt(minimum_age, 10))
            ? parseInt(minimum_age, 10)
            : null,
      estimated_hours: typeof estimated_hours === 'string' && estimated_hours ? estimated_hours : null,
      urgency: typeof urgency === 'string' && urgency ? urgency : null,
      created_by,
    })
    return NextResponse.json({ success: true, template }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create job template'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
