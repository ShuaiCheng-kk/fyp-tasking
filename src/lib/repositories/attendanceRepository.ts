/**
 * AttendanceRepository — data access layer for attendance records and shifts.
 *
 * Supabase tables touched:
 *   - attendance_records  (id, worker_id, shift_id, clock_in, clock_out,
 *                          photo_url, status, verified_by, created_at)
 *   - shifts              (id, department_id, date, start_time, end_time,
 *                          required_headcount, created_by)
 *
 * Attendance status values: 'present' | 'absent' | 'late' | 'half_day'
 *
 * Photo verification: clock_in photo is stored in Supabase Storage.
 * The photo_url field holds the public storage path.
 */

import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day'

export interface AttendanceRecord {
  id: string
  worker_id: string
  shift_id: string
  clock_in: string | null
  clock_out: string | null
  photo_url: string | null      // stored in Supabase Storage bucket 'attendance-photos'
  status: AttendanceStatus
  verified_by: string | null    // manager's user ID who manually verified
  created_at: string
}

export interface Shift {
  id: string
  department_id: string
  date: string                  // YYYY-MM-DD
  start_time: string            // HH:MM (24h)
  end_time: string
  required_headcount: number
  created_by: string
}

// ---------------------------------------------------------------------------
// Shifts — read
// ---------------------------------------------------------------------------

export async function findShiftsByDepartment(
  departmentId: string,
  date?: string,
): Promise<Shift[]> {
  let query = supabase.from('shifts').select('*').eq('department_id', departmentId)
  if (date) query = query.eq('date', date)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function findShiftById(id: string): Promise<Shift | null> {
  const { data, error } = await supabase.from('shifts').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data
}

// ---------------------------------------------------------------------------
// Attendance — read
// ---------------------------------------------------------------------------

/** Fetch all attendance records for a worker, optionally within a date range. */
export async function findAttendanceByWorker(
  workerId: string,
  from?: string,   // YYYY-MM-DD
  to?: string,     // YYYY-MM-DD
): Promise<AttendanceRecord[]> {
  let query = supabase
    .from('attendance_records')
    .select('*, shifts(date, start_time, end_time)')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })

  // filter by shift date range via the joined shifts table
  if (from) query = query.gte('shifts.date', from)
  if (to)   query = query.lte('shifts.date', to)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Fetch all attendance for a specific shift (useful for manager view). */
export async function findAttendanceByShift(shiftId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*, profiles(full_name, avatar_url)')
    .eq('shift_id', shiftId)

  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------------------------------------------------------------------------
// Attendance — write
// ---------------------------------------------------------------------------

/**
 * Record a clock-in event.
 * photoUrl should be the Supabase Storage path (not a full URL).
 */
export async function clockIn(
  workerId: string,
  shiftId: string,
  photoUrl: string,
): Promise<AttendanceRecord> {
  const { data, error } = await supabase
    .from('attendance_records')
    .insert({
      worker_id: workerId,
      shift_id: shiftId,
      clock_in: new Date().toISOString(),
      photo_url: photoUrl,
      status: 'present',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/** Record a clock-out event on an existing attendance row. */
export async function clockOut(recordId: string): Promise<void> {
  const { error } = await supabase
    .from('attendance_records')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', recordId)

  if (error) throw new Error(error.message)
}

/** Manager manually overrides attendance status (e.g. marks absent after deadline). */
export async function overrideAttendanceStatus(
  recordId: string,
  status: AttendanceStatus,
  verifiedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from('attendance_records')
    .update({ status, verified_by: verifiedBy })
    .eq('id', recordId)

  if (error) throw new Error(error.message)
}
