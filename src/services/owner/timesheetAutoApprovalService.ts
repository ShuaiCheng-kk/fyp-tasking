// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { attendanceService } from '@/services/owner/attendanceService'
import { AIAutoApprovalDecision } from '@/types/AI'

export const timesheetAutoApprovalService = {
  async reviewTimesheets(company_id: string): Promise<AIAutoApprovalDecision[]> {
    const dashboard = await attendanceService.getAttendanceDashboard(company_id)
    const pending = dashboard.records
      .filter(row => row.record?.owner_status === 'pending')
      .slice(0, 50)
      .map(row => ({
        record_id: row.record!.id,
        assignee_name: row.assignee_name,
        department_name: row.department_name,
        shift_date: row.shift.shift_date,
        scheduled_start: row.shift.start_time,
        scheduled_end: row.shift.end_time,
        clock_in_time: row.record!.clock_in_time,
        clock_out_time: row.record!.clock_out_time,
        employee_notes: row.record!.employee_notes,
        manager_notes: row.record!.manager_notes,
        exceptions: row.exceptions,
      }))

    if (pending.length === 0) return []

    const result = await openAIService.generateStructuredJson<{ decisions: AIAutoApprovalDecision[] }>({
      schemaName: 'timesheet_auto_approval',
      maxOutputTokens: 1000,
      instructions: [
        'You review attendance timesheets for a Smart Task Allocation app.',
        'Auto-approve only clean records with no late, absent, overtime, missing clock time, or concerning notes.',
        'Flag anything ambiguous. Owners can make the final decision.',
        'Confidence is 0 to 100.',
      ].join(' '),
      input: { pending_timesheets: pending },
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          decisions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                record_id: { type: 'string' },
                decision: { type: 'string', enum: ['auto_approve', 'flag'] },
                confidence: { type: 'number' },
                reason: { type: 'string' },
              },
              required: ['record_id', 'decision', 'confidence', 'reason'],
            },
          },
        },
        required: ['decisions'],
      },
    })

    return result.decisions
  },

  async applyAutoApprovals(company_id: string, owner_id: string, min_confidence = 85): Promise<AIAutoApprovalDecision[]> {
    const decisions = await this.reviewTimesheets(company_id)
    const autoApproved = decisions.filter(decision => decision.decision === 'auto_approve' && decision.confidence >= min_confidence)
    await Promise.all(autoApproved.map(decision =>
      attendanceService.finalReviewAttendance({
        id: decision.record_id,
        owner_id,
        decision: 'approved',
        owner_notes: `AI auto-approved: ${decision.reason}`,
      }),
    ))
    return decisions
  },
}
