import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { logCritical } from '@/lib/auditLog'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret || webhookSecret === 'whsec_PLACEHOLDER') {
    console.warn('Stripe webhook secret not set — skipping signature verification')
    return NextResponse.json({ received: true })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const companyId = session.metadata?.companyId
  const planTier = session.metadata?.planTier

  switch (event.type) {
    case 'checkout.session.completed': {
      if (!companyId) break
      await updateDoc(doc(db, 'companies', companyId), {
        subscriptionTier: planTier || 'professional',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        subscriptionStatus: 'active',
        trialEndsAt: session.subscription ? null : null,
        updatedAt: serverTimestamp(),
      })
      console.log(`Company ${companyId} upgraded to ${planTier}`)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription & { current_period_end: number }
      const subCompanyId = subscription.metadata?.companyId
      if (!subCompanyId) break
      await updateDoc(doc(db, 'companies', subCompanyId), {
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        updatedAt: serverTimestamp(),
      })
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const subCompanyId = subscription.metadata?.companyId
      if (!subCompanyId) break
      await updateDoc(doc(db, 'companies', subCompanyId), {
        subscriptionTier: 'free',
        subscriptionStatus: 'cancelled',
        stripeSubscriptionId: null,
        updatedAt: serverTimestamp(),
      })
      console.log(`Company ${subCompanyId} downgraded to free`)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const invoiceCompanyId = (invoice as unknown as { metadata?: { companyId?: string } }).metadata?.companyId
      if (!invoiceCompanyId) break
      await updateDoc(doc(db, 'companies', invoiceCompanyId), {
        subscriptionStatus: 'past_due',
        updatedAt: serverTimestamp(),
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
