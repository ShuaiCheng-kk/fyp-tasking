'use client'

import PartnerSidebar from '@/components/PartnerSidebar'
import CompanySettingsView from '@/components/settings/CompanySettingsView'

export default function SettingsPage() {
  return <CompanySettingsView sidebar={<PartnerSidebar />} dashboardPath="/partner/dashboard" />
}
