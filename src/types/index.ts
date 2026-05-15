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
  company_id: string | null
  department_id: string | null
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

export interface JobPosting {
  id: string
  title: string
  description: string | null
  company_id: string
  department_id: string | null
  manager_id: string
  status: 'draft' | 'open' | 'closed' | 'cancelled'
  slots: number
  required_skills: string[]
  created_at: string
  closes_at: string | null
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
