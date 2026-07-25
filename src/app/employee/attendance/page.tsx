'use client'

import EmployeeSidebar from '@/components/EmployeeSidebar'
import AttendanceView from '@/components/attendance/AttendanceView'

export default function EmployeeAttendancePage() {
  // UC49 (own clock in/out), UC50 (own records), UC52/UC54 (submit own Shift Swap / Fixed Day
  // Off) — Employee never approves anyone's request (UC53/UC55 are Manager/O-P-only), so there is
  // no review-queue tab; scopeToEmployeeSupervised also adds the Casual Worker clock-out release
  // queue, which Manager doesn't get since Manager doesn't supervise one-off-job Casual Workers.
  return (
    <AttendanceView
      sidebar={<EmployeeSidebar />}
      basePath="/employee"
      canModifyClockTimes={false}
      showPersonalClock
      scopeToEmployeeSupervised
    />
  )
}
