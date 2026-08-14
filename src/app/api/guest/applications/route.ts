// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { workerApplicationService } from '@/services/guest/workerApplicationService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const jobId = body.job_id
  const userId = body.user_id

  if (typeof jobId !== 'string' || !jobId) {
    return NextResponse.json({ success: false, message: 'job_id is required' }, { status: 400 })
  }
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (userId !== session.user.id && userId !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only apply as yourself' }, { status: 403 })
  }

  try {
    const application = await workerApplicationService.submitApplication({
      job_id: jobId,
      // userId only proves it's this session's own request (accepted in either the auth id or
      // internal id form the client happened to send) — the service needs the canonical internal
      // users.id, which the session already resolved.
      user_id: session.user.id,
      meets_experience_requirement: body.meets_experience_requirement === true,
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
    const resource = searchParams.get('resource')

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Missing user ID' },
        { status: 400 }
      )
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    if (userId !== session.user.id && userId !== session.auth_id) {
      return NextResponse.json({ success: false, message: 'You can only view your own applications' }, { status: 403 })
    }

    if (resource === 'eligibility') {
      const jobId = searchParams.get('job_id')
      if (!jobId) return NextResponse.json({ success: false, message: 'job_id is required' }, { status: 400 })
      // Same normalization as POST above — userId here may be the auth id form (that's what the
      // job-board's ApplyJobModal sends), but the service needs the canonical internal users.id.
      const result = await workerApplicationService.checkEligibility(jobId, session.user.id)
      return NextResponse.json({ success: true, ...result })
    }

    const applications =
      await workerApplicationService.getApplicationsByUser(session.user.id)

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
