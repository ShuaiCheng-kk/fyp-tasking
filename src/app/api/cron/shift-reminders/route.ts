import { NextRequest, NextResponse } from 'next/server'
import { shiftReminderService } from '@/services/casual/shiftReminderService'

// GET /api/cron/shift-reminders
// Triggered once daily by Vercel Cron (see vercel.json). Not a user-facing endpoint — requires
// the shared CRON_SECRET so it can't be hit by anyone who finds the URL.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await shiftReminderService.sendDueShiftReminders()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
