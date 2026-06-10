// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import {
  AttendanceDashboard,
  AttendanceDashboardRecord,
  AttendanceExceptionType,
  AttendanceManagerReviewInput,
  AttendanceReviewInput,
  ShiftSwapDecisionInput,
  ShiftSwapRequestView,
  TimeOffRequestDecisionInput,
  TimeOffRequestView,
} from '@/types/Attendance'

function combineDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}`)
}

function minutesAfter(actual: string | null, shiftDate: string, shiftTime: string): number {
  if (!actual) return 0
  const scheduled = combineDateTime(shiftDate, shiftTime)
  return Math.round((new Date(actual).getTime() - scheduled.getTime()) / 60000)
}

function getAttendanceExceptions(input: {
  shift_date: string
  start_time: string
  end_time: string
  record: { clock_in_time: string | null; clock_out_time: string | null; owner_status: string } | null
}): AttendanceExceptionType[] {
  const exceptions: AttendanceExceptionType[] = []
  const shiftEnd = combineDateTime(input.shift_date, input.end_time)
  const now = new Date()

  if (!input.record && now.getTime() > shiftEnd.getTime()) {
    exceptions.push('absent')
    return exceptions
  }

  if (!input.record) return exceptions

  if (input.record.owner_status === 'pending') exceptions.push('pending')
  if (minutesAfter(input.record.clock_in_time, input.shift_date, input.start_time) > 15) exceptions.push('late')
  if (minutesAfter(input.record.clock_out_time, input.shift_date, input.end_time) > 15) exceptions.push('overtime')
  return exceptions
}

function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map(row => [row.id, row]))
}

export const attendanceService = {
  async getAttendanceDashboard(company_id: string): Promise<AttendanceDashboard> {
    const assignments = await attendanceRepository.getAssignmentsByCompany(company_id)
    const assignmentIds = assignments.map(assignment => assignment.id)
    const records = await attendanceRepository.getAttendanceRecordsByAssignmentIds(assignmentIds)

    const userIds = new Set<string>()
    const departmentIds = new Set<string>()
    assignments.forEach(assignment => {
      userIds.add(assignment.user_id)
      if (assignment.supervisor_employee_id) userIds.add(assignment.supervisor_employee_id)
      if (assignment.shifts?.department_id) departmentIds.add(assignment.shifts.department_id)
    })
    records.forEach(record => {
      userIds.add(record.casual_worker_id)
      userIds.add(record.confirmed_by_employee_id)
      userIds.add(record.submitted_by_employee_id)
    })

    const [users, departments] = await Promise.all([
      attendanceRepository.getUsersByIds([...userIds]),
      attendanceRepository.getDepartmentsByIds([...departmentIds]),
    ])
    const usersById = indexById(users)
    const departmentsById = indexById(departments)
    const recordsByAssignment = new Map(records.map(record => [record.shift_assignment_id, record]))

    const dashboardRecords: AttendanceDashboardRecord[] = assignments
      .filter(assignment => assignment.shifts)
      .map(assignment => {
        const shift = assignment.shifts!
        const record = recordsByAssignment.get(assignment.id) ?? null
        return {
          assignment,
          shift,
          assignee_name: usersById.get(assignment.user_id)?.full_name ?? 'Unknown member',
          assignee_role: usersById.get(assignment.user_id)?.role ?? 'Member',
          supervisor_name: assignment.supervisor_employee_id ? usersById.get(assignment.supervisor_employee_id)?.full_name ?? null : null,
          department_name: shift.department_id ? departmentsById.get(shift.department_id)?.name ?? null : null,
          record,
          exceptions: getAttendanceExceptions({
            shift_date: shift.shift_date,
            start_time: shift.start_time,
            end_time: shift.end_time,
            record,
          }),
        }
      })

    return {
      records: dashboardRecords,
      summary: {
        total_assignments: dashboardRecords.length,
        pending_final_review: dashboardRecords.filter(row => row.record?.owner_status === 'pending').length,
        approved: dashboardRecords.filter(row => row.record?.owner_status === 'approved').length,
        rejected: dashboardRecords.filter(row => row.record?.owner_status === 'rejected').length,
        late: dashboardRecords.filter(row => row.exceptions.includes('late')).length,
        absent: dashboardRecords.filter(row => row.exceptions.includes('absent')).length,
        overtime: dashboardRecords.filter(row => row.exceptions.includes('overtime')).length,
      },
    }
  },

  async managerReviewAttendance(input: AttendanceManagerReviewInput) {
    const existing = await attendanceRepository.getAttendanceRecordById(input.id)
    if (!existing) throw new Error('Attendance record not found')
    return attendanceRepository.updateAttendanceRecord(input.id, {
      manager_notes: input.manager_notes,
      status: 'manager_reviewed',
    })
  },

  async finalReviewAttendance(input: AttendanceReviewInput) {
    const existing = await attendanceRepository.getAttendanceRecordById(input.id)
    if (!existing) throw new Error('Attendance record not found')
    if (!['approved', 'rejected', 'modified'].includes(input.decision)) {
      throw new Error('Invalid attendance decision')
    }

    return attendanceRepository.updateAttendanceRecord(input.id, {
      owner_status: input.decision,
      owner_notes: input.owner_notes ?? null,
      owner_reviewed_by: input.owner_id,
      owner_reviewed_at: new Date().toISOString(),
      owner_adjusted_clock_in_time: input.decision === 'modified' ? input.clock_in_time ?? existing.clock_in_time : existing.owner_adjusted_clock_in_time,
      owner_adjusted_clock_out_time: input.decision === 'modified' ? input.clock_out_time ?? existing.clock_out_time : existing.owner_adjusted_clock_out_time,
      status: input.decision === 'approved' ? 'owner_approved' : input.decision === 'rejected' ? 'owner_rejected' : 'owner_modified',
    })
  },

  async getTimeOffRequests(company_id: string): Promise<TimeOffRequestView[]> {
    const [requests, assignments] = await Promise.all([
      attendanceRepository.getTimeOffRequestsByCompany(company_id),
      attendanceRepository.getAssignmentsByCompany(company_id),
    ])
    const users = await attendanceRepository.getUsersByIds([...new Set(requests.map(request => request.requester_id))])
    const usersById = indexById(users)
    const assignmentsById = new Map(assignments.map(assignment => [assignment.id, assignment]))

    return requests.map(request => {
      const assignment = request.shift_assignment_id ? assignmentsById.get(request.shift_assignment_id) : null
      return {
        ...request,
        requester_name: usersById.get(request.requester_id)?.full_name ?? 'Unknown member',
        shift_title: assignment?.shifts?.title ?? null,
        shift_date: assignment?.shifts?.shift_date ?? null,
        start_time: assignment?.shifts?.start_time ?? null,
        end_time: assignment?.shifts?.end_time ?? null,
      }
    })
  },

  async decideTimeOffRequest(input: TimeOffRequestDecisionInput) {
    if (!['approved', 'rejected'].includes(input.decision)) throw new Error('Invalid request decision')
    return attendanceRepository.updateTimeOffRequest(input.id, {
      status: input.decision,
      reviewed_by: input.reviewer_id,
      reviewed_at: new Date().toISOString(),
    })
  },

  async getShiftSwapRequests(company_id: string): Promise<ShiftSwapRequestView[]> {
    const [requests, assignments] = await Promise.all([
      attendanceRepository.getShiftSwapRequestsByCompany(company_id),
      attendanceRepository.getAssignmentsByCompany(company_id),
    ])
    const userIds = [...new Set(requests.flatMap(request => [request.requester_id, request.replacement_user_id]))]
    const users = await attendanceRepository.getUsersByIds(userIds)
    const usersById = indexById(users)
    const assignmentsById = new Map(assignments.map(assignment => [assignment.id, assignment]))

    return requests.map(request => {
      const assignment = assignmentsById.get(request.shift_assignment_id)
      return {
        ...request,
        requester_name: usersById.get(request.requester_id)?.full_name ?? 'Unknown member',
        replacement_name: usersById.get(request.replacement_user_id)?.full_name ?? 'Unknown member',
        shift_title: assignment?.shifts?.title ?? null,
        shift_date: assignment?.shifts?.shift_date ?? null,
        start_time: assignment?.shifts?.start_time ?? null,
        end_time: assignment?.shifts?.end_time ?? null,
      }
    })
  },

  async decideShiftSwapRequest(input: ShiftSwapDecisionInput) {
    if (!['approved', 'rejected'].includes(input.decision)) throw new Error('Invalid swap decision')
    const request = await attendanceRepository.getShiftSwapRequestById(input.id)
    if (!request) throw new Error('Shift swap request not found')

    if (input.decision === 'approved') {
      await attendanceRepository.updateShiftAssignmentUser(request.shift_assignment_id, request.replacement_user_id)
    }

    return attendanceRepository.updateShiftSwapRequest(input.id, {
      status: input.decision,
      reviewed_by: input.reviewer_id,
      reviewed_at: new Date().toISOString(),
    })
  },
}
