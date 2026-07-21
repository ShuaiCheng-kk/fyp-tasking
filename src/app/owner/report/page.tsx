'use client'

import OwnerSidebar from '@/components/OwnerSidebar'
import ReportView from '@/components/report/ReportView'

export default function OwnerReportPage() {
  return <ReportView sidebar={<OwnerSidebar />} />
}
