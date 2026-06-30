// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import {
  AttendanceDashboard,
  AttendanceDashboardRecord,
  AttendanceExceptionType,
  AttendanceManagerReviewInput,
  AttendanceReviewInput,
  FixedOffDayDecisionInput,
  FixedOffDayRequestView,
  ShiftSwapDecisionInput,
  ShiftSwapRequestView,
  TimeOffRequestDecisionInput,
  TimeOffRequestView,
} from '@/types/Attendance'

// shift_date/start_time/end_time are stored as plain UTC-naive strings — without the explicit
// 'Z', `new Date(...)` parses them as local time, which produces a multi-hour skew against the
// already-UTC clock_in_time/clock_out_time timestamps on any server not running in UTC.
function combineDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}Z`)
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

  // Absent: no clock-in by shift end, OR clocked in after shift end (invalid clock-in)
  const clockInTime = input.record?.clock_in_time ?? null
  const clockedInAfterShiftEnd = clockInTime && new Date(clockInTime).getTime() >= shiftEnd.getTime()
  if (!clockInTime && now.getTime() > shiftEnd.getTime()) {
    exceptions.push('absent')
    return exceptions
  }
  if (clockedInAfterShiftEnd) {
    exceptions.push('absent')
    return exceptions
  }

  if (!input.record) return exceptions

  if (input.record.owner_status === 'pending') exceptions.push('pending')
  // Present window: clock-in within 10 min after shift start (grace) = not late.
  // Late: clock-in more than 10 min after shift start.
  // The grace period is also applied at clock-in time (attendanceGrace.ts) so a clock-in
  // recorded at exactly start_time can be ≤10 min after and is never flagged late.
  if (minutesAfter(clockInTime, input.shift_date, input.start_time) > 10) exceptions.push('late')
  if (minutesAfter(input.record.clock_out_time, input.shift_date, input.end_time) > 15) exceptions.push('overtime')
  return exceptions
}

function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map(row => [row.id, row]))
}

// Shared by getAttendanceDashboard (all-time, used by AI review/anomaly detection which need to
// scan every pending record regardless of date) and getAttendanceByDateRange (UC50/UC51, which
// need just today or just a calendar month) — same assembly, different assignment source.
async function buildDashboardRecords(
  assignments: Awaited<ReturnType<typeof attendanceRepository.getAssignmentsByCompany>>,
): Promise<AttendanceDashboardRecord[]> {
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

  return assignments
    .filter(assignment => assignment.shifts)
    .map(assignment => {
      const shift = assignment.shifts!
      const record = recordsByAssignment.get(assignment.id) ?? null
      return {
        assignment,
        shift,
        assignee_name: usersById.get(assignment.user_id)?.full_name ?? 'Unknown member',
        assignee_role: usersById.get(assignment.user_id)?.role ?? 'Member',
        assignee_profile_photo_url: usersById.get(assignment.user_id)?.profile_photo_url ?? null,
        assignee_worker_status: usersById.get(assignment.user_id)?.worker_status ?? null,
        assignee_hourly_rate: usersById.get(assignment.user_id)?.hourly_rate ?? null,
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
}

export const attendanceService = {
  async getAttendanceDashboard(company_id: string): Promise<AttendanceDashboard> {
    const assignments = await attendanceRepository.getAssignmentsByCompany(company_id)
    const dashboardRecords = await buildDashboardRecords(assignments)

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

  // UC50/UC51 — Today's ratio + timeline, and the Past Attendance Record calendar, both need
  // records scoped to an explicit date window instead of the company's entire history.
  async getAttendanceByDateRange(company_id: string, from_date: string, to_date: string): Promise<AttendanceDashboardRecord[]> {
    const assignments = await attendanceRepository.getAssignmentsByCompanyAndDateRange(company_id, from_date, to_date)
    return buildDashboardRecords(assignments)
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

  // UC56: Approve Fixed Day Off
  async getFixedOffDayRequests(company_id: string): Promise<FixedOffDayRequestView[]> {
    const requests = await attendanceRepository.getFixedOffDayRequestsByCompany(company_id)
    const users = await attendanceRepository.getUsersByIds([...new Set(requests.map(request => request.user_id))])
    const usersById = indexById(users)

    return requests.map(request => ({
      ...request,
      requester_name: usersById.get(request.user_id)?.full_name ?? 'Unknown member',
    }))
  },

  async decideFixedOffDayRequest(input: FixedOffDayDecisionInput) {
    if (!['approved', 'rejected'].includes(input.decision)) throw new Error('Invalid request decision')
    const existing = await attendanceRepository.getFixedOffDayRequestById(input.id)
    if (!existing) throw new Error('Fixed day off request not found')

    return attendanceRepository.updateFixedOffDayRequest(input.id, {
      status: input.decision,
      reviewed_by: input.reviewer_id,
      reviewed_at: new Date().toISOString(),
    })
  },

  // UC52 — Submit Shift Swap Request (M or E)
  async submitShiftSwapRequest(input: {
    company_id: string
    shift_assignment_id: string
    requester_id: string
    replacement_user_id: string
    reason: string | null
  }) {
    const assignment = await attendanceRepository.getShiftAssignmentById(input.shift_assignment_id)
    if (!assignment) throw new Error('Shift assignment not found')
    if (assignment.user_id !== input.requester_id) throw new Error('You are not assigned to this shift')
    return attendanceRepository.createShiftSwapRequest(input)
  },

  // UC57 — Submit Leave Request (M or E)
  async submitLeaveRequest(input: {
    company_id: string
    requester_id: string
    request_type: string
    reason: string | null
    shift_assignment_id: string | null
  }) {
    if (!['time_off', 'leave'].includes(input.request_type)) throw new Error('Invalid request type')
    return attendanceRepository.createTimeOffRequest(input)
  },

  // UC55 — Submit Fixed Day Off Request (M or E)
  async submitFixedOffDayRequest(input: {
    user_id: string
    company_id: string
    weekday: number
  }) {
    if (input.weekday < 0 || input.weekday > 6) throw new Error('weekday must be 0–6')
    return attendanceRepository.createFixedOffDayRequest(input)
  },

  // UC52/55/57 — View own submitted requests (M or E)
  async getMyRequests(user_id: string): Promise<{
    swaps: ShiftSwapRequestView[]
    time_off: TimeOffRequestView[]
    fixed_off: FixedOffDayRequestView[]
  }> {
    const [swaps, time_off, fixed_off] = await Promise.all([
      attendanceRepository.getShiftSwapRequestsByUser(user_id),
      attendanceRepository.getTimeOffRequestsByUser(user_id),
      attendanceRepository.getFixedOffDayRequestsByUser(user_id),
    ])

    const assignmentIds = [
      ...swaps.map(s => s.shift_assignment_id),
      ...time_off.filter(t => t.shift_assignment_id).map(t => t.shift_assignment_id!),
    ]
    const uniqueAssignmentIds = [...new Set(assignmentIds)]

    const assignmentsArr = await Promise.all(
      uniqueAssignmentIds.map(id => attendanceRepository.getShiftAssignmentById(id)),
    )
    const assignmentsById = new Map(
      assignmentsArr.filter(Boolean).map(a => [a!.id, a!]),
    )

    const userIds = [...new Set([
      user_id,
      ...swaps.map(s => s.replacement_user_id),
    ])]
    const users = await attendanceRepository.getUsersByIds(userIds)
    const usersById = indexById(users)

    const swapsView: ShiftSwapRequestView[] = swaps.map(req => {
      const assignment = assignmentsById.get(req.shift_assignment_id)
      return {
        ...req,
        requester_name: usersById.get(req.requester_id)?.full_name ?? 'Unknown',
        replacement_name: usersById.get(req.replacement_user_id)?.full_name ?? 'Unknown',
        shift_title: assignment?.shifts?.title ?? null,
        shift_date: assignment?.shifts?.shift_date ?? null,
        start_time: assignment?.shifts?.start_time ?? null,
        end_time: assignment?.shifts?.end_time ?? null,
      }
    })

    const timeOffView: TimeOffRequestView[] = time_off.map(req => {
      const assignment = req.shift_assignment_id ? assignmentsById.get(req.shift_assignment_id) : null
      return {
        ...req,
        requester_name: usersById.get(req.requester_id)?.full_name ?? 'Unknown',
        shift_title: assignment?.shifts?.title ?? null,
        shift_date: assignment?.shifts?.shift_date ?? null,
        start_time: assignment?.shifts?.start_time ?? null,
        end_time: assignment?.shifts?.end_time ?? null,
      }
    })

    const fixedOffView: FixedOffDayRequestView[] = fixed_off.map(req => ({
      ...req,
      requester_name: usersById.get(req.user_id)?.full_name ?? 'Unknown',
    }))

    return { swaps: swapsView, time_off: timeOffView, fixed_off: fixedOffView }
  },
}
