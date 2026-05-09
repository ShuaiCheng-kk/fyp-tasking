/**
 * GET /api/health
 *
 * Lightweight health-check endpoint.
 * Returns 200 { status: 'ok' } when the server is running.
 * Add database connectivity check here once Supabase tables are set up.
 *
 * ---
 * API route naming conventions for this project:
 *
 *   /api/auth/...          → Supabase Auth helpers (sign-in, sign-out, callback)
 *   /api/users/...         → Profile CRUD (calls userRepository via userService)
 *   /api/jobs/...          → Job postings + applications (recruitmentService)
 *   /api/attendance/...    → Clock-in, clock-out, reports (attendanceService)
 *   /api/notifications/... → Fetch, mark-read (notificationService)
 *   /api/ai/...            → AI scoring and recommendations (aiService)
 *
 * Pattern:
 *   1. Validate the incoming request (auth session, body schema).
 *   2. Call the appropriate service function (never a repository directly).
 *   3. Return NextResponse.json(data) or NextResponse.json({ error }, { status })
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
