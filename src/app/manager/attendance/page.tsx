'use client'

import ManagerSidebar from '@/components/ManagerSidebar'
import AttendanceView from '@/components/attendance/AttendanceView'

export default function ManagerAttendancePage() {
  return <AttendanceView sidebar={<ManagerSidebar />} basePath="/manager" canModifyClockTimes={false} scopeToManagerDepartments showPersonalClock />
}
