'use client'

import PartnerSidebar from '@/components/PartnerSidebar'
import RecruitmentView from '@/components/recruitment/RecruitmentView'

export default function PartnerRecruitmentPage() {
  return <RecruitmentView sidebar={<PartnerSidebar />} />
}
