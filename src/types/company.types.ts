export interface Company {
  id: string
  name: string
  description: string | null
  owner_id: string
  plan: 'Free' | 'Paid'
  created_at: string
  location: string | null
  address: string | null
  postal_code: string | null
  industry: string | null
  size: string | null
  logo_url: string | null
  website: string | null
}
