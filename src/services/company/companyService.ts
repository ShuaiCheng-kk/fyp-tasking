import { companyRepository } from '@/repositories/company/companyRepository'
import { departmentRepository } from '@/repositories/department/departmentRepository'
import { authRepository } from '@/repositories/auth/authRepository'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { Company, } from '@/types/company.types'
import { Department } from '@/types/department.types'
import { User } from '@/types/auth.types'

async function resolveInternalOwnerUserId(ownerRef: string): Promise<string | null> {
  const byAuth = await authRepository.findByAuthId(ownerRef)
  if (byAuth) return byAuth.id
  const byPk = await authRepository.findById(ownerRef)
  return byPk?.id ?? null
}

export const companyService = {

  async setupCompany(data: {
    name: string
    description: string | null
    owner_id: string
    plan: Company['plan']
    location?: string | null
    address?: string | null
    postal_code?: string | null
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
      address: data.address,
      postal_code: data.postal_code,
      industry: data.industry,
      size: data.size,
      logo_url: data.logo_url,
      website: data.website,
    })
    await authRepository.updateCompanyId(internalOwnerId, company.id)

    return company
  },

  async createDepartment(data: {
    name: string
    company_id: string
    color?: string | null
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

  async updateDepartment(department_id: string, name: string, color?: string | null): Promise<void> {
    await departmentRepository.updateById(department_id, name, color)
  },

  async deleteDepartment(department_id: string): Promise<void> {
    const memberCount = await departmentRepository.countMembers(department_id)
    if (memberCount > 0) throw new Error('Department still has active members. Reassign or remove all members before deleting this department.')
    await departmentRepository.deleteById(department_id)
  },

  async getCompanyByOwnerId(owner_id: string): Promise<Company | null> {
    const internalOwnerId = await resolveInternalOwnerUserId(owner_id)
    if (!internalOwnerId) return null
    return await companyRepository.findByOwnerId(internalOwnerId)
  },

  async getManagersByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase
      .from('manager_departments')
      .select('manager_id, users!inner(id, full_name)')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
    if (error) throw new Error(error.message)
    return (data || []).map((row: any) => ({ id: row.users.id, full_name: row.users.full_name }))
  },

  async getAllManagersByCompany(company_id: string): Promise<{ id: string; full_name: string; department_id: string | null }[]> {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, manager_departments!manager_departments_manager_id_fkey(department_id)')
      .eq('company_id', company_id)
      .eq('role', 'Manager')
    if (error) throw new Error(error.message)
    return (data || []).map((row: any) => ({
      id: row.id,
      full_name: row.full_name,
      department_id: row.manager_departments?.[0]?.department_id ?? null,
    }))
  },

  async getCompaniesByOwner(owner_id: string): Promise<Company[]> {
    const internalOwnerId = await resolveInternalOwnerUserId(owner_id)
    if (!internalOwnerId) return []
    return await companyRepository.findAllByOwnerId(internalOwnerId)
  },

  async getCurrentCompanyContext(
    userRef: string,
    preferredCompanyId?: string | null,
  ): Promise<{ role: User['role']; company: Company | null; companies: Company[] }> {
    const user = await authRepository.findByAuthIdOrInternalId(userRef)
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

    const memberCompanies = await companyRepository.findCompaniesByMembership(user.id)
    if (memberCompanies.length > 0) {
      let selected = memberCompanies[0]
      if (preferredCompanyId) {
        const match = memberCompanies.find((c) => c.id === preferredCompanyId)
        if (match) selected = match
      }
      return { role: user.role, company: selected, companies: memberCompanies }
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
    address?: string | null
    postal_code?: string | null
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
      const owner = await authRepository.findById(company.owner_id)
      if (owner?.company_id === company_id) {
        throw new Error('This is your primary company created during registration and cannot be deleted.')
      }
    }

    console.log(`[deleteCompany] Step 1: fetching non-Owner members for company ${company_id}`)
    const nonOwnerMembers = await companyRepository.findNonOwnerMembersByCompanyId(company_id)
    console.log(`[deleteCompany] Step 1: found ${nonOwnerMembers.length} non-Owner members`)

    const membersForFullDeletion = nonOwnerMembers

    console.log(`[deleteCompany] Step 3: deleting inbox records for company ${company_id}`)
    await companyRepository.deleteInboxByCompanyId(company_id)

    console.log(`[deleteCompany] Step 3: deleting announcements for company ${company_id}`)
    await companyRepository.deleteAnnouncementsByCompanyId(company_id)

    console.log(`[deleteCompany] Step 3: deleting messages for company ${company_id}`)
    await companyRepository.deleteMessagesByCompanyId(company_id)

    console.log(`[deleteCompany] Step 3: deleting manager_departments for company ${company_id}`)
    await companyRepository.deleteManagerDepartmentsByCompanyId(company_id)

    console.log(`[deleteCompany] Step 3: deleting invitation_code for company ${company_id}`)
    await companyRepository.deleteInvitationCodeByCompanyId(company_id)

    console.log(`[deleteCompany] Step 3: deleting departments for company ${company_id}`)
    await companyRepository.deleteDepartmentsByCompanyId(company_id)

    console.log(`[deleteCompany] Step 4: fully deleting ${membersForFullDeletion.length} members`)
    for (const member of membersForFullDeletion) {
      console.log(`[deleteCompany] Step 4: deleting user ${member.user_id}`)
      await authRepository.deleteById(member.user_id)
      if (member.supabase_auth_id) {
        console.log(`[deleteCompany] Step 4: deleting auth user ${member.supabase_auth_id}`)
        await getSupabaseAdmin().auth.admin.deleteUser(member.supabase_auth_id)
      }
    }

    console.log(`[deleteCompany] Step 5: deleting company ${company_id}`)
    await companyRepository.deleteById(company_id)
    console.log(`[deleteCompany] Step 5: company ${company_id} deleted successfully`)
  },

  async createAdditionalCompany(data: {
    owner_id: string
    name: string
    description: string | null
    plan: Company['plan']
    departments: string[]
    location?: string | null
    address?: string | null
    postal_code?: string | null
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
      address: data.address,
      postal_code: data.postal_code,
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

  async getJobBoardFilters(): Promise<{ industries: string[]; locations: string[] }> {
    return companyRepository.getDistinctIndustriesAndLocations()
  },

}
