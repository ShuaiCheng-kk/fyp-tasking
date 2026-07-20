'use client'

import ManagerSidebar from '@/components/ManagerSidebar'
import TeamView from '@/components/team/TeamView'

export default function ManagerTeamPage() {
  return (
    <TeamView
      sidebar={<ManagerSidebar />}
      basePath="/manager"
      scopeToManagerDepartments
      permissions={{
        canManageDepartments: false,
        canChangeMemberDepartment: false,
        canInviteMembers: false,
        canInviteMembersCsv: false,
      }}
    />
  )
}
