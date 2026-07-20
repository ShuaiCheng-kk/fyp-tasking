'use client'

import PartnerSidebar from '@/components/PartnerSidebar'
import AttendanceView from '@/components/attendance/AttendanceView'

export default function PartnerAttendancePage() {
  return <AttendanceView sidebar={<PartnerSidebar />} basePath="/partner" />
}
