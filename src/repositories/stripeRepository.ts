// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()

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
    plan_cancel_at: string | null
    plan: string
  } | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('stripe_customer_id, stripe_subscription_id, plan_started_at, plan_next_billing_at, plan_cancel_at, plan')
      .eq('id', companyId)
      .single()

    if (error) throw new Error(error.message)
    return data
  },

  // Called when user schedules cancellation — keeps plan Paid until period ends
  async scheduleCompanyDowngrade(companyId: string, cancelAt: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({ plan_cancel_at: cancelAt })
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  },

  // Called when user resumes (un-cancels) their subscription
  async resumeCompanySubscription(companyId: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({ plan_cancel_at: null })
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  },

  // Called by webhook when subscription actually expires — downgrades to Free
  async clearCompanySubscription(companyId: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({
        plan: 'Free',
        stripe_subscription_id: null,
        plan_next_billing_at: null,
        plan_cancel_at: null,
      })
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  },
}
