// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { workerApplicationService, RelevantExperience } from '@/services/guest/workerApplicationService'

const RELEVANT_EXPERIENCE_VALUES = ['none', 'less_than_1', '1_to_2', 'more_than_2']

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const jobId = body.job_id
  const userId = body.user_id
  const relevantExperience = body.relevant_experience

  if (typeof jobId !== 'string' || !jobId) {
    return NextResponse.json({ success: false, message: 'job_id is required' }, { status: 400 })
  }
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (typeof relevantExperience !== 'string' || !RELEVANT_EXPERIENCE_VALUES.includes(relevantExperience)) {
    return NextResponse.json(
      { success: false, message: 'relevant_experience must be one of: none, less_than_1, 1_to_2, more_than_2' },
      { status: 400 },
    )
  }

  try {
    const application = await workerApplicationService.submitApplication({
      job_id: jobId,
      user_id: userId,
      relevant_experience: relevantExperience as RelevantExperience,
      additional_note: typeof body.additional_note === 'string' ? body.additional_note : null,
    })

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
      application,
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to submit application',
      },
      { status: 400 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Missing user ID' },
        { status: 400 }
      )
    }

    const applications =
      await workerApplicationService.getApplicationsByUser(userId)

    return NextResponse.json({
      success: true,
      applications,
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : 'Failed to load applications',
      },
      { status: 500 }
    )
  }
}
