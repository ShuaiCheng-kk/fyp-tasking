import { employeeAttendanceRepository } from '@/repositories/employee/employeeAttendanceRepository'
import { applyClockInGracePeriod } from '@/services/shared/attendanceGrace'

// UC49: the Clock In button only appears starting 30 minutes before the shift's scheduled
// start; Clock Out never appears early — only once the shift has actually reached its end time.
const CLOCK_IN_WINDOW_MINUTES_BEFORE = 30

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export const employeeAttendanceService = {
  async getAttendanceRecords(auth_user_id: string) {
    return employeeAttendanceRepository.getAttendanceRecords(auth_user_id)
  },

  // "My Shift" card for UC49 — same shape as casualAttendanceService.getAttendance, shared by
  // Manager and Employee since both clock in/out against their own shift_assignment the same way.
  async getMyShift(authId: string) {
    if (!authId) throw new Error('Missing user id')
    const user = await employeeAttendanceRepository.getUserByAuthId(authId)
    if (!user) throw new Error('User not found')

    const assignments = await employeeAttendanceRepository.getUpcomingAssignments(user.id, todayIsoDate())
    const records = await employeeAttendanceRepository.getAttendanceRecordsByAssignmentIds(assignments.map(a => a.id))
    const recordsByAssignment = new Map(records.map(record => [record.shift_assignment_id, record]))
    const shifts = assignments
      .filter(assignment => assignment.shifts)
      .map(assignment => ({
        assignment,
        shift: assignment.shifts!,
        record: recordsByAssignment.get(assignment.id) ?? null,
      }))

    return {
      user,
      shifts,
      message: shifts.length === 0 ? 'No active shift.' : 'Attendance loaded.',
    }
  },

  // Shared by Manager and Employee — both are scheduled internal staff who clock in/out
  // against their own shift_assignment the same way (see CLAUDE.md: Manager ⊇ Employee).
  async clockIn(input: { authId: string; shift_assignment_id: string; clock_time?: string; notes?: string | null; late_reason?: string | null; attachment_url?: string | null }) {
    const user = await employeeAttendanceRepository.getUserByAuthId(input.authId)
    if (!user) throw new Error('User not found')

    const assignment = await employeeAttendanceRepository.getAssignmentById(input.shift_assignment_id)
    if (!assignment || assignment.user_id !== user.id) {
      throw new Error('Shift assignment not found for this user')
    }
    if (!assignment.shifts) throw new Error('Shift not found for this assignment')

    const existing = await employeeAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (existing?.clock_in_time) throw new Error('Already clocked in for this shift')

    const rawNow = input.clock_time ?? new Date().toISOString()
    const shiftStart = new Date(`${assignment.shifts.shift_date}T${assignment.shifts.start_time}Z`)
    const shiftEnd = new Date(`${assignment.shifts.shift_date}T${assignment.shifts.end_time}Z`)
    const earliestClockIn = new Date(shiftStart.getTime() - CLOCK_IN_WINDOW_MINUTES_BEFORE * 60000)
    if (new Date(rawNow).getTime() < earliestClockIn.getTime()) {
      throw new Error('Too early to clock in for this shift')
    }
    if (!assignment.shifts.is_open_ended && new Date(rawNow).getTime() >= shiftEnd.getTime()) {
      throw new Error('Shift has already ended — cannot clock in')
    }
    const now = applyClockInGracePeriod(rawNow, assignment.shifts.shift_date, assignment.shifts.start_time)

    if (existing) {
      return employeeAttendanceRepository.updateAttendanceRecord(existing.id, {
        clock_in_time: now,
        confirmed_by_employee_id: user.id,
        status: 'clocked_in',
        employee_notes: input.notes ?? existing.employee_notes,
        late_reason: input.late_reason ?? existing.late_reason,
        attachment_url: input.attachment_url ?? existing.attachment_url,
      })
    }

    return employeeAttendanceRepository.createAttendanceRecord({
      shift_assignment_id: input.shift_assignment_id,
      casual_worker_id: user.id,
      clock_in_time: now,
      confirmed_by_employee_id: user.id,
      submitted_by_employee_id: user.id,
      status: 'clocked_in',
      employee_notes: input.notes ?? null,
      late_reason: input.late_reason ?? null,
      attachment_url: input.attachment_url ?? null,
      owner_status: 'pending',
    })
  },

  async clockOut(input: { authId: string; shift_assignment_id: string; clock_time?: string; notes?: string | null }) {
    const user = await employeeAttendanceRepository.getUserByAuthId(input.authId)
    if (!user) throw new Error('User not found')

    const assignment = await employeeAttendanceRepository.getAssignmentById(input.shift_assignment_id)
    if (!assignment || assignment.user_id !== user.id) {
      throw new Error('Shift assignment not found for this user')
    }
    if (!assignment.shifts) throw new Error('Shift not found for this assignment')

    const existing = await employeeAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (!existing?.clock_in_time) throw new Error('Clock in before clocking out')
    if (existing.clock_out_time) throw new Error('Already clocked out for this shift')

    if (!assignment.shifts.is_open_ended) {
      const rawNow = input.clock_time ?? new Date().toISOString()
      const shiftEnd = new Date(`${assignment.shifts.shift_date}T${assignment.shifts.end_time}Z`)
      if (new Date(rawNow).getTime() < shiftEnd.getTime()) {
        throw new Error('Too early to clock out — wait until the shift ends')
      }
    }

    return employeeAttendanceRepository.updateAttendanceRecord(existing.id, {
      clock_out_time: input.clock_time ?? new Date().toISOString(),
      submitted_by_employee_id: user.id,
      employee_notes: input.notes ?? existing.employee_notes,
      status: 'submitted',
    })
  },

  async breakIn(input: { authId: string; shift_assignment_id: string }) {
    const user = await employeeAttendanceRepository.getUserByAuthId(input.authId)
    if (!user) throw new Error('User not found')

    const existing = await employeeAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (!existing?.clock_in_time) throw new Error('Clock in before taking a break')
    if (existing.clock_out_time) throw new Error('Shift already ended')
    if (existing.break_in_time && !existing.break_out_time) throw new Error('Already on a break')

    return employeeAttendanceRepository.updateAttendanceRecord(existing.id, {
      break_in_time: new Date().toISOString(),
    })
  },

  async breakOut(input: { authId: string; shift_assignment_id: string }) {
    const user = await employeeAttendanceRepository.getUserByAuthId(input.authId)
    if (!user) throw new Error('User not found')

    const existing = await employeeAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (!existing?.break_in_time) throw new Error('No break started')
    if (existing.break_out_time) throw new Error('Break already ended')

    return employeeAttendanceRepository.updateAttendanceRecord(existing.id, {
      break_out_time: new Date().toISOString(),
    })
  },

  // Casual Workers on a one-off (open-ended) job have no scheduled end time, so this Employee
  // must review the work and explicitly release each one before they're allowed to clock out —
  // see casualAttendanceService.clockOut.
  async getClockOutReleaseQueue(authId: string) {
    const user = await employeeAttendanceRepository.getUserByAuthId(authId)
    if (!user) throw new Error('User not found')

    const pending = await employeeAttendanceRepository.getPendingClockOutReleases(user.id)
    const workers = await employeeAttendanceRepository.getUsersByIds(pending.map(p => p.casual_worker_id))
    const workersById = new Map(workers.map(w => [w.id, w]))

    return pending.map(p => ({
      ...p,
      worker_name: workersById.get(p.casual_worker_id)?.full_name ?? 'Casual Worker',
    }))
  },

  async releaseClockOut(authId: string, attendance_record_id: string) {
    const user = await employeeAttendanceRepository.getUserByAuthId(authId)
    if (!user) throw new Error('User not found')

    const record = await employeeAttendanceRepository.getAttendanceRecordWithSupervisor(attendance_record_id)
    if (!record) throw new Error('Attendance record not found')
    if (record.shift_assignments?.supervisor_employee_id !== user.id) {
      throw new Error('You are not the supervisor for this worker')
    }
    if (!record.shift_assignments?.shifts?.is_open_ended) {
      throw new Error('Clock-out release only applies to one-off jobs')
    }
    if (!record.clock_in_time) throw new Error('This worker has not clocked in yet')
    if (record.clock_out_time) throw new Error('This worker has already clocked out')
    if (record.clock_out_released_at) throw new Error('Already released')

    return employeeAttendanceRepository.releaseClockOut(attendance_record_id, user.id)
  },

  async recordAbsence(input: { authId: string; shift_assignment_id: string; absence_reason: string; attachment_url?: string | null }) {
    const user = await employeeAttendanceRepository.getUserByAuthId(input.authId)
    if (!user) throw new Error('User not found')

    const assignment = await employeeAttendanceRepository.getAssignmentById(input.shift_assignment_id)
    if (!assignment || assignment.user_id !== user.id) throw new Error('Shift assignment not found for this user')

    const existing = await employeeAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (existing) {
      return employeeAttendanceRepository.updateAttendanceRecord(existing.id, {
        absence_reason: input.absence_reason,
        attachment_url: input.attachment_url ?? existing.attachment_url,
        status: 'submitted',
      })
    }

    return employeeAttendanceRepository.createAttendanceRecord({
      shift_assignment_id: input.shift_assignment_id,
      casual_worker_id: user.id,
      clock_in_time: null,
      confirmed_by_employee_id: user.id,
      submitted_by_employee_id: user.id,
      status: 'submitted',
      absence_reason: input.absence_reason,
      attachment_url: input.attachment_url ?? null,
      owner_status: 'pending',
    })
  },
}
