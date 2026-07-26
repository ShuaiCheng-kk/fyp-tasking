import { AlertTriangle, Check, UserX } from 'lucide-react'
import { AttendanceDashboardRecord } from '@/types/Attendance'

// Shared between AttendanceView (Owner/Partner/Employee's Attendance Records block) and
// ShiftsView (Manager's merged Shift Calendar, whose past/today cells render this same
// status-pill style instead of a shift-time bar) — extracted so both stay in lockstep instead
// of drifting via copy-paste.
export type ARStatus = 'present' | 'late' | 'absent' | 'no-shift'

export function getARStatus(row: AttendanceDashboardRecord): ARStatus {
  if (row.exceptions.includes('absent')) return 'absent'
  if (row.exceptions.includes('late')) return 'late'
  if (row.record?.clock_in_time) return 'present'
  return 'absent'
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
  return <span style={{ width: 20, height: 20, flexShrink: 0 }} />
}
