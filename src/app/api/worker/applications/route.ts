import { NextRequest, NextResponse } from 'next/server'
import { workerApplicationService } from '@/services/worker/workerApplicationService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const application = await workerApplicationService.submitApplication({
      job_id: body.job_id,
      user_id: body.user_id,
      resume_url: body.resume_url,
      cover_letter: body.cover_letter,
    })

    return NextResponse.json({
      success: true,
      application,
      message: 'Application submitted successfully',
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : 'Failed to submit application',
      },
      { status: 500 }
    )
  }
}