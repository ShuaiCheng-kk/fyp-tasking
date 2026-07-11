import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/ai/openAIService', () => ({
  openAIService: { generateStructuredJson: vi.fn() },
}))

vi.mock('@/services/ai/resumeTextService', () => ({
  resumeTextService: { extractResumeText: vi.fn() },
  UNPARSEABLE_RESUME: 'Resume attached but could not be parsed (unsupported format or scanned document).',
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    getJobPostingById: vi.fn(),
    getApplicantsByJob: vi.fn(),
    updateApplicantAI: vi.fn(),
  },
}))

import { candidateRecommendationService } from './candidateRecommendationService'
import { openAIService } from '@/services/ai/openAIService'
import { resumeTextService } from '@/services/ai/resumeTextService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { JobApplicant } from '@/types/Recruitment'

const jobPosting = {
  id: 'job-1',
  title: 'Weekend Cashier',
  description: 'Run the front register.',
  requirements: 'Available weekends',
  experience_required: '1+ Year',
  employment_type: 'casual',
  location: 'Downtown',
  salary_amount: 15,
  salary_type: 'per hour',
}

function makeApplicant(overrides: Partial<JobApplicant>): JobApplicant {
  return {
    id: 'app-1',
    job_id: 'job-1',
    user_id: 'user-1',
    full_name: 'Alice',
    email_address: 'alice@test.com',
    resume_url: null,
    cover_letter: null,
    status: 'pending',
    applied_at: '2026-01-01',
    relevant_experience: '1_to_2',
    additional_note: null,
    skills_snapshot: 'Customer service',
    certificates_snapshot: null,
    age_at_apply: 24,
    ai_score: null,
    ai_summary: null,
    ai_computed_at: null,
    ...overrides,
  }
}

const aiRec = (id: string, name: string, score: number) => ({
  applicant_id: id, applicant_name: name, score,
  recommendation: score >= 75 ? 'strong' as const : 'review' as const,
  reasons: ['Relevant skills'], risks: [], suggested_next_step: 'Interview',
})

describe('candidateRecommendationService.recommendCandidates (UC48)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(jobPosting as never)
    vi.mocked(resumeTextService.extractResumeText).mockResolvedValue('Parsed resume text')
  })

  it('throws when the job posting does not exist', async () => {
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(null)
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([])

    await expect(candidateRecommendationService.recommendCandidates('missing-job')).rejects.toThrow('Job posting not found')
  })

  it('returns an empty list when there are no active applicants', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([
      makeApplicant({ status: 'rejected' }),
    ])

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result).toEqual([])
    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
  })

  it('sends the snapshot data (skills, certificates, experience, resume text) to the AI and caches each result', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([
      makeApplicant({
        id: 'app-1',
        resume_url: 'https://cdn/resume.pdf',
        certificates_snapshot: [{ name: 'Food Hygiene Certificate', file_url: 'https://cdn/cert.jpg' }],
        additional_note: 'Worked at Starbucks.',
      }),
    ])
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      recommendations: [aiRec('app-1', 'Alice', 85)],
    })

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(resumeTextService.extractResumeText).toHaveBeenCalledWith('https://cdn/resume.pdf')
    expect(openAIService.generateStructuredJson).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          job_posting: expect.objectContaining({ title: 'Weekend Cashier', experience_required: '1+ Year' }),
          applicants: [
            expect.objectContaining({
              applicant_id: 'app-1',
              skills: 'Customer service',
              certificates: [{ name: 'Food Hygiene Certificate', proof_attached: true }],
              relevant_experience: '1–2 years in this role',
              additional_note: 'Worked at Starbucks.',
              resume_text: 'Parsed resume text',
            }),
          ],
        }),
      }),
    )
    // computed once -> cached on the application row
    expect(recruitmentRepository.updateApplicantAI).toHaveBeenCalledWith('app-1', 85, expect.any(String))
    expect(result[0].score).toBe(85)
  })

  it('serves cached results without calling the AI again', async () => {
    const cached = JSON.stringify(aiRec('app-1', 'Alice', 72))
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([
      makeApplicant({ ai_score: 72, ai_summary: cached, ai_computed_at: '2026-07-11T00:00:00Z' }),
    ])

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
    expect(recruitmentRepository.updateApplicantAI).not.toHaveBeenCalled()
    expect(result[0].score).toBe(72)
  })

  it('refresh=true recomputes even when a cache exists', async () => {
    const cached = JSON.stringify(aiRec('app-1', 'Alice', 72))
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([
      makeApplicant({ ai_score: 72, ai_summary: cached, ai_computed_at: '2026-07-11T00:00:00Z' }),
    ])
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      recommendations: [aiRec('app-1', 'Alice', 88)],
    })

    const result = await candidateRecommendationService.recommendCandidates('job-1', true)

    expect(openAIService.generateStructuredJson).toHaveBeenCalled()
    expect(result[0].score).toBe(88)
  })

  it('flags applicants with no profile signal as insufficient instead of scoring them', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([
      makeApplicant({
        id: 'app-empty', full_name: 'Nobody',
        skills_snapshot: null, certificates_snapshot: null, resume_url: null,
        additional_note: null, relevant_experience: null,
      }),
    ])

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
    expect(result[0].insufficient).toBe(true)
    expect(recruitmentRepository.updateApplicantAI).toHaveBeenCalledWith('app-empty', null, expect.any(String))
  })

  it('sorts scored applicants by score and puts insufficient ones last', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([
      makeApplicant({
        id: 'app-empty', full_name: 'Nobody',
        skills_snapshot: null, certificates_snapshot: null, resume_url: null,
        additional_note: null, relevant_experience: null,
      }),
      makeApplicant({ id: 'app-low', full_name: 'Bob' }),
      makeApplicant({ id: 'app-high', full_name: 'Alice' }),
    ])
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      recommendations: [aiRec('app-low', 'Bob', 55), aiRec('app-high', 'Alice', 92)],
    })

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result.map(r => r.applicant_id)).toEqual(['app-high', 'app-low', 'app-empty'])
  })
})
