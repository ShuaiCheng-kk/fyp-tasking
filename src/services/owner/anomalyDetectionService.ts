// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { reportService } from '@/services/owner/reportService'
import { AIAnomaly } from '@/types/AI'
import { ReportFilters } from '@/types/Report'

// 'internal' = Owner Report's Internal tab: Manager/Employee shift coverage, task delivery,
// attendance, and department-level hiring/cost performance only — no individual Casual Worker
// attendance/reliability or job-posting-level detail is fed to the AI (that lives on the
// Casual Worker tab, which is out of scope for this panel).
// 'all' = every signal the report computes, both internal and casual (legacy Partner report page).
export type AnomalyScope = 'all' | 'internal'

// Overview fields that describe internal-staff/company-level performance, safe to hand to the
// AI under 'internal' scope — excludes the casual-worker-only rate/cost breakdowns.
const INTERNAL_OVERVIEW_KEYS = [
  'on_time_attendance_rate', 'on_time_attendance_late_rate', 'on_time_attendance_absent_rate',
  'on_time_task_completion_rate', 'hiring_success_rate', 'average_time_to_fill_days',
  'total_casual_worker_cost', 'total_shifts', 'total_assignments', 'total_tasks',
  'labor_cost', 'uncosted_assignments',
] as const

function pickInternalOverview(overview: Awaited<ReturnType<typeof reportService.getCompanyReport>>['overview']) {
  return Object.fromEntries(INTERNAL_OVERVIEW_KEYS.map(key => [key, overview[key]]))
}

export const anomalyDetectionService = {
  // UC63 — feeds the AI nothing but facts computed from recorded data (the same
  // CompanyReport the page shows). The code states what happened; the AI decides
  // what is unusual and what to do about it — no hardcoded thresholds here.
  async detectAnomalies(filters: ReportFilters, scope: AnomalyScope = 'all'): Promise<AIAnomaly[]> {
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
      ...(scope === 'internal' ? [] : [
        ...report.casual.workers
          .filter(row => row.absent + row.late + row.rejected_shifts > 0)
          .slice(0, 20)
          .map(row => `${row.full_name}: ${row.absent} absent, ${row.late} late, ${row.rejected_shifts} rejected shift(s) this period`),
        ...report.casual.postings
          .filter(row => row.openings !== null && row.openings > 0 && row.confirmed < row.openings)
          .map(row => `Posting "${row.title}": ${row.confirmed}/${row.openings} openings filled (${row.applicants} applicant(s))`),
      ]),
    ]

    const baseInput = {
      period: report.period,
      previous_period: report.previous_period,
      overview: scope === 'internal' ? pickInternalOverview(report.overview) : report.overview,
      previous_overview: scope === 'internal' ? pickInternalOverview(report.previous_overview) : report.previous_overview,
      department_rows: report.departments,
      manual_signals: manualSignals,
    }
    const input = scope === 'internal' ? baseInput : {
      ...baseInput,
      casual_worker_rows: report.casual.workers,
      recruitment_funnel: report.casual.funnel,
      recruitment_postings: report.casual.postings,
    }

    const result = await openAIService.generateStructuredJson<{ anomalies: AIAnomaly[] }>({
      schemaName: 'allocation_anomalies',
      maxOutputTokens: 900,
      instructions: [
        'You are an operations analyst for a Smart Task Allocation app.',
        'Find meaningful workforce anomalies in the period under review, not generic comments.',
        'Compare the current period against the previous period where useful.',
        scope === 'internal'
          ? 'Only evaluate internal staff (Manager/Employee) shift coverage, task delivery, attendance reliability, and department-level hiring/cost performance. You have not been given individual casual worker or job-posting data, so do not mention or infer anything about them.'
          : 'Prioritize anomalies that affect shift coverage, task delivery, attendance reliability, hiring, or labor cost.',
        'Return concise evidence and practical recommended actions for the company owner.',
      ].join(' '),
      input,
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
