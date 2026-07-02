// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'

export interface RequestAISuggestion {
  recommendation: 'approve' | 'reject' | 'review'
  confidence: number
  reason: string
  concerns: string[]
  alternatives: string[]
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const requestAISuggestService = {
  async suggestFixedOffDay(request: {
    id: string
    requester_name: string
    weekday: number
    company_id: string
    user_id: string
  }): Promise<RequestAISuggestion> {
    const allFixedOff = await attendanceRepository.getFixedOffDaysByCompanyAndWeekday(
      request.company_id,
      request.weekday,
    )
    const otherUsersWithSameDay = allFixedOff.filter(r => r.user_id !== request.user_id)

    const context = {
      request_type: 'Fixed Day Off',
      requester: request.requester_name,
      requested_weekday: WEEKDAY_NAMES[request.weekday],
      existing_fixed_off_count_same_day: otherUsersWithSameDay.length,
      note: `${otherUsersWithSameDay.length} other employee(s) already have ${WEEKDAY_NAMES[request.weekday]} as their fixed day off.`,
    }

    return openAIService.generateStructuredJson<RequestAISuggestion>({
      schemaName: 'fixed_off_day_suggestion',
      maxOutputTokens: 600,
      instructions: [
        'You are an HR assistant helping a business owner decide whether to approve a fixed day off request.',
        'Assess the impact on staffing: if too many employees already have the same day off, the team may be understaffed.',
        'Generally: 0–1 others with same day off → likely approve; 2 others → review carefully; 3+ others → likely reject.',
        'recommendation must be one of: approve, reject, review.',
        'confidence is 0–100. concerns is a list of issues (empty if none). alternatives is a list of suggestions (empty if none).',
      ].join(' '),
      input: context,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recommendation: { type: 'string', enum: ['approve', 'reject', 'review'] },
          confidence: { type: 'number' },
          reason: { type: 'string' },
          concerns: { type: 'array', items: { type: 'string' } },
          alternatives: { type: 'array', items: { type: 'string' } },
        },
        required: ['recommendation', 'confidence', 'reason', 'concerns', 'alternatives'],
      },
    })
  },

}
