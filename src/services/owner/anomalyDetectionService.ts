// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { attendanceService } from '@/services/owner/attendanceService'
import { reportService } from '@/services/owner/reportService'
import { AIAnomaly } from '@/types/AI'
import { ReportFilters } from '@/types/Report'

export const anomalyDetectionService = {
  async detectAnomalies(filters: ReportFilters): Promise<AIAnomaly[]> {
    const [report, attendance] = await Promise.all([
      reportService.getWorkforceAnalytics(filters),
      attendanceService.getAttendanceDashboard(filters.company_id),
    ])

    const manualSignals = [
      ...report.departments
        .filter(row => row.assignments === 0 && row.shifts > 0)
        .map(row => `${row.department_name}: ${row.shifts} shift(s) but no assignments`),
      ...attendance.records
        .filter(row => row.exceptions.length > 0)
        .slice(0, 20)
        .map(row => `${row.assignee_name}: ${row.exceptions.join(', ')} on ${row.shift.shift_date}`),
    ]

    const result = await openAIService.generateStructuredJson<{ anomalies: AIAnomaly[] }>({
      schemaName: 'allocation_anomalies',
      maxOutputTokens: 900,
      instructions: [
        'You are an operations analyst for a Smart Task Allocation app.',
        'Find meaningful workforce allocation anomalies, not generic comments.',
        'Use the provided report, attendance exceptions, and manual signals.',
        'Prioritize anomalies that affect coverage, task completion, attendance reliability, or owner action.',
        'Return concise evidence and practical recommended actions.',
      ].join(' '),
      input: {
        filters,
        report_summary: report.summary,
        department_rollups: report.departments,
        attendance_summary: attendance.summary,
        attendance_exceptions: attendance.records.filter(row => row.exceptions.length > 0).slice(0, 30).map(row => ({
          assignee_name: row.assignee_name,
          department_name: row.department_name,
          shift_date: row.shift.shift_date,
          shift_time: `${row.shift.start_time}-${row.shift.end_time}`,
          exceptions: row.exceptions,
        })),
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
