// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { companyRepository } from '@/repositories/companyRepository'
import { departmentRepository } from '@/repositories/departmentRepository'
import { userRepository } from '@/repositories/userRepository'
import { Company, Department, User } from '@/types'

/** Owner APIs receive Supabase Auth id (session.user.id); companies.owner_id is public.users.id. */
async function resolveInternalOwnerUserId(ownerRef: string): Promise<string | null> {
  const byAuth = await userRepository.findByAuthId(ownerRef)
  if (byAuth) return byAuth.id
  const byPk = await userRepository.findById(ownerRef)
  return byPk?.id ?? null
}

export const companyService = {

  async setupCompany(data: {
    name: string
    description: string | null
    owner_id: string
    plan: Company['plan']
    location?: string | null
    industry?: string | null
    size?: string | null
    logo_url?: string | null
    website?: string | null
  }): Promise<Company> {
    const internalOwnerId = await resolveInternalOwnerUserId(data.owner_id)
    if (!internalOwnerId) throw new Error('Owner profile not found')

    const existing = await companyRepository.findByOwnerId(internalOwnerId)
    if (existing) throw new Error('Company already exists for this owner')
    const company = await companyRepository.createCompany({
      name: data.name,
      description: data.description,
      owner_id: internalOwnerId,
      plan: data.plan,
      location: data.location,
      industry: data.industry,
      size: data.size,
      logo_url: data.logo_url,
      website: data.website,
    })
    await userRepository.updateCompanyId(internalOwnerId, company.id)
    return company
  },

  async createDepartment(data: {
    name: string
    company_id: string
  }): Promise<Department> {
    return await departmentRepository.createDepartment(data)
  },

  async getDepartments(company_id: string): Promise<Department[]> {
    return await departmentRepository.findByCompanyId(company_id)
  },

  async updatePlan(company_id: string, plan: Company['plan']): Promise<void> {
    const company = await companyRepository.findById(company_id)
    if (!company) throw new Error('Company not found')
    await companyRepository.updatePlanByOwnerId(company.owner_id, plan)
  },

  async updateDepartment(department_id: string, name: string): Promise<void> {
    await departmentRepository.updateById(department_id, name)
  },

  async deleteDepartment(department_id: string): Promise<void> {
    await departmentRepository.deleteById(department_id)
  },

  async getCompanyByOwnerId(owner_id: string): Promise<Company | null> {
    const internalOwnerId = await resolveInternalOwnerUserId(owner_id)
    if (!internalOwnerId) return null
    return await companyRepository.findByOwnerId(internalOwnerId)
  },

  async getManagersByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    return await userRepository.findManagersByDepartment(company_id, department_id)
  },

  async getAllManagersByCompany(company_id: string): Promise<{ id: string; full_name: string; department_id: string | null }[]> {
    return await userRepository.findManagersByCompany(company_id)
  },

  async getCompaniesByOwner(owner_id: string): Promise<Company[]> {
    const internalOwnerId = await resolveInternalOwnerUserId(owner_id)
    if (!internalOwnerId) return []
    return await companyRepository.findAllByOwnerId(internalOwnerId)
  },

  /**
   * Resolve active company for dashboard: owners see owned companies (+ switcher);
   * managers/employees see their assigned users.company_id row.
   */
  async getCurrentCompanyContext(
    userRef: string,
    preferredCompanyId?: string | null,
  ): Promise<{ role: User['role']; company: Company | null; companies: Company[] }> {
    const user = await userRepository.findByAuthIdOrInternalId(userRef)
    if (!user) throw new Error('User profile not found')

    const owned = await companyRepository.findAllByOwnerId(user.id)
    if (owned.length > 0) {
      let selected = owned[0]
      if (preferredCompanyId) {
        const match = owned.find((c) => c.id === preferredCompanyId)
        if (match) selected = match
      }
      return { role: user.role, company: selected, companies: owned }
    }

    if (user.company_id) {
      const c = await companyRepository.findById(user.company_id)
      return { role: user.role, company: c, companies: c ? [c] : [] }
    }

    return { role: user.role, company: null, companies: [] }
  },

  async updateCompany(id: string, data: {
    name: string
    description: string | null
    location?: string | null
    industry?: string | null
    size?: string | null
    logo_url?: string | null
    website?: string | null
  }): Promise<Company> {
    return await companyRepository.updateCompany(id, data)
  },

  async deleteCompany(company_id: string): Promise<void> {
    const company = await companyRepository.findById(company_id)
    if (company) {
      const owner = await userRepository.findById(company.owner_id)
      if (owner?.company_id === company_id) {
        throw new Error('This is your primary company created during registration and cannot be deleted.')
      }
    }
    await companyRepository.deleteById(company_id)
  },

  async createAdditionalCompany(data: {
    owner_id: string
    name: string
    description: string | null
    plan: Company['plan']
    departments: string[]
    location?: string | null
    industry?: string | null
    size?: string | null
    logo_url?: string | null
    website?: string | null
  }): Promise<Company> {
    const internalOwnerId = await resolveInternalOwnerUserId(data.owner_id)
    if (!internalOwnerId) throw new Error('Owner profile not found')

    const company = await companyRepository.createCompanyForOwner({
      name: data.name,
      description: data.description,
      owner_id: internalOwnerId,
      plan: data.plan,
      location: data.location,
      industry: data.industry,
      size: data.size,
      logo_url: data.logo_url,
      website: data.website,
    })
    for (const deptName of data.departments.filter((d) => d.trim())) {
      await departmentRepository.createDepartment({ name: deptName.trim(), company_id: company.id })
    }
    return company
  },

}
