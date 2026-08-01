'use client'

import PartnerSidebar from '@/components/PartnerSidebar'
import DashboardView from '@/components/dashboard/DashboardView'

export default function PartnerDashboardPage() {
  return <DashboardView sidebar={<PartnerSidebar />} basePath="/partner" hidePlanBadge />
}
