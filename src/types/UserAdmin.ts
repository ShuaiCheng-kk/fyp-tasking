export interface UACompany {
  id: string
  name: string
  description: string | null
  plan: string
  industry: string | null
  size: string | null
  location: string | null
  website: string | null
  address: string | null
  postal_code: string | null
  logo_url: string | null
  plan_started_at: string | null
  plan_next_billing_at: string | null
  plan_cancel_at: string | null
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
  profile_photo_url: string | null
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

export interface UAReportStats {
  totalCompanies: number
  totalUsers: number
  activeCompanies: number
  activeUsers: number
  suspendedCompanies: number
  suspendedUsers: number
  newCompaniesLast7Days: number
  newUsersLast7Days: number
  newCompaniesLast30Days: number
  newUsersLast30Days: number
  newCompaniesInRange: number
  newUsersInRange: number
  invitationFunnel: { used: number; pending: number; expired: number }
  usersWithCompany: number
  usersWithoutCompany: number
  usersByCompanyPlan: { free: number; paid: number }
  avgUsersPerCompany: number
  pendingInvitationCount: number
  topCompaniesByMemberCount: { name: string; count: number }[]
  planBreakdown: Record<string, number>
  roleBreakdown: Record<string, number>
  industryBreakdown: Record<string, number>
  companySizeBreakdown: Record<string, number>
  growthByMonth: { month: string; companies: number; users: number }[]
}
