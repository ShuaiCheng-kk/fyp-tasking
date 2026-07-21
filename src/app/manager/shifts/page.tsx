'use client'

import ManagerSidebar from '@/components/ManagerSidebar'
import ShiftsView from '@/components/shifts/ShiftsView'

export default function ManagerShiftsPage() {
  return <ShiftsView sidebar={<ManagerSidebar />} basePath="/manager" canManageShifts={false} scopeToManagerDepartments />
}
