// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { workerProfileService } from '@/services/guest/workerProfileService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid form data' }, { status: 400 })
  }

  const userId = formData.get('user_id')
  const name = formData.get('name')
  const file = formData.get('file')

  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (userId !== session.user.id && userId !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only edit your own profile' }, { status: 403 })
  }

  try {
    const certificate = await workerProfileService.addCertificate(
      userId,
      name,
      file instanceof File ? file : null,
    )
    return NextResponse.json({ success: true, certificate }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add certificate'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid form data' }, { status: 400 })
  }

  const userId = formData.get('user_id')
  const certificateId = formData.get('certificate_id')
  const file = formData.get('file')

  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (typeof certificateId !== 'string' || !certificateId) {
    return NextResponse.json({ success: false, message: 'certificate_id is required' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: 'file is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (userId !== session.user.id && userId !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only edit your own profile' }, { status: 403 })
  }

  try {
    const certificate = await workerProfileService.replaceCertificateFile(userId, certificateId, file)
    return NextResponse.json({ success: true, certificate })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to replace certificate file'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const certificateId = searchParams.get('certificate_id')

  if (!userId) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (!certificateId) {
    return NextResponse.json({ success: false, message: 'certificate_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (userId !== session.user.id && userId !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only edit your own profile' }, { status: 403 })
  }

  try {
    await workerProfileService.removeCertificate(userId, certificateId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove certificate'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
