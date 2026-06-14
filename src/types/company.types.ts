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
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan_started_at: string | null
  plan_next_billing_at: string | null
  plan_cancel_at: string | null
}
