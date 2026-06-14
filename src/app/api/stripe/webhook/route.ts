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
      await stripeRepository.updateCompanyPlan(companyId, 'Paid')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update company plan'
      return NextResponse.json({ success: false, message }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
