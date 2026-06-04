// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { AttendanceRecord } from '@/types/Attendance'
import { Shift } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'
import { Task } from '@/types/Task'
import { ReportFilters } from '@/types/Report'

export const reportRepository = {
  async getDepartments(company_id: string): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; name: string }>
  },

  async getShifts(filters: ReportFilters): Promise<Shift[]> {
    let query = supabase
      .from('shifts')
      .select('*')
      .eq('company_id', filters.company_id)
      .gte('shift_date', filters.date_from)
      .lte('shift_date', filters.date_to)
      .order('shift_date', { ascending: false })
    if (filters.department_id) query = query.eq('department_id', filters.department_id)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async getAssignmentsByShiftIds(shiftIds: string[]): Promise<ShiftAssignment[]> {
    if (shiftIds.length === 0) return []
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*')
      .in('shift_id', shiftIds)
    if (error) throw new Error(error.message)
    return (data ?? []) as ShiftAssignment[]
  },

  async getTasks(filters: ReportFilters): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('company_id', filters.company_id)
      .gte('created_at', `${filters.date_from}T00:00:00`)
      .lte('created_at', `${filters.date_to}T23:59:59`)
      .order('created_at', { ascending: false })
    if (filters.department_id) query = query.eq('department_id', filters.department_id)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as Task[]
  },

  async getAttendanceByAssignmentIds(assignmentIds: string[]): Promise<AttendanceRecord[]> {
    if (assignmentIds.length === 0) return []
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .in('shift_assignment_id', assignmentIds)
    if (error) throw new Error(error.message)
    return (data ?? []) as AttendanceRecord[]
  },
}
