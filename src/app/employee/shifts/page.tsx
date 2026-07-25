'use client'

import EmployeeSidebar from '@/components/EmployeeSidebar'
import ShiftsView from '@/components/shifts/ShiftsView'

export default function EmployeeShiftsPage() {
  // Read-only, like Manager — but scoped narrower: only the Employee's own shift plus any
  // Casual Worker shift blocks they currently supervise (see shiftService.getTimelineShifts).
  return <ShiftsView sidebar={<EmployeeSidebar />} basePath="/employee" canManageShifts={false} scopeToEmployeeSelf />
}
