import * as admin from 'firebase-admin'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'

admin.initializeApp()
const db = admin.firestore()

// ─────────────────────────────────────────────
// 1. SET CUSTOM CLAIMS WHEN MEMBER JOINS COMPANY
// ─────────────────────────────────────────────
export const onMemberWrite = onDocumentWritten(
  'companies/{companyId}/members/{userId}',
  async (event) => {
    const { companyId, userId } = event.params
    const data = event.data?.after?.data()

    if (!data) {
      // Member removed — clear claims
      try {
        await admin.auth().setCustomUserClaims(userId, {})
        logger.info(`Cleared claims for ${userId}`)
      } catch (err) {
        logger.error('Failed to clear claims', err)
      }
      return
    }

    try {
      await admin.auth().setCustomUserClaims(userId, {
        companyId,
        role: data.role,
        platformRole: data.platformRole || null,
      })
      logger.info(`Set claims for ${userId}: ${data.role} in ${companyId}`)
    } catch (err) {
      logger.error('Failed to set claims', err)
    }
  }
)

// ─────────────────────────────────────────────
// 2. OVERDUE ESCALATION — RUNS DAILY AT 8AM UTC
// ─────────────────────────────────────────────
export const escalateOverdueActions = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'UTC' },
  async () => {
    const now = new Date()
    logger.info('Running overdue escalation check...')

    try {
      // Get all audits
      const auditsSnap = await db.collection('audits').get()

      for (const auditDoc of auditsSnap.docs) {
        const actionsSnap = await db
          .collection(`audits/${auditDoc.id}/actions`)
          .where('status', 'in', ['open', 'in_progress'])
          .get()

        for (const actionDoc of actionsSnap.docs) {
          const action = actionDoc.data()
          if (!action.dueDate) continue

          const dueDate = action.dueDate.toDate()
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

          if (daysOverdue <= 0) continue

          const ref = actionDoc.ref

          if (daysOverdue >= 7 && action.status !== 'escalated') {
            // Escalate
            await ref.update({
              status: 'escalated',
              escalatedAt: admin.firestore.FieldValue.serverTimestamp(),
            })

            // Log escalation
            await db.collection(`companies/${action.companyId}/activityLog`).add({
              action: 'action_escalated',
              category: 'corrective_action',
              actor: { userId: 'system', name: 'OpsAudit System', role: 'system', email: '', isSystem: true },
              target: { type: 'corrective_action', id: actionDoc.id, label: action.title },
              metadata: { daysOverdue, previousStatus: action.status },
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              immutable: true,
            })

            logger.info(`Escalated action ${actionDoc.id} (${daysOverdue} days overdue)`)

          } else if (daysOverdue >= 4 && daysOverdue < 7) {
            // Log warning level
            logger.info(`Action ${actionDoc.id} is ${daysOverdue} days overdue - warning level`)
          }
        }
      }

      logger.info('Escalation check complete')
    } catch (err) {
      logger.error('Escalation check failed', err)
    }
  }
)

// ─────────────────────────────────────────────
// 3. WEEKLY HEALTH SCORE CALCULATION
// ─────────────────────────────────────────────
export const calculateHealthScores = onSchedule(
  { schedule: '0 6 * * 1', timeZone: 'UTC' }, // Every Monday 6am
  async () => {
    logger.info('Calculating health scores...')

    const companiesSnap = await db.collection('companies').get()

    for (const companyDoc of companiesSnap.docs) {
      try {
        const companyId = companyDoc.id
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

        // Get recent audits
        const auditsSnap = await db.collection('audits')
          .where('companyId', '==', companyId)
          .where('status', '==', 'submitted')
          .where('submittedAt', '>=', thirtyDaysAgo)
          .get()

        if (auditsSnap.empty) continue

        const audits = auditsSnap.docs.map(d => d.data())

        // Component 1: Average audit score (40%)
        const avgScore = audits.reduce((sum, a) => sum + (a.score || 0), 0) / audits.length

        // Component 2: On-time action resolution (30%)
        let totalActions = 0
        let onTimeActions = 0
        for (const auditDoc of auditsSnap.docs) {
          const actionsSnap = await db
            .collection(`audits/${auditDoc.id}/actions`)
            .where('status', '==', 'resolved')
            .get()

          for (const actionDoc of actionsSnap.docs) {
            const action = actionDoc.data()
            totalActions++
            if (action.dueDate && action.updatedAt) {
              const resolvedDate = action.updatedAt.toDate()
              const dueDate = action.dueDate.toDate()
              if (resolvedDate <= dueDate) onTimeActions++
            }
          }
        }
        const resolutionRate = totalActions > 0 ? (onTimeActions / totalActions) * 100 : 100

        // Component 3: Audit schedule adherence (20%)
        const scheduledAudits = audits.filter(a => a.scheduledDate)
        const adherenceRate = scheduledAudits.length > 0
          ? (audits.length / Math.max(scheduledAudits.length, 1)) * 100
          : 100

        // Component 4: Low recurrence rate (10%)
        const recurrenceRate = 90 // Placeholder — needs historical comparison

        // Composite score
        const healthScore = Math.round(
          (avgScore * 0.4) +
          (Math.min(resolutionRate, 100) * 0.3) +
          (Math.min(adherenceRate, 100) * 0.2) +
          (recurrenceRate * 0.1)
        )

        await companyDoc.ref.update({
          healthScore,
          healthScoreUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          healthScoreComponents: {
            auditScore: Math.round(avgScore),
            resolutionRate: Math.round(resolutionRate),
            adherenceRate: Math.round(adherenceRate),
            recurrenceRate,
          }
        })

        logger.info(`Health score for ${companyId}: ${healthScore}`)
      } catch (err) {
        logger.error(`Failed health score for ${companyDoc.id}`, err)
      }
    }

    logger.info('Health score calculation complete')
  }
)

