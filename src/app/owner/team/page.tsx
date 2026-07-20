'use client'

import OwnerSidebar from '@/components/OwnerSidebar'
import TeamView from '@/components/team/TeamView'

export default function OwnerTeamPage() {
  return (
    <TeamView
      sidebar={<OwnerSidebar />}
      basePath="/owner"
      permissions={{
        canManageDepartments: true,
        canInviteMembers: true,
        canChangeMemberDepartment: true,
        canInviteMembersCsv: true,
      }}
    />
  )
}
