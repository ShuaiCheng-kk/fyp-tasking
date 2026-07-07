// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import {
  UACompany,
  UACompanyDetail,
  UAUser,
  UAReportStats,
  SuspendCompanyInput,
  UnsuspendCompanyInput,
  SuspendUserInput,
  UnsuspendUserInput,
} from '@/types/UserAdmin'
import * as repo from '@/repositories/userAdminRepository'

export async function listCompanies(search?: string): Promise<UACompany[]> {
  return repo.getAllCompanies(search)
}

export async function getCompanyDetail(companyId: string): Promise<UACompanyDetail | null> {
  if (!companyId) throw new Error('Company ID is required')
  return repo.getCompanyDetail(companyId)
}

export async function listUsers(search?: string, roles?: string[], statuses?: string[]): Promise<UAUser[]> {
  return repo.getAllUsers(search, roles, statuses)
}

export async function suspendCompany(input: SuspendCompanyInput): Promise<void> {
  if (!input.company_id) throw new Error('Company ID is required')
  if (!input.reason?.trim()) throw new Error('Suspension reason is required')
  await repo.suspendCompany(input.company_id, input.reason.trim())
}

export async function unsuspendCompany(input: UnsuspendCompanyInput): Promise<void> {
  if (!input.company_id) throw new Error('Company ID is required')
  await repo.unsuspendCompany(input.company_id)
}

export async function suspendUser(input: SuspendUserInput): Promise<void> {
  if (!input.user_id) throw new Error('User ID is required')
  if (!input.reason?.trim()) throw new Error('Suspension reason is required')
  const user = await repo.getUserById(input.user_id)
  if (user && ['User Admin', 'Marketing Admin'].includes(user.role)) {
    throw new Error('Platform admin accounts cannot be suspended')
  }
  await repo.suspendUser(input.user_id, input.reason.trim())
}

export async function unsuspendUser(input: UnsuspendUserInput): Promise<void> {
  if (!input.user_id) throw new Error('User ID is required')
  await repo.unsuspendUser(input.user_id)
}

export async function getReportStats(from?: string, to?: string): Promise<UAReportStats> {
  return repo.getReportStats(from, to)
}
