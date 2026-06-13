// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { CasualWorkerStatus, JobApplicant, JobInvitation, JobPosting, JobPostingInput, JobPostingPendingApproval } from '@/types/Recruitment'

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
    let userMap = new Map<string, string>()
    if (allUserIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, full_name').in('id', allUserIds)
      userMap = new Map((users ?? []).map((u: { id: string; full_name: string }) => [u.id, u.full_name]))
    }

    return postings.map(p => ({
      ...p,
      department_name: p.department_id ? deptMap.get(p.department_id) ?? null : null,
      submitter_name: userMap.get(p.created_by) ?? null,
      assigned_employee_name: p.assigned_employee_id ? userMap.get(p.assigned_employee_id) ?? null : null,
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
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data as JobPosting
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
        assigned_employee_id: input.assigned_employee_id ?? null,
        form_type: input.form_type ?? null,
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

  async updateJobPosting(id: string, fields: Partial<JobPostingInput> & { status?: string; archived_at?: string | null }): Promise<JobPosting> {
    const { data, error } = await supabase
      .from('job_postings')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as JobPosting
  },

  async getApplicantsByJob(job_id: string): Promise<JobApplicant[]> {
    const { data, error } = await supabase
      .from('job_applicants')
      .select('*')
      .eq('job_id', job_id)
      .order('applied_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as JobApplicant[]
  },

  async getApplicantCounts(job_ids: string[]): Promise<{ job_id: string; status: string }[]> {
    if (job_ids.length === 0) return []
    const { data, error } = await supabase
      .from('job_applicants')
      .select('job_id, status')
      .in('job_id', job_ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as { job_id: string; status: string }[]
  },

  async getApplicantById(id: string): Promise<JobApplicant | null> {
    const { data, error } = await supabase
      .from('job_applicants')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data as JobApplicant
  },

  async updateApplicantStatus(id: string, status: 'accepted' | 'rejected'): Promise<JobApplicant> {
    const { data, error } = await supabase
      .from('job_applicants')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as JobApplicant
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

  async getUsersByIds(ids: string[]): Promise<{ id: string; full_name: string }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as { id: string; full_name: string }[]
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

}
