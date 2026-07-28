export interface WorkerCertificate {
  id: string
  user_id: string
  name: string
  certificate_url: string | null
  created_at: string
}

export interface WorkerProfile {
  id: string
  full_name: string
  email_address: string
  phone_number: string
  date_of_birth: string
  profile_photo_url: string
  role: string
  supabase_auth_id: string
  skills: string | null
  resume_url: string | null
  certificates: WorkerCertificate[]
}

// Preset names keep spelling consistent so the AI matcher and the employer see the same label
// ("Food Hygiene" vs "Food Hygine" vs "食品卫生" would never match). Kept to the certificates
// most casual workers actually hold — everything else (Barista, Lifeguard, Class 3 Driving
// Licence, etc.) goes through "Add custom certificate" instead of bloating this dropdown.
export const PRESET_CERTIFICATES = [
  'Food Hygiene Certificate',
  'First Aid Certificate (CPR + AED)',
  'WSQ Food Safety Course Level 1',
  'Forklift Licence',
  'Security Officer Licence',
] as const
