import { supabase } from '@/lib/supabase'

export const employeeDashboardRepository = {
  async getEmployeeDashboard(
    user_id: string
  ): Promise<{ company_id: string; company_name: string; department_id: string; department_name: string } | null> {
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('company_id, companies!users_company_id_fkey(name)')
      .eq('id', user_id)
      .single()

    if (userErr || !user?.company_id) return null

    const { data: empDept } = await supabase
      .from('employee_departments')
      .select('department_id')
      .eq('employee_id', user_id)
      .single()

    let department_name = ''
    if (empDept?.department_id) {
      const { data: dept } = await supabase
        .from('departments')
        .select('name')
        .eq('id', empDept.department_id)
        .single()
      department_name = dept?.name ?? ''
    }

    return {
      company_id: user.company_id,
      company_name: (user.companies as any)?.name ?? '',
      department_id: empDept?.department_id ?? '',
      department_name,
    }
  },

  async getAssignedWork(user_id: string) {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select(`
        id,
        shift_id,
        user_id,
        assigned_cw_id,
        assignment_status,
        assigned_by,
        created_at,
        shifts!inner (
          title,
          instruction,
          shift_date,
          start_time,
          end_time,
          publication_status
        )
      `)
      .eq('user_id', user_id)
      .eq('shifts.publication_status', 'published')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    const assignedByIds = [
      ...new Set((data ?? []).map((row: any) => row.assigned_by).filter(Boolean)),
    ]

    const assignedCwIds = [
      ...new Set((data ?? []).map((row: any) => row.assigned_cw_id).filter(Boolean)),
    ]

    const { data: assignedByUsers } = assignedByIds.length
      ? await supabase
          .from('users')
          .select('id, full_name, email_address')
          .in('id', assignedByIds)
      : { data: [] }

    const { data: assignedCwUsers } = assignedCwIds.length
      ? await supabase
          .from('users')
          .select('id, full_name, email_address, phone_number')
          .in('id', assignedCwIds)
      : { data: [] }

    const assignedByMap = new Map(
      ((assignedByUsers ?? []) as any[]).map((user) => [user.id, user])
    )

    const assignedCwMap = new Map(
      ((assignedCwUsers ?? []) as any[]).map((user) => [user.id, user])
    )

    return (data ?? []).map((row: any) => {
      const assignedBy = assignedByMap.get(row.assigned_by)
      const assignedCw = assignedCwMap.get(row.assigned_cw_id)

      return {
        id: row.id,
        shift_id: row.shift_id,

        title: row.shifts?.title ?? 'Untitled Shift',
        instruction: row.shifts?.instruction ?? null,
        shift_date: row.shifts?.shift_date ?? '',
        start_time: row.shifts?.start_time ?? '',
        end_time: row.shifts?.end_time ?? '',

        assignment_status: row.assignment_status ?? 'assigned',

        assigned_cw_id: row.assigned_cw_id ?? null,
        casual_worker_name: assignedCw?.full_name ?? '',
        casual_worker_email: assignedCw?.email_address ?? '',
        casual_worker_phone: assignedCw?.phone_number ?? '',

        manager_name: assignedBy?.full_name ?? 'Assigned Manager',
        manager_email: assignedBy?.email_address ?? '',
      }
    })
  },
}