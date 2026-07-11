// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { recruitmentService } from '@/services/owner/recruitmentService'
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
      const applicants = await recruitmentService.getApplicants(job_id)
      return NextResponse.json({ success: true, applicants })
    }
    if (resource === 'job_posting') {
      if (!job_id) return NextResponse.json({ success: false, message: 'job_id is required' }, { status: 400 })
      const posting = await recruitmentService.getJobPostingById(job_id)
      if (!posting) return NextResponse.json({ success: false, message: 'Job posting not found' }, { status: 404 })
      return NextResponse.json({ success: true, posting })
    }
    if (resource === 'workers') {
      if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
      const assigned_employee_id = searchParams.get('assigned_employee_id')
      const workers = assigned_employee_id
        ? await recruitmentService.getAcceptedCasualWorkersForEmployee(company_id, assigned_employee_id)
        : await recruitmentService.getCasualWorkers(company_id)
      return NextResponse.json({ success: true, workers })
    }
    if (resource === 'pending_approval') {
      if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
      const pendingPostings = await recruitmentService.getPendingApprovalPostings(company_id)
      return NextResponse.json({ success: true, pendingPostings })
    }
    if (resource === 'drafts') {
      const user_id = searchParams.get('user_id')
      if (!company_id || !user_id) return NextResponse.json({ success: false, message: 'company_id and user_id are required' }, { status: 400 })
      const drafts = await recruitmentService.getDraftPostings(company_id, user_id)
      return NextResponse.json({ success: true, drafts })
    }
    if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
    const department_id = searchParams.get('department_id')
    const manager_id = searchParams.get('manager_id')
    let postings
    if (manager_id) {
      postings = await recruitmentService.getJobPostingsForManager(company_id, manager_id)
    } else if (department_id) {
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
    description: typeof data.description === 'string' ? data.description : '',
    requirements: typeof data.requirements === 'string' && data.requirements ? data.requirements : null,
    location: typeof data.location === 'string' && data.location ? data.location : null,
    employment_type: typeof data.employment_type === 'string' && data.employment_type ? data.employment_type : null,
    company_name: typeof data.company_name === 'string' && data.company_name ? data.company_name : null,
    industry: typeof data.industry === 'string' && data.industry ? data.industry : null,
    salary_amount: typeof data.salary_amount === 'number' ? data.salary_amount : null,
    salary_type: typeof data.salary_type === 'string' && data.salary_type ? data.salary_type : 'per hour',
    urgency: typeof data.urgency === 'string' && data.urgency ? data.urgency : null,
    estimated_hours: typeof data.estimated_hours === 'string' && data.estimated_hours ? data.estimated_hours : null,
    is_recurring: data.is_recurring === true,
    recurrence_interval: typeof data.recurrence_interval === 'number' ? data.recurrence_interval : null,
    recurrence_unit: typeof data.recurrence_unit === 'string' && data.recurrence_unit ? data.recurrence_unit : null,
    status: data.status === 'draft' ? 'draft' : data.status === 'pending_approval' ? 'pending_approval' : 'open',
    shift_date: typeof data.shift_date === 'string' && data.shift_date ? data.shift_date : null,
    shift_start_time: typeof data.shift_start_time === 'string' && data.shift_start_time ? data.shift_start_time : null,
    shift_end_time: typeof data.shift_end_time === 'string' && data.shift_end_time ? data.shift_end_time : null,
    break_start_time: typeof data.break_start_time === 'string' && data.break_start_time ? data.break_start_time : null,
    break_end_time: typeof data.break_end_time === 'string' && data.break_end_time ? data.break_end_time : null,
    job_start_time: typeof data.job_start_time === 'string' && data.job_start_time ? data.job_start_time : null,
    assigned_employee_id: typeof data.assigned_employee_id === 'string' && data.assigned_employee_id ? data.assigned_employee_id : null,
    form_type: typeof data.formType === 'string' && data.formType ? data.formType : null,
    expires_at: typeof data.expires_at === 'string' && data.expires_at ? data.expires_at : null,
    template_id: typeof data.template_id === 'string' && data.template_id ? data.template_id : null,
    experience_required: typeof data.experience_required === 'string' && data.experience_required ? data.experience_required : null,
    minimum_age: parseNullableInt(data.minimum_age),
    openings: parseNullableInt(data.openings),
    uniform_required: data.uniform_required === true,
    uniform_type: typeof data.uniform_type === 'string' && data.uniform_type ? data.uniform_type : null,
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
      if ('description' in data && typeof data.description === 'string') patch.description = data.description
      if ('requirements' in data) patch.requirements = nullableString(data.requirements)
      if ('location' in data) patch.location = nullableString(data.location)
      if ('employment_type' in data) patch.employment_type = nullableString(data.employment_type)
      if ('salary_amount' in data) patch.salary_amount = typeof data.salary_amount === 'number' ? data.salary_amount : null
      if ('salary_type' in data) patch.salary_type = nullableString(data.salary_type)
      if ('urgency' in data) patch.urgency = nullableString(data.urgency)
      if ('estimated_hours' in data) patch.estimated_hours = nullableString(data.estimated_hours)
      if ('is_recurring' in data && typeof data.is_recurring === 'boolean') patch.is_recurring = data.is_recurring
      if ('shift_date' in data) patch.shift_date = nullableString(data.shift_date)
      if ('shift_start_time' in data) patch.shift_start_time = nullableString(data.shift_start_time)
      if ('shift_end_time' in data) patch.shift_end_time = nullableString(data.shift_end_time)
      if ('break_start_time' in data) patch.break_start_time = nullableString(data.break_start_time)
      if ('break_end_time' in data) patch.break_end_time = nullableString(data.break_end_time)
      if ('job_start_time' in data) patch.job_start_time = nullableString(data.job_start_time)
      if ('assigned_employee_id' in data) patch.assigned_employee_id = nullableString(data.assigned_employee_id)
      if ('expires_at' in data) patch.expires_at = nullableString(data.expires_at)
      if ('experience_required' in data) patch.experience_required = nullableString(data.experience_required)
      if ('minimum_age' in data) patch.minimum_age = parseNullableInt(data.minimum_age)
      if ('openings' in data) patch.openings = parseNullableInt(data.openings)
      if ('uniform_required' in data && typeof data.uniform_required === 'boolean') patch.uniform_required = data.uniform_required
      if ('uniform_type' in data) patch.uniform_type = nullableString(data.uniform_type)
      if ('uniform_details' in data) patch.uniform_details = nullableString(data.uniform_details)

      const posting = await recruitmentService.editJobPosting(String(data.job_id ?? ''), patch)
      return NextResponse.json({ success: true, posting })
    }

    if (action === 'archive_posting') {
      const posting = await recruitmentService.archiveJobPosting(String(data.job_id ?? ''))
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
        message: typeof data.message === 'string' ? data.message : null,
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

    if (action === 'cancel_job') {
      await recruitmentService.cancelJob({
        job_id: String(data.job_id ?? ''),
        cancelled_by: String(data.cancelled_by ?? ''),
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
      await recruitmentService.deleteJobPosting(String(data.job_id ?? ''))
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
      const posting = await recruitmentService.rejectJobPosting(String(data.job_id ?? ''), rejection_reason)
      return NextResponse.json({ success: true, posting })
    }

    if (action === 'update_worker_status') {
      const worker_status = data.worker_status === 'active' || data.worker_status === 'inactive' || data.worker_status === 'blocked'
        ? data.worker_status
        : null
      if (!worker_status) return NextResponse.json({ success: false, message: 'worker_status is invalid' }, { status: 400 })
      await recruitmentService.updateCasualWorkerStatus({
        user_id: String(data.user_id ?? ''),
        worker_status,
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update recruitment data'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
