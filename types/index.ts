export type UserRole = 'admin' | 'manager' | 'auditor' | 'assignee' | 'viewer'

export interface AppUser {
  uid: string
  email: string
  name: string
  companyId: string | null
  role: UserRole | null
  createdAt: Date
  lastLoginAt?: Date
}

export interface Company {
  id: string
  name: string
  industry: string
  size: string
  country: string
  logo?: string
  branding?: { primaryColor: string }
  subscriptionTier: 'free' | 'professional' | 'enterprise'
  healthScore?: number
  createdAt: Date
  createdBy: string
}

export interface Location {
  id: string
  companyId: string
  name: string
  address: string
  city: string
  country: string
  managerId?: string
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  active: boolean
  createdAt: Date
}

export interface Invitation {
  id: string
  email: string
  companyId: string
  companyName: string
  role: UserRole
  locations: string[]
  invitedBy: string
  invitedByName: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  token: string
  expiresAt: Date
  createdAt: Date
  message?: string
}

export type QuestionType = 'yes_no' | 'pass_fail' | 'text' | 'number' | 'photo' | 'multiple_choice'

export interface Question {
  id: string
  text: string
  type: QuestionType
  hint?: string
  weight?: number
  required: boolean
  options?: string[] // for multiple_choice
}

export interface Section {
  id: string
  title: string
  questions: Question[]
}

export interface Template {
  id: string
  companyId: string
  title: string
  description: string
  industry: string
  estimatedMinutes?: number
  sections: Section[]
  isPublic: boolean
  sourceDoc?: string
  version: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type AuditStatus = 'scheduled' | 'in_progress' | 'submitted' | 'reviewed'
export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface Finding {
  id: string
  auditId: string
  questionId: string
  questionText: string
  answer: string
  notes?: string
  photos: string[]
  severity?: Severity
  aiRiskScore?: number
  finalRiskScore?: number
  aiAnalysis?: string
  correctiveAction?: string
  aiSuggestedAction?: string
  category?: string
  createdAt: Date
}

export interface CorrectiveAction {
  id: string
  auditId: string
  findingId: string
  companyId: string
  locationId: string
  title: string
  description: string
  assigneeId?: string
  assigneeName?: string
  dueDate?: Date
  priority: Severity
  status: 'open' | 'in_progress' | 'resolved' | 'escalated'
  resolutionPhoto?: string
  aiVerification?: { resolved: boolean; confidence: string; concerns?: string }
  createdAt: Date
  updatedAt: Date
}

export interface Audit {
  id: string
  companyId: string
  locationId: string
  locationName: string
  templateId: string
  templateTitle: string
  auditorId: string
  auditorName: string
  status: AuditStatus
  score?: number
  qualityScore?: number
  findings: string[]
  scheduledDate?: Date
  startedAt?: Date
  submittedAt?: Date
  gps?: { lat: number; lng: number }
  anomalyFlags?: string[]
  createdAt: Date
}

export interface AuditAnswer {
  questionId: string
  answer: string
  notes?: string
  photos?: string[]
  timestamp: Date
}

export interface ActivityLog {
  id: string
  action: string
  category: string
  actor: {
    userId: string
    name: string
    role: string
    email: string
    isSystem: boolean
  }
  target?: { type: string; id: string; label: string }
  change?: { field: string; from: unknown; to: unknown; reason?: string }
  locationId?: string
  auditId?: string
  timestamp: Date
  ipAddress?: string
  immutable: boolean
}

// Extended audit with report fields
export interface AuditWithReport extends Audit {
  executiveSummary?: string
  reportId?: string
}
