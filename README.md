# OpsAudit AI — MVP v3

AI-powered operational audit platform. Next.js 14 + Firebase + Anthropic Claude.

## What's Built

### Phase 1 — Foundation
- Auth (email/password + Google SSO + forgot password)
- Company workspace onboarding (3-step wizard)
- Multi-tenant Firestore with full security rules
- Roles: Admin, Manager, Auditor, Assignee, Viewer
- Token-based invite system with email notifications
- Immutable audit trail on every action
- Superadmin portal

### Phase 2 — AI Intelligence
- AI template generator (plain English → checklist)
- SOP/Work Instruction PDF upload → AI compliance checklist
- Mobile-first audit execution flow
- Photo capture + real-time Claude Vision hazard detection
- AI risk scoring per finding (likelihood × impact)
- AI corrective action suggestions
- AI Audit Copilot (floating voice-enabled chat during audits)
- Audit quality scoring (post-submission)
- Before/After photo verification for corrective actions
- Auto-generated PDF reports with AI executive summary
- Full analytics dashboard (recharts: trend, donut, frequency)
- Natural language analytics ("ask your data")
- Predictive Risk Index per location
- Root Cause Analysis engine
- Action detail panel with comments + AI verification
- Intelligence page (predictions + RCA)
- 6 Cloud Functions: custom claims, escalation, health scores, benchmarking, anomaly detection, superadmin

### Phase 3 — Monetisation & Modules
- Stripe subscription (checkout, webhooks, billing portal)
- Freemium limits enforcement (audits/locations/members)
- Upgrade modal on limit hit
- Billing settings tab with plan comparison
- Resend email system (invite, overdue, audit report, weekly digest, escalation, welcome)
- Email placeholders — works without API key, logs to console
- Permit to Work module (5 types, AI validation, active permit tracking)
- Incident Management (5 types, AI root cause + regulatory notification, RIDDOR check)
- Sidebar updated with all new pages

## Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Auth & DB**: Firebase (Auth, Firestore, Storage)
- **AI**: Anthropic Claude API (claude-opus-4-6)
- **Payments**: Stripe
- **Email**: Resend
- **Charts**: Recharts
- **PDF**: @react-pdf/renderer

## Quick Start

```bash
npm install
cp .env.local.example .env.local
# Fill in Firebase + Anthropic keys (Stripe + Resend optional for now)
npm run dev
```

## Environment Variables

```env
# Required
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Stripe (add when ready)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# Resend (add when ready)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@opsaudit.ai

# Admin
ADMIN_SECRET=your-random-secret
```

## Stripe Setup (when ready)

1. Create products in Stripe dashboard:
   - Professional: €149/month recurring
   - Enterprise: €349/month recurring
2. Copy the Price IDs into your env vars
3. Set up webhook endpoint: `https://your-domain.com/api/stripe/webhook`
   - Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy webhook signing secret into `STRIPE_WEBHOOK_SECRET`

## Resend Setup (when ready)

1. Create account at resend.com
2. Add and verify your sending domain
3. Create an API key
4. Add to `RESEND_API_KEY` and set `RESEND_FROM_EMAIL`

## Deploy

```bash
# Deploy Firebase rules + indexes
firebase deploy --only firestore:rules,firestore:indexes,storage

# Deploy Cloud Functions
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions

# Full deploy (hosting + functions + rules)
firebase deploy
```

## File Structure

```
opsaudit/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/          ← Analytics + AI query
│   │   ├── audits/             ← List, new, conduct, detail
│   │   ├── templates/          ← Library + manual/AI/SOP builder
│   │   ├── actions/            ← Hub + detail panel + verification
│   │   ├── permits/            ← Permit to Work + AI validation
│   │   ├── incidents/          ← Incident reporting + AI analysis
│   │   ├── intelligence/       ← Predictive risk + root cause
│   │   ├── team/               ← Members + invites
│   │   └── settings/           ← Company + locations + billing
│   ├── api/
│   │   ├── stripe/             ← checkout, webhook, portal
│   │   ├── email/              ← unified email endpoint
│   │   ├── generate-template/  ├── analyse-sop/
│   │   ├── analyse-photo/      ├── score-risk/
│   │   ├── score-quality/      ├── audit-copilot/
│   │   ├── generate-report/    ├── analytics-query/
│   │   ├── predict-risk/       ├── root-cause/
│   │   ├── verify-resolution/  ├── check-permit/
│   │   └── analyse-incident/
│   ├── auth/                   ← login, signup, forgot-password
│   ├── invite/                 ← token acceptance
│   └── onboarding/             ← company setup wizard
├── components/
│   ├── Sidebar.tsx             ├── Charts.tsx
│   ├── AuditCopilot.tsx        ├── AuditReport.tsx
│   ├── ActionDetailPanel.tsx   ├── UpgradeModal.tsx
│   └── BillingPage.tsx
├── hooks/
│   └── useUsageLimits.ts
├── lib/
│   ├── firebase.ts  ├── stripe.ts
│   ├── email.ts     ├── auditLog.ts  ├── utils.ts
├── functions/src/index.ts       ← Cloud Functions
├── types/index.ts
├── firestore.rules  ├── storage.rules  ├── firestore.indexes.json
```

## Phase 4 Roadmap
- REST API for enterprise (GET /audits, GET /findings, webhooks)
- ESG / Environmental audit module
- Mobile PWA (offline service worker + manifest)
- Advanced benchmarking dashboard
- Contractor self-service portal
- Slack / Teams notification integration
