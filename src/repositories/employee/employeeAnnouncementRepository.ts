import { supabase } from '@/lib/supabase'

export const employeeAnnouncementRepository = {

  async getEmployeeAnnouncements(user_id: string): Promise<{
    id: string
    from_user_id: string
    company_id: string
    department_id: string | null
    title: string
    content: string
    created_at: string
    created_by_name: string | null
  }[]> {
    const { data: empDept } = await supabase
      .from('employee_departments')
      .select('department_id')
      .eq('employee_id', user_id)
      .single()
    if (!empDept?.department_id) return []

    const { data: user } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user_id)
      .single()
    if (!user?.company_id) return []

    const { data, error } = await supabase
      .from('announcements')
      .select('id, from_user_id, company_id, department_id, title, content, created_at, poster:users!announcements_from_user_id_fkey(full_name)')
      .eq('company_id', user.company_id)
      .eq('department_id', empDept.department_id)
      .order('created_at', { ascending: false })
    if (error) throw error

    return (data ?? []).map((row: any) => ({
      id: row.id,
      from_user_id: row.from_user_id,
      company_id: row.company_id,
      department_id: row.department_id,
      title: row.title,
      content: row.content,
      created_at: row.created_at,
      created_by_name: row.poster?.full_name ?? null,
    }))
  },

}
