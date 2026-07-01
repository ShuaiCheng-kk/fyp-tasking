// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { JobTemplate, JobTemplateInput, JobTemplateUpdateInput } from '@/types/JobTemplate'

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
      .order('created_at', { ascending: true })
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
      .update(input)
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

}
