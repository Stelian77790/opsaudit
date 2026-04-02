import { db } from './firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

interface LogEntry {
  action: string
  category: string
  target?: { type: string; id: string; label: string }
  change?: { field: string; from: unknown; to: unknown; reason?: string }
  metadata?: Record<string, unknown>
  locationId?: string
  auditId?: string
}

interface Actor {
  userId: string
  name: string
  role: string
  email: string
}

export async function logActivity(
  companyId: string,
  actor: Actor,
  entry: LogEntry
): Promise<void> {
  try {
    const log = {
      ...entry,
      actor: { ...actor, isSystem: false },
      timestamp: serverTimestamp(),
      immutable: true,
    }
    await addDoc(collection(db, `companies/${companyId}/activityLog`), log)
    if (entry.auditId) {
      await addDoc(collection(db, `audits/${entry.auditId}/activity`), log)
    }
  } catch (err) {
    console.error('Failed to log activity:', err)
    // Never throw — logging should never break the main flow
  }
}

export async function logCritical(
  companyId: string,
  actor: Actor,
  entry: LogEntry
): Promise<void> {
  try {
    await addDoc(collection(db, 'auditTrail'), {
      companyId,
      ...entry,
      actor: { ...actor, isSystem: false },
      timestamp: serverTimestamp(),
      immutable: true,
    })
  } catch (err) {
    console.error('Failed to log critical event:', err)
  }
}
