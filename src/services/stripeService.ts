// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { stripe } from '@/lib/stripe'
import { stripeRepository } from '@/repositories/stripeRepository'

const PRICE_ID = 'price_1TiEhu40ShbeCpWad1gCGxK6'

export interface SubscriptionDetails {
  plan: string
  plan_started_at: string | null
  plan_next_billing_at: string | null
  stripe_subscription_id: string | null
}

export const stripeService = {
  async createCheckoutSession(userId: string, companyId: string, email: string): Promise<string> {
    const successUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/get-started`)
    successUrl.searchParams.set('verify', '1')
    successUrl.searchParams.set('email', email)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      metadata: { companyId, userId },
      success_url: successUrl.toString(),
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/get-started?step=plan`,
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return session.url
  },

  async saveCheckoutSubscription(companyId: string, sessionId: string): Promise<void> {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    const sub = session.subscription as import('stripe').Stripe.Subscription | null
    if (!sub) throw new Error('No subscription found in session')

    const startedAt = new Date(sub.start_date * 1000).toISOString()
    const nextBillingAt = new Date(sub.current_period_end * 1000).toISOString()
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? ''

    await stripeRepository.updateCompanyStripeInfo(companyId, {
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      plan_started_at: startedAt,
      plan_next_billing_at: nextBillingAt,
      plan: 'Paid',
    })
  },

  async getSubscriptionDetails(companyId: string): Promise<SubscriptionDetails> {
    const info = await stripeRepository.getCompanyStripeInfo(companyId)
    if (!info) throw new Error('Company not found')

    if (info.plan === 'Paid') {
      // If we have a stored subscription ID, refresh billing dates from Stripe
      if (info.stripe_subscription_id) {
        try {
          const sub = await stripe.subscriptions.retrieve(info.stripe_subscription_id)
          const startedAt = info.plan_started_at ?? new Date(sub.start_date * 1000).toISOString()
          const nextBillingAt = new Date(sub.current_period_end * 1000).toISOString()
          const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as { id: string })?.id ?? ''

          await stripeRepository.updateCompanyStripeInfo(companyId, {
            stripe_customer_id: customerId,
            stripe_subscription_id: info.stripe_subscription_id,
            plan_started_at: startedAt,
            plan_next_billing_at: nextBillingAt,
            plan: 'Paid',
          })
          info.plan_started_at = startedAt
          info.plan_next_billing_at = nextBillingAt
        } catch {
          // Stripe lookup failed — return stored values
        }
      } else {
        // Existing Pro subscriber before new columns were added — backfill from Stripe
        // by searching checkout sessions with companyId metadata
        try {
          const sessions = await stripe.checkout.sessions.list({ limit: 100 })
          const match = sessions.data.find(s => s.metadata?.companyId === companyId && s.subscription)

          if (match?.subscription) {
            const subId = typeof match.subscription === 'string' ? match.subscription : match.subscription.id
            const sub = await stripe.subscriptions.retrieve(subId)
            const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as { id: string })?.id ?? ''
            const startedAt = new Date(sub.start_date * 1000).toISOString()
            const nextBillingAt = new Date(sub.current_period_end * 1000).toISOString()

            await stripeRepository.updateCompanyStripeInfo(companyId, {
              stripe_customer_id: customerId,
              stripe_subscription_id: sub.id,
              plan_started_at: startedAt,
              plan_next_billing_at: nextBillingAt,
              plan: 'Paid',
            })
            info.stripe_subscription_id = sub.id
            info.plan_started_at = startedAt
            info.plan_next_billing_at = nextBillingAt
          }
        } catch {
          // Backfill failed — dates will show as null
        }
      }
    }

    return {
      plan: info.plan,
      plan_started_at: info.plan_started_at,
      plan_next_billing_at: info.plan_next_billing_at,
      stripe_subscription_id: info.stripe_subscription_id,
    }
  },

  async cancelSubscription(companyId: string): Promise<void> {
    const info = await stripeRepository.getCompanyStripeInfo(companyId)
    if (!info?.stripe_subscription_id) throw new Error('No active subscription found')

    await stripe.subscriptions.cancel(info.stripe_subscription_id)
    await stripeRepository.clearCompanySubscription(companyId)
  },

  async createUpgradeCheckoutSession(userId: string, companyId: string, email: string): Promise<string> {
    const successUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/owner/settings`)
    successUrl.searchParams.set('upgraded', '1')

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      metadata: { companyId, userId },
      customer_email: email,
      success_url: successUrl.toString(),
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/owner/settings`,
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return session.url
  },
}
