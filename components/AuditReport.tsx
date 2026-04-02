'use client'

import {
  Document, Page, Text, View, StyleSheet,
  Image, Font, pdf
} from '@react-pdf/renderer'
import { Audit, Template, Finding, Company } from '@/types'
import { formatDateTime } from '@/lib/utils'

// Styles
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#0A0A0A',
    color: '#FFFFFF',
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
  },
  // Cover
  coverPage: {
    backgroundColor: '#0A0A0A',
    padding: 50,
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
  },
  coverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 60,
  },
  logoBox: {
    width: 40,
    height: 40,
    backgroundColor: '#F97316',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },
  brandName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  brandAi: {
    fontSize: 10,
    color: '#F97316',
    marginLeft: 4,
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    lineHeight: 1.2,
    marginBottom: 12,
  },
  coverSub: {
    fontSize: 14,
    color: '#A3A3A3',
    marginBottom: 40,
  },
  coverMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  coverMetaLabel: {
    fontSize: 10,
    color: '#525252',
    width: 80,
  },
  coverMetaValue: {
    fontSize: 10,
    color: '#FFFFFF',
    flex: 1,
  },
  scoreBox: {
    backgroundColor: '#111111',
    border: '1px solid #1F1F1F',
    borderRadius: 12,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 40,
  },
  scoreNumber: {
    fontSize: 56,
    fontFamily: 'Helvetica-Bold',
  },
  scoreSuffix: {
    fontSize: 24,
    color: '#525252',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#A3A3A3',
    marginTop: 4,
  },
  // Section styles
  sectionHeader: {
    borderBottom: '2px solid #F97316',
    paddingBottom: 8,
    marginBottom: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#F97316',
  },
  // Summary
  summaryBox: {
    backgroundColor: '#111111',
    border: '1px solid #1F1F1F',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 10,
    color: '#A3A3A3',
    lineHeight: 1.6,
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#111111',
    border: '1px solid #1F1F1F',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    color: '#525252',
  },
  // Finding
  findingRow: {
    backgroundColor: '#111111',
    border: '1px solid #1F1F1F',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  findingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  findingQuestion: {
    fontSize: 10,
    color: '#FFFFFF',
    flex: 1,
    fontFamily: 'Helvetica-Bold',
  },
  severityBadge: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  findingNotes: {
    fontSize: 9,
    color: '#A3A3A3',
    marginTop: 4,
    lineHeight: 1.4,
  },
  aiAnalysis: {
    backgroundColor: '#1A0A00',
    border: '1px solid #7C3A0A',
    borderRadius: 4,
    padding: 8,
    marginTop: 6,
  },
  aiLabel: {
    fontSize: 8,
    color: '#F97316',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  aiText: {
    fontSize: 9,
    color: '#A3A3A3',
    lineHeight: 1.4,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #1F1F1F',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#525252',
  },
  footerOrange: {
    fontSize: 8,
    color: '#F97316',
  },
  // Photo grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  photo: {
    width: 120,
    height: 90,
    borderRadius: 4,
    objectFit: 'cover',
  },
})

function getScoreColor(score: number): string {
  if (score >= 80) return '#22C55E'
  if (score >= 60) return '#EAB308'
  return '#EF4444'
}

function getSeverityStyle(severity: string) {
  switch (severity) {
    case 'critical': return { color: '#FCA5A5', backgroundColor: '#450A0A' }
    case 'high': return { color: '#FDBA74', backgroundColor: '#431407' }
    case 'medium': return { color: '#FDE047', backgroundColor: '#422006' }
    case 'low': return { color: '#86EFAC', backgroundColor: '#052E16' }
    default: return { color: '#A3A3A3', backgroundColor: '#1F1F1F' }
  }
}

interface ReportProps {
  audit: Audit
  template: Template
  findings: Finding[]
  company: Company
  executiveSummary: string
}

