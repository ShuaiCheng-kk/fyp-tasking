import { NextRequest, NextResponse } from 'next/server'
import { ownerAnnouncementService } from '@/services/owner/ownerAnnouncementService'

const PERMISSION_ERRORS = new Set([
  'Employees cannot post announcements',
  'Managers can only post announcements to their own department',
])

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const company_id = searchParams.get('company_id')
    const role = searchParams.get('role') ?? 'owner'
    const department_id = searchParams.get('audience_department_id')
    const user_id = searchParams.get('user_id')
    if (!company_id) {
      return NextResponse.json({ success: false, error: 'Missing company_id' }, { status: 400 })
    }
    const announcements = await ownerAnnouncementService.getAnnouncements(company_id, user_id, role, department_id)
    return NextResponse.json({ success: true, announcements })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { announcement_id, requesting_user_id } = body
    if (!announcement_id || !requesting_user_id) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }
    await ownerAnnouncementService.deleteAnnouncement(announcement_id, requesting_user_id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { announcement_id, requesting_user_id, title, content, audience_department_id: department_id } = body
    if (!announcement_id || !requesting_user_id || !title || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }
    const announcement = await ownerAnnouncementService.updateAnnouncement(
      announcement_id,
      requesting_user_id,
      title,
      content,
      department_id ?? null
    )
    return NextResponse.json({ success: true, announcement })
  } catch (error: any) {
    const status = PERMISSION_ERRORS.has(error.message) ? 403 : 400
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, company_id, audience_department_id, title, content } = body
    if (!user_id || !company_id || !title || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }
    const announcement = await ownerAnnouncementService.postAnnouncement(
      user_id,
      company_id,
      audience_department_id ?? null,
      title,
      content
    )
    return NextResponse.json({ success: true, announcement })
  } catch (error: any) {
    const status = PERMISSION_ERRORS.has(error.message) ? 403 : 400
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
