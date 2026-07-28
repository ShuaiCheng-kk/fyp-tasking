export interface User {
  id: string
  supabase_auth_id: string
  full_name: string
  email_address: string
  phone_number: string
  date_of_birth: string
  profile_photo_url: string
  role: 'Owner' | 'Partner' | 'Manager' | 'Employee' | 'Casual Worker' | 'Guest User' | 'Marketing Admin' | 'User Admin'
  company_id: string | null
  created_at: string
}
