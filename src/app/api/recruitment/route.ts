// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { recruitmentService } from '@/services/owner/recruitmentService'
import { taskService } from '@/services/owner/taskService'
import { JobPostingInput } from '@/types/Recruitment'

function parseNullableInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = parseInt(value, 10)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const job_id = searchParams.get('job_id')
  const resource = searchParams.get('resource')

  try {
    if (resource === 'applicants') {
      if (!job_id) return NextResponse.json({ success: false, message: 'job_id is required' }, { status: 400 })
      const viewer_id = searchParams.get('viewer_id')
      if (!viewer_id) return NextResponse.json({ success: false, message: 'viewer_id is required' }, { status: 400 })
      const applicants = await recruitmentService.getApplicants(job_id, viewer_id)
      return NextResponse.json({ success: true, applicants })
    }
    if (resource === 'job_posting') {
      if (!job_id) return NextResponse.json({ success: false, message: 'job_id is required' }, { status: 400 })
      const posting = await recruitmentService.getJobPostingById(job_id)
      if (!posting) return NextResponse.json({ success: false, message: 'Job posting not found' }, { status: 404 })
      return NextResponse.json({ success: true, posting })
    }
    if (resource === 'pool_workers') {
      if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
      // Manager scope: only workers verified in their own department(s) — same manager_scope_id
      // resolution as drafts/templates above.
      const manager_scope_id = searchParams.get('manager_scope_id') ?? undefined
      const managerScope = manager_scope_id ? await taskService.getManagerTeamScope(company_id, manager_scope_id) : null
      const poolWorkers = await recruitmentService.getPoolWorkers(company_id, managerScope?.departmentIds)
      return NextResponse.json({ success: true, poolWorkers })
    }
    if (resource === 'pending_approval') {
      if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
      const include_rejected = searchParams.get('include_rejected') === 'true'
      // Manager scope: same manager_scope_id resolution as drafts/templates/pool_workers above.
      const manager_scope_id = searchParams.get('manager_scope_id') ?? undefined
      const managerScope = manager_scope_id ? await taskService.getManagerTeamScope(company_id, manager_scope_id) : null
      const pendingPostings = await recruitmentService.getPendingApprovalPostings(company_id, include_rejected, managerScope?.departmentIds)
      return NextResponse.json({ success: true, pendingPostings })
    }
    if (resource === 'drafts') {
      if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
      // Manager Recruitment page scope: same manager_scope_id resolution as /api/task-template —
      // Owner/Partner drafts excluded. Unlike Templates, a Draft is never shared even within the
      // same department — it's a private in-progress scratchpad, so this Manager only ever sees
      // their own (see getDraftPostings' viewer_id filter).
      const manager_scope_id = searchParams.get('manager_scope_id') ?? undefined
      const managerScope = manager_scope_id ? await taskService.getManagerTeamScope(company_id, manager_scope_id) : null
      const drafts = await recruitmentService.getDraftPostings(company_id, managerScope?.departmentIds, manager_scope_id)
      return NextResponse.json({ success: true, drafts })
    }
    if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
    const department_id = searchParams.get('department_id')
    // Job Visibility: a Manager's own department-scoped view is filtered client-side by
    // department (see RecruitmentView's scopeToManagerDepartments) — not by creator, so it
    // includes Owner/Partner/other-Managers' postings in the department, not just their own.
    let postings
    if (department_id) {
      postings = await recruitmentService.getJobPostingsByDepartment(company_id, department_id)
    } else {
      postings = await recruitmentService.getJobPostings(company_id)
    }
    return NextResponse.json({ success: true, postings })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch recruitment data'
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

  const data = body as Record<string, unknown>
  const input: JobPostingInput = {
    company_id: typeof data.company_id === 'string' ? data.company_id : '',
    department_id: typeof data.department_id === 'string' && data.department_id ? data.department_id : null,
    created_by: typeof data.created_by === 'string' ? data.created_by : '',
    title: typeof data.title === 'string' ? data.title : '',
    responsibilities: typeof data.responsibilities === 'string' ? data.responsibilities : '',
    skills: typeof data.skills === 'string' && data.skills ? data.skills : null,
    salary_amount: typeof data.salary_amount === 'number' ? data.salary_amount : null,
    urgency: typeof data.urgency === 'string' && data.urgency ? data.urgency : null,
    estimated_hours: typeof data.estimated_hours === 'string' && data.estimated_hours ? data.estimated_hours : null,
    status: data.status === 'draft' ? 'draft' : data.status === 'pending_approval' ? 'pending_approval' : 'open',
    job_date: typeof data.job_date === 'string' && data.job_date ? data.job_date : null,
    job_start_time: typeof data.job_start_time === 'string' && data.job_start_time ? data.job_start_time : null,
    job_end_time: typeof data.job_end_time === 'string' && data.job_end_time ? data.job_end_time : null,
    break_start_time: typeof data.break_start_time === 'string' && data.break_start_time ? data.break_start_time : null,
    break_end_time: typeof data.break_end_time === 'string' && data.break_end_time ? data.break_end_time : null,
    assigned_employee_id: typeof data.assigned_employee_id === 'string' && data.assigned_employee_id ? data.assigned_employee_id : null,
    job_type: typeof data.jobType === 'string' && data.jobType ? data.jobType : null,
    expires_at: typeof data.expires_at === 'string' && data.expires_at ? data.expires_at : null,
    template_id: typeof data.template_id === 'string' && data.template_id ? data.template_id : null,
    experience_required: typeof data.experience_required === 'string' && data.experience_required ? data.experience_required : null,
    minimum_age: parseNullableInt(data.minimum_age),
    openings: parseNullableInt(data.openings),
    uniform_type: typeof data.uniform_type === 'string' && data.uniform_type ? data.uniform_type : 'none',
    uniform_details: typeof data.uniform_details === 'string' && data.uniform_details ? data.uniform_details : null,
  }

  try {
    const posting = await recruitmentService.createJobPosting(input)
    return NextResponse.json({ success: true, posting }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create job posting'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const data = body as Record<string, unknown>
  const action = data.action

  try {
    if (action === 'edit_posting') {
      // Absent key = leave the field untouched; only keys present in the payload are written.
      // (Nulling omitted fields would both clear data on partial updates and falsely trip the
      // locked-field check the service runs once a posting has applicants.)
      const patch: Partial<JobPostingInput> = {}
      const nullableString = (v: unknown) => (typeof v === 'string' && v ? v : null)
      if ('department_id' in data) patch.department_id = nullableString(data.department_id)
      if ('title' in data && typeof data.title === 'string') patch.title = data.title
      if ('responsibilities' in data && typeof data.responsibilities === 'string') patch.responsibilities = data.responsibilities
      if ('skills' in data) patch.skills = nullableString(data.skills)
      if ('salary_amount' in data) patch.salary_amount = typeof data.salary_amount === 'number' ? data.salary_amount : null
      if ('urgency' in data) patch.urgency = nullableString(data.urgency)
      if ('estimated_hours' in data) patch.estimated_hours = nullableString(data.estimated_hours)
      if ('job_date' in data) patch.job_date = nullableString(data.job_date)
      if ('job_start_time' in data) patch.job_start_time = nullableString(data.job_start_time)
      if ('job_end_time' in data) patch.job_end_time = nullableString(data.job_end_time)
      if ('break_start_time' in data) patch.break_start_time = nullableString(data.break_start_time)
      if ('break_end_time' in data) patch.break_end_time = nullableString(data.break_end_time)
      if ('assigned_employee_id' in data) patch.assigned_employee_id = nullableString(data.assigned_employee_id)
      if ('expires_at' in data) patch.expires_at = nullableString(data.expires_at)
      if ('experience_required' in data) patch.experience_required = nullableString(data.experience_required)
      if ('minimum_age' in data) patch.minimum_age = parseNullableInt(data.minimum_age)
      if ('openings' in data) patch.openings = parseNullableInt(data.openings)
      if ('uniform_type' in data) patch.uniform_type = typeof data.uniform_type === 'string' && data.uniform_type ? data.uniform_type : 'none'
      if ('uniform_details' in data) patch.uniform_details = nullableString(data.uniform_details)

      const posting = await recruitmentService.editJobPosting(String(data.job_id ?? ''), patch, typeof data.created_by === 'string' ? data.created_by : undefined)
      return NextResponse.json({ success: true, posting })
    }

    if (action === 'archive_posting') {
      const posting = await recruitmentService.archiveJobPosting(String(data.job_id ?? ''), typeof data.created_by === 'string' ? data.created_by : undefined)
      return NextResponse.json({ success: true, posting })
    }

    if (action === 'duplicate_posting') {
      const posting = await recruitmentService.duplicateJobPosting(
        String(data.job_id ?? ''),
        String(data.created_by ?? ''),
      )
      return NextResponse.json({ success: true, posting })
    }

    if (action === 'decide_applicant') {
      const decision = data.decision === 'accepted' ? 'accepted' : data.decision === 'rejected' ? 'rejected' : null
      if (!decision) return NextResponse.json({ success: false, message: 'decision must be accepted or rejected' }, { status: 400 })
      const applicant = await recruitmentService.decideApplicant({
        applicant_id: String(data.applicant_id ?? ''),
        decision,
        decided_by: String(data.decided_by ?? ''),
      })
      return NextResponse.json({ success: true, applicant })
    }

    if (action === 'remove_worker') {
      await recruitmentService.removeConfirmedWorker({
        job_id: String(data.job_id ?? ''),
        applicant_id: String(data.applicant_id ?? ''),
        removed_by: String(data.removed_by ?? ''),
        reason: typeof data.reason === 'string' ? data.reason : '',
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'publish_draft') {
      const posting = await recruitmentService.publishDraft(String(data.job_id ?? ''))
      return NextResponse.json({ success: true, posting })
    }

    if (action === 'submit_for_review') {
      const posting = await recruitmentService.submitForReview(String(data.job_id ?? ''))
      return NextResponse.json({ success: true, posting })
    }

    if (action === 'delete_draft') {
      await recruitmentService.deleteDraft(String(data.job_id ?? ''))
      return NextResponse.json({ success: true })
    }

    if (action === 'delete_posting') {
      await recruitmentService.deleteJobPosting(String(data.job_id ?? ''), typeof data.created_by === 'string' ? data.created_by : undefined)
      return NextResponse.json({ success: true })
    }

    if (action === 'unarchive_posting') {
      const posting = await recruitmentService.unarchiveJobPosting(String(data.job_id ?? ''))
      return NextResponse.json({ success: true, posting })
    }

    if (action === 'approve_posting') {
      const posting = await recruitmentService.approveJobPosting(String(data.job_id ?? ''))
      return NextResponse.json({ success: true, posting })
    }

    if (action === 'reject_posting') {
      const rejection_reason = typeof data.rejection_reason === 'string' ? data.rejection_reason : ''
      const posting = await recruitmentService.rejectJobPosting(String(data.job_id ?? ''), rejection_reason, String(data.rejected_by ?? ''))
      return NextResponse.json({ success: true, posting })
    }

    if (action === 'invite_pool_workers') {
      const user_ids = Array.isArray(data.user_ids) ? data.user_ids.map(String) : []
      const results = await recruitmentService.invitePoolWorkers({
        job_id: String(data.job_id ?? ''),
        user_ids,
        sent_by: String(data.sent_by ?? ''),
      })
      return NextResponse.json({ success: true, results })
    }

    return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update recruitment data'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
