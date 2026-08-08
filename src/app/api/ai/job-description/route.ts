// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { jobDescriptionService } from '@/services/owner/jobDescriptionService'
import { getServerSessionUser } from '@/lib/serverAuth'

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
  if (typeof b.title !== 'string') {
    return NextResponse.json({ success: false, message: 'title is required' }, { status: 400 })
  }

  try {
    const draft = await jobDescriptionService.generateDescription({
      title: b.title,
      job_type: (b.job_type as string | null) ?? null,
      company_name: (b.company_name as string | null) ?? null,
      department_name: (b.department_name as string | null) ?? null,
      location: (b.location as string | null) ?? null,
      pay: (b.pay as string | null) ?? null,
      notes: (b.notes as string | null) ?? null,
    })
    return NextResponse.json({ success: true, draft })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate job description'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
