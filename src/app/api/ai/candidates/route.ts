// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { candidateRecommendationService } from '@/services/owner/candidateRecommendationService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const job_id = searchParams.get('job_id')
  if (!job_id) {
    return NextResponse.json({ success: false, message: 'job_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  const job = await recruitmentRepository.getJobPostingById(job_id)
  if (!job) return NextResponse.json({ success: false, message: 'Job posting not found' }, { status: 404 })
  if (job.company_id !== session.user.company_id) {
    return NextResponse.json({ success: false, message: 'You can only view candidates for your own company\'s jobs' }, { status: 403 })
  }

  const refresh = searchParams.get('refresh') === 'true'

  try {
    const recommendations = await candidateRecommendationService.recommendCandidates(job_id, refresh)
    return NextResponse.json({ success: true, recommendations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to recommend candidates'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
