// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { ApplicantCertificateSnapshot, CasualWorkerStatus, JobApplicant, JobInvitation, JobPosting, JobPostingInput, JobPostingPendingApproval, PoolWorker } from '@/types/Recruitment'

export const recruitmentRepository = {
  async getPublicJobPostings(): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as JobPosting[]
  },

  async getJobPostingsByCompany(company_id: string): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', company_id)
      .not('status', 'in', '("pending_approval","draft")')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as JobPosting[]
  },

  async getJobPostingsByDepartment(company_id: string, department_id: string): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
      .not('status', 'in', '("pending_approval","draft")')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as JobPosting[]
  },

  async getDraftPostings(company_id: string, user_id: string): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', company_id)
      .eq('created_by', user_id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as JobPosting[]
  },

  async getPendingApprovalPostings(company_id: string): Promise<JobPostingPendingApproval[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', company_id)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    const postings = (data ?? []) as JobPosting[]

    const deptIds = [...new Set(postings.map(p => p.department_id).filter((id): id is string => Boolean(id)))]
    let deptMap = new Map<string, string>()
    if (deptIds.length > 0) {
      const { data: depts } = await supabase.from('departments').select('id, name').in('id', deptIds)
      deptMap = new Map((depts ?? []).map((d: { id: string; name: string }) => [d.id, d.name]))
    }

    const allUserIds = [...new Set([
      ...postings.map(p => p.created_by),
      ...postings.map(p => p.assigned_employee_id).filter((id): id is string => Boolean(id)),
    ].filter(Boolean))]
    let userMap = new Map<string, { full_name: string; profile_photo_url: string | null }>()
    if (allUserIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, full_name, profile_photo_url').in('id', allUserIds)
      userMap = new Map((users ?? []).map((u: { id: string; full_name: string; profile_photo_url: string | null }) => [u.id, { full_name: u.full_name, profile_photo_url: u.profile_photo_url }]))
    }

    return postings.map(p => ({
      ...p,
      department_name: p.department_id ? deptMap.get(p.department_id) ?? null : null,
      submitter_name: userMap.get(p.created_by)?.full_name ?? null,
      submitter_photo_url: userMap.get(p.created_by)?.profile_photo_url ?? null,
      assigned_employee_name: p.assigned_employee_id ? userMap.get(p.assigned_employee_id)?.full_name ?? null : null,
    }))
  },

  async approveJobPosting(id: string): Promise<JobPosting> {
    const { data, error } = await supabase
      .from('job_postings')
      .update({ status: 'open' })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as JobPosting
  },

  async rejectJobPosting(id: string, rejection_reason: string): Promise<JobPosting> {
    const { data, error } = await supabase
      .from('job_postings')
      .update({ status: 'rejected', rejection_reason })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as JobPosting
  },

  async getJobPostingById(id: string): Promise<JobPosting | null> {
    // Company profile fields are joined live (same shape as /api/jobs/public) so detail views
    // can render the Company Profile section; job_postings itself only snapshots company_name.
    const { data, error } = await supabase
      .from('job_postings')
      .select('*, departments(name), companies(location, description, size, address, industry)')
      .eq('id', id)
      .single()
    if (error) return null
    const { departments, companies, ...rest } = data as any
    const dept = Array.isArray(departments) ? departments[0] : departments
    const co = Array.isArray(companies) ? companies[0] : companies
    return {
      ...rest,
      department_name: dept?.name ?? null,
      company_location: co?.location ?? null,
      company_description: co?.description ?? null,
      company_size: co?.size ?? null,
      company_address: co?.address ?? null,
      company_industry: co?.industry ?? null,
    } as JobPosting
  },

  async createJobPosting(input: JobPostingInput): Promise<JobPosting> {
    const { data, error } = await supabase
      .from('job_postings')
      .insert({
        company_id: input.company_id,
        department_id: input.department_id ?? null,
        created_by: input.created_by,
        title: input.title,
        description: input.description,
        requirements: input.requirements ?? null,
        location: input.location ?? null,
        employment_type: input.employment_type ?? null,
        company_name: input.company_name ?? null,
        industry: input.industry ?? null,
        salary_amount: input.salary_amount ?? null,
        salary_type: input.salary_type ?? 'per hour',
        urgency: input.urgency ?? null,
        estimated_hours: input.estimated_hours ?? null,
        is_recurring: input.is_recurring ?? false,
        recurrence_interval: input.recurrence_interval ?? null,
        recurrence_unit: input.recurrence_unit ?? null,
        status: input.status ?? 'open',
        shift_date: input.shift_date ?? null,
        shift_start_time: input.shift_start_time ?? null,
        shift_end_time: input.shift_end_time ?? null,
        break_start_time: input.break_start_time ?? null,
        break_end_time: input.break_end_time ?? null,
        job_start_time: input.job_start_time ?? null,
        assigned_employee_id: input.assigned_employee_id ?? null,
        form_type: input.form_type ?? null,
        expires_at: input.expires_at ?? null,
        template_id: input.template_id ?? null,
        experience_required: input.experience_required ?? null,
        minimum_age: input.minimum_age ?? null,
        openings: input.openings ?? null,
        uniform_required: input.uniform_required ?? false,
        uniform_type: input.uniform_type ?? null,
        uniform_details: input.uniform_details ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as JobPosting
  },

  async deleteJobPosting(id: string): Promise<void> {
    const { error } = await supabase.from('job_postings').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async updateJobPosting(id: string, fields: Partial<JobPostingInput> & { status?: string; archived_at?: string | null; archived_from_status?: string | null }): Promise<JobPosting> {
    const { data, error } = await supabase
      .from('job_postings')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as JobPosting
  },

  // Lazily run on-read (there is no cron/job-runner in this app — same pattern as
  // autoExpireSwapRequestIfNeeded in attendanceService) — flips any 'open' posting whose deadline
  // has passed to 'archived', the same terminal state the manual Archive action already produces.
  // Scoping to company_id keeps the owner/manager dashboard sweep cheap; omit it to sweep globally
  // (used by the public job board, which has no company context).
  async sweepExpiredJobPostings(company_id?: string): Promise<void> {
    let query = supabase
      .from('job_postings')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('status', 'open')
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString())
    if (company_id) query = query.eq('company_id', company_id)
    const { error } = await query
    if (error) throw new Error(error.message)
  },

  // Workers whose two-way confirmation is complete (invitation accepted) — the people an
  // employer-side cancellation has to notify.
  async getConfirmedWorkersByJob(job_id: string): Promise<{
    invitation_id: string
    applicant_id: string
    user_id: string
    full_name: string
    email_address: string
  }[]> {
    const { data, error } = await supabase
      .from('job_invitations')
      .select('id, applicant_id, job_applicants!inner(user_id, users(full_name, email_address))')
      .eq('job_id', job_id)
      .eq('status', 'accepted')
    if (error) throw new Error(error.message)
    return (data ?? []).map(row => {
      const r = row as unknown as { id: string; applicant_id: string; job_applicants: { user_id: string; users: { full_name: string; email_address: string } | null } }
      return {
        invitation_id: r.id,
        applicant_id: r.applicant_id,
        user_id: r.job_applicants.user_id,
        full_name: r.job_applicants.users?.full_name ?? '',
        email_address: r.job_applicants.users?.email_address ?? '',
      }
    })
  },

  async setApplicantStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('job_applicants')
      .update({ status, decided_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async cancelAcceptedInvitationByApplicant(applicant_id: string): Promise<void> {
    const { error } = await supabase
      .from('job_invitations')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('applicant_id', applicant_id)
      .eq('status', 'accepted')
    if (error) throw new Error(error.message)
  },

  // Rescinds an offer the worker hasn't responded to yet (invitation still 'sent') — used when the
  // Owner reverses an earlier Accept before the worker confirms. Without this the stale invitation
  // would stay 'sent' forever, letting the worker still confirm a rescinded offer.
  async cancelSentInvitationByApplicant(applicant_id: string): Promise<void> {
    const { error } = await supabase
      .from('job_invitations')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('applicant_id', applicant_id)
      .eq('status', 'sent')
    if (error) throw new Error(error.message)
  },

  async cancelOpenInvitationsForJob(job_id: string): Promise<void> {
    const { error } = await supabase
      .from('job_invitations')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('job_id', job_id)
      .in('status', ['sent', 'accepted'])
    if (error) throw new Error(error.message)
  },

  async markPendingApplicantsJobClosed(job_id: string): Promise<void> {
    const { error } = await supabase
      .from('job_applicants')
      .update({ status: 'job_closed', decided_at: new Date().toISOString() })
      .eq('job_id', job_id)
      .eq('status', 'pending')
    if (error) throw new Error(error.message)
  },

  async getEmployeeShiftOnDate(user_id: string, company_id: string, shift_date: string): Promise<{
    start_time: string
    end_time: string
  } | null> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('shifts!inner(start_time, end_time, shift_date, company_id, status)')
      .eq('user_id', user_id)
      .eq('shifts.company_id', company_id)
      .eq('shifts.shift_date', shift_date)
      .neq('shifts.status', 'cancelled')
      .limit(1)
    if (error) throw new Error(error.message)
    const row = data?.[0] as unknown as { shifts: { start_time: string; end_time: string } } | undefined
    return row?.shifts ?? null
  },

  async getShiftsForJobWorker(job_id: string, user_id: string): Promise<{
    id: string
    shift_date: string
    start_time: string
    status: string
  }[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('shifts!inner(id, shift_date, start_time, status, source_job_posting_id)')
      .eq('user_id', user_id)
      .eq('shifts.source_job_posting_id', job_id)
    if (error) throw new Error(error.message)
    return (data ?? []).map(row => (row as unknown as { shifts: never }).shifts)
  },

  async cancelShiftsByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const { error } = await supabase.from('shifts').update({ status: 'cancelled' }).in('id', ids)
    if (error) throw new Error(error.message)
  },

  async cancelFutureShiftsForJob(job_id: string, fromDateKey: string): Promise<void> {
    const { error } = await supabase
      .from('shifts')
      .update({ status: 'cancelled' })
      .eq('source_job_posting_id', job_id)
      .gte('shift_date', fromDateKey)
      .neq('status', 'cancelled')
    if (error) throw new Error(error.message)
  },

  async insertRecruitmentCancellation(input: {
    job_id: string
    applicant_id: string | null
    cancelled_by: string
    cancelled_role: 'worker' | 'employer'
    scope: 'worker' | 'job'
    reason: string | null
  }): Promise<void> {
    const { error } = await supabase.from('recruitment_cancellations').insert(input)
    if (error) throw new Error(error.message)
  },

  async reopenJobPosting(job_id: string): Promise<void> {
    const { error } = await supabase
      .from('job_postings')
      .update({ status: 'open', archived_at: null })
      .eq('id', job_id)
    if (error) throw new Error(error.message)
  },

  // How many times each of these users has cancelled a confirmed shift before — history the
  // employer can weigh, deliberately NOT a rating system.
  async getWorkerCancellationCounts(user_ids: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    if (user_ids.length === 0) return counts
    const { data, error } = await supabase
      .from('recruitment_cancellations')
      .select('cancelled_by')
      .eq('cancelled_role', 'worker')
      .in('cancelled_by', user_ids)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const id = (row as { cancelled_by: string }).cancelled_by
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  },

  // Caches one applicant's AI match result — ai_summary holds the structured recommendation as
  // JSON text so a later page open can rebuild it without another OpenAI call.
  async updateApplicantAI(id: string, ai_score: number | null, ai_summary: string): Promise<void> {
    const { error } = await supabase
      .from('job_applicants')
      .update({ ai_score, ai_summary, ai_computed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async getApplicantsByJob(job_id: string): Promise<JobApplicant[]> {
    const { data, error } = await supabase
      .from('job_applicants')
      .select('*, users(full_name, email_address, phone_number, profile_photo_url), job_invitations(status, sent_at)')
      .eq('job_id', job_id)
      // A withdrawn application means the worker walked away (withdrew, or declined the offer)
      // — nothing left for the employer to act on, so it's dropped from their list.
      .neq('status', 'withdrawn')
      .order('applied_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapApplicantRow)
  },

  async getApplicantCounts(job_ids: string[]): Promise<{ job_id: string; status: string; invitation_status: string | null }[]> {
    if (job_ids.length === 0) return []
    const { data, error } = await supabase
      .from('job_applicants')
      .select('job_id, status, job_invitations(status)')
      .in('job_id', job_ids)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => {
      const invitations = row.job_invitations as unknown as { status: string }[] | null | undefined
      return {
        job_id: row.job_id as string,
        status: row.status as string,
        invitation_status: invitations && invitations.length > 0 ? invitations[invitations.length - 1].status : null,
      }
    })
  },

  async getApplicantById(id: string): Promise<JobApplicant | null> {
    const { data, error } = await supabase
      .from('job_applicants')
      .select('*, users(full_name, email_address), job_invitations(status, sent_at)')
      .eq('id', id)
      .single()
    if (error) return null
    return mapApplicantRow(data)
  },

  async updateApplicantStatus(id: string, status: 'accepted' | 'rejected'): Promise<JobApplicant> {
    const { data, error } = await supabase
      .from('job_applicants')
      // Accepting isn't the end of the road — the offer that follows carries its own sent_at, and
      // the application stays live until the worker answers it. Only a rejection resolves the
      // application here, so only that stamps decided_at.
      .update(status === 'rejected'
        ? { status, decided_at: new Date().toISOString() }
        : { status })
      .eq('id', id)
      .select('*, users(full_name, email_address)')
      .single()
    if (error) throw new Error(error.message)
    return mapApplicantRow(data)
  },

  async createJobInvitation(input: {
    job_id: string
    applicant_id: string
    sent_by: string
    message?: string | null
  }): Promise<JobInvitation> {
    const { data, error } = await supabase
      .from('job_invitations')
      .insert({
        job_id: input.job_id,
        applicant_id: input.applicant_id,
        sent_by: input.sent_by,
        message: input.message ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as JobInvitation
  },

  async getDepartmentsByIds(ids: string[]): Promise<{ id: string; name: string }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as { id: string; name: string }[]
  },

  async getUsersByIds(ids: string[]): Promise<{ id: string; full_name: string; profile_photo_url: string | null }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, profile_photo_url')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as { id: string; full_name: string; profile_photo_url: string | null }[]
  },

  async getManagerDepartmentIds(manager_id: string, company_id: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('department_id')
      .eq('manager_id', manager_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r: { department_id: string }) => r.department_id)
  },

  async getJobPostingsByManagerDepts(company_id: string, department_ids: string[]): Promise<JobPosting[]> {
    if (department_ids.length === 0) return []
    const { data: managerUsers, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', company_id)
      .eq('role', 'Manager')
    if (userError) throw new Error(userError.message)
    const managerIds = (managerUsers ?? []).map((u: { id: string }) => u.id)
    if (managerIds.length === 0) return []
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', company_id)
      .in('department_id', department_ids)
      .in('created_by', managerIds)
      .not('status', 'in', '("draft")')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as JobPosting[]
  },

  async getCasualWorkersByCompany(company_id: string): Promise<CasualWorkerStatus[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email_address, worker_status')
      .eq('company_id', company_id)
      .eq('role', 'Casual Worker')
      .order('full_name', { ascending: true })
    if (error) throw new Error(error.message)

    const workers = (data ?? []) as Array<{ id: string; full_name: string; email_address: string; worker_status: string | null }>

    return workers.map(worker => ({
      id: worker.id,
      full_name: worker.full_name,
      email_address: worker.email_address,
      department_id: null,
      department_name: null,
      worker_status: (worker.worker_status as CasualWorkerStatus['worker_status']) ?? 'active',
    }))
  },

  async getAcceptedCasualWorkersByAssignedEmployee(company_id: string, employee_id: string): Promise<CasualWorkerStatus[]> {
    const { data: postings, error: postingError } = await supabase
      .from('job_postings')
      .select('id, department_id')
      .eq('company_id', company_id)
      .eq('assigned_employee_id', employee_id)
      .not('status', 'in', '("pending_approval","draft","rejected")')
    if (postingError) throw new Error(postingError.message)

    const jobDeptMap = new Map((postings ?? []).map((posting: { id: string; department_id: string | null }) => [posting.id, posting.department_id]))
    const jobIds = [...jobDeptMap.keys()]
    if (jobIds.length === 0) return []

    const { data: applicants, error: applicantError } = await supabase
      .from('job_applicants')
      .select('job_id, user_id')
      .in('job_id', jobIds)
      .eq('status', 'accepted')
      .not('user_id', 'is', null)
    if (applicantError) throw new Error(applicantError.message)

    const workerIds = [...new Set((applicants ?? []).map((applicant: { user_id: string | null }) => applicant.user_id).filter((id): id is string => Boolean(id)))]
    if (workerIds.length === 0) return []

    const workerDeptMap = new Map<string, string | null>()
    for (const applicant of (applicants ?? []) as Array<{ job_id: string; user_id: string | null }>) {
      if (applicant.user_id && !workerDeptMap.has(applicant.user_id)) {
        workerDeptMap.set(applicant.user_id, jobDeptMap.get(applicant.job_id) ?? null)
      }
    }

    const { data: workersData, error: workerError } = await supabase
      .from('users')
      .select('id, full_name, email_address, worker_status')
      .in('id', workerIds)
      .eq('company_id', company_id)
      .eq('role', 'Casual Worker')
      .order('full_name', { ascending: true })
    if (workerError) throw new Error(workerError.message)

    const deptIds = [...new Set([...workerDeptMap.values()].filter((id): id is string => Boolean(id)))]
    const { data: departmentData, error: departmentError } = deptIds.length > 0
      ? await supabase.from('departments').select('id, name').in('id', deptIds)
      : { data: [], error: null }
    if (departmentError) throw new Error(departmentError.message)

    const deptMap = new Map(((departmentData ?? []) as Array<{ id: string; name: string }>).map(department => [department.id, department.name]))
    const workers = (workersData ?? []) as Array<{ id: string; full_name: string; email_address: string; worker_status: string | null }>

    return workers.map(worker => {
      const deptId = workerDeptMap.get(worker.id) ?? null
      return {
        id: worker.id,
        full_name: worker.full_name,
        email_address: worker.email_address,
        department_id: deptId,
        department_name: deptId ? deptMap.get(deptId) ?? null : null,
        worker_status: (worker.worker_status as CasualWorkerStatus['worker_status']) ?? 'active',
      }
    })
  },

  async getClosedPostingsByDateRange(company_id: string, date_from: string, date_to: string): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', company_id)
      .in('status', ['closed', 'archived'])
      .gte('created_at', `${date_from}T00:00:00`)
      .lte('created_at', `${date_to}T23:59:59`)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as JobPosting[]
  },

  async updateCasualWorkerStatus(user_id: string, worker_status: 'active' | 'inactive' | 'blocked'): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ worker_status })
      .eq('id', user_id)
      .eq('role', 'Casual Worker')
    if (error) throw new Error(error.message)
  },

  // The company's verified worker pool: Casual Workers who have actually completed a shift here
  // (verified_at) and are not banned (blocked_at). Enriched with how many shifts they've finished
  // so the Owner can pick the regulars they trust.
  async getVerifiedPoolWorkers(company_id: string): Promise<PoolWorker[]> {
    const { data: cwdRows, error: cwdErr } = await supabase
      .from('casualworker_departments')
      .select('casual_worker_id, department_id, verified_at, departments(name)')
      .eq('company_id', company_id)
      .not('verified_at', 'is', null)
      .is('blocked_at', null)
    if (cwdErr) throw new Error(cwdErr.message)
    if (!cwdRows || cwdRows.length === 0) return []

    // A worker can sit in more than one department of the same company — keep the earliest
    // verification (when they first proved themselves here).
    const byWorker = new Map<string, { department_id: string | null; department_name: string | null; verified_at: string }>()
    for (const row of cwdRows as any[]) {
      const existing = byWorker.get(row.casual_worker_id)
      if (!existing || row.verified_at < existing.verified_at) {
        byWorker.set(row.casual_worker_id, {
          department_id: row.department_id ?? null,
          department_name: Array.isArray(row.departments) ? (row.departments[0]?.name ?? null) : (row.departments?.name ?? null),
          verified_at: row.verified_at,
        })
      }
    }
    const workerIds = [...byWorker.keys()]

    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, full_name, email_address, phone_number, profile_photo_url, skills')
      .in('id', workerIds)
      .eq('role', 'Casual Worker')
    if (usersErr) throw new Error(usersErr.message)

    // Completed shifts for THIS company — attendance rows with a clock-out, reached through the
    // shift they belong to (attendance_records has no company_id of its own).
    const { data: attendance, error: attErr } = await supabase
      .from('attendance_records')
      .select('casual_worker_id, clock_out_time, shift_assignments!inner(shifts!inner(company_id, shift_date))')
      .in('casual_worker_id', workerIds)
      .not('clock_out_time', 'is', null)
      .eq('shift_assignments.shifts.company_id', company_id)
    if (attErr) throw new Error(attErr.message)

    const stats = new Map<string, { count: number; last: string | null }>()
    for (const row of (attendance ?? []) as any[]) {
      const shift = row.shift_assignments?.shifts
      const date = Array.isArray(shift) ? shift[0]?.shift_date : shift?.shift_date
      const current = stats.get(row.casual_worker_id) ?? { count: 0, last: null }
      current.count += 1
      if (date && (!current.last || date > current.last)) current.last = date
      stats.set(row.casual_worker_id, current)
    }

    return ((users ?? []) as any[]).map(user => {
      const meta = byWorker.get(user.id)!
      const stat = stats.get(user.id) ?? { count: 0, last: null }
      return {
        id: user.id,
        full_name: user.full_name,
        email_address: user.email_address,
        phone_number: user.phone_number ?? null,
        profile_photo_url: user.profile_photo_url ?? null,
        skills: user.skills ?? null,
        department_id: meta.department_id,
        department_name: meta.department_name,
        verified_at: meta.verified_at,
        completed_shifts: stat.count,
        last_worked_date: stat.last,
      }
    }).sort((a, b) => b.completed_shifts - a.completed_shifts || a.full_name.localeCompare(b.full_name))
  },

  async getApplicantByJobAndUser(job_id: string, user_id: string): Promise<JobApplicant | null> {
    const { data, error } = await supabase
      .from('job_applicants')
      .select('*')
      .eq('job_id', job_id)
      .eq('user_id', user_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as JobApplicant | null) ?? null
  },

  // The Owner hand-picking a pool worker still needs a job_applicants row — job_invitations keys
  // off one, and the whole confirm/FCFS/shift chain reads through it. So we record the application
  // on the worker's behalf, already 'accepted' (the Owner chose them), with the same profile
  // snapshot a self-submitted application would freeze.
  async createDirectApplicant(input: {
    job_id: string
    user_id: string
    resume_url: string | null
    skills_snapshot: string | null
    certificates_snapshot: ApplicantCertificateSnapshot[]
    age_at_apply: number | null
  }): Promise<JobApplicant> {
    const { data, error } = await supabase
      .from('job_applicants')
      .insert({
        job_id: input.job_id,
        user_id: input.user_id,
        resume_url: input.resume_url,
        relevant_experience: null,
        additional_note: null,
        skills_snapshot: input.skills_snapshot,
        certificates_snapshot: input.certificates_snapshot,
        age_at_apply: input.age_at_apply,
        status: 'accepted',
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as JobApplicant
  },

}

function mapApplicantRow(row: Record<string, unknown>): JobApplicant {
  const user = row.users as { full_name: string; email_address: string; phone_number?: string | null; profile_photo_url?: string | null } | null
  const invitations = row.job_invitations as { status: string; sent_at?: string | null }[] | null | undefined
  const { users: _users, job_invitations: _invitations, ...rest } = row
  const lastInvitation = invitations && invitations.length > 0 ? invitations[invitations.length - 1] : null
  return {
    ...(rest as Omit<JobApplicant, 'full_name' | 'email_address'>),
    full_name: user?.full_name ?? '',
    email_address: user?.email_address ?? '',
    phone_number: user?.phone_number ?? null,
    profile_photo_url: user?.profile_photo_url ?? null,
    invitation_status: lastInvitation ? lastInvitation.status : null,
    confirmed_at: lastInvitation?.sent_at ?? null,
  }
}
