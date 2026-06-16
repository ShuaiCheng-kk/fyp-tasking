export interface User {
  id: string
  supabase_auth_id: string
  full_name: string
  email_address: string
  phone_number: string | null
  date_of_birth: string | null
  profile_photo_url: string | null
  role: 'Owner' | 'Partner' | 'Manager' | 'Employee' | 'Casual Worker' | 'Guest User'
  company_id: string | null
  created_at: string
  payment_method: string | null
  payment_account: string | null
}
