import { InviteDelivery } from '@/services/invitation/invitationService'

export interface DepartmentImportRow {
  name: string
}

export interface DepartmentImportResult {
  created: string[]
  skipped: string[]
}

export interface MemberImportRow {
  email: string
  role: 'Partner' | 'Manager' | 'Employee'
  department_name?: string | null
  department_id?: string | null
}

export interface MemberImportResult {
  invited: string[]
  failed: Array<{ email: string; message: string }>
  // Invitation emails prepared but not yet sent - the route delivers these after responding, so a
  // slow email provider does not hold up an import whose invitation rows are already committed.
  pendingDeliveries: InviteDelivery[]
}
