import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()

export const employeeAnnouncementRepository = {

  async getEmployeeAnnouncements(user_id: string): Promise<{
    id: string
    user_id: string
    company_id: string
    audience_department_id: string | null
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
      .select('id, user_id, company_id, audience_department_id, title, content, created_at, poster:users!announcements_user_id_fkey(full_name, role)')
      .eq('company_id', user.company_id)
      .eq('audience_department_id', empDept.department_id)
      .order('created_at', { ascending: false })
    if (error) throw error

    return (data ?? []).filter((row: any) => row.poster?.role === 'Manager').map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      company_id: row.company_id,
      audience_department_id: row.audience_department_id,
      title: row.title,
      content: row.content,
      created_at: row.created_at,
      created_by_name: row.poster?.full_name ?? null,
    }))
  },

}
