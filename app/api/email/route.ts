import { NextRequest, NextResponse } from 'next/server'
import {
  sendInviteEmail,
  sendOverdueActionEmail,
  sendAuditReportEmail,
  sendWeeklyDigestEmail,
  sendEscalationEmail,
  sendWelcomeEmail,
} from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { type, ...payload } = await req.json()

    let result

    switch (type) {
      case 'invite':
        result = await sendInviteEmail(payload)
        break
      case 'overdue_actions':
        result = await sendOverdueActionEmail(payload)
        break
      case 'audit_report':
        result = await sendAuditReportEmail(payload)
        break
      case 'weekly_digest':
        result = await sendWeeklyDigestEmail(payload)
        break
      case 'escalation':
        result = await sendEscalationEmail(payload)
        break
      case 'welcome':
        result = await sendWelcomeEmail(payload)
        break
      default:
        return NextResponse.json({ error: 'Unknown email type' }, { status: 400 })
    }

    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
