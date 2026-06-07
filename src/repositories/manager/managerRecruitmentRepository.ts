import { supabase } from '@/lib/supabase'
import {
  JobPosting,
  CreateJobPostingInput,
  UpdateJobPostingInput,
} from '@/types/recruitment.types'

export const managerRecruitmentRepository = {

  // ─── Job Postings ───────────────────────────────────────────────────────────

  async findJobsByCompany(company_id: string): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', company_id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async findJobById(id: string): Promise<JobPosting | null> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  },

  async insertJob(input: CreateJobPostingInput): Promise<JobPosting> {
    const { data, error } = await supabase
      .from('job_postings')
      .insert({
        ...input,
        status: 'open',
        archived_at: null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async updateJob(id: string, updates: UpdateJobPostingInput): Promise<JobPosting> {
    const { data, error } = await supabase
      .from('job_postings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async archiveJob(id: string): Promise<JobPosting> {
    const { data, error } = await supabase
      .from('job_postings')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async duplicateJob(id: string, created_by: string): Promise<JobPosting> {
    const original = await this.findJobById(id)
    if (!original) throw new Error('Job not found')
    const { id: _id, created_at, updated_at, archived_at, status, ...rest } = original
    return this.insertJob({ ...rest, created_by, title: `${rest.title} (Copy)` })
  },

  async deleteJob(id: string): Promise<void> {
  const { error } = await supabase
    .from('job_postings')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  },

}