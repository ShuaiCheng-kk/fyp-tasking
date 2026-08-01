'use client'

import PartnerSidebar from '@/components/PartnerSidebar'
import TeamView from '@/components/team/TeamView'

export default function PartnerTeamPage() {
  return (
    <TeamView
      sidebar={<PartnerSidebar />}
      basePath="/partner"
      hidePlanBadge
      permissions={{
        canManageDepartments: false,
        canInviteMembers: true,
        canChangeMemberDepartment: false,
        canInviteMembersCsv: true,
      }}
    />
  )
}
