'use client'

import OwnerSidebar from '@/components/OwnerSidebar'
import DashboardView from '@/components/dashboard/DashboardView'

export default function OwnerDashboardPage() {
  return <DashboardView sidebar={<OwnerSidebar />} basePath="/owner" />
}
