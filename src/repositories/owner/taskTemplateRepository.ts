// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { TaskTemplate, TaskTemplateInput, TaskTemplateUpdateInput } from '@/types/TaskTemplate'

export const taskTemplateRepository = {

  async createTemplate(input: TaskTemplateInput): Promise<TaskTemplate> {
    const { data, error } = await supabase
      .from('task_templates')
      .insert({
        company_id: input.company_id,
        department_id: input.department_id ?? null,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? null,
        sub_task_titles: input.sub_task_titles ?? [],
        created_by: input.created_by,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as TaskTemplate
  },

  // department_id null = an Owner/Partner template, shared only between the two of them — never
  // department-scoped, never shown to a Manager. department_ids omitted (Owner/Partner viewer) →
  // ONLY the null (Owner/Partner) templates, never a Manager's — Owner/Partner shouldn't see (or
  // be able to edit) a Manager's own department template here, same as a Manager never sees an
  // Owner/Partner template. department_ids passed (Manager viewer) → ONLY templates tagged to a
  // department the manager is in.
  async getTemplatesByCompany(company_id: string, department_ids?: string[]): Promise<TaskTemplate[]> {
    let query = supabase
      .from('task_templates')
      .select('*')
      .eq('company_id', company_id)
    if (department_ids) {
      if (department_ids.length === 0) return []
      query = query.in('department_id', department_ids)
    } else {
      query = query.is('department_id', null)
    }
    const { data, error } = await query.order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as TaskTemplate[]
  },

  async getTemplateById(id: string): Promise<TaskTemplate | null> {
    const { data } = await supabase
      .from('task_templates')
      .select('*')
      .eq('id', id)
      .single()
    return (data as TaskTemplate) ?? null
  },

  async updateTemplate(id: string, input: TaskTemplateUpdateInput): Promise<TaskTemplate> {
    const { data, error } = await supabase
      .from('task_templates')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as TaskTemplate
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('task_templates').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

}
