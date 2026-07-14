import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'
import { applyClockInGracePeriod } from '@/services/shared/attendanceGrace'
import { AttendanceRecord, CasualAttendanceOverview } from '@/types/Attendance'

// UC49: the Clock In button only appears starting 30 minutes before the shift's scheduled
// start; Clock Out never appears early — only once the shift has actually reached its end time.
const CLOCK_IN_WINDOW_MINUTES_BEFORE = 30

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface AttendanceHistoryEntry {
  id: string
  title: string | null
  company_name: string | null
  shift_date: string
  clock_in_time: string | null
  clock_out_time: string | null
  hours: number | null
  pay: number | null
}

function hoursBetween(clockIn: string, clockOut: string): number {
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  return ms > 0 ? Math.round((ms / 3600000) * 100) / 100 : 0
}

export const casualAttendanceService = {
  // Past completed shifts only — pure history, no approval-chain status shown (the worker just
  // sees what they worked and what they're owed; the 4-tier review is internal to the employer).
  async getHistory(authId: string): Promise<AttendanceHistoryEntry[]> {
    if (!authId) throw new Error('Missing user id')

    const user = await casualAttendanceRepository.getUserByAuthId(authId)
    if (!user) throw new Error('Casual worker not found')

    const assignments = await casualAttendanceRepository.getCompletedAssignments(user.id)
    const records = await casualAttendanceRepository.getAttendanceRecordsByAssignmentIds(assignments.map(a => a.id))
    const recordsByAssignment = new Map(records.map(r => [r.shift_assignment_id, r]))

    const completed = assignments.filter(a => recordsByAssignment.get(a.id)?.clock_out_time)

    const jobIds = [...new Set(completed.map(a => a.shift.source_job_posting_id).filter((id): id is string => Boolean(id)))]
    const jobs = await casualAttendanceRepository.getJobPostingsByIds(jobIds)
    const jobMap = new Map(jobs.map(job => [job.id, job]))

    return completed
      .map(a => {
        const record = recordsByAssignment.get(a.id)!
        const job = a.shift.source_job_posting_id ? jobMap.get(a.shift.source_job_posting_id) : undefined
        const hours = record.clock_in_time && record.clock_out_time
          ? hoursBetween(record.clock_in_time, record.clock_out_time)
          : null

        // Flat rate wins when the shift has one (one-off jobs); otherwise hourly_rate x actual
        // hours worked. Mirrors the exact formula reportService uses for labor costing.
        let pay: number | null = null
        if (a.shift.flat_rate !== null && a.shift.flat_rate !== undefined) {
          pay = a.shift.flat_rate
        } else if (user.hourly_rate !== null && user.hourly_rate !== undefined && hours !== null) {
          pay = Math.round(user.hourly_rate * hours * 100) / 100
        }

        return {
          id: a.id,
          title: a.shift.title,
          company_name: job?.company_name ?? null,
          shift_date: a.shift.shift_date,
          clock_in_time: record.clock_in_time,
          clock_out_time: record.clock_out_time,
          hours,
          pay,
        }
      })
      .sort((x, y) => y.shift_date.localeCompare(x.shift_date))
  },


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
    if (!assignment.shifts.is_open_ended && new Date(rawNow).getTime() >= shiftEnd.getTime()) {
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
    // done, pay is flat regardless of duration) so the time gate is skipped, but since there is
    // no natural "done" signal the supervising Employee must review the work and release the
    // worker first — otherwise a worker could clock in and immediately clock out unchecked.
    if (!assignment.shifts.is_open_ended) {
      const rawNow = input.clock_time ?? new Date().toISOString()
      const shiftEnd = new Date(`${assignment.shifts.shift_date}T${assignment.shifts.end_time}Z`)
      if (new Date(rawNow).getTime() < shiftEnd.getTime()) {
        throw new Error('Too early to clock out — wait until the shift ends')
      }
    } else if (!existing.clock_out_released_at) {
      throw new Error('Waiting for your supervisor to review your work before you can clock out')
    }

    const record = await casualAttendanceRepository.updateAttendanceRecord(existing.id, {
      clock_out_time: input.clock_time ?? new Date().toISOString(),
      submitted_by_employee_id: user.id,
      employee_notes: input.notes ?? existing.employee_notes,
      status: 'submitted',
    })

    // Proof of a completed shift is what promotes this worker into the company's verified Casual
    // Worker pool — not the recruitment two-way-confirm, which happens before they ever show up.
    await casualAttendanceRepository.markCasualWorkerDepartmentVerified(user.id, assignment.shifts.department_id)

    return record
  },
}
