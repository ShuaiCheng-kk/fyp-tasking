import { NextRequest, NextResponse } from 'next/server'
import { getAnnouncements, postAnnouncement, deleteAnnouncement, updateAnnouncement } from '@/services/inboxService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const company_id = searchParams.get('company_id')
    const role = searchParams.get('role') ?? 'owner'
    const department_id = searchParams.get('department_id')
    const user_id = searchParams.get('user_id')
    if (!company_id) {
      return NextResponse.json({ success: false, error: 'Missing company_id' }, { status: 400 })
    }
    const announcements = await getAnnouncements(company_id, role, department_id, user_id)
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
    await deleteAnnouncement(announcement_id, requesting_user_id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { announcement_id, requesting_user_id, title, content, department_id } = body
    if (!announcement_id || !requesting_user_id || !title || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }
    const announcement = await updateAnnouncement(
      announcement_id,
      requesting_user_id,
      title,
      content,
      department_id ?? null
    )
    return NextResponse.json({ success: true, announcement })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { from_user_id, company_id, department_id, title, content, user_role } = body
    if (!from_user_id || !company_id || !title || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }
    const announcement = await postAnnouncement(
      from_user_id,
      company_id,
      department_id ?? null,
      title,
      content,
      user_role ?? ''
    )
    return NextResponse.json({ success: true, announcement })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}
