'use client'

import PartnerSidebar from '@/components/PartnerSidebar'
import ReportView from '@/components/report/ReportView'

export default function PartnerReportPage() {
  return <ReportView sidebar={<PartnerSidebar />} />
}
