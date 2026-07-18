import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'
import { applyClockInGracePeriod } from '@/services/shared/attendanceGrace'
import { AttendanceRecord, CasualAttendanceOverview } from '@/types/Attendance'

// UC49: the Clock In button only appears starting 30 minutes before the shift's scheduled
// start; Clock Out never appears early — only once the shift has actually reached its end time.
// Exported because the same moment also unlocks the other work actions (messaging, task board).
export const CLOCK_IN_WINDOW_MINUTES_BEFORE = 30

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface AttendanceHistoryEntry {
  id: string
  title: string | null
  job_posting_id: string | null
  company_name: string | null
  location: string | null
  supervisor_name: string | null
  supervisor_phone: string | null
  supervisor_email: string | null
  supervisor_photo_url: string | null
  // Who published the posting this job was hired from — the fallback contact if the supervisor
  // can't be reached, same as the Dashboard's "Backup Contact". Null for shifts with no posting.
  poster_name: string | null
  poster_role: string | null
  poster_phone: string | null
  poster_email: string | null
  poster_photo_url: string | null
  is_open_ended: boolean
  shift_date: string
  start_time: string
  end_time: string
  status: 'working' | 'completed'
  clock_in_time: string | null
  clock_out_time: string | null
  break_in_time: string | null
  break_out_time: string | null
  hours: number | null
  hourly_rate: number | null
  flat_rate: number | null
  pay: number | null
  notes: string | null
  // Titles of the tasks this worker completed on this shift — shown in the record detail.
  completed_tasks: string[]
}

// Worked hours = clock span minus any completed break — the same formula reportService uses for
// labor costing, so the worker's pay figure always matches what the Owner's report charges.
function hoursBetween(record: { clock_in_time: string; clock_out_time: string; break_in_time: string | null; break_out_time: string | null }): number {
  let ms = new Date(record.clock_out_time).getTime() - new Date(record.clock_in_time).getTime()
  if (record.break_in_time && record.break_out_time) {
    ms -= new Date(record.break_out_time).getTime() - new Date(record.break_in_time).getTime()
  }
  return ms > 0 ? Math.round((ms / 3600000) * 100) / 100 : 0
}