function AuditReport({ audit, template, findings, company, executiveSummary }: ReportProps) {
  const score = audit.score || 0
  const failFindings = findings.filter(f => f.answer === 'fail' || f.answer === 'no')
  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const highCount = findings.filter(f => f.severity === 'high').length
  const mediumCount = findings.filter(f => f.severity === 'medium').length

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <View>
            {/* Brand */}
            <View style={styles.coverHeader}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>O</Text>
              </View>
              <View>
                <Text style={styles.brandName}>OpsAudit<Text style={styles.brandAi}> AI</Text></Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.coverTitle}>{audit.templateTitle}</Text>
            <Text style={styles.coverSub}>Audit Report</Text>

            {/* Meta */}
            {[
              ['Company', company.name],
              ['Location', audit.locationName],
              ['Auditor', audit.auditorName],
              ['Date', formatDateTime(audit.submittedAt || audit.createdAt)],
              ['Reference', audit.id.slice(0, 8).toUpperCase()],
            ].map(([label, value]) => (
              <View key={label} style={styles.coverMetaRow}>
                <Text style={styles.coverMetaLabel}>{label}</Text>
                <Text style={styles.coverMetaValue}>{value}</Text>
              </View>
            ))}

            {/* Score */}
            <View style={styles.scoreBox}>
              <View>
                <Text style={[styles.scoreNumber, { color: getScoreColor(score) }]}>
                  {score}<Text style={styles.scoreSuffix}>%</Text>
                </Text>
                <Text style={styles.scoreLabel}>Overall Score</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.statsRow}>
                  {[
                    { label: 'Critical', value: criticalCount, color: '#EF4444' },
                    { label: 'High', value: highCount, color: '#F97316' },
                    { label: 'Medium', value: mediumCount, color: '#EAB308' },
                    { label: 'Total Issues', value: failFindings.length, color: '#FFFFFF' },
                  ].map(stat => (
                    <View key={stat.label} style={styles.statBox}>
                      <Text style={[styles.statNumber, { color: stat.color }]}>{stat.value}</Text>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <Text style={{ fontSize: 8, color: '#525252', textAlign: 'center' }}>
            Generated by OpsAudit AI · {new Date().toISOString().split('T')[0]} · Confidential
          </Text>
        </View>
      </Page>

      {/* Executive Summary */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{executiveSummary}</Text>
        </View>

        {/* Section Breakdown */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Score by Section</Text>
        </View>
        {template.sections.map(section => {
          const sectionFindings = findings.filter(f =>
            section.questions.some(q => q.id === f.questionId)
          )
          const passes = sectionFindings.filter(f => f.answer === 'pass' || f.answer === 'yes').length
          const total = section.questions.length
          const sectionScore = total > 0 ? Math.round((passes / total) * 100) : 100
          return (
            <View key={section.id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: 10, color: '#FFFFFF' }}>{section.title}</Text>
                <Text style={{ fontSize: 10, color: getScoreColor(sectionScore), fontFamily: 'Helvetica-Bold' }}>
                  {sectionScore}%
                </Text>
              </View>
              <View style={{ backgroundColor: '#1F1F1F', borderRadius: 4, height: 6 }}>
                <View style={{
                  backgroundColor: getScoreColor(sectionScore),
                  borderRadius: 4,
                  height: 6,
                  width: `${sectionScore}%`,
                }} />
              </View>
            </View>
          )
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>OpsAudit AI · {company.name}</Text>
          <Text style={styles.footerOrange}>{audit.templateTitle}</Text>
        </View>
      </Page>

      {/* Findings */}
      {failFindings.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Findings & Issues ({failFindings.length})</Text>
          </View>

          {failFindings.map((finding, i) => {
            const sevStyle = getSeverityStyle(finding.severity || 'medium')
            return (
              <View key={finding.id} style={styles.findingRow} wrap={false}>
                <View style={styles.findingHeader}>
                  <Text style={styles.findingQuestion}>{finding.questionText}</Text>
                  <Text style={[styles.severityBadge, sevStyle]}>
                    {(finding.severity || 'medium').toUpperCase()}
                  </Text>
                </View>
                {finding.notes && (
                  <Text style={styles.findingNotes}>{finding.notes}</Text>
                )}
                {finding.aiAnalysis && (
                  <View style={styles.aiAnalysis}>
                    <Text style={styles.aiLabel}>AI ANALYSIS</Text>
                    <Text style={styles.aiText}>{finding.aiAnalysis}</Text>
                  </View>
                )}
                {finding.aiSuggestedAction && (
                  <Text style={[styles.findingNotes, { marginTop: 6 }]}>
                    → Recommended action: {finding.aiSuggestedAction}
                  </Text>
                )}
              </View>
            )
          })}

          <View style={styles.footer}>
            <Text style={styles.footerText}>OpsAudit AI · {company.name}</Text>
            <Text style={styles.footerOrange}>{audit.templateTitle}</Text>
          </View>
        </Page>
      )}

      {/* Photo Evidence */}
      {findings.some(f => f.photos?.length > 0) && (
        <Page size="A4" style={styles.page}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Photo Evidence</Text>
          </View>
          {findings.filter(f => f.photos?.length > 0).map(finding => (
            <View key={finding.id} style={{ marginBottom: 16 }} wrap={false}>
              <Text style={{ fontSize: 10, color: '#A3A3A3', marginBottom: 6 }}>{finding.questionText}</Text>
              <View style={styles.photoGrid}>
                {finding.photos.slice(0, 4).map((url, i) => (
                  <Image key={i} src={url} style={styles.photo} />
                ))}
              </View>
            </View>
          ))}
          <View style={styles.footer}>
            <Text style={styles.footerText}>OpsAudit AI · {company.name}</Text>
            <Text style={styles.footerOrange}>{audit.templateTitle}</Text>
          </View>
        </Page>
      )}
    </Document>
  )
}

export async function generateAuditPDF(props: ReportProps): Promise<Blob> {
  const blob = await pdf(<AuditReport {...props} />).toBlob()
  return blob
}

export default AuditReport
