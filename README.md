# OpsAudit AI — MVP v2

AI-powered operational audit platform. Next.js 14 + Firebase + Anthropic Claude.

## What's Built

### Phase 1 — Foundation
- Auth (email/password + Google SSO + forgot password)
- Company workspace creation (3-step onboarding)
- Multi-tenant Firestore with full security rules
- Role-based access: Admin, Manager, Auditor, Assignee, Viewer
- Invite system with token-based acceptance flow
- Immutable audit trail on every action
- Superadmin portal

### Phase 2 — Intelligence
- AI template generator (plain English → full checklist)
- SOP/Work Instruction upload → AI generates compliance checklist
- Audit execution flow (mobile-first, section by section)
- Photo capture with real-time Claude Vision hazard analysis
- AI risk scoring per finding (likelihood × impact)
- AI corrective action suggestions
- AI Audit Copilot (floating chat during audits, voice-enabled)
- Audit quality scoring (post-submission)
- Before/After photo verification for corrective actions
- Auto-generated PDF audit reports with AI executive summary
- Full analytics dashboard with recharts (score trend, severity donut, frequency chart)
- Natural language analytics ("ask your data")
- Predictive Risk Index per location
- Root Cause Analysis engine
- Corrective actions hub with detail panel and comments
- Intelligence page (predictions + RCA)
- Cloud Functions: custom claims, escalation, health scores, benchmarking, anomaly detection

## Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Auth & DB**: Firebase (Auth, Firestore, Storage)
- **AI**: Anthropic Claude API (claude-opus-4-6)
- **Charts**: Recharts
- **PDF**: @react-pdf/renderer
- **Animations**: Framer Motion
- **Design**: Black & Orange dark premium (#0A0A0A / #F97316)

## Quick Start

```bash
# 1. Install
npm install
cp .env.local.example .env.local

# 2. Fill in .env.local with Firebase + Anthropic keys

# 3. Run
npm run dev
```

## Firebase Setup

1. Create project at console.firebase.google.com
2. Enable: Authentication (Email/Password + Google), Firestore, Storage
3. Add web app → copy config to .env.local
4. Deploy rules:
```bash
npm install -g firebase-tools
firebase login
firebase use --add   # select your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## Cloud Functions Setup

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

Functions deployed:
- `onMemberWrite` — sets custom claims when member joins (critical for security rules)
- `escalateOverdueActions` — daily 8am escalation check
- `calculateHealthScores` — weekly composite score
- `aggregateBenchmarks` — nightly anonymised industry benchmarks
- `detectAuditAnomalies` — flags suspicious audit patterns
- `setSuperAdmin` — HTTP endpoint to grant superadmin (protect with ADMIN_SECRET env var)

## Set Yourself as Superadmin

After deploying functions:
```bash
curl -X POST https://your-region-your-project.cloudfunctions.net/setSuperAdmin \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"uid": "your-firebase-uid"}'
```

## Deploy to Vercel (Recommended)

```bash
npm install -g vercel
vercel
# Add all .env.local values in Vercel dashboard
```

## Project Structure

```
opsaudit/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/        ← Analytics dashboard with charts
│   │   ├── audits/           ← List, new, [id], [id]/conduct
│   │   ├── templates/        ← Library, new (manual + AI + SOP upload)
│   │   ├── actions/          ← Hub with detail panel + AI verification
│   │   ├── intelligence/     ← Predictive risk + root cause analysis
│   │   ├── team/             ← Members + invitations
│   │   └── settings/         ← Company + locations
│   ├── api/
│   │   ├── generate-template/   ← Claude: AI template from description
│   │   ├── analyse-sop/         ← Claude: SOP document → checklist
│   │   ├── analyse-photo/       ← Claude Vision: hazard detection
│   │   ├── score-risk/          ← Claude: likelihood × impact scoring
│   │   ├── score-quality/       ← Claude: audit quality assessment
│   │   ├── audit-copilot/       ← Claude: in-audit chat assistant
│   │   ├── generate-report/     ← Claude: executive summary + report
│   │   ├── generate-summary/    ← Claude: standalone summary
│   │   ├── analytics-query/     ← Claude: natural language analytics
│   │   ├── predict-risk/        ← Claude: forward risk prediction
│   │   ├── root-cause/          ← Claude: systemic root cause analysis
│   │   └── verify-resolution/   ← Claude: before/after verification
│   ├── auth/                    ← Login, signup, forgot password
│   ├── invite/                  ← Token-based invite acceptance
│   └── onboarding/              ← Company setup wizard
├── components/
│   ├── Sidebar.tsx
│   ├── Charts.tsx               ← Recharts components
│   ├── AuditCopilot.tsx         ← Floating AI chat during audits
│   ├── AuditReport.tsx          ← React PDF report
│   └── ActionDetailPanel.tsx    ← Slide-in action detail
├── contexts/AuthContext.tsx
├── lib/
│   ├── firebase.ts
│   ├── auditLog.ts
│   └── utils.ts
├── types/index.ts
├── functions/src/index.ts       ← All Cloud Functions
├── firestore.rules
├── storage.rules
└── firestore.indexes.json
```

## Environment Variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=https://your-domain.com
ADMIN_SECRET=your-random-secret-for-superadmin-endpoint
```

## Phase 3 Roadmap (Next)
- Permit to Work module
- Incident Management
- ESG/Environmental auditing module
- REST API for enterprise
- Stripe subscription integration
- Email notification system (Firebase Extensions or Resend)
- Offline mode with service worker
- Mobile PWA manifest
