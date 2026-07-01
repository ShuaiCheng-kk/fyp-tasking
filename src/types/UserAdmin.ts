export interface UACompany {
  id: string
  name: string
  description: string | null
  plan: string
  industry: string | null
  size: string | null
  location: string | null
  website: string | null
  is_suspended: boolean
  suspended_at: string | null
  suspended_reason: string | null
  created_at: string
  owner_id: string | null
}

export interface UACompanyDetail extends UACompany {
  member_count: number
  owner_name: string | null
  owner_email: string | null
}

export interface UAUser {
  id: string
  supabase_auth_id: string
  full_name: string
  email_address: string
  role: string
  company_id: string | null
  company_name: string | null
  is_suspended: boolean
  suspended_at: string | null
  suspended_reason: string | null
  created_at: string
}

export interface SuspendCompanyInput {
  company_id: string
  reason: string
}

export interface UnsuspendCompanyInput {
  company_id: string
}

export interface SuspendUserInput {
  user_id: string
  reason: string
}

export interface UnsuspendUserInput {
  user_id: string
}
