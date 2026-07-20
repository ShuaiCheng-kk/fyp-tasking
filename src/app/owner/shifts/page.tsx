'use client'

import OwnerSidebar from '@/components/OwnerSidebar'
import ShiftsView from '@/components/shifts/ShiftsView'

export default function OwnerShiftsPage() {
  return <ShiftsView sidebar={<OwnerSidebar />} basePath="/owner" />
}
