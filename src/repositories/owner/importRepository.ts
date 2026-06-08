// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { Department } from '@/types/department.types'

export const importRepository = {
  async getDepartmentsByCompany(company_id: string): Promise<Department[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? []) as Department[]
  },

  async createDepartment(company_id: string, name: string): Promise<Department> {
    const { data, error } = await supabase
      .from('departments')
      .insert({ company_id, name })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Department
  },
}
