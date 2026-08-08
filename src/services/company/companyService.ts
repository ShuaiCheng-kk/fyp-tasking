import { companyRepository } from '@/repositories/company/companyRepository'
import { departmentRepository } from '@/repositories/department/departmentRepository'
import { authRepository } from '@/repositories/auth/authRepository'
import { userService } from '@/services/auth/userService'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { Company, } from '@/types/company.types'
import { Department } from '@/types/department.types'
import { User } from '@/types/auth.types'
import { DEPT_COLORS } from '@/lib/deptColor'

async function resolveInternalOwnerUserId(ownerRef: string): Promise<string | null> {
  const byAuth = await authRepository.findByAuthId(ownerRef)
  if (byAuth) return byAuth.id
  const byPk = await authRepository.findById(ownerRef)
  return byPk?.id ?? null
}

const DEPARTMENT_NAME_MAX_LENGTH = 100

// BUG-014/BUG-010: department name had no length limit (raw Postgres varchar(255) errors leaked
// to the user, and long unbroken strings blew out the card/org-chart layout) and no dedup check
// at any layer (frontend, service, or DB) — two identically named departments become
// indistinguishable in every Shift/Task/Recruitment dropdown. Mirrors importService's
// normalizeName + case-insensitive dedup, the one path that already got this right.
async function validateDepartmentName(company_id: string, name: string, excludeDepartmentId?: string): Promise<string> {
  const normalized = name.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new Error('Department name cannot be empty')
  if (normalized.length > DEPARTMENT_NAME_MAX_LENGTH) {
    throw new Error(`Department name cannot exceed ${DEPARTMENT_NAME_MAX_LENGTH} characters`)
  }
  const existing = await departmentRepository.findByCompanyId(company_id)
  const clash = existing.some(d => d.id !== excludeDepartmentId && d.name.trim().toLowerCase() === normalized.toLowerCase())
  if (clash) throw new Error(`A department named "${normalized}" already exists`)
  return normalized
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
    })
    await authRepository.updateCompanyId(internalOwnerId, company.id)

    return company
  },

  async createDepartment(data: {
    name: string
    company_id: string
    color?: string | null
  }): Promise<Department> {
    const name = await validateDepartmentName(data.company_id, data.name)
    return await departmentRepository.createDepartment({ ...data, name })
  },

  async getDepartments(company_id: string): Promise<Department[]> {
    return await departmentRepository.findByCompanyId(company_id)
  },

  async updatePlan(company_id: string, plan: Company['plan']): Promise<void> {
    const company = await companyRepository.findById(company_id)
    if (!company) throw new Error('Company not found')
    await companyRepository.updatePlanByOwnerId(company.owner_id, plan)
  },

  async updateDepartment(department_id: string, name: string, color: string | null | undefined, company_id: string): Promise<void> {
    const current = await departmentRepository.findById(department_id)
    if (!current) throw new Error('Department not found')
    if (current.company_id !== company_id) throw new Error('You can only manage your own company\'s departments')
    const validName = await validateDepartmentName(current.company_id, name, department_id)
    await departmentRepository.updateById(department_id, validName, color)
  },

  async deleteDepartment(department_id: string, company_id: string): Promise<void> {
    const current = await departmentRepository.findById(department_id)
    if (!current) throw new Error('Department not found')
    if (current.company_id !== company_id) throw new Error('You can only manage your own company\'s departments')
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
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('manager_departments')
      .select('manager_id, users!manager_departments_manager_id_fkey!inner(id, full_name)')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
    if (error) throw new Error(error.message)
    return (data || []).map((row: any) => {
      const user = Array.isArray(row.users) ? row.users[0] : row.users
      return { id: user.id, full_name: user.full_name }
    })
  },

  async getAllManagersByCompany(company_id: string): Promise<{ id: string; full_name: string; department_id: string | null }[]> {
    const supabase = getSupabaseAdmin()
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

  // UC33: every field is required (Name, Description, Postal Code, Number of Staff, Location,
  // Address, Industry), Postal Code must be exactly 6 digits, Number of Staff cannot be '0', and
  // only the company's original creator (Owner, never a Partner) may edit the profile — mirrors
  // the validation that used to live only in TeamView.tsx's client-side handler, so a caller that
  // bypasses the UI can't skip it.
  async updateCompany(id: string, requester_user_id: string, data: {
    name: string
    description: string | null
    location?: string | null
    address?: string | null
    postal_code?: string | null
    industry?: string | null
    size?: string | null
  }): Promise<Company> {
    await userService.assertOwnerRole(requester_user_id)

    const name = data.name?.trim() ?? ''
    const description = data.description?.trim() ?? ''
    const postal_code = data.postal_code?.trim() ?? ''
    const location = data.location?.trim() ?? ''
    const address = data.address?.trim() ?? ''
    const industry = data.industry?.trim() ?? ''
    const size = data.size?.trim() ?? ''

    if (!name) throw new Error('Company name is required.')
    if (!description) throw new Error('Company description is required.')
    if (!postal_code) throw new Error('Postal code is required.')
    if (!/^\d{6}$/.test(postal_code)) throw new Error('Postal code must be exactly 6 digits.')
    if (!location) throw new Error('Location is required.')
    if (!address) throw new Error('Address is required.')
    if (!industry) throw new Error('Industry is required.')
    if (size === '0') throw new Error('Number of staff cannot be 0.')
    if (!size) throw new Error('Number of staff is required.')

    return await companyRepository.updateCompany(id, {
      name, description, location, address, postal_code, industry, size,
    })
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
    })
    for (const [index, deptName] of data.departments.filter((d) => d.trim()).entries()) {
      await departmentRepository.createDepartment({
        name: deptName.trim(),
        company_id: company.id,
        color: DEPT_COLORS[index % DEPT_COLORS.length],
      })
    }
    return company
  },

  async getJobBoardFilters(): Promise<{ industries: string[]; locations: string[] }> {
    return companyRepository.getDistinctIndustriesAndLocations()
  },

}
