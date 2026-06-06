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

async getAssignedWork(user_id: string) {
  const { data, error } = await supabase
    .from('shift_assignments')
    .select(`
      id,
      shift_id,
      user_id,
      assignment_status,
      assigned_by,
      shifts!inner (
        title,
        instruction,
        shift_date,
        start_time,
        end_time
      )
    `)
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const assignedByIds = [
    ...new Set((data ?? []).map((row: any) => row.assigned_by).filter(Boolean)),
  ]

  const { data: assignedByUsers } = assignedByIds.length
    ? await supabase
        .from('users')
        .select('id, full_name, email_address')
        .in('id', assignedByIds)
    : { data: [] }

  const assignedByMap = new Map(
    ((assignedByUsers ?? []) as any[]).map((user) => [user.id, user])
  )

  return (data ?? []).map((row: any) => {
    const assignedBy = assignedByMap.get(row.assigned_by)

    return {
      id: row.id,
      shift_id: row.shift_id,

      title: row.shifts?.title ?? 'Untitled Shift',
      instruction: row.shifts?.instruction ?? null,
      shift_date: row.shifts?.shift_date ?? '',
      start_time: row.shifts?.start_time ?? '',
      end_time: row.shifts?.end_time ?? '',

      assignment_status: row.assignment_status ?? 'assigned',

      manager_name: assignedBy?.full_name ?? 'Assigned Manager',
      manager_email: assignedBy?.email_address ?? '',
    }
  })
}
}