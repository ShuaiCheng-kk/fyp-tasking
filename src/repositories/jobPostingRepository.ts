// LAYER: Repository
// RULE: This file must ONLY contain data access — no business logic
// RULE: Never import supabase directly in Service or Controller layers
// RULE: Never write business logic in Repository or Controller layers

import { supabase } from '@/lib/supabase'
import type { JobPosting } from '@/types/index'

export const jobPostingRepository = {
  async findById(id: string): Promise<JobPosting | null> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async findByCompanyId(companyId: string): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async findByManagerId(managerId: string): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('manager_id', managerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async findByStatus(companyId: string, status: JobPosting['status']): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', status)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async create(posting: Omit<JobPosting, 'id' | 'created_at'>): Promise<JobPosting> {
    const { data, error } = await supabase
      .from('job_postings')
      .insert(posting)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateStatus(id: string, status: JobPosting['status']): Promise<JobPosting> {
    const { data, error } = await supabase
      .from('job_postings')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
