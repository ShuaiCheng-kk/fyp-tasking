// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { workerProfileService } from '@/services/guest/workerProfileService'

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid form data' }, { status: 400 })
  }

  const userId = formData.get('user_id')
  const resume = formData.get('resume')

  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (!(resume instanceof File)) {
    return NextResponse.json({ success: false, message: 'resume file is required' }, { status: 400 })
  }

  try {
    const profile = await workerProfileService.uploadResume(userId, resume)
    return NextResponse.json({ success: true, profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upload resume'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }

  try {
    const profile = await workerProfileService.removeResume(userId)
    return NextResponse.json({ success: true, profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove resume'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