// ─────────────────────────────────────────────
// 4. NIGHTLY BENCHMARKING AGGREGATION
// ─────────────────────────────────────────────
export const aggregateBenchmarks = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'UTC' }, // 2am daily
  async () => {
    logger.info('Aggregating benchmarks...')

    const companiesSnap = await db.collection('companies').get()

    // Group by industry
    const byIndustry: Record<string, {
      scores: number[]
      resolutionTimes: number[]
      findingCategories: Record<string, number>
    }> = {}

    for (const companyDoc of companiesSnap.docs) {
      const company = companyDoc.data()
      const industry = company.industry || 'Other'

      if (!byIndustry[industry]) {
        byIndustry[industry] = { scores: [], resolutionTimes: [], findingCategories: {} }
      }

      if (company.healthScore) {
        byIndustry[industry].scores.push(company.healthScore)
      }
    }

    // Write benchmarks (only for industries with 10+ companies for privacy)
    const batch = db.batch()

    for (const [industry, data] of Object.entries(byIndustry)) {
      if (data.scores.length < 10) continue // Privacy threshold

      const avgScore = data.scores.reduce((s, n) => s + n, 0) / data.scores.length
      const benchmarkRef = db.collection('benchmarks').doc(industry.toLowerCase().replace(/\s/g, '_'))

      batch.set(benchmarkRef, {
        industry,
        companyCount: data.scores.length,
        avgHealthScore: Math.round(avgScore),
        p25Score: percentile(data.scores, 25),
        p50Score: percentile(data.scores, 50),
        p75Score: percentile(data.scores, 75),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    await batch.commit()
    logger.info('Benchmarks aggregated')
  }
)

// ─────────────────────────────────────────────
// 5. ANOMALY DETECTION ON AUDIT SUBMISSION
// ─────────────────────────────────────────────
export const detectAuditAnomalies = onDocumentWritten(
  'audits/{auditId}',
  async (event) => {
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    // Only trigger when status changes to 'submitted'
    if (!after || before?.status === 'submitted' || after.status !== 'submitted') return

    const anomalyFlags: string[] = []
    const auditId = event.params.auditId

    try {
      // Check 1: Submitted too fast
      if (after.startedAt && after.submittedAt) {
        const startTime = after.startedAt.toDate().getTime()
        const submitTime = after.submittedAt.toDate().getTime()
        const durationMinutes = (submitTime - startTime) / (1000 * 60)
        const estimatedMinutes = after.estimatedMinutes || 30

        if (durationMinutes < estimatedMinutes * 0.2) {
          anomalyFlags.push(`Completed in ${Math.round(durationMinutes)}min (estimated ${estimatedMinutes}min)`)
        }
      }

      // Check 2: Perfect score with no evidence
      if (after.score === 100) {
        const findingsSnap = await db.collection(`audits/${auditId}/findings`).get()
        const hasPhotos = findingsSnap.docs.some(d => d.data().photos?.length > 0)
        if (!hasPhotos) {
          anomalyFlags.push('Perfect score with no photo evidence submitted')
        }
      }

      // Write flags if any found
      if (anomalyFlags.length > 0) {
        await event.data!.after.ref.update({ anomalyFlags })
        logger.info(`Anomalies detected in audit ${auditId}: ${anomalyFlags.join(', ')}`)
      }
    } catch (err) {
      logger.error('Anomaly detection failed', err)
    }
  }
)

// ─────────────────────────────────────────────
// 6. HTTP ENDPOINT — SET SUPERADMIN CLAIM
// ─────────────────────────────────────────────
export const setSuperAdmin = onRequest(
  { cors: false },
  async (req, res) => {
    // Only callable with a secret key — protect this endpoint
    const secret = req.headers['x-admin-secret']
    if (secret !== process.env.ADMIN_SECRET) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const { uid } = req.body
    if (!uid) { res.status(400).json({ error: 'uid required' }); return }

    await admin.auth().setCustomUserClaims(uid, { platformRole: 'superadmin' })
    res.json({ success: true, uid })
  }
)

// ─────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}
