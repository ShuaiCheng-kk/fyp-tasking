import { supabase } from '@/lib/supabase'

export const employeeDashboardRepository = {
  async getEmployeeDashboard(
    user_id: string
  ): Promise<{ company_name: string; department_name: string } | null> {
    const { data: member, error: memberErr } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user_id)
      .single()

    if (memberErr || !member) return null

    const { data: company, error: compErr } = await supabase
      .from('companies')
      .select('name')
      .eq('id', member.company_id)
      .single()

    if (compErr || !company) return null

    const { data: empDept } = await supabase
      .from('employee_departments')
      .select('department_id, departments(name)')
      .eq('employee_id', user_id)
      .single()

    return {
      company_name: company.name,
      department_name: (empDept?.departments as any)?.name ?? '',
    }
  },

  async getAssignedWork(user_id: string): Promise<
    {
      id: string
      shift_id: string
      title: string
      instruction: string | null
      shift_date: string
      start_time: string
      end_time: string
      assignment_status: string
      casual_worker_name: string
      casual_worker_email: string
      manager_name: string
      manager_email: string
    }[]
  > {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select(`
        id,
        shift_id,
        assignment_status,

        casual_worker:users!shift_assignments_user_id_fkey (
          full_name,
          email_address
        ),

        assigned_by_user:users!shift_assignments_assigned_by_fkey (
          full_name,
          email_address
        ),

        shifts (
          title,
          instruction,
          shift_date,
          start_time,
          end_time
        )
      `)
      .eq('supervisor_employee_id', user_id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      shift_id: row.shift_id,

      title: row.shifts?.title ?? 'Untitled Shift',
      instruction: row.shifts?.instruction ?? null,
      shift_date: row.shifts?.shift_date ?? '',
      start_time: row.shifts?.start_time ?? '',
      end_time: row.shifts?.end_time ?? '',

      assignment_status: row.assignment_status ?? 'assigned',

      casual_worker_name: row.casual_worker?.full_name ?? 'Not assigned',
      casual_worker_email: row.casual_worker?.email_address ?? 'No email',

      manager_name: row.assigned_by_user?.full_name ?? 'Assigned Manager',
      manager_email: row.assigned_by_user?.email_address ?? '',
    }))
  },
}