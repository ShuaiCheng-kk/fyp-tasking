// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { CasualWorkerStatus, JobApplicant, JobPosting, JobPostingInput, JobPostingSummary } from '@/types/Recruitment'

export const recruitmentService = {
  async getJobPostings(company_id: string): Promise<JobPostingSummary[]> {
    if (!company_id) throw new Error('company_id is required')
    const postings = await recruitmentRepository.getJobPostingsByCompany(company_id)
    const applicantRows = await recruitmentRepository.getApplicantCounts(postings.map(posting => posting.id))
    const deptIds = [...new Set(postings.map(posting => posting.department_id).filter((id): id is string => Boolean(id)))]
    const departments = await recruitmentRepository.getDepartmentsByIds(deptIds)
    const deptMap = new Map(departments.map(department => [department.id, department.name]))

    return postings.map(posting => {
      const rows = applicantRows.filter(row => row.job_id === posting.id)
      return {
        ...posting,
        department_name: posting.department_id ? deptMap.get(posting.department_id) ?? null : null,
        applicant_count: rows.length,
        pending_count: rows.filter(row => row.status === 'pending').length,
      }
    })
  },

  async getApplicants(job_id: string): Promise<JobApplicant[]> {
    if (!job_id) throw new Error('job_id is required')
    return recruitmentRepository.getApplicantsByJob(job_id)
  },

  async createJobPosting(input: JobPostingInput): Promise<JobPosting> {
    validateJobPostingInput(input)
    return recruitmentRepository.createJobPosting(input)
  },

  async editJobPosting(id: string, input: Partial<JobPostingInput>): Promise<JobPosting> {
    if (!id) throw new Error('job_id is required')
    if (input.title !== undefined && !input.title.trim()) throw new Error('title is required')
    if (input.description !== undefined && !input.description.trim()) throw new Error('description is required')
    return recruitmentRepository.updateJobPosting(id, input)
  },

  async archiveJobPosting(id: string): Promise<JobPosting> {
    if (!id) throw new Error('job_id is required')
    return recruitmentRepository.updateJobPosting(id, {
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
  },

  async duplicateJobPosting(id: string, created_by: string): Promise<JobPosting> {
    if (!id || !created_by) throw new Error('job_id and created_by are required')
    const original = await recruitmentRepository.getJobPostingById(id)
    if (!original) throw new Error('Job posting not found')
    return recruitmentRepository.createJobPosting({
      company_id: original.company_id,
      department_id: original.department_id,
      created_by,
      title: `${original.title} (copy)`,
      description: original.description,
      requirements: original.requirements,
      location: original.location,
      employment_type: original.employment_type,
      company_name: original.company_name,
      industry: original.industry,
      salary_amount: original.salary_amount,
      salary_type: original.salary_type,
      is_recurring: original.is_recurring,
      recurrence_interval: original.recurrence_interval,
      recurrence_unit: original.recurrence_unit,
    })
  },

  async decideApplicant(input: {
    applicant_id: string
    decision: 'accepted' | 'rejected'
    decided_by: string
    message?: string | null
  }): Promise<JobApplicant> {
    if (!input.applicant_id || !input.decision || !input.decided_by) {
      throw new Error('applicant_id, decision, and decided_by are required')
    }
    const applicant = await recruitmentRepository.getApplicantById(input.applicant_id)
    if (!applicant) throw new Error('Applicant not found')
    const updated = await recruitmentRepository.updateApplicantStatus(input.applicant_id, input.decision)
    if (input.decision === 'accepted') {
      await recruitmentRepository.createJobInvitation({
        job_id: applicant.job_id,
        applicant_id: applicant.id,
        sent_by: input.decided_by,
        message: input.message ?? 'Your application has been accepted. Please wait for onboarding instructions.',
      })
    }
    return updated
  },

  async getCasualWorkers(company_id: string): Promise<CasualWorkerStatus[]> {
    if (!company_id) throw new Error('company_id is required')
    return recruitmentRepository.getCasualWorkersByCompany(company_id)
  },

  async updateCasualWorkerStatus(input: {
    user_id: string
    worker_status: 'active' | 'inactive' | 'blocked'
  }): Promise<void> {
    if (!input.user_id) throw new Error('user_id is required')
    if (!['active', 'inactive', 'blocked'].includes(input.worker_status)) {
      throw new Error('worker_status must be active, inactive, or blocked')
    }
    await recruitmentRepository.updateCasualWorkerStatus(input.user_id, input.worker_status)
  },
}

function validateJobPostingInput(input: JobPostingInput): void {
  if (!input.company_id || !input.created_by || !input.title?.trim() || !input.description?.trim()) {
    throw new Error('company_id, created_by, title, and description are required')
  }
  if (input.salary_amount !== undefined && input.salary_amount !== null && input.salary_amount < 0) {
    throw new Error('salary_amount cannot be negative')
  }
}
