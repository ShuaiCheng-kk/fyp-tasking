// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { openAIService } from '@/services/ai/openAIService'
import { CandidateRecommendation } from '@/types/AI'

export const candidateRecommendationService = {
  async recommendCandidates(job_id: string): Promise<CandidateRecommendation[]> {
    const [jobPosting, applicants] = await Promise.all([
      recruitmentRepository.getJobPostingById(job_id),
      recruitmentRepository.getApplicantsByJob(job_id),
    ])
    if (!jobPosting) throw new Error('Job posting not found')

    const result = await openAIService.generateStructuredJson<{ recommendations: CandidateRecommendation[] }>({
      schemaName: 'candidate_recommendations',
      instructions: [
        'You rank applicants for a Smart Task Allocation recruitment workflow.',
        'Use job requirements, cover letters, and application context.',
        'Do not invent resume details. If evidence is missing, list it as a risk.',
        'Score 0 to 100. The owner/manager still makes the final decision.',
      ].join(' '),
      input: {
        job_posting: {
          title: jobPosting.title,
          description: jobPosting.description,
          requirements: jobPosting.requirements,
          employment_type: jobPosting.employment_type,
          location: jobPosting.location,
          salary_amount: jobPosting.salary_amount,
          salary_type: jobPosting.salary_type,
        },
        applicants: applicants.map(applicant => ({
          applicant_id: applicant.id,
          full_name: applicant.full_name,
          email_address: applicant.email_address,
          cover_letter: applicant.cover_letter,
          status: applicant.status,
          applied_at: applicant.applied_at,
        })),
      },
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                applicant_id: { type: 'string' },
                applicant_name: { type: 'string' },
                score: { type: 'number' },
                recommendation: { type: 'string', enum: ['strong', 'review', 'weak'] },
                reasons: { type: 'array', items: { type: 'string' } },
                risks: { type: 'array', items: { type: 'string' } },
                suggested_next_step: { type: 'string' },
              },
              required: ['applicant_id', 'applicant_name', 'score', 'recommendation', 'reasons', 'risks', 'suggested_next_step'],
            },
          },
        },
        required: ['recommendations'],
      },
    })

    return result.recommendations.sort((a, b) => b.score - a.score)
  },
}
