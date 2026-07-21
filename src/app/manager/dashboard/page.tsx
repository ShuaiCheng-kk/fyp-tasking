'use client'

import ManagerSidebar from '@/components/ManagerSidebar'
import DashboardView from '@/components/dashboard/DashboardView'

export default function ManagerDashboardPage() {
  return <DashboardView sidebar={<ManagerSidebar />} basePath="/manager" viewerRole="Manager" />
}
