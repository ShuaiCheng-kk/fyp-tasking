import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/ai/openAIService', () => ({
  openAIService: {
    generateStructuredJson: vi.fn(),
  },
}))

vi.mock('@/services/ai/resumeTextService', () => ({
  resumeTextService: {
    extractResumeText: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    getJobPostingById: vi.fn(),
    getApplicantsByJob: vi.fn(),
    updateApplicantAI: vi.fn(),
  },
}))

import { candidateRecommendationService } from './candidateRecommendationService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { openAIService } from '@/services/ai/openAIService'
import { resumeTextService } from '@/services/ai/resumeTextService'

const job = {
  id: 'job-1', title: 'Weekend Cashier', responsibilities: 'Handle checkout', skills: 'Basic maths',
  experience_required: 'None', company_location: 'Singapore', salary_amount: 12,
}

describe('UC49 Recommend Candidates via AI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(job as never)
    vi.mocked(recruitmentRepository.updateApplicantAI).mockResolvedValue(undefined as never)
    vi.mocked(resumeTextService.extractResumeText).mockResolvedValue(null as never)
  })

  const withSignalApplicant = {
    id: 'app-1', full_name: 'Alex Applicant', status: 'pending',
    skills: 'Cash handling', certificates: [], resume: null, additional_note: null,
    ai_computed_at: null, ai_summary: null,
  }

  it('UC49-M-UT-O: Owner runs AI Assessment on a pending applicant with profile signal', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([withSignalApplicant] as never)
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      recommendations: [{
        applicant_id: 'app-1', applicant_name: 'Alex Applicant', score: 82, recommendation: 'strong',
        reasons: ['Has relevant cash handling experience'], risks: [], suggested_next_step: 'Move to interview',
      }],
    } as never)

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ applicant_id: 'app-1', score: 82, recommendation: 'strong' })
    expect(recruitmentRepository.updateApplicantAI).toHaveBeenCalledWith('app-1', expect.any(String))
  })

  it('UC49-M-UT-P: Partner runs AI Assessment on a pending applicant with profile signal', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([withSignalApplicant] as never)
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      recommendations: [{
        applicant_id: 'app-1', applicant_name: 'Alex Applicant', score: 60, recommendation: 'review',
        reasons: ['Some relevant experience'], risks: ['No certificates attached'], suggested_next_step: 'Ask about availability',
      }],
    } as never)

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ score: 60, recommendation: 'review' })
  })

  it('UC49-M-UT-M: Manager runs AI Assessment on a pending applicant with profile signal', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([withSignalApplicant] as never)
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      recommendations: [{
        applicant_id: 'app-1', applicant_name: 'Alex Applicant', score: 40, recommendation: 'weak',
        reasons: ['Limited relevant experience'], risks: ['No resume provided'], suggested_next_step: 'Consider other candidates first',
      }],
    } as never)

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ score: 40, recommendation: 'weak' })
  })

  const noSignalApplicant = {
    id: 'app-2', full_name: 'Jordan Empty', status: 'pending',
    skills: null, certificates: [], resume: null, additional_note: null,
    ai_computed_at: null, ai_summary: null,
  }

  it('UC49-A1-UT-O: Owner sees an applicant with no profile signal flagged as insufficient, without being sent to AI', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([noSignalApplicant] as never)

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result).toEqual([expect.objectContaining({
      applicant_id: 'app-2', score: 0, insufficient: true,
      suggested_next_step: 'Ask the applicant to complete their Worker Profile.',
    })])
    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
  })

  it('UC49-A1-UT-P: Partner sees an applicant with no profile signal flagged as insufficient, without being sent to AI', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([noSignalApplicant] as never)

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result[0]).toMatchObject({ score: 0, insufficient: true })
    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
  })

  it('UC49-A1-UT-M: Manager sees an applicant with no profile signal flagged as insufficient, without being sent to AI', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([noSignalApplicant] as never)

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result[0]).toMatchObject({ score: 0, insufficient: true })
    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
  })

  it('UC49-BR-UT-O-1: Owner revisiting the panel reuses the cached score instead of calling AI again', async () => {
    const cachedApplicant = {
      ...withSignalApplicant,
      ai_computed_at: '2026-08-01T00:00:00.000Z',
      ai_summary: JSON.stringify({
        applicant_id: 'app-1', applicant_name: 'Alex Applicant', score: 82, recommendation: 'strong',
        reasons: ['Has relevant cash handling experience'], risks: [], suggested_next_step: 'Move to interview',
      }),
    }
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([cachedApplicant] as never)

    const result = await candidateRecommendationService.recommendCandidates('job-1', false)

    expect(result[0]).toMatchObject({ score: 82, recommendation: 'strong' })
    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
    expect(recruitmentRepository.updateApplicantAI).not.toHaveBeenCalled()
  })

  it('UC49-BR-UT-O-2: An applicant who is no longer Pending is skipped entirely, since there is nothing left to decide', async () => {
    const acceptedApplicant = { ...withSignalApplicant, id: 'app-3', status: 'accepted' }
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([acceptedApplicant] as never)

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result).toEqual([])
    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
  })

  // BUG-090: the model echoes applicant_id back from the input and occasionally corrupts it.
  // A real run returned "02b1487a-...-99134f-b68f-99134f8229d3" for an id ending "...-99134f8229d3",
  // which reached Postgres as a uuid and failed the entire assessment.
  it('UC49-BR-UT-O-3: A corrupted applicant_id from the model is resolved back to the real applicant instead of reaching the database', async () => {
    const realApplicant = { ...withSignalApplicant, id: '02b1487a-5548-462f-b68f-99134f8229d3' }
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([realApplicant] as never)
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      recommendations: [{
        applicant_id: '02b1487a-5548-462f-b68f-99134f-b68f-99134f8229d3',
        applicant_name: 'Alex Applicant', score: 88, recommendation: 'strong',
        reasons: ['Directly relevant experience'], risks: [], suggested_next_step: 'Accept',
      }],
    } as never)

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    expect(result[0].applicant_id).toBe('02b1487a-5548-462f-b68f-99134f8229d3')
    expect(recruitmentRepository.updateApplicantAI).toHaveBeenCalledWith(
      '02b1487a-5548-462f-b68f-99134f8229d3', expect.any(String),
    )
  })

  it('UC49-BR-UT-O-4: A recommendation that matches no applicant at all is dropped rather than written under an unknown id', async () => {
    vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([
      withSignalApplicant,
      { ...withSignalApplicant, id: 'app-9', full_name: 'Bea Applicant' },
    ] as never)
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      recommendations: [
        { applicant_id: 'app-1', applicant_name: 'Alex Applicant', score: 70, recommendation: 'review', reasons: [], risks: [], suggested_next_step: 'Call' },
        { applicant_id: 'ghost', applicant_name: 'Nobody At All', score: 90, recommendation: 'strong', reasons: [], risks: [], suggested_next_step: 'Accept' },
        { applicant_id: 'ghost-2', applicant_name: 'Also Nobody', score: 95, recommendation: 'strong', reasons: [], risks: [], suggested_next_step: 'Accept' },
      ],
    } as never)

    const result = await candidateRecommendationService.recommendCandidates('job-1')

    // 'ghost' takes the one remaining unclaimed applicant (app-9); 'ghost-2' has nobody left and is dropped.
    expect(result).toHaveLength(2)
    expect(result.map(r => r.applicant_id).sort()).toEqual(['app-1', 'app-9'])
    expect(recruitmentRepository.updateApplicantAI).not.toHaveBeenCalledWith('ghost-2', expect.anything())
  })
})
