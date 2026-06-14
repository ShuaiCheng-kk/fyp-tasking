// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { stripe } from '@/lib/stripe'
import { stripeRepository } from '@/repositories/stripeRepository'
import type Stripe from 'stripe'

const PRICE_ID = 'price_1TiEhu40ShbeCpWad1gCGxK6'

export interface SubscriptionDetails {
  plan: string
  plan_started_at: string | null
  plan_next_billing_at: string | null
  plan_cancel_at: string | null
  stripe_subscription_id: string | null
}

// current_period_end moved to SubscriptionItem in Stripe SDK v17+ (API 2025+)
function getPeriodEnd(sub: Stripe.Subscription): number {
  return (sub as unknown as { current_period_end?: number }).current_period_end
    ?? sub.items?.data?.[0]?.current_period_end
    ?? sub.created
}

function getCustomerId(sub: Stripe.Subscription): string {
  return typeof sub.customer === 'string' ? sub.customer : (sub.customer as Stripe.Customer)?.id ?? ''
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
      expand: ['subscription', 'subscription.items'],
    })

    const sub = session.subscription as Stripe.Subscription | null
    if (!sub) throw new Error('No subscription found in session')

    await stripeRepository.updateCompanyStripeInfo(companyId, {
      stripe_customer_id: getCustomerId(sub),
      stripe_subscription_id: sub.id,
      plan_started_at: new Date(sub.start_date * 1000).toISOString(),
      plan_next_billing_at: new Date(getPeriodEnd(sub) * 1000).toISOString(),
      plan: 'Paid',
    })
    // Clear any pending cancellation (e.g. user re-subscribed after cancelling)
    await stripeRepository.resumeCompanySubscription(companyId)
  },

  async getSubscriptionDetails(companyId: string): Promise<SubscriptionDetails> {
    const info = await stripeRepository.getCompanyStripeInfo(companyId)
    if (!info) throw new Error('Company not found')

    if (info.plan === 'Paid') {
      if (info.stripe_subscription_id) {
        try {
          const sub = await stripe.subscriptions.retrieve(info.stripe_subscription_id, { expand: ['items'] })
          const startedAt = info.plan_started_at ?? new Date(sub.start_date * 1000).toISOString()
          const nextBillingAt = new Date(getPeriodEnd(sub) * 1000).toISOString()

          // Sync cancel_at_period_end status from Stripe
          const cancelAtPeriodEnd = (sub as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end ?? false
          const cancelAt = cancelAtPeriodEnd ? new Date(getPeriodEnd(sub) * 1000).toISOString() : null

          await stripeRepository.updateCompanyStripeInfo(companyId, {
            stripe_customer_id: getCustomerId(sub),
            stripe_subscription_id: info.stripe_subscription_id,
            plan_started_at: startedAt,
            plan_next_billing_at: nextBillingAt,
            plan: 'Paid',
          })
          if (cancelAt !== info.plan_cancel_at) {
            if (cancelAt) {
              await stripeRepository.scheduleCompanyDowngrade(companyId, cancelAt)
            } else {
              await stripeRepository.resumeCompanySubscription(companyId)
            }
          }

          info.plan_started_at = startedAt
          info.plan_next_billing_at = nextBillingAt
          info.plan_cancel_at = cancelAt
        } catch {
          // Stripe lookup failed — return stored values
        }
      } else {
        // Existing Pro subscriber before new columns — backfill from Stripe checkout sessions
        try {
          const sessions = await stripe.checkout.sessions.list({ limit: 100 })
          const match = sessions.data.find(s => s.metadata?.companyId === companyId && s.subscription)

          if (match?.subscription) {
            const subId = typeof match.subscription === 'string' ? match.subscription : (match.subscription as Stripe.Subscription).id
            const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items'] })
            const startedAt = new Date(sub.start_date * 1000).toISOString()
            const nextBillingAt = new Date(getPeriodEnd(sub) * 1000).toISOString()
            const cancelAtPeriodEnd = (sub as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end ?? false
            const cancelAt = cancelAtPeriodEnd ? nextBillingAt : null

            await stripeRepository.updateCompanyStripeInfo(companyId, {
              stripe_customer_id: getCustomerId(sub),
              stripe_subscription_id: sub.id,
              plan_started_at: startedAt,
              plan_next_billing_at: nextBillingAt,
              plan: 'Paid',
            })
            if (cancelAt) await stripeRepository.scheduleCompanyDowngrade(companyId, cancelAt)

            info.stripe_subscription_id = sub.id
            info.plan_started_at = startedAt
            info.plan_next_billing_at = nextBillingAt
            info.plan_cancel_at = cancelAt
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
      plan_cancel_at: info.plan_cancel_at,
      stripe_subscription_id: info.stripe_subscription_id,
    }
  },

  // Schedule cancellation at end of billing period — user stays Pro until then
  async cancelSubscription(companyId: string): Promise<void> {
    const info = await stripeRepository.getCompanyStripeInfo(companyId)
    if (!info?.stripe_subscription_id) throw new Error('No active subscription found')

    const sub = await stripe.subscriptions.update(info.stripe_subscription_id, {
      cancel_at_period_end: true,
    } as Stripe.SubscriptionUpdateParams)

    const cancelAt = new Date(getPeriodEnd(sub) * 1000).toISOString()
    await stripeRepository.scheduleCompanyDowngrade(companyId, cancelAt)
  },

  // Un-cancel — resume subscription before period ends
  async resumeSubscription(companyId: string): Promise<void> {
    const info = await stripeRepository.getCompanyStripeInfo(companyId)
    if (!info?.stripe_subscription_id) throw new Error('No active subscription found')

    await stripe.subscriptions.update(info.stripe_subscription_id, {
      cancel_at_period_end: false,
    } as Stripe.SubscriptionUpdateParams)

    await stripeRepository.resumeCompanySubscription(companyId)
  },

  async createUpgradeCheckoutSession(userId: string, companyId: string, email: string): Promise<string> {
    const successUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/owner/dashboard`)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      metadata: { companyId, userId },
      customer_email: email,
      success_url: successUrl.toString(),
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/owner/dashboard`,
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return session.url
  },
}
