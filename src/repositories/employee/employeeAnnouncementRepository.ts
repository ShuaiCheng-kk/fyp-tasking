import { supabase } from '@/lib/supabase'

export const employeeAnnouncementRepository = {

  async getEmployeeAnnouncements(user_id: string): Promise<{
    id: string
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

    const { data: mgrDept } = await supabase
      .from('manager_departments')
      .select('manager_id')
      .eq('department_id', empDept.department_id)
      .limit(1)
      .single()
    if (!mgrDept?.manager_id) return []

    const { data: member } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user_id)
      .single()
    if (!member?.company_id) return []

    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, created_at, poster:users!announcements_from_user_id_fkey(full_name)')
      .eq('company_id', member.company_id)
      .eq('from_user_id', mgrDept.manager_id)
      .order('created_at', { ascending: false })
    if (error) throw error

    return (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      created_at: row.created_at,
      created_by_name: row.poster?.full_name ?? null,
    }))
  },

}
