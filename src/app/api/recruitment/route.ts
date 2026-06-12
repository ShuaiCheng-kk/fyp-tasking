// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { recruitmentService } from '@/services/owner/recruitmentService'
import { JobPostingInput } from '@/types/Recruitment'

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
    if (resource === 'workers') {
      if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
      const workers = await recruitmentService.getCasualWorkers(company_id)
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
    const postings = await recruitmentService.getJobPostings(company_id)
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
    status: data.status === 'draft' ? 'draft' : 'open',
    shift_date: typeof data.shift_date === 'string' && data.shift_date ? data.shift_date : null,
    shift_start_time: typeof data.shift_start_time === 'string' && data.shift_start_time ? data.shift_start_time : null,
    shift_end_time: typeof data.shift_end_time === 'string' && data.shift_end_time ? data.shift_end_time : null,
    break_start_time: typeof data.break_start_time === 'string' && data.break_start_time ? data.break_start_time : null,
    break_end_time: typeof data.break_end_time === 'string' && data.break_end_time ? data.break_end_time : null,
    assigned_employee_id: typeof data.assigned_employee_id === 'string' && data.assigned_employee_id ? data.assigned_employee_id : null,
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
      const posting = await recruitmentService.editJobPosting(String(data.job_id ?? ''), {
        department_id: typeof data.department_id === 'string' && data.department_id ? data.department_id : null,
        title: typeof data.title === 'string' ? data.title : undefined,
        description: typeof data.description === 'string' ? data.description : undefined,
        requirements: typeof data.requirements === 'string' ? data.requirements : null,
        location: typeof data.location === 'string' ? data.location : null,
        employment_type: typeof data.employment_type === 'string' ? data.employment_type : null,
        salary_amount: typeof data.salary_amount === 'number' ? data.salary_amount : null,
        salary_type: typeof data.salary_type === 'string' ? data.salary_type : null,
        urgency: typeof data.urgency === 'string' ? data.urgency : null,
        estimated_hours: typeof data.estimated_hours === 'string' ? data.estimated_hours : null,
        is_recurring: typeof data.is_recurring === 'boolean' ? data.is_recurring : undefined,
        shift_date: typeof data.shift_date === 'string' ? data.shift_date : null,
        shift_start_time: typeof data.shift_start_time === 'string' ? data.shift_start_time : null,
        shift_end_time: typeof data.shift_end_time === 'string' ? data.shift_end_time : null,
        break_start_time: typeof data.break_start_time === 'string' ? data.break_start_time : null,
        break_end_time: typeof data.break_end_time === 'string' ? data.break_end_time : null,
        assigned_employee_id: typeof data.assigned_employee_id === 'string' ? data.assigned_employee_id : null,
      })
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

    if (action === 'publish_draft') {
      const posting = await recruitmentService.publishDraft(String(data.job_id ?? ''))
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
      const posting = await recruitmentService.rejectJobPosting(String(data.job_id ?? ''))
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
