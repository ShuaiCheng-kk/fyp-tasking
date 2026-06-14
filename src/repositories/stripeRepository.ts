// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'

export const stripeRepository = {
  async updateCompanyPlan(companyId: string, plan: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({ plan })
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  },

  async updateCompanyStripeInfo(companyId: string, data: {
    stripe_customer_id: string
    stripe_subscription_id: string
    plan_started_at: string
    plan_next_billing_at: string
    plan: string
  }): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update(data)
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  },

  async getCompanyStripeInfo(companyId: string): Promise<{
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan_started_at: string | null
    plan_next_billing_at: string | null
    plan: string
  } | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('stripe_customer_id, stripe_subscription_id, plan_started_at, plan_next_billing_at, plan')
      .eq('id', companyId)
      .single()

    if (error) throw new Error(error.message)
    return data
  },

  async clearCompanySubscription(companyId: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({
        plan: 'Free',
        stripe_subscription_id: null,
        plan_next_billing_at: null,
      })
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  },
}
