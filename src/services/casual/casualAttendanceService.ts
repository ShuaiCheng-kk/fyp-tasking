import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'
import { applyClockInGracePeriod } from '@/services/shared/attendanceGrace'
import { AttendanceRecord, CasualAttendanceOverview } from '@/types/Attendance'

// UC49: the Clock In button only appears starting 30 minutes before the shift's scheduled
// start; Clock Out never appears early — only once the shift has actually reached its end time.
const CLOCK_IN_WINDOW_MINUTES_BEFORE = 30

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export const casualAttendanceService = {
  async getAttendance(authId: string): Promise<CasualAttendanceOverview> {
    if (!authId) throw new Error('Missing user id')

    const user = await casualAttendanceRepository.getUserByAuthId(authId)

    if (!user) {
      throw new Error('Casual worker not found')
    }

    const assignments = await casualAttendanceRepository.getUpcomingAssignments(user.id, todayIsoDate())
    const records = await casualAttendanceRepository.getAttendanceRecordsByAssignmentIds(assignments.map(assignment => assignment.id))
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

  async clockIn(input: { authId: string; shift_assignment_id: string; clock_time?: string; notes?: string | null }): Promise<AttendanceRecord> {
    const user = await casualAttendanceRepository.getUserByAuthId(input.authId)
    if (!user) throw new Error('Casual worker not found')

    const assignment = await casualAttendanceRepository.getAssignmentById(input.shift_assignment_id)
    if (!assignment || assignment.user_id !== user.id) {
      throw new Error('Shift assignment not found for casual worker')
    }
    if (!assignment.shifts) throw new Error('Shift not found for this assignment')

    const existing = await casualAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (existing?.clock_in_time) throw new Error('Already clocked in for this shift')

    const rawNow = input.clock_time ?? new Date().toISOString()
    const shiftStart = new Date(`${assignment.shifts.shift_date}T${assignment.shifts.start_time}Z`)
    const shiftEnd = new Date(`${assignment.shifts.shift_date}T${assignment.shifts.end_time}Z`)
    const earliestClockIn = new Date(shiftStart.getTime() - CLOCK_IN_WINDOW_MINUTES_BEFORE * 60000)
    if (new Date(rawNow).getTime() < earliestClockIn.getTime()) {
      throw new Error('Too early to clock in for this shift')
    }
    if (new Date(rawNow).getTime() >= shiftEnd.getTime()) {
      throw new Error('Shift has already ended — cannot clock in')
    }
    const now = applyClockInGracePeriod(rawNow, assignment.shifts.shift_date, assignment.shifts.start_time)
    if (existing) {
      return casualAttendanceRepository.updateAttendanceRecord(existing.id, {
        clock_in_time: now,
        confirmed_by_employee_id: user.id,
        status: 'clocked_in',
        employee_notes: input.notes ?? existing.employee_notes,
      })
    }

    return casualAttendanceRepository.createAttendanceRecord({
      shift_assignment_id: input.shift_assignment_id,
      casual_worker_id: user.id,
      clock_in_time: now,
      confirmed_by_employee_id: user.id,
      submitted_by_employee_id: user.id,
      status: 'clocked_in',
      employee_notes: input.notes ?? null,
      owner_status: 'pending',
    })
  },

  async clockOut(input: { authId: string; shift_assignment_id: string; clock_time?: string; notes?: string | null }): Promise<AttendanceRecord> {
    const user = await casualAttendanceRepository.getUserByAuthId(input.authId)
    if (!user) throw new Error('Casual worker not found')

    const assignment = await casualAttendanceRepository.getAssignmentById(input.shift_assignment_id)
    if (!assignment || assignment.user_id !== user.id) {
      throw new Error('Shift assignment not found for casual worker')
    }
    if (!assignment.shifts) throw new Error('Shift not found for this assignment')

    const existing = await casualAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (!existing?.clock_in_time) throw new Error('Clock in before clocking out')
    if (existing.clock_out_time) throw new Error('Already clocked out for this shift')

    // UC49: Clock Out never appears early for a fixed-end shift — only once the scheduled end
    // time has actually arrived. One-off jobs are open-ended (the worker decides when they're
    // done, pay is flat regardless of duration), so this gate is skipped for those.
    if (!assignment.shifts.is_open_ended) {
      const rawNow = input.clock_time ?? new Date().toISOString()
      const shiftEnd = new Date(`${assignment.shifts.shift_date}T${assignment.shifts.end_time}Z`)
      if (new Date(rawNow).getTime() < shiftEnd.getTime()) {
        throw new Error('Too early to clock out — wait until the shift ends')
      }
    }

    return casualAttendanceRepository.updateAttendanceRecord(existing.id, {
      clock_out_time: input.clock_time ?? new Date().toISOString(),
      submitted_by_employee_id: user.id,
      employee_notes: input.notes ?? existing.employee_notes,
      status: 'submitted',
    })
  },
}
