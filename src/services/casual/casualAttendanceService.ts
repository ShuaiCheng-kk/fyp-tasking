import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'
import { AttendanceRecord, CasualAttendanceOverview } from '@/types/Attendance'

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

    const existing = await casualAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (existing?.clock_in_time) throw new Error('Already clocked in for this shift')

    const now = input.clock_time ?? new Date().toISOString()
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

    const existing = await casualAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (!existing?.clock_in_time) throw new Error('Clock in before clocking out')
    if (existing.clock_out_time) throw new Error('Already clocked out for this shift')

    return casualAttendanceRepository.updateAttendanceRecord(existing.id, {
      clock_out_time: input.clock_time ?? new Date().toISOString(),
      submitted_by_employee_id: user.id,
      employee_notes: input.notes ?? existing.employee_notes,
      status: 'submitted',
    })
  },
}
