// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { jobTemplateService } from '@/services/owner/jobTemplateService'
import { taskService } from '@/services/owner/taskService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  // Manager Recruitment page scope: same manager_scope_id resolution as /api/task-template —
  // company-wide (Owner/Partner) templates excluded, only this manager's own department's shown.
  const manager_scope_id = searchParams.get('manager_scope_id') ?? undefined

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own company\'s templates' }, { status: 403 })
  }

  try {
    const managerScope = manager_scope_id ? await taskService.getManagerTeamScope(company_id, manager_scope_id) : null
    const templates = await jobTemplateService.listTemplates(company_id, managerScope?.departmentIds)
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

  const { company_id, title, responsibilities, skills, job_type, department_id, salary_amount, uniform_type, uniform_details, experience_required, minimum_age, estimated_hours, urgency } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!title || typeof title !== 'string')
    return NextResponse.json({ success: false, message: 'title is required' }, { status: 400 })

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only manage your own company\'s templates' }, { status: 403 })
  }

  try {
    const template = await jobTemplateService.createTemplate({
      company_id,
      title,
      responsibilities: typeof responsibilities === 'string' ? responsibilities : null,
      skills: typeof skills === 'string' ? skills : null,
      job_type: typeof job_type === 'string' ? job_type : null,
      department_id: typeof department_id === 'string' && department_id ? department_id : null,
      salary_amount: typeof salary_amount === 'number' ? salary_amount : null,
      uniform_type: typeof uniform_type === 'string' && uniform_type ? uniform_type : 'none',
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
      created_by: session.user.id,
    })
    return NextResponse.json({ success: true, template }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create job template'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
