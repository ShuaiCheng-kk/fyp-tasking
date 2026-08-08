import { NextRequest, NextResponse } from 'next/server'
import { ownerAnnouncementService } from '@/services/owner/ownerAnnouncementService'
import { getServerSessionUser } from '@/lib/serverAuth'

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
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    if (session.user.company_id !== company_id) {
      return NextResponse.json({ success: false, error: 'You can only view your own company\'s announcements' }, { status: 403 })
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
    const { announcement_id } = body
    if (!announcement_id) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    await ownerAnnouncementService.deleteAnnouncement(announcement_id, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { announcement_id, title, content, audience_department_id: department_id } = body
    if (!announcement_id || !title || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    const announcement = await ownerAnnouncementService.updateAnnouncement(
      announcement_id,
      session.user.id,
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
    const { company_id, audience_department_id, title, content } = body
    if (!company_id || !title || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    if (session.user.company_id !== company_id) {
      return NextResponse.json({ success: false, error: 'You can only post to your own company' }, { status: 403 })
    }
    const announcement = await ownerAnnouncementService.postAnnouncement(
      session.user.id,
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
