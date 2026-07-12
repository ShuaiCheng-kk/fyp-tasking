// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { JobTemplate, JobTemplateInput, JobTemplateUpdateInput, JobTemplateUsageStats } from '@/types/JobTemplate'

export const jobTemplateRepository = {

  async createTemplate(input: JobTemplateInput): Promise<JobTemplate> {
    const { data, error } = await supabase
      .from('job_templates')
      .insert({
        company_id: input.company_id,
        name: input.name,
        title: input.title,
        description: input.description ?? null,
        requirements: input.requirements ?? null,
        employment_type: input.employment_type ?? null,
        form_type: input.form_type ?? null,
        department_id: input.department_id ?? null,
        salary_amount: input.salary_amount ?? null,
        salary_type: input.salary_type ?? null,
        uniform_required: input.uniform_required ?? false,
        uniform_type: input.uniform_type ?? null,
        uniform_details: input.uniform_details ?? null,
        experience_required: input.experience_required ?? null,
        minimum_age: input.minimum_age ?? null,
        estimated_hours: input.estimated_hours ?? null,
        urgency: input.urgency ?? null,
        created_by: input.created_by,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as JobTemplate
  },

  async getTemplatesByCompany(company_id: string): Promise<JobTemplate[]> {
    const { data, error } = await supabase
      .from('job_templates')
      .select('*')
      .eq('company_id', company_id)
      .order('updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as JobTemplate[]
  },

  async getTemplateById(id: string): Promise<JobTemplate | null> {
    const { data } = await supabase
      .from('job_templates')
      .select('*')
      .eq('id', id)
      .single()
    return (data as JobTemplate) ?? null
  },

  async updateTemplate(id: string, input: JobTemplateUpdateInput): Promise<JobTemplate> {
    const { data, error } = await supabase
      .from('job_templates')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as JobTemplate
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('job_templates').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async getUsageStats(template_id: string): Promise<JobTemplateUsageStats> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('status, created_at')
      .eq('template_id', template_id)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as { status: string; created_at: string }[]
    const draft_jobs = rows.filter(r => r.status === 'draft').length
    const last_used_at = rows.reduce<string | null>(
      (max, r) => (!max || r.created_at > max ? r.created_at : max), null,
    )
    return {
      used_in_jobs: rows.length,
      published_jobs: rows.length - draft_jobs,
      draft_jobs,
      last_used_at,
    }
  },

}
