import { supabase } from '@/lib/supabase'
import { Department } from '@/types/department.types'

export const departmentRepository = {

  async createDepartment(data: {
    name: string
    company_id: string
  }): Promise<Department> {
    const { data: department, error } = await supabase
      .from('departments')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return department
  },

  async findByCompanyId(company_id: string): Promise<Department[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return data || []
  },

  async findById(id: string): Promise<Department | null> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  },

  async updateById(id: string, name: string): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .update({ name })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async deleteById(id: string): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

}
