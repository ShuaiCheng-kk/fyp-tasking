// LAYER: Shared Types
// RULE: This file defines TypeScript interfaces mirroring database table schemas.
// RULE: Import these types in Repository, Service, and Controller layers.

export interface User {
  id: string
  supabase_auth_id: string
  full_name: string
  email_address: string
  phone_number: string | null
  role: 'Owner' | 'Manager' | 'Employee' | 'Casual Worker' | 'Guest User'
  created_at: string
}

export interface Company {
  id: string
  name: string
  description: string | null
  owner_id: string
  plan: 'Free' | 'Paid'
  created_at: string
}

export interface Department {
  id: string
  name: string
  company_id: string
  created_at: string
}

export interface InvitationCode {
  code: string
  company_id: string
  department_id: string | null
  role: 'Owner' | 'Manager' | 'Employee'
  status: 'Active' | 'Expired'
  generated_by: string
  used_by: string | null
  created_at: string
  expired_at: string
}
