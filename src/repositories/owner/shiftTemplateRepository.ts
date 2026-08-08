// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { ShiftTemplate, ShiftTemplateInput } from '@/types/ShiftTemplate'

export const shiftTemplateRepository = {

  async createTemplate(input: ShiftTemplateInput): Promise<ShiftTemplate> {
    const { data, error } = await supabase
      .from('shift_templates')
      .insert({
        company_id: input.company_id,
        name: input.name,
        start_time: input.start_time,
        end_time: input.end_time,
        created_by: input.created_by,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftTemplate
  },

  async getTemplatesByCompany(company_id: string): Promise<ShiftTemplate[]> {
    const { data, error } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('company_id', company_id)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as ShiftTemplate[]
  },

  async getTemplateById(id: string): Promise<ShiftTemplate | null> {
    const { data } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('id', id)
      .single()
    return (data as ShiftTemplate) ?? null
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('shift_templates').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async updateTemplate(id: string, fields: Partial<Pick<ShiftTemplateInput, 'name' | 'start_time' | 'end_time'>>): Promise<ShiftTemplate> {
    const { data, error } = await supabase
      .from('shift_templates')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftTemplate
  },

}
