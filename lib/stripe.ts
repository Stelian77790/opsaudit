import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set — Stripe features disabled')
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    limits: {
      auditsPerMonth: 3,
      locations: 2,
      members: 5,
    },
    features: ['3 audits/month', '2 locations', '5 members', 'Basic reports', 'AI template generator'],
  },
  professional: {
    name: 'Professional',
    price: 149,
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_PLACEHOLDER',
    limits: {
      auditsPerMonth: Infinity,
      locations: Infinity,
      members: Infinity,
    },
    features: [
      'Unlimited audits',
      'Unlimited locations',
      'Unlimited members',
      'All AI features',
      'Branded PDF reports',
      'Analytics dashboard',
      'Predictive risk index',
      'Root cause analysis',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 349,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_PLACEHOLDER',
    limits: {
      auditsPerMonth: Infinity,
      locations: Infinity,
      members: Infinity,
    },
    features: [
      'Everything in Professional',
      'Industry benchmarking',
      'REST API access',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom branding',
    ],
  },
}

export type PlanTier = keyof typeof PLANS
