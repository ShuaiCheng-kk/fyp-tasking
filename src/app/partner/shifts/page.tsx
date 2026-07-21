'use client'

import PartnerSidebar from '@/components/PartnerSidebar'
import ShiftsView from '@/components/shifts/ShiftsView'

export default function PartnerShiftsPage() {
  return <ShiftsView sidebar={<PartnerSidebar />} basePath="/partner" />
}
