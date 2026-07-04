import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/ai/openAIService', () => ({
  openAIService: { generateStructuredJson: vi.fn() },
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: { getJobPostingById: vi.fn(), getApplicantsByJob: vi.fn() },
}))

import { candidateRecommendationService } from './candidateRecommendationService'
import { openAIService } from '@/services/ai/openAIService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'

const jobPosting = {
  id: 'job-1',
  title: 'Weekend Cashier',
  description: 'Run the front register.',
  requirements: 'Available weekends',
  employment_type: 'casual',
  location: 'Downtown',
  salary_amount: 15,
  salary_type: 'per hour',
}

const applicants = [
  { id: 'app-1', full_name: 'Alice', email_address: 'alice@test.com', cover_letter: 'I love retail.', status: 'pending', applied_at: '2026-01-01' },
  { id: 'app-2', full_name: 'Bob', email_address: 'bob@test.com', cover_letter: null, status: 'pending', applied_at: '2026-01-02' },
]

describe('candidateRecommendationService.recommendCandidates (UC48)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(jobPosting as any)
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue(applicants as any)
  })

  it('throws when the job posting does not exist', async () => {
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(null)

    await expect(candidateRecommendationService.recommendCandidates('missing-job')).rejects.toThrow('Job posting not found')
  })

  it('sorts recommendations by score, highest first', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      recommendations: [
        { applicant_id: 'app-2', applicant_name: 'Bob', score: 60, recommendation: 'review', reasons: [], risks: ['No cover letter'], suggested_next_step: 'Interview' },
        { applicant_id: 'app-1', applicant_name: 'Alice', score: 90, recommendation: 'strong', reasons: ['Enthusiastic cover letter'], risks: [], suggested_next_step: 'Hire' },
      ],
    })

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result.map(r => r.applicant_id)).toEqual(['app-1', 'app-2'])
    expect(result[0].score).toBe(90)
  })

  it('passes job requirements and applicant cover letters through to the AI call', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({ recommendations: [] })

    await candidateRecommendationService.recommendCandidates('job-1')

    expect(recruitmentRepository.getJobPostingById).toHaveBeenCalledWith('job-1')
    expect(recruitmentRepository.getApplicantsByJob).toHaveBeenCalledWith('job-1')
    expect(openAIService.generateStructuredJson).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'candidate_recommendations',
        input: expect.objectContaining({
          job_posting: expect.objectContaining({ title: 'Weekend Cashier', requirements: 'Available weekends' }),
          applicants: [
            expect.objectContaining({ applicant_id: 'app-1', full_name: 'Alice', cover_letter: 'I love retail.' }),
            expect.objectContaining({ applicant_id: 'app-2', full_name: 'Bob', cover_letter: null }),
          ],
        }),
      }),
    )
  })

  it('returns an empty list when there are no applicants', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([])
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({ recommendations: [] })

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result).toEqual([])
  })
})
