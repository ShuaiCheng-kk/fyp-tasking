import { partnerDashboardRepository } from '@/repositories/partner/partnerDashboardRepository'
import { User } from '@/types/auth.types'
import { Company } from '@/types/company.types'

export const partnerDashboardService = {

  async getCurrentCompanyContext(
    userRef: string,
    preferredCompanyId?: string | null,
  ): Promise<{ role: User['role']; company: Company | null; companies: Company[] }> {
    const user = await partnerDashboardRepository.findUserByAuthIdOrInternalId(userRef)
    if (!user) throw new Error('User profile not found')

    const memberCompanies = await partnerDashboardRepository.findCompaniesByMembership(user.id)
    if (memberCompanies.length > 0) {
      let selected = memberCompanies[0]
      if (preferredCompanyId) {
        const match = memberCompanies.find((c) => c.id === preferredCompanyId)
        if (match) selected = match
      }
      return { role: user.role, company: selected, companies: memberCompanies }
    }

    return { role: user.role, company: null, companies: [] }
  },

}
