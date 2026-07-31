import { AlertTriangle, Check, Clock, UserX } from 'lucide-react'
import { AttendanceDashboardRecord } from '@/types/Attendance'
import { sgtShiftEndInstant } from '@/lib/singaporeTime'

// Shared between AttendanceView (Owner/Partner/Employee's Attendance Records block) and
// ShiftsView (Manager's merged Shift Calendar, whose past/today cells render this same
// status-pill style instead of a shift-time bar) — extracted so both stay in lockstep instead
// of drifting via copy-paste.
export type ARStatus = 'present' | 'late' | 'absent' | 'no-shift'

export function getARStatus(row: AttendanceDashboardRecord): ARStatus {
  if (row.exceptions.includes('absent')) return 'absent'
  if (row.exceptions.includes('late')) return 'late'
  if (row.record?.clock_in_time) return 'present'
  // BUG-023 — this fallback used to judge "no clock-in, no exceptions" as Absent unconditionally,
  // even for a shift that hadn't started (or was still in progress) yet. attendanceService's own
  // 'absent' exception already requires the shift to have actually ended (see
  // attendanceService.ts's getAttendanceExceptions) — this fallback must agree, not jump ahead of
  // it, or a shift that simply hasn't happened yet reads as a missed one.
  // BUG-021: an overnight shift's end (end_time <= start_time) falls on the following Singapore
  // calendar day.
  const shiftEnd = sgtShiftEndInstant(row.shift.shift_date, row.shift.start_time, row.shift.end_time)
  if (Date.now() > shiftEnd.getTime()) return 'absent'
  return 'no-shift'
}

export function ARStatusIcon({ status }: { status: ARStatus }) {
  if (status === 'present') return (
    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Check size={11} color="#059669" strokeWidth={3} />
    </span>
  )
  if (status === 'late') return (
    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <AlertTriangle size={10} color="#C2410C" strokeWidth={3} />
    </span>
  )
  if (status === 'absent') return (
    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <UserX size={10} color="#B91C1C" strokeWidth={3} />
    </span>
  )
  // 'no-shift': the shift exists and hasn't ended yet (in progress or hasn't started), so there's
  // no Present/Late/Absent verdict to render yet — a neutral pending icon instead of an empty slot.
  return (
    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Clock size={10} color="#6B7280" strokeWidth={3} />
    </span>
  )
}
