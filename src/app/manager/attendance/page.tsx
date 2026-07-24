'use client'

import ManagerSidebar from '@/components/ManagerSidebar'
import AttendanceView from '@/components/attendance/AttendanceView'

export default function ManagerAttendancePage() {
  // UC56 (expanded 2026-07-23): a Manager can modify clock times for their own department's
  // Employee/Casual Worker records — AttendanceView further restricts this per-record (never a
  // peer Manager's) via scopeToManagerDepartments + reviewRecord.assignee_role.
  return <AttendanceView sidebar={<ManagerSidebar />} basePath="/manager" canModifyClockTimes scopeToManagerDepartments />
}
