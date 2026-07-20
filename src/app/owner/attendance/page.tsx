'use client'

import OwnerSidebar from '@/components/OwnerSidebar'
import AttendanceView from '@/components/attendance/AttendanceView'

export default function OwnerAttendancePage() {
  return <AttendanceView sidebar={<OwnerSidebar />} basePath="/owner" />
}
