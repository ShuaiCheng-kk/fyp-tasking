// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { casualWorkerStatusService } from '@/services/team/casualWorkerStatusService'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, company_id, worker_status, inactivate_reason } = body as Record<string, unknown>

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json(
        { success: false, message: 'user_id is required' },
        { status: 400 }
      )
    }

    if (!company_id || typeof company_id !== 'string') {
      return NextResponse.json(
        { success: false, message: 'company_id is required' },
        { status: 400 }
      )
    }

    if (!worker_status || typeof worker_status !== 'string') {
      return NextResponse.json(
        { success: false, message: 'worker_status is required' },
        { status: 400 }
      )
    }

    if (!['active', 'inactive'].includes(worker_status.toLowerCase())) {
      return NextResponse.json(
        { success: false, message: 'worker_status must be "active" or "inactive"' },
        { status: 400 }
      )
    }

    if (worker_status.toLowerCase() === 'inactive' && (typeof inactivate_reason !== 'string' || !inactivate_reason.trim())) {
      return NextResponse.json(
        { success: false, message: 'A reason is required to inactivate this Casual Worker.' },
        { status: 400 }
      )
    }

    await casualWorkerStatusService.updateStatus({
      user_id,
      company_id,
      worker_status: worker_status.toLowerCase(),
      inactivate_reason: typeof inactivate_reason === 'string' ? inactivate_reason : null,
    })

    return NextResponse.json({
      success: true,
      message: 'Casual worker status updated successfully',
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update casual worker status',
      },
      { status: 500 }
    )
  }
}
