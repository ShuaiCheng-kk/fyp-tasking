'use client'

import OwnerSidebar from '@/components/OwnerSidebar'
import CompanySettingsView from '@/components/settings/CompanySettingsView'

export default function SettingsPage() {
  return <CompanySettingsView sidebar={<OwnerSidebar />} dashboardPath="/owner/dashboard" />
}
