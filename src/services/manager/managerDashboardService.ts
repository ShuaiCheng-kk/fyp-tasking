import { managerDashboardRepository } from '@/repositories/manager/managerDashboardRepository'
import { User } from '@/types/auth.types'
import { Company } from '@/types/company.types'

export const managerDashboardService = {

  async getCurrentCompanyContext(
    userRef: string,
    preferredCompanyId?: string | null,
  ): Promise<{ role: User['role']; company: Company | null; companies: Company[] }> {
    const user = await managerDashboardRepository.findUserByAuthIdOrInternalId(userRef)
    if (!user) throw new Error('User profile not found')

    const memberCompanies = await managerDashboardRepository.findCompaniesByMembership(user.id)
    if (memberCompanies.length > 0) {
      let selected = memberCompanies[0]
      if (preferredCompanyId) {
        const match = memberCompanies.find((c) => c.id === preferredCompanyId)
        if (match) selected = match
      }
      return { role: user.role, company: selected, companies: memberCompanies }
    }

    if (user.company_id) {
      const c = await managerDashboardRepository.findCompanyById(user.company_id)
      return { role: user.role, company: c, companies: c ? [c] : [] }
    }

    return { role: user.role, company: null, companies: [] }
  },

}
