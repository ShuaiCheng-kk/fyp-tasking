// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { sgtInstant } from '@/lib/singaporeTime'

// UC49: clocking in within 10 minutes of the scheduled shift start is graced — the recorded
// clock-in time is rounded down to the shift's own start time, so an 11:07 clock-in for an
// 11:00 shift is recorded as 11:00 and shows as Present, not Late.
// Present window: (start - 30min) to (start + 10min).
// Late: clock-in after (start + 10min) and before shift end.
// Absent: no clock-in by shift end, or clock-in at/after shift end.
const GRACE_PERIOD_MINUTES = 10

export function applyClockInGracePeriod(clockTime: string, shiftDate: string, shiftStartTime: string): string {
  // shift_date/shiftStartTime are Singapore-nominal wall-clock values — sgtInstant resolves the
  // real instant they represent, comparable to clockTime (always a real ISO UTC timestamp).
  const scheduledStart = sgtInstant(shiftDate, shiftStartTime)
  const actual = new Date(clockTime)
  const minutesLate = (actual.getTime() - scheduledStart.getTime()) / 60000
  if (minutesLate >= 0 && minutesLate <= GRACE_PERIOD_MINUTES) {
    return scheduledStart.toISOString()
  }
  return actual.toISOString()
}
