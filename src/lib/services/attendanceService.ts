/**
 * AttendanceService — business logic for the Attendance module.
 *
 * Responsibilities:
 *   - Validate clock-in requests (correct shift, within time window, photo present)
 *   - Detect late arrivals and flag them automatically
 *   - Compute total working hours from clock-in / clock-out timestamps
 *   - Trigger attendance-alert notifications for no-shows after shift start
 *   - Generate summary reports for managers (daily, weekly, monthly)
 *
 * This service calls:
 *   - attendanceRepository  for all database reads/writes
 *   - userRepository        to verify worker is assigned to the shift
 *   - notificationService   to alert managers of anomalies
 *
 * Never call the Supabase client directly here — always go through a repository.
 */

import {
  clockIn,
  clockOut,
  findAttendanceByShift,
  findAttendanceByWorker,
  findShiftById,
  overrideAttendanceStatus,
  type AttendanceStatus,
} from '@/lib/repositories/attendanceRepository'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many minutes after shift start a clock-in is still accepted (grace period). */
const CLOCK_IN_GRACE_MINUTES = 15

/** How many minutes late before attendance is flagged as 'late' instead of 'present'. */
const LATE_THRESHOLD_MINUTES = 10

// ---------------------------------------------------------------------------
// Clock-in / Clock-out
// ---------------------------------------------------------------------------

/**
 * Process a clock-in request from a casual worker.
 *
 * Steps:
 *   1. Verify the shift exists and is ongoing.
 *   2. Determine if the worker is on time, late, or outside the window.
 *   3. Store the attendance record with correct status.
 *   4. Return the created record.
 *
 * @param workerId  - auth user ID of the worker clocking in
 * @param shiftId   - ID of the shift they are clocking into
 * @param photoUrl  - Supabase Storage path of the verification photo
 */
export async function processClockIn(
  workerId: string,
  shiftId: string,
  photoUrl: string,
) {
  const shift = await findShiftById(shiftId)
  if (!shift) throw new Error('Shift not found.')

  const now = new Date()
  const shiftStart = new Date(`${shift.date}T${shift.start_time}`)
  const shiftEnd   = new Date(`${shift.date}T${shift.end_time}`)

  // Reject if trying to clock in after the grace period
  const minutesAfterStart = (now.getTime() - shiftStart.getTime()) / 60_000
  if (minutesAfterStart > CLOCK_IN_GRACE_MINUTES) {
    throw new Error(`Clock-in window closed. Shift started ${Math.round(minutesAfterStart)} minutes ago.`)
  }

  if (now > shiftEnd) {
    throw new Error('This shift has already ended.')
  }

  const record = await clockIn(workerId, shiftId, photoUrl)

  // Auto-flag late arrivals
  if (minutesAfterStart > LATE_THRESHOLD_MINUTES) {
    await overrideAttendanceStatus(record.id, 'late', workerId)
    // TODO: notificationService.sendAttendanceAlert({ workerId, shiftId, status: 'late' })
  }

  return record
}

/**
 * Process a clock-out request.
 * Validates that a matching clock-in record exists for this worker and shift.
 */
export async function processClockOut(workerId: string, shiftId: string) {
  const records = await findAttendanceByShift(shiftId)
  const myRecord = records.find((r) => r.worker_id === workerId && r.clock_in && !r.clock_out)

  if (!myRecord) throw new Error('No active clock-in found for this shift.')

  await clockOut(myRecord.id)
  return myRecord.id
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/**
 * Compute total hours worked by a worker over a date range.
 * Returns total hours as a number (e.g. 42.5 for 42h 30m).
 */
export async function computeWorkedHours(
  workerId: string,
  from: string,
  to: string,
): Promise<number> {
  const records = await findAttendanceByWorker(workerId, from, to)

  const totalMs = records.reduce((sum, r) => {
    if (!r.clock_in || !r.clock_out) return sum
    return sum + (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime())
  }, 0)

  return parseFloat((totalMs / 3_600_000).toFixed(2))
}

/**
 * Generate a daily attendance summary for a department.
 * Returns per-worker breakdown: present, absent, late counts.
 *
 * Used by the manager dashboard to get an at-a-glance view.
 *
 * TODO: implement once the attendance_records + shifts tables are finalised.
 */
export async function getDailyReport(departmentId: string, date: string) {
  // TODO:
  //   1. findShiftsByDepartment(departmentId, date)
  //   2. For each shift, findAttendanceByShift(shift.id)
  //   3. Aggregate by status
  //   4. Return { date, departmentId, present, absent, late, half_day, totalShifts }
  throw new Error('getDailyReport: not yet implemented')
}

// ---------------------------------------------------------------------------
// Manager overrides
// ---------------------------------------------------------------------------

/**
 * Allow a manager to manually correct an attendance status
 * (e.g. worker forgot to clock out, or had a technical issue).
 */
export async function manualOverride(
  recordId: string,
  status: AttendanceStatus,
  managerId: string,
) {
  await overrideAttendanceStatus(recordId, status, managerId)
  // TODO: notificationService.sendAttendanceAlert for the affected worker
}
