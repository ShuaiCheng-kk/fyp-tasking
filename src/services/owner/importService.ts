// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { importRepository } from '@/repositories/owner/importRepository'
import { invitationService } from '@/services/invitation/invitationService'
import {
  DepartmentImportResult,
  MemberImportResult,
  MemberImportRow,
} from '@/types/Import'

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeRole(role: string): MemberImportRow['role'] {
  const cleaned = role.trim().toLowerCase()
  if (cleaned === 'partner') return 'Partner'
  if (cleaned === 'manager') return 'Manager'
  if (cleaned === 'employee') return 'Employee'
  throw new Error(`Unsupported role: ${role}`)
}

export const importService = {
  async importDepartments(company_id: string, names: string[]): Promise<DepartmentImportResult> {
    const existing = await importRepository.getDepartmentsByCompany(company_id)
    const existingNames = new Set(existing.map(department => department.name.trim().toLowerCase()))
    const uniqueNames = [...new Set(names.map(normalizeName).filter(Boolean))]
    const created: string[] = []
    const skipped: string[] = []

    for (const name of uniqueNames) {
      if (existingNames.has(name.toLowerCase())) {
        skipped.push(name)
        continue
      }
      await importRepository.createDepartment(company_id, name)
      existingNames.add(name.toLowerCase())
      created.push(name)
    }

    return { created, skipped }
  },

  async importMembers(data: {
    company_id: string
    invited_by: string
    members: MemberImportRow[]
  }): Promise<MemberImportResult> {
    const departments = await importRepository.getDepartmentsByCompany(data.company_id)
    const departmentsByName = new Map(departments.map(department => [department.name.trim().toLowerCase(), department.id]))
    const invited: string[] = []
    const failed: Array<{ email: string; message: string }> = []

    for (const member of data.members) {
      const email = member.email.trim().toLowerCase()
      try {
        if (!email || !email.includes('@')) throw new Error('Invalid email address')
        const role = normalizeRole(member.role)
        const departmentId = role === 'Partner'
          ? null
          : member.department_id || (member.department_name ? departmentsByName.get(member.department_name.trim().toLowerCase()) ?? null : null)
        if (role !== 'Partner' && !departmentId) throw new Error('Department not found')

        await invitationService.sendInvite({
          email,
          role,
          company_id: data.company_id,
          department_id: departmentId,
          invited_by: data.invited_by,
        })
        invited.push(email)
      } catch (err) {
        failed.push({ email: email || member.email, message: err instanceof Error ? err.message : 'Failed to invite member' })
      }
    }

    return { invited, failed }
  },
}
