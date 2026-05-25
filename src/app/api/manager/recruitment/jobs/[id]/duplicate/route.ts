import { NextRequest, NextResponse } from 'next/server'
import { managerRecruitmentService } from '@/services/manager/managerRecruitmentService'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/manager/recruitment/jobs/:id/duplicate
// Body: { requesting_manager_id: string }
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 })

    const { requesting_manager_id } = await req.json()
    if (!requesting_manager_id) {
      return NextResponse.json({ success: false, error: 'requesting_manager_id is required' }, { status: 400 })
    }

    const job = await managerRecruitmentService.duplicateJob(id, requesting_manager_id)
    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 })
  }
}