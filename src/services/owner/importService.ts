// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { importRepository } from '@/repositories/owner/importRepository'
import { invitationService, InviteDelivery } from '@/services/invitation/invitationService'
import {
  DepartmentImportResult,
  MemberImportResult,
  MemberImportRow,
} from '@/types/Import'
import { DEPT_COLORS } from '@/lib/deptColor'

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
      await importRepository.createDepartment(company_id, name, DEPT_COLORS[(existing.length + created.length) % DEPT_COLORS.length])
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
    // One invite per row, each ending in its own email-provider round trip, and the rows are
    // independent - so they go out together rather than one after another. Sequentially, an N-row
    // CSV cost N round trips stacked end to end (a 2-row import measured 11.3s when the provider
    // was slow); in parallel it costs one. Results are still reported per row, in CSV order.
    const outcomes = await Promise.all(data.members.map(async member => {
      const email = member.email.trim().toLowerCase()
      try {
        if (!email || !email.includes('@')) throw new Error('Invalid email address')
        const role = normalizeRole(member.role)
        const departmentId = role === 'Partner'
          ? null
          : member.department_id || (member.department_name ? departmentsByName.get(member.department_name.trim().toLowerCase()) ?? null : null)
        if (role !== 'Partner' && !departmentId) throw new Error('Department not found')

        const delivery = await invitationService.createInvite({
          email,
          role,
          company_id: data.company_id,
          department_id: departmentId,
          invited_by: data.invited_by,
        })
        return { ok: true as const, email, delivery }
      } catch (err) {
        return {
          ok: false as const,
          email: email || member.email,
          message: err instanceof Error ? err.message : 'Failed to invite member',
        }
      }
    }))

    const invited: string[] = []
    const failed: Array<{ email: string; message: string }> = []
    const pendingDeliveries: InviteDelivery[] = []
    for (const outcome of outcomes) {
      if (outcome.ok) { invited.push(outcome.email); pendingDeliveries.push(outcome.delivery) }
      else failed.push({ email: outcome.email, message: outcome.message })
    }

    // Every invitation row is committed at this point. The emails are handed back for the route to
    // send after it responds: which rows were accepted or rejected is decided entirely by validation
    // above, so making the caller wait for the email provider adds nothing it can act on.
    return { invited, failed, pendingDeliveries }
  },
}
