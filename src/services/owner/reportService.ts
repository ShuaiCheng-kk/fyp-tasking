// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { reportRepository } from '@/repositories/owner/reportRepository'
import { DepartmentReportRow, ReportFilters, WorkforceAnalyticsReport } from '@/types/Report'

function percent(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

export const reportService = {
  async getWorkforceAnalytics(filters: ReportFilters): Promise<WorkforceAnalyticsReport> {
    const [departments, shifts, tasks] = await Promise.all([
      reportRepository.getDepartments(filters.company_id),
      reportRepository.getShifts(filters),
      reportRepository.getTasks(filters),
    ])

    const assignments = await reportRepository.getAssignmentsByShiftIds(shifts.map(shift => shift.id))
    const attendance = await reportRepository.getAttendanceByAssignmentIds(assignments.map(assignment => assignment.id))
    const shiftsById = new Map(shifts.map(shift => [shift.id, shift]))
    const departmentNames = new Map(departments.map(department => [department.id, department.name]))
    const rows = new Map<string, DepartmentReportRow>()

    const ensureRow = (departmentId: string | null): DepartmentReportRow => {
      const key = departmentId ?? 'none'
      const existing = rows.get(key)
      if (existing) return existing
      const row: DepartmentReportRow = {
        department_id: departmentId,
        department_name: departmentId ? departmentNames.get(departmentId) ?? 'Department' : 'No department',
        shifts: 0,
        assignments: 0,
        tasks: 0,
        completed_tasks: 0,
        attendance_records: 0,
        approved_attendance: 0,
        rejected_attendance: 0,
      }
      rows.set(key, row)
      return row
    }

    shifts.forEach(shift => {
      ensureRow(shift.department_id).shifts += 1
    })

    assignments.forEach(assignment => {
      const shift = shiftsById.get(assignment.shift_id)
      ensureRow(shift?.department_id ?? null).assignments += 1
    })

    tasks.forEach(task => {
      const row = ensureRow(task.department_id)
      row.tasks += 1
      if (task.status === 'Complete' || task.percentage_complete >= 100) row.completed_tasks += 1
    })

    const assignmentsById = new Map(assignments.map(assignment => [assignment.id, assignment]))
    attendance.forEach(record => {
      const assignment = assignmentsById.get(record.shift_assignment_id)
      const shift = assignment ? shiftsById.get(assignment.shift_id) : null
      const row = ensureRow(shift?.department_id ?? null)
      row.attendance_records += 1
      if (record.owner_status === 'approved' || record.status === 'owner_approved') row.approved_attendance += 1
      if (record.owner_status === 'rejected' || record.status === 'owner_rejected') row.rejected_attendance += 1
    })

    return {
      summary: {
        shifts: shifts.length,
        assignments: assignments.length,
        tasks: tasks.length,
        completed_tasks: tasks.filter(task => task.status === 'Complete' || task.percentage_complete >= 100).length,
        task_completion_rate: percent(tasks.filter(task => task.status === 'Complete' || task.percentage_complete >= 100).length, tasks.length),
        attendance_records: attendance.length,
        approved_attendance: attendance.filter(record => record.owner_status === 'approved' || record.status === 'owner_approved').length,
        rejected_attendance: attendance.filter(record => record.owner_status === 'rejected' || record.status === 'owner_rejected').length,
        pending_attendance: attendance.filter(record => record.owner_status === 'pending').length,
      },
      departments: [...rows.values()].sort((a, b) => b.assignments + b.tasks - (a.assignments + a.tasks)),
      recent_activity: [
        ...shifts.slice(0, 5).map(shift => ({
          type: 'shift' as const,
          title: shift.title || 'Shift',
          detail: `${departmentNames.get(shift.department_id) ?? 'No department'} · ${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`,
          date: shift.shift_date,
        })),
        ...tasks.slice(0, 5).map(task => ({
          type: 'task' as const,
          title: task.title,
          detail: `${task.status} · ${task.percentage_complete}% complete`,
          date: task.created_at,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    }
  },
}
