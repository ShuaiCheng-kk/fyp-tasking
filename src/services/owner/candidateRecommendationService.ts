// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { openAIService } from '@/services/ai/openAIService'
import { resumeTextService } from '@/services/ai/resumeTextService'
import { CandidateRecommendation } from '@/types/AI'
import { JobApplicant } from '@/types/Recruitment'

// The AI compares soft signals only (skills, certificates, resume, experience answer, note).
// Hard gates — age, job status, schedule conflicts — were already enforced deterministically
// at apply time and are never delegated to the model.
export const candidateRecommendationService = {
  async recommendCandidates(job_id: string, refresh = false): Promise<CandidateRecommendation[]> {
    const [jobPosting, allApplicants] = await Promise.all([
      recruitmentRepository.getJobPostingById(job_id),
      recruitmentRepository.getApplicantsByJob(job_id),
    ])
    if (!jobPosting) throw new Error('Job posting not found')

    // Only applicants the Owner still has to decide on — once accepted (awaiting the worker's
    // confirmation) or in any terminal state, the decision is already made, so there's nothing
    // left for the AI to help with.
    const applicants = allApplicants.filter(a => a.status === 'pending')
    if (applicants.length === 0) return []

    const results: CandidateRecommendation[] = []
    const toCompute: JobApplicant[] = []

    for (const applicant of applicants) {
      // No profile signal at all -> flagged as insufficient, never scored by the AI (a made-up
      // low score would mislead the owner more than an honest "not enough information").
      if (!hasSignal(applicant)) {
        const rec: CandidateRecommendation = {
          applicant_id: applicant.id,
          applicant_name: applicant.full_name,
          score: 0,
          recommendation: 'review',
          reasons: ['Applicant provided no skills, certificates, resume, or note to assess.'],
          risks: ['No information available — consider contacting the applicant directly.'],
          suggested_next_step: 'Ask the applicant to complete their Worker Profile.',
          insufficient: true,
        }
        results.push(rec)
        if (!applicant.ai_computed_at || refresh) {
          await recruitmentRepository.updateApplicantAI(applicant.id, JSON.stringify(rec))
        }
        continue
      }

      // Cache hit — computed once, reused on every later page open until forced to refresh.
      if (!refresh && applicant.ai_computed_at && applicant.ai_summary) {
        const cached = parseCachedRecommendation(applicant)
        if (cached) {
          results.push(cached)
          continue
        }
      }

      toCompute.push(applicant)
    }

    if (toCompute.length > 0) {
      const resumeTexts = await Promise.all(
        toCompute.map(applicant =>
          applicant.resume
            ? resumeTextService.extractResumeText(applicant.resume)
            : Promise.resolve(null)
        )
      )

      const result = await openAIService.generateStructuredJson<{ recommendations: CandidateRecommendation[] }>({
        schemaName: 'candidate_recommendations',
        maxOutputTokens: 1500,
        instructions: [
          'You rank applicants for a Smart Task Allocation recruitment workflow.',
          'Compare each applicant\'s skills, certificates, resume text, role experience, and note against the job requirements.',
          'Do not invent details. If evidence is missing, list it as a risk.',
          'Do not judge age or scheduling — the system enforces those separately.',
          'Score 0 to 100. The owner/manager still makes the final decision.',
        ].join(' '),
        input: {
          job_posting: {
            title: jobPosting.title,
            responsibilities: jobPosting.responsibilities,
            skills: jobPosting.skills,
            experience_required: jobPosting.experience_required,
            location: jobPosting.company_location,
            salary_amount: jobPosting.salary_amount,
          },
          applicants: toCompute.map((applicant, index) => ({
            applicant_id: applicant.id,
            full_name: applicant.full_name,
            skills: applicant.skills,
            certificates: (applicant.certificates ?? []).map(cert => ({
              name: cert.name,
              proof_attached: Boolean(cert.file_url),
            })),
            additional_note: applicant.additional_note,
            resume_text: resumeTexts[index],
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

      // Never trust the id the model echoes back — see resolveApplicant below.
      const claimed = new Set<string>()
      for (const rec of result.recommendations) {
        const applicant = resolveApplicant(rec, toCompute, claimed)
        if (!applicant) continue
        claimed.add(applicant.id)
        const resolved: CandidateRecommendation = {
          ...rec,
          applicant_id: applicant.id,
          applicant_name: applicant.full_name,
        }
        await recruitmentRepository.updateApplicantAI(applicant.id, JSON.stringify(resolved))
        results.push(resolved)
      }
    }

    // Scored applicants first (best on top), insufficient-info ones at the bottom.
    return results.sort((a, b) => {
      if (a.insufficient !== b.insufficient) return a.insufficient ? 1 : -1
      return b.score - a.score
    })
  },
}

// The model echoes applicant_id back from the input, and it does sometimes corrupt a raw UUID.
// Observed in a demo run: "02b1487a-5548-462f-b68f-99134f-b68f-99134f8229d3" — the real id
// "02b1487a-5548-462f-b68f-99134f8229d3" with a middle segment duplicated. Passing that straight
// to Postgres kills the whole assessment with `invalid input syntax for type uuid`, so every
// recommendation is tied back to a real applicant first: exact id, then name, then a UUID-prefix
// match, then the only remaining unclaimed applicant. One that still can't be matched is dropped
// rather than written under an id nobody owns.
function resolveApplicant(
  rec: CandidateRecommendation,
  pending: JobApplicant[],
  claimed: Set<string>,
): JobApplicant | null {
  const unclaimed = pending.filter(applicant => !claimed.has(applicant.id))
  if (unclaimed.length === 0) return null

  const byId = unclaimed.find(applicant => applicant.id === rec.applicant_id)
  if (byId) return byId

  const name = (rec.applicant_name ?? '').trim().toLowerCase()
  const byName = name ? unclaimed.find(applicant => applicant.full_name.trim().toLowerCase() === name) : undefined
  if (byName) return byName

  const returned = (rec.applicant_id ?? '').toLowerCase()
  const byPrefix = returned.length >= 8
    ? unclaimed.find(applicant => returned.startsWith(applicant.id.slice(0, 8).toLowerCase()))
    : undefined
  if (byPrefix) return byPrefix

  return unclaimed.length === 1 ? unclaimed[0] : null
}

function hasSignal(applicant: JobApplicant): boolean {
  return Boolean(
    applicant.skills ||
    (applicant.certificates && applicant.certificates.length > 0) ||
    applicant.resume ||
    applicant.additional_note
  )
}

function parseCachedRecommendation(applicant: JobApplicant): CandidateRecommendation | null {
  try {
    const parsed = JSON.parse(applicant.ai_summary ?? '') as CandidateRecommendation
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.score !== 'number') return null
    return { ...parsed, applicant_id: applicant.id, applicant_name: applicant.full_name }
  } catch {
    return null
  }
}
