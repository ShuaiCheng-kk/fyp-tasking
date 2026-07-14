// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { reportService } from '@/services/owner/reportService'
import { AIAnomaly } from '@/types/AI'
import { ReportFilters } from '@/types/Report'

export const anomalyDetectionService = {
  // UC63 — feeds the AI nothing but facts computed from recorded data (the same
  // CompanyReport the page shows). The code states what happened; the AI decides
  // what is unusual and what to do about it — no hardcoded thresholds here.
  async detectAnomalies(filters: ReportFilters): Promise<AIAnomaly[]> {
    const report = await reportService.getCompanyReport(filters)

    const manualSignals: string[] = [
      ...report.departments
        .filter(row => row.shifts > 0 && row.assignments === 0)
        .map(row => `${row.department_name}: ${row.shifts} shift(s) scheduled but nobody assigned`),
      ...report.departments
        .filter(row => row.overdue_open > 0)
        .map(row => `${row.department_name}: ${row.overdue_open} task(s) past their deadline and still not complete`),
      ...report.departments
        .filter(row => row.rework_count > 0)
        .map(row => `${row.department_name}: ${row.rework_count} task(s) were rejected back for rework`),
      ...report.casual.workers
        .filter(row => row.absent + row.late + row.rejected_shifts > 0)
        .slice(0, 20)
        .map(row => `${row.full_name}: ${row.absent} absent, ${row.late} late, ${row.rejected_shifts} rejected shift(s) this period`),
      ...report.casual.postings
        .filter(row => row.openings !== null && row.openings > 0 && row.confirmed < row.openings)
        .map(row => `Posting "${row.title}": ${row.confirmed}/${row.openings} openings filled (${row.applicants} applicant(s))`),
    ]

    const result = await openAIService.generateStructuredJson<{ anomalies: AIAnomaly[] }>({
      schemaName: 'allocation_anomalies',
      maxOutputTokens: 900,
      instructions: [
        'You are an operations analyst for a Smart Task Allocation app.',
        'Find meaningful workforce anomalies in the period under review, not generic comments.',
        'Compare the current period against the previous period where useful.',
        'Prioritize anomalies that affect shift coverage, task delivery, attendance reliability, hiring, or labor cost.',
        'Return concise evidence and practical recommended actions for the company owner.',
      ].join(' '),
      input: {
        period: report.period,
        previous_period: report.previous_period,
        overview: report.overview,
        previous_overview: report.previous_overview,
        department_rows: report.departments,
        casual_worker_rows: report.casual.workers,
        recruitment_funnel: report.casual.funnel,
        recruitment_postings: report.casual.postings,
        manual_signals: manualSignals,
      },
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          anomalies: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                area: { type: 'string', enum: ['Dashboard', 'Report', 'Attendance', 'Recruitment'] },
                severity: { type: 'string', enum: ['low', 'medium', 'high'] },
                title: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } },
                recommended_action: { type: 'string' },
              },
              required: ['id', 'area', 'severity', 'title', 'evidence', 'recommended_action'],
            },
          },
        },
        required: ['anomalies'],
      },
    })

    return result.anomalies
  },
}
