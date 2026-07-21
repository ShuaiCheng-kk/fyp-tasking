'use client'

import ManagerSidebar from '@/components/ManagerSidebar'
import RecruitmentView from '@/components/recruitment/RecruitmentView'

export default function ManagerRecruitmentPage() {
  return <RecruitmentView sidebar={<ManagerSidebar />} canApprovePostings={false} canArchivePostings={false} scopeToManagerDepartments />
}
