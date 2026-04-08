import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { planTier, companyId, userId, userEmail, returnUrl } = await req.json()

    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured — add STRIPE_SECRET_KEY to env' }, { status: 503 })
    }

    const plan = PLANS[planTier as keyof typeof PLANS]
    if (!plan || planTier === 'free') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: userEmail,
      line_items: [{
        price: (plan as { priceId: string }).priceId,
        quantity: 1,
      }],
      metadata: {
        companyId,
        userId,
        planTier,
      },
      success_url: `${returnUrl || process.env.NEXT_PUBLIC_APP_URL}/settings?upgraded=true`,
      cancel_url: `${returnUrl || process.env.NEXT_PUBLIC_APP_URL}/settings?cancelled=true`,
      subscription_data: {
        trial_period_days: 14,
        metadata: { companyId, userId },
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
