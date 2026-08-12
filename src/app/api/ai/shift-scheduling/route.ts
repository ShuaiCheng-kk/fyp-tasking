// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftSchedulingService } from '@/services/owner/shiftSchedulingService'
import { getServerSessionUser } from '@/lib/serverAuth'

// See api/ai/candidates/route.ts — Vercel's default function timeout is shorter than
// OPENAI_TIMEOUT_MS, and a timed-out function returns HTML that breaks res.json().
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.context !== 'string' || !b.context.trim()) {
    return NextResponse.json({ success: false, message: 'context is required' }, { status: 400 })
  }
  if (typeof b.date_from !== 'string' || !b.date_from) {
    return NextResponse.json({ success: false, message: 'date_from is required' }, { status: 400 })
  }
  if (typeof b.date_to !== 'string' || !b.date_to) {
    return NextResponse.json({ success: false, message: 'date_to is required' }, { status: 400 })
  }

  try {
    const draft = await shiftSchedulingService.generateShifts({
      context:         b.context as string,
      department_name: (b.department_name as string | null) ?? null,
      date_from:       b.date_from as string,
      date_to:         b.date_to as string,
      preferred_hours: (b.preferred_hours as string | null) ?? null,
      num_staff:       (b.num_staff as number | null) ?? null,
    })
    return NextResponse.json({ success: true, draft })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate shift schedule'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
