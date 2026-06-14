// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { stripe } from '@/lib/stripe'

const PRICE_ID = 'price_1TiEhu40ShbeCpWad1gCGxK6'

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
}
