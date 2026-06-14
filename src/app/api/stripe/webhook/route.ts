// LAYER: Controller
// RULE: Parse request, validate, call repository, return response. No business logic.

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { stripeRepository } from '@/repositories/stripeRepository'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ success: false, message: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const companyId = session.metadata?.companyId

    if (!companyId) {
      return NextResponse.json({ success: false, message: 'Missing companyId in metadata' }, { status: 400 })
    }

    try {
      // Retrieve the subscription to get billing dates
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items'] })
        const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as Stripe.Customer)?.id ?? ''
        // current_period_end moved to SubscriptionItem in Stripe SDK v17+ (API 2025+)
        const periodEnd: number = (sub as unknown as { current_period_end?: number }).current_period_end
          ?? sub.items?.data?.[0]?.current_period_end
          ?? sub.created
        await stripeRepository.updateCompanyStripeInfo(companyId, {
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          plan_started_at: new Date(sub.start_date * 1000).toISOString(),
          plan_next_billing_at: new Date(periodEnd * 1000).toISOString(),
          plan: 'Paid',
        })
      } else {
        await stripeRepository.updateCompanyPlan(companyId, 'Paid')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update company plan'
      return NextResponse.json({ success: false, message }, { status: 500 })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id

    if (customerId) {
      try {
        // Find company by stripe_customer_id and downgrade
        const { data } = await (await import('@/lib/supabase')).supabase
          .from('companies')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (data?.id) {
          await stripeRepository.clearCompanySubscription(data.id)
        }
      } catch {
        // Best-effort: log but don't fail the webhook
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