export const casualAttendanceService = {
  // Attendance history — every clocked-in shift, both still-working and completed. Read-only for
  // the worker: no approval-chain status shown (the worker just sees what they worked and what
  // they're owed; any employer-side review is internal to the employer).
  async getHistory(authId: string): Promise<AttendanceHistoryEntry[]> {
    if (!authId) throw new Error('Missing user id')

    const user = await casualAttendanceRepository.getUserByAuthId(authId)
    if (!user) throw new Error('Casual worker not found')

    const assignments = await casualAttendanceRepository.getHistoryAssignments(user.id)
    const records = await casualAttendanceRepository.getAttendanceRecordsByAssignmentIds(assignments.map(a => a.id))
    const recordsByAssignment = new Map(records.map(r => [r.shift_assignment_id, r]))

    const clockedIn = assignments.filter(a => recordsByAssignment.get(a.id)?.clock_in_time)

    const jobIds = [...new Set(clockedIn.map(a => a.shift.source_job_posting_id).filter((id): id is string => Boolean(id)))]
    const supervisorIds = [...new Set(clockedIn.map(a => a.supervisor_employee_id).filter((id): id is string => Boolean(id)))]
    const shiftIds = [...new Set(clockedIn.map(a => a.shift.id))]
    // Postings first — their created_by ids (the Owner/Manager who posted, the fallback contact
    // when the supervisor can't be reached) join the same user fetch as the supervisors.
    const jobs = await casualAttendanceRepository.getJobPostingsByIds(jobIds)
    const posterIds = [...new Set(jobs.map(j => j.created_by).filter((id): id is string => Boolean(id)))]
    const [users, completedTasks] = await Promise.all([
      casualAttendanceRepository.getUsersByIds([...new Set([...supervisorIds, ...posterIds])]),
      casualAttendanceRepository.getCompletedTasksByShiftIds(shiftIds, user.id),
    ])
    const jobMap = new Map(jobs.map(job => [job.id, job]))
    const userMap = new Map(users.map(u => [u.id, u]))
    const tasksByShift = new Map<string, string[]>()
    for (const task of completedTasks) {
      if (!task.shift_id) continue
      tasksByShift.set(task.shift_id, [...(tasksByShift.get(task.shift_id) ?? []), task.title])
    }

    return clockedIn
      .map(a => {
        const record = recordsByAssignment.get(a.id)!
        const job = a.shift.source_job_posting_id ? jobMap.get(a.shift.source_job_posting_id) : undefined
        const supervisor = a.supervisor_employee_id ? userMap.get(a.supervisor_employee_id) : undefined
        const poster = job?.created_by ? userMap.get(job.created_by) : undefined
        const hours = record.clock_in_time && record.clock_out_time
          ? hoursBetween({ clock_in_time: record.clock_in_time, clock_out_time: record.clock_out_time, break_in_time: record.break_in_time, break_out_time: record.break_out_time })
          : null

        // Pay is only earned once the shift is completed (clocked out). Flat rate wins when the
        // shift has one (one-off jobs); otherwise hourly_rate x actual hours worked. Mirrors the
        // exact formula reportService uses for labor costing.
        let pay: number | null = null
        if (record.clock_out_time) {
          if (a.shift.flat_rate !== null && a.shift.flat_rate !== undefined) {
            pay = a.shift.flat_rate
          } else if (user.hourly_rate !== null && user.hourly_rate !== undefined && hours !== null) {
            pay = Math.round(user.hourly_rate * hours * 100) / 100
          }
        }

        return {
          id: a.id,
          title: a.shift.title,
          job_posting_id: a.shift.source_job_posting_id,
          company_name: job?.company_name ?? null,
          location: job?.location ?? null,
          supervisor_name: supervisor?.full_name ?? null,
          supervisor_phone: supervisor?.phone_number ?? null,
          supervisor_email: supervisor?.email_address ?? null,
          supervisor_photo_url: supervisor?.profile_photo_url ?? null,
          poster_name: poster?.full_name ?? null,
          poster_role: poster?.role ?? null,
          poster_phone: poster?.phone_number ?? null,
          poster_email: poster?.email_address ?? null,
          poster_photo_url: poster?.profile_photo_url ?? null,
          is_open_ended: a.shift.is_open_ended,
          shift_date: a.shift.shift_date,
          start_time: a.shift.start_time,
          end_time: a.shift.end_time,
          status: (record.clock_out_time ? 'completed' : 'working') as 'working' | 'completed',
          clock_in_time: record.clock_in_time,
          clock_out_time: record.clock_out_time,
          break_in_time: record.break_in_time,
          break_out_time: record.break_out_time,
          hours,
          hourly_rate: user.hourly_rate ?? null,
          flat_rate: a.shift.flat_rate ?? null,
          pay,
          notes: record.employee_notes ?? null,
          completed_tasks: tasksByShift.get(a.shift.id) ?? [],
        }
      })
      .sort((x, y) =>
        y.shift_date.localeCompare(x.shift_date) ||
        Number(y.status === 'working') - Number(x.status === 'working')
      )
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

  // UC49 break tracking: one break per shift. Break In only exists between clock in and clock
  // out; Break Out closes it. No time window — the worker decides when to take their break.
  async breakIn(input: { authId: string; shift_assignment_id: string; break_time?: string }): Promise<AttendanceRecord> {
    const user = await casualAttendanceRepository.getUserByAuthId(input.authId)
    if (!user) throw new Error('Casual worker not found')

    const assignment = await casualAttendanceRepository.getAssignmentById(input.shift_assignment_id)
    if (!assignment || assignment.user_id !== user.id) {
      throw new Error('Shift assignment not found for casual worker')
    }

    const existing = await casualAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (!existing?.clock_in_time) throw new Error('Clock in before starting a break')
    if (existing.clock_out_time) throw new Error('Shift already clocked out')
    if (existing.break_in_time && !existing.break_out_time) throw new Error('Already on a break')
    if (existing.break_in_time && existing.break_out_time) throw new Error('Break already taken for this shift')

    return casualAttendanceRepository.updateAttendanceRecord(existing.id, {
      break_in_time: input.break_time ?? new Date().toISOString(),
    })
  },

  async breakOut(input: { authId: string; shift_assignment_id: string; break_time?: string }): Promise<AttendanceRecord> {
    const user = await casualAttendanceRepository.getUserByAuthId(input.authId)
    if (!user) throw new Error('Casual worker not found')

    const assignment = await casualAttendanceRepository.getAssignmentById(input.shift_assignment_id)
    if (!assignment || assignment.user_id !== user.id) {
      throw new Error('Shift assignment not found for casual worker')
    }

    const existing = await casualAttendanceRepository.getAttendanceRecordByAssignmentId(input.shift_assignment_id)
    if (!existing?.break_in_time) throw new Error('No break started')
    if (existing.break_out_time) throw new Error('Break already ended')

    return casualAttendanceRepository.updateAttendanceRecord(existing.id, {
      break_out_time: input.break_time ?? new Date().toISOString(),
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
