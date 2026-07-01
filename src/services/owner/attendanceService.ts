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
  ShiftSwapCounterpartDecisionInput,
  ShiftSwapOwnerDecisionInput,
  ShiftSwapRequestCreateInput,
  ShiftSwapRequestView,
  ShiftSwapWithdrawInput,
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

  async getShiftSwapRequests(company_id: string): Promise<ShiftSwapRequestView[]> {
    const requests = await attendanceRepository.getShiftSwapRequestsByCompany(company_id)
    if (requests.length === 0) return []

    const assignmentIds = [...new Set(requests.flatMap(r => [r.requester_assignment_id, r.counterpart_assignment_id]))]
    const userIds = [...new Set(requests.flatMap(r => [r.requester_id, r.counterpart_id]))]

    const [assignmentsArr, users] = await Promise.all([
      Promise.all(assignmentIds.map(id => attendanceRepository.getShiftAssignmentById(id))),
      attendanceRepository.getUsersByIds(userIds),
    ])
    const assignmentsById = new Map(assignmentsArr.filter(Boolean).map(a => [a!.id, a!]))
    const usersById = indexById(users)

    const taskCounts = await Promise.all(
      assignmentIds.map(id => attendanceRepository.getTasksByShiftAssignment(id).then(t => ({ id, count: t.length }))),
    )
    const taskCountById = new Map(taskCounts.map(tc => [tc.id, tc.count]))

    // fetch department names via requester assignment's shift department_id
    const deptIds = [...new Set(assignmentsArr.filter(Boolean).map(a => a!.shifts?.department_id).filter(Boolean) as string[])]
    const depts = await attendanceRepository.getDepartmentsByIds(deptIds)
    const deptsById = new Map(depts.map(d => [d.id, d.name]))

    return requests.map(req => {
      const reqAss = assignmentsById.get(req.requester_assignment_id)
      const ctrAss = assignmentsById.get(req.counterpart_assignment_id)
      const requester = usersById.get(req.requester_id)
      const counterpart = usersById.get(req.counterpart_id)
      const deptName = deptsById.get(reqAss?.shifts?.department_id ?? '') ?? null
      return {
        ...req,
        requester_name: requester?.full_name ?? 'Unknown',
        requester_role: requester?.role ?? '',
        requester_photo_url: requester?.profile_photo_url ?? null,
        counterpart_name: counterpart?.full_name ?? 'Unknown',
        counterpart_role: counterpart?.role ?? '',
        counterpart_photo_url: counterpart?.profile_photo_url ?? null,
        department_name: deptName,
        requester_shift_title: reqAss?.shifts?.title ?? null,
        requester_shift_date: reqAss?.shifts?.shift_date ?? null,
        requester_start_time: reqAss?.shifts?.start_time ?? null,
        requester_end_time: reqAss?.shifts?.end_time ?? null,
        counterpart_shift_title: ctrAss?.shifts?.title ?? null,
        counterpart_shift_date: ctrAss?.shifts?.shift_date ?? null,
        counterpart_start_time: ctrAss?.shifts?.start_time ?? null,
        counterpart_end_time: ctrAss?.shifts?.end_time ?? null,
        requester_task_count: taskCountById.get(req.requester_assignment_id) ?? 0,
        counterpart_task_count: taskCountById.get(req.counterpart_assignment_id) ?? 0,
      }
    })
  },

  // Owner/Manager: approve or reject after counterpart has agreed
  async decideShiftSwapRequest(input: ShiftSwapOwnerDecisionInput) {
    if (!['approved', 'rejected'].includes(input.decision)) throw new Error('Invalid swap decision')
    const request = await attendanceRepository.getShiftSwapRequestById(input.id)
    if (!request) throw new Error('Shift swap request not found')
    if (request.counterpart_status !== 'approved') throw new Error('Counterpart has not agreed yet')
    if (request.status !== 'pending') throw new Error('Request is no longer pending')

    if (input.decision === 'approved') {
      // Swap the two assignments' user_id
      await attendanceRepository.updateShiftAssignmentUser(request.requester_assignment_id, request.counterpart_id)
      await attendanceRepository.updateShiftAssignmentUser(request.counterpart_assignment_id, request.requester_id)
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

  // UC52 — Submit Shift Swap Request (M or E initiates)
  async submitShiftSwapRequest(input: ShiftSwapRequestCreateInput) {
    const [reqAss, ctrAss] = await Promise.all([
      attendanceRepository.getShiftAssignmentById(input.requester_assignment_id),
      attendanceRepository.getShiftAssignmentById(input.counterpart_assignment_id),
    ])
    if (!reqAss) throw new Error('Your shift assignment not found')
    if (!ctrAss) throw new Error('Counterpart shift assignment not found')
    if (reqAss.user_id !== input.requester_id) throw new Error('You are not assigned to this shift')
    if (ctrAss.user_id !== input.counterpart_id) throw new Error('Counterpart is not assigned to that shift')

    // Validate same department and same role
    const reqShift = reqAss.shifts
    const ctrShift = ctrAss.shifts
    if (!reqShift || !ctrShift) throw new Error('Shift data missing')
    if (reqShift.department_id !== ctrShift.department_id) throw new Error('Both shifts must be in the same department')

    const users = await attendanceRepository.getUsersByIds([input.requester_id, input.counterpart_id])
    const requester = users.find(u => u.id === input.requester_id)
    const counterpart = users.find(u => u.id === input.counterpart_id)
    if (!requester || !counterpart) throw new Error('User not found')
    if (requester.role !== counterpart.role) throw new Error('Both users must have the same role to swap shifts')

    // Check no other pending request exists for either assignment
    const [reqLocks, ctrLocks] = await Promise.all([
      attendanceRepository.getPendingSwapRequestsByAssignment(input.requester_assignment_id),
      attendanceRepository.getPendingSwapRequestsByAssignment(input.counterpart_assignment_id),
    ])
    if (reqLocks.length > 0) throw new Error('Your shift already has a pending swap request')
    if (ctrLocks.length > 0) throw new Error('The counterpart shift already has a pending swap request')

    return attendanceRepository.createShiftSwapRequest(input)
  },

  // Counterpart responds to a swap request
  async respondShiftSwapRequest(input: ShiftSwapCounterpartDecisionInput) {
    if (!['approved', 'rejected'].includes(input.decision)) throw new Error('Invalid decision')
    const request = await attendanceRepository.getShiftSwapRequestById(input.id)
    if (!request) throw new Error('Shift swap request not found')
    if (request.counterpart_id !== input.counterpart_id) throw new Error('You are not the counterpart of this request')
    if (request.status !== 'pending') throw new Error('Request is no longer pending')
    if (request.counterpart_status !== 'pending') throw new Error('Already responded')

    const fields: Parameters<typeof attendanceRepository.updateShiftSwapRequest>[1] = {
      counterpart_status: input.decision,
      counterpart_reviewed_at: new Date().toISOString(),
    }
    // If counterpart rejects, close the whole request
    if (input.decision === 'rejected') fields.status = 'rejected'

    return attendanceRepository.updateShiftSwapRequest(input.id, fields)
  },

  // Requester withdraws before counterpart responds or before owner decides
  async withdrawShiftSwapRequest(input: ShiftSwapWithdrawInput) {
    const request = await attendanceRepository.getShiftSwapRequestById(input.id)
    if (!request) throw new Error('Shift swap request not found')
    if (request.requester_id !== input.requester_id) throw new Error('Only the requester can withdraw')
    if (request.status !== 'pending') throw new Error('Request is no longer pending')
    return attendanceRepository.updateShiftSwapRequest(input.id, { status: 'withdrawn' })
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

  // UC52/55 — View own submitted requests (M or E) — includes both sides of a swap
  async getMyRequests(user_id: string): Promise<{
    swaps: ShiftSwapRequestView[]
    fixed_off: FixedOffDayRequestView[]
  }> {
    const [swaps, fixed_off] = await Promise.all([
      attendanceRepository.getShiftSwapRequestsByUser(user_id),
      attendanceRepository.getFixedOffDayRequestsByUser(user_id),
    ])

    // Build swapsView using the same logic as getShiftSwapRequests
    let swapsView: ShiftSwapRequestView[] = []
    if (swaps.length > 0) {
      const assignmentIds = [...new Set(swaps.flatMap(s => [s.requester_assignment_id, s.counterpart_assignment_id]))]
      const userIds = [...new Set(swaps.flatMap(s => [s.requester_id, s.counterpart_id]))]
      const [assignmentsArr, users] = await Promise.all([
        Promise.all(assignmentIds.map(id => attendanceRepository.getShiftAssignmentById(id))),
        attendanceRepository.getUsersByIds(userIds),
      ])
      const assignmentsById = new Map(assignmentsArr.filter(Boolean).map(a => [a!.id, a!]))
      const usersById = indexById(users)
      const taskCounts = await Promise.all(
        assignmentIds.map(id => attendanceRepository.getTasksByShiftAssignment(id).then(t => ({ id, count: t.length }))),
      )
      const taskCountById = new Map(taskCounts.map(tc => [tc.id, tc.count]))
      const deptIds = [...new Set(assignmentsArr.filter(Boolean).map(a => a!.shifts?.department_id).filter(Boolean) as string[])]
      const depts = await attendanceRepository.getDepartmentsByIds(deptIds)
      const deptsById = new Map(depts.map(d => [d.id, d.name]))

      swapsView = swaps.map(req => {
        const reqAss = assignmentsById.get(req.requester_assignment_id)
        const ctrAss = assignmentsById.get(req.counterpart_assignment_id)
        const requester = usersById.get(req.requester_id)
        const counterpart = usersById.get(req.counterpart_id)
        return {
          ...req,
          requester_name: requester?.full_name ?? 'Unknown',
          requester_role: requester?.role ?? '',
          requester_photo_url: requester?.profile_photo_url ?? null,
          counterpart_name: counterpart?.full_name ?? 'Unknown',
          counterpart_role: counterpart?.role ?? '',
          counterpart_photo_url: counterpart?.profile_photo_url ?? null,
          department_name: deptsById.get(reqAss?.shifts?.department_id ?? '') ?? null,
          requester_shift_title: reqAss?.shifts?.title ?? null,
          requester_shift_date: reqAss?.shifts?.shift_date ?? null,
          requester_start_time: reqAss?.shifts?.start_time ?? null,
          requester_end_time: reqAss?.shifts?.end_time ?? null,
          counterpart_shift_title: ctrAss?.shifts?.title ?? null,
          counterpart_shift_date: ctrAss?.shifts?.shift_date ?? null,
          counterpart_start_time: ctrAss?.shifts?.start_time ?? null,
          counterpart_end_time: ctrAss?.shifts?.end_time ?? null,
          requester_task_count: taskCountById.get(req.requester_assignment_id) ?? 0,
          counterpart_task_count: taskCountById.get(req.counterpart_assignment_id) ?? 0,
        }
      })
    }

    const foUsers = await attendanceRepository.getUsersByIds([user_id])
    const foUsersById = indexById(foUsers)
    const fixedOffView: FixedOffDayRequestView[] = fixed_off.map(req => ({
      ...req,
      requester_name: foUsersById.get(req.user_id)?.full_name ?? 'Unknown',
    }))

    return { swaps: swapsView, fixed_off: fixedOffView }
  },
}
