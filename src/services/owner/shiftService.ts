// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { shiftRepository } from '@/repositories/owner/shiftRepository'
import { Shift, ShiftInput } from '@/types/Shift'

export interface TimelineRow {
  user_id: string | null
  full_name: string
  role: string
  department_id: string
  department_name: string
  shifts: Shift[]
}

export const shiftService = {

  async createShift(input: ShiftInput): Promise<Shift> {
    if (!input.company_id || !input.department_id || !input.date || !input.start_time || !input.end_time || !input.created_by) {
      throw new Error('Missing required shift fields')
    }
    if (input.start_time >= input.end_time) {
      throw new Error('start_time must be before end_time')
    }
    return shiftRepository.createShift(input)
  },

  async editShift(
    id: string,
    fields: Partial<Omit<Shift, 'id' | 'company_id' | 'created_by' | 'created_at'>>,
  ): Promise<Shift> {
    if (fields.start_time && fields.end_time && fields.start_time >= fields.end_time) {
      throw new Error('start_time must be before end_time')
    }
    return shiftRepository.updateShift(id, fields)
  },

  async deleteShift(id: string): Promise<void> {
    return shiftRepository.deleteShift(id)
  },

  async getTimelineShifts(
    company_id: string,
    date_from: string,
    date_to: string,
  ): Promise<TimelineRow[]> {
    const shifts = await shiftRepository.getShiftsByCompanyAndDateRange(company_id, date_from, date_to)

    const userIds = [...new Set(shifts.filter(s => s.assigned_user_id).map(s => s.assigned_user_id!))]
    const deptIds = [...new Set(shifts.map(s => s.department_id))]

    const [users, departments] = await Promise.all([
      shiftRepository.getUsersByIds(userIds),
      shiftRepository.getDepartmentsByIds(deptIds),
    ])

    const userMap = new Map(users.map(u => [u.id, u]))
    const deptMap = new Map(departments.map(d => [d.id, d.name]))

    // Group by assigned_user_id; unassigned shifts group by department as "Open Shift"
    const rowMap = new Map<string, TimelineRow>()
    for (const shift of shifts) {
      const key = shift.assigned_user_id ?? `open_${shift.department_id}`
      if (!rowMap.has(key)) {
        const user = shift.assigned_user_id ? userMap.get(shift.assigned_user_id) : null
        rowMap.set(key, {
          user_id: shift.assigned_user_id,
          full_name: user?.full_name ?? 'Open Shift',
          role: user?.role ?? '',
          department_id: shift.department_id,
          department_name: deptMap.get(shift.department_id) ?? '',
          shifts: [],
        })
      }
      rowMap.get(key)!.shifts.push(shift)
    }

    return Array.from(rowMap.values())
  },

}
