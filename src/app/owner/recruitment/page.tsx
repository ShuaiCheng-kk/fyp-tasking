'use client'

import OwnerSidebar from '@/components/OwnerSidebar'
import RecruitmentView from '@/components/recruitment/RecruitmentView'

export default function OwnerRecruitmentPage() {
  return <RecruitmentView sidebar={<OwnerSidebar />} />
}
