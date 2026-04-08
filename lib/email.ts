import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_PLACEHOLDER'
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@opsaudit.ai'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// ─── SHARED STYLES ───
const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #0A0A0A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 560px; margin: 40px auto; background: #111111; border: 1px solid #1F1F1F; border-radius: 16px; overflow: hidden; }
    .header { background: #111111; padding: 24px 32px; border-bottom: 1px solid #1F1F1F; display: flex; align-items: center; gap: 12px; }
    .logo { width: 36px; height: 36px; background: #F97316; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .brand { color: #FFFFFF; font-size: 18px; font-weight: 700; }
    .brand-ai { color: #F97316; font-size: 12px; margin-left: 4px; }
    .body { padding: 32px; }
    .footer { padding: 20px 32px; border-top: 1px solid #1F1F1F; text-align: center; }
    h1 { color: #FFFFFF; font-size: 22px; font-weight: 700; margin: 0 0 8px; }
    p { color: #A3A3A3; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; background: #F97316; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 8px 0 20px; }
    .card { background: #1A1A1A; border: 1px solid #2A2A2A; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .card-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .card-label { color: #525252; font-size: 13px; }
    .card-value { color: #FFFFFF; font-size: 13px; font-weight: 500; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-critical { background: rgba(239,68,68,0.15); color: #EF4444; border: 1px solid rgba(239,68,68,0.3); }
    .badge-high { background: rgba(249,115,22,0.15); color: #F97316; border: 1px solid rgba(249,115,22,0.3); }
    .badge-orange { background: rgba(249,115,22,0.15); color: #F97316; }
    .divider { border: none; border-top: 1px solid #1F1F1F; margin: 20px 0; }
    .footer-text { color: #525252; font-size: 12px; }
    .score { font-size: 42px; font-weight: 700; }
    .score-good { color: #22C55E; }
    .score-ok { color: #EAB308; }
    .score-bad { color: #EF4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo" style="width:36px;height:36px;background:#F97316;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-weight:700;font-size:16px;">O</span>
      </div>
      <span class="brand">OpsAudit<span class="brand-ai">AI</span></span>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p class="footer-text">OpsAudit AI · Operational Intelligence Platform<br>
      You're receiving this because you're a member of a workspace on OpsAudit.</p>
    </div>
  </div>
</body>
</html>`

// ─── EMAIL FUNCTIONS ───

export async function sendInviteEmail({
  toEmail,
  toName,
  inviterName,
  companyName,
  role,
  token,
  message,
}: {
  toEmail: string
  toName?: string
  inviterName: string
  companyName: string
  role: string
  token: string
  message?: string
}) {
  const inviteUrl = `${APP_URL}/invite?token=${token}`

  if (!resend) {
    console.log(`[EMAIL PLACEHOLDER] Invite to ${toEmail}: ${inviteUrl}`)
    return { success: true, placeholder: true }
  }

  const html = emailWrapper(`
    <h1>You've been invited to join ${companyName}</h1>
    <p><strong style="color:#FFFFFF">${inviterName}</strong> has invited you to join <strong style="color:#F97316">${companyName}</strong> on OpsAudit AI as a <strong style="color:#FFFFFF">${role}</strong>.</p>
    ${message ? `<div class="card"><p style="margin:0;font-style:italic;">"${message}"</p></div>` : ''}
    <a href="${inviteUrl}" class="btn">Accept Invitation →</a>
    <p style="font-size:12px;color:#525252;">This invitation expires in 7 days. If you didn't expect this, you can ignore this email.</p>
  `)

  return resend.emails.send({ from: FROM, to: toEmail, subject: `You've been invited to join ${companyName} on OpsAudit AI`, html })
}

export async function sendOverdueActionEmail({
  toEmail,
  toName,
  actions,
  companyName,
}: {
  toEmail: string
  toName: string
  actions: Array<{ title: string; priority: string; daysOverdue: number; auditTitle: string }>
  companyName: string
}) {
  if (!resend) {
    console.log(`[EMAIL PLACEHOLDER] Overdue actions to ${toEmail}: ${actions.length} actions`)
    return { success: true, placeholder: true }
  }

  const actionRows = actions.map(a => `
    <div class="card-row">
      <span class="card-value">${a.title}</span>
      <span class="badge badge-${a.priority === 'critical' ? 'critical' : 'high'}">${a.daysOverdue}d overdue</span>
    </div>
    <div class="card-row" style="margin-bottom:12px;">
      <span class="card-label">${a.auditTitle}</span>
      <span class="card-label">${a.priority}</span>
    </div>
  `).join('<hr class="divider">')

  const html = emailWrapper(`
    <h1>You have overdue actions</h1>
    <p>Hi ${toName}, you have <strong style="color:#F97316">${actions.length} overdue corrective action${actions.length > 1 ? 's' : ''}</strong> in ${companyName} that need your attention.</p>
    <div class="card">${actionRows}</div>
    <a href="${APP_URL}/actions" class="btn">Review Actions →</a>
  `)

  return resend.emails.send({ from: FROM, to: toEmail, subject: `${actions.length} overdue action${actions.length > 1 ? 's' : ''} need your attention`, html })
}

export async function sendAuditReportEmail({
  toEmail,
  toName,
  auditTitle,
  locationName,
  score,
  findingsCount,
  criticalCount,
  auditId,
  companyName,
}: {
  toEmail: string
  toName: string
  auditTitle: string
  locationName: string
  score: number
  findingsCount: number
  criticalCount: number
  auditId: string
  companyName: string
}) {
  if (!resend) {
    console.log(`[EMAIL PLACEHOLDER] Audit report to ${toEmail}: ${auditTitle} score ${score}%`)
    return { success: true, placeholder: true }
  }

  const scoreClass = score >= 80 ? 'score-good' : score >= 60 ? 'score-ok' : 'score-bad'

  const html = emailWrapper(`
    <h1>Audit Submitted</h1>
    <p>An audit has been completed for <strong style="color:#FFFFFF">${locationName}</strong>.</p>
    <div class="card" style="text-align:center;">
      <p style="margin:0;color:#525252;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Overall Score</p>
      <div class="score ${scoreClass}">${score}%</div>
    </div>
    <div class="card">
      <div class="card-row"><span class="card-label">Audit</span><span class="card-value">${auditTitle}</span></div>
      <div class="card-row"><span class="card-label">Location</span><span class="card-value">${locationName}</span></div>
      <div class="card-row"><span class="card-label">Total findings</span><span class="card-value">${findingsCount}</span></div>
      <div class="card-row"><span class="card-label">Critical issues</span><span class="card-value" style="color:${criticalCount > 0 ? '#EF4444' : '#22C55E'}">${criticalCount}</span></div>
    </div>
    <a href="${APP_URL}/audits/${auditId}" class="btn">View Full Report →</a>
  `)

  return resend.emails.send({ from: FROM, to: toEmail, subject: `Audit complete: ${auditTitle} — ${score}%`, html })
}

export async function sendWeeklyDigestEmail({
  toEmail,
  toName,
  companyName,
  healthScore,
  openActions,
  auditsThisWeek,
  criticalActions,
}: {
  toEmail: string
  toName: string
  companyName: string
  healthScore: number
  openActions: number
  auditsThisWeek: number
  criticalActions: number
}) {
  if (!resend) {
    console.log(`[EMAIL PLACEHOLDER] Weekly digest to ${toEmail}`)
    return { success: true, placeholder: true }
  }

  const scoreClass = healthScore >= 80 ? 'score-good' : healthScore >= 60 ? 'score-ok' : 'score-bad'

  const html = emailWrapper(`
    <h1>Your weekly safety digest</h1>
    <p>Hi ${toName}, here's your weekly OpsAudit summary for <strong style="color:#FFFFFF">${companyName}</strong>.</p>
    <div class="card" style="text-align:center;">
      <p style="margin:0;color:#525252;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Health Score</p>
      <div class="score ${scoreClass}">${healthScore}</div>
    </div>
    <div class="card">
      <div class="card-row"><span class="card-label">Audits this week</span><span class="card-value">${auditsThisWeek}</span></div>
      <div class="card-row"><span class="card-label">Open actions</span><span class="card-value">${openActions}</span></div>
      <div class="card-row"><span class="card-label">Critical actions</span><span class="card-value" style="color:${criticalActions > 0 ? '#EF4444' : '#22C55E'}">${criticalActions}</span></div>
    </div>
    <a href="${APP_URL}/dashboard" class="btn">View Dashboard →</a>
  `)

  return resend.emails.send({ from: FROM, to: toEmail, subject: `Weekly digest: ${companyName} — Health Score ${healthScore}`, html })
}

export async function sendEscalationEmail({
  toEmail,
  toName,
  actionTitle,
  daysOverdue,
  assigneeName,
  auditTitle,
  auditId,
  companyName,
}: {
  toEmail: string
  toName: string
  actionTitle: string
  daysOverdue: number
  assigneeName: string
  auditTitle: string
  auditId: string
  companyName: string
}) {
  if (!resend) {
    console.log(`[EMAIL PLACEHOLDER] Escalation to ${toEmail}: ${actionTitle}`)
    return { success: true, placeholder: true }
  }

  const html = emailWrapper(`
    <h1 style="color:#EF4444;">⚠ Action Escalated</h1>
    <p>A corrective action in <strong style="color:#FFFFFF">${companyName}</strong> has been escalated after being overdue for <strong style="color:#EF4444">${daysOverdue} days</strong>.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Action</span><span class="card-value">${actionTitle}</span></div>
      <div class="card-row"><span class="card-label">Assigned to</span><span class="card-value">${assigneeName}</span></div>
      <div class="card-row"><span class="card-label">Audit</span><span class="card-value">${auditTitle}</span></div>
      <div class="card-row"><span class="card-label">Days overdue</span><span class="card-value" style="color:#EF4444;">${daysOverdue} days</span></div>
    </div>
    <a href="${APP_URL}/audits/${auditId}" class="btn">View & Resolve →</a>
  `)

  return resend.emails.send({ from: FROM, to: toEmail, subject: `⚠ Escalated: ${actionTitle} is ${daysOverdue} days overdue`, html })
}

export async function sendWelcomeEmail({
  toEmail,
  toName,
  companyName,
}: {
  toEmail: string
  toName: string
  companyName: string
}) {
  if (!resend) {
    console.log(`[EMAIL PLACEHOLDER] Welcome to ${toEmail}`)
    return { success: true, placeholder: true }
  }

  const html = emailWrapper(`
    <h1>Welcome to OpsAudit AI 🎉</h1>
    <p>Hi ${toName}, your workspace for <strong style="color:#F97316">${companyName}</strong> is ready.</p>
    <p>Here's how to get started in the next 10 minutes:</p>
    <div class="card">
      <div class="card-row" style="margin-bottom:8px;"><span style="color:#F97316;font-weight:600;">1.</span><span class="card-value" style="margin-left:8px;">Create an AI-powered audit template</span></div>
      <div class="card-row" style="margin-bottom:8px;"><span style="color:#F97316;font-weight:600;">2.</span><span class="card-value" style="margin-left:8px;">Invite your H&S team</span></div>
      <div class="card-row"><span style="color:#F97316;font-weight:600;">3.</span><span class="card-value" style="margin-left:8px;">Run your first audit</span></div>
    </div>
    <a href="${APP_URL}/templates/new?mode=ai" class="btn">Create Your First Template →</a>
  `)

  return resend.emails.send({ from: FROM, to: toEmail, subject: `Welcome to OpsAudit AI — let's get started`, html })
}
