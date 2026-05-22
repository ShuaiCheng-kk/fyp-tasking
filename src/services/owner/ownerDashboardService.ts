import { ownerDashboardRepository } from '@/repositories/owner/ownerDashboardRepository'
import { User } from '@/types/auth.types'
import { Company } from '@/types/company.types'

export const ownerDashboardService = {

  async getCurrentCompanyContext(
    userRef: string,
    preferredCompanyId?: string | null,
  ): Promise<{ role: User['role']; company: Company | null; companies: Company[] }> {
    const user = await ownerDashboardRepository.findUserByAuthIdOrInternalId(userRef)
    if (!user) throw new Error('User profile not found')

    const owned = await ownerDashboardRepository.findCompaniesByOwnerId(user.id)
    if (owned.length > 0) {
      let selected = owned[0]
      if (preferredCompanyId) {
        const match = owned.find((c) => c.id === preferredCompanyId)
        if (match) selected = match
      }
      return { role: user.role, company: selected, companies: owned }
    }

    return { role: user.role, company: null, companies: [] }
  },

  async countMembersForOwner(internal_owner_id: string): Promise<number> {
    return ownerDashboardRepository.countMembersAcrossOwnedCompanies(internal_owner_id)
  },

}
