import { supabase } from '@/lib/supabase'

export const employeeAttendanceRepository = {
  async getAttendanceRecords(auth_user_id: string) {
    // Resolve internal user id from auth id
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_auth_id', auth_user_id)
      .single()

    // Fall back: treat auth_user_id as internal id if lookup fails
    const internalId = user?.id ?? auth_user_id

    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        id,
        shift_assignment_id,
        clock_in_time,
        clock_out_time,
        status,
        employee_notes,
        manager_notes,
        shift_assignments!inner (
          id,
          user_id,
          shifts!inner (
            id,
            title,
            shift_date,
            start_time,
            end_time,
            departments ( name )
          )
        )
      `)
      .eq('shift_assignments.user_id', internalId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return (data ?? []).map((row: any) => {
      const assignment = row.shift_assignments
      const shift      = assignment?.shifts
      const dept       = shift?.departments

      return {
        id:              row.id,
        shift_id:        shift?.id ?? '',
        shift_title:     shift?.title ?? 'Shift',
        shift_date:      shift?.shift_date ?? '',
        start_time:      shift?.start_time ?? '',
        end_time:        shift?.end_time ?? '',
        clock_in_time:   row.clock_in_time ?? null,
        clock_out_time:  row.clock_out_time ?? null,
        status:          row.status ?? 'pending',
        employee_notes:  row.employee_notes ?? null,
        manager_notes:   row.manager_notes ?? null,
        department_name: dept?.name ?? null,
      }
    })
  },
}
