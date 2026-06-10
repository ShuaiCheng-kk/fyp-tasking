import { NextRequest, NextResponse } from 'next/server'
import { workerApplicationService } from '@/services/guest/workerApplicationService'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const jobId = formData.get('job_id')
    const userId = formData.get('user_id')
    const resumeFile = formData.get('resume_file')
    const coverLetterFile = formData.get('cover_letter_file')

    if (
      typeof jobId !== 'string' ||
      typeof userId !== 'string' ||
      !(resumeFile instanceof File) ||
      !(coverLetterFile instanceof File)
    ) {
      return NextResponse.json(
        { success: false, message: 'Missing required application fields' },
        { status: 400 }
      )
    }

    const application = await workerApplicationService.submitApplication({
      job_id: jobId,
      user_id: userId,
      resume_file: resumeFile,
      cover_letter_file: coverLetterFile,
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
        message:
          err instanceof Error
            ? err.message
            : 'Failed to submit application',
      },
      { status: 500 }
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