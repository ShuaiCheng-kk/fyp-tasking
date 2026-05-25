import { managerRecruitmentRepository } from '@/repositories/manager/managerRecruitmentRepository'
import { JobPosting, CreateJobPostingInput } from '@/types/recruitment.types'

export const managerRecruitmentService = {

  async getJobsByCompany(company_id: string): Promise<JobPosting[]> {
    return managerRecruitmentRepository.findJobsByCompany(company_id)
  },

  async postJob(input: CreateJobPostingInput): Promise<JobPosting> {
    if (!input.title.trim()) throw new Error('Job title is required')
    if (!input.description.trim()) throw new Error('Job description is required')

    if (input.is_recurring) {
      if (!input.recurrence_interval || !input.recurrence_unit) {
        throw new Error('Recurring jobs require an interval and unit (e.g. every 2 weeks)')
      }
    } else {
      input.recurrence_interval = null
      input.recurrence_unit = null
    }

    return managerRecruitmentRepository.insertJob(input)
  },

  async updateJob(id: string, fields: Partial<JobPosting>): Promise<JobPosting> {
    const job = await managerRecruitmentRepository.findJobById(id)
    if (!job) throw new Error('Job not found')
    return managerRecruitmentRepository.updateJob(id, fields)
  },

  async deleteJob(id: string): Promise<void> {
    const job = await managerRecruitmentRepository.findJobById(id)
    if (!job) throw new Error('Job not found')
    return managerRecruitmentRepository.deleteJob(id)
  },

  async archiveJob(job_id: string, requesting_manager_id: string): Promise<JobPosting> {
    const job = await managerRecruitmentRepository.findJobById(job_id)
    if (!job) throw new Error('Job not found')
    if (job.created_by !== requesting_manager_id) throw new Error('You can only archive your own job postings')
    return managerRecruitmentRepository.archiveJob(job_id)
  },

  async duplicateJob(job_id: string, requesting_manager_id: string): Promise<JobPosting> {
    const job = await managerRecruitmentRepository.findJobById(job_id)
    if (!job) throw new Error('Job not found')
    return managerRecruitmentRepository.duplicateJob(job_id, requesting_manager_id)
  },
}