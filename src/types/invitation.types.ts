export interface InvitationCode {
  code: string
  company_id: string
  department_id: string | null
  role: 'Owner' | 'Partner' | 'Manager' | 'Employee'
  status: 'Active' | 'Expired'
  generated_by: string
  used_by: string | null
  created_at: string
  expired_at: string
}
