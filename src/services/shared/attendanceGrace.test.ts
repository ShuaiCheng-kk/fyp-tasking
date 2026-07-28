import { describe, it, expect } from 'vitest'
import { applyClockInGracePeriod } from './attendanceGrace'

// shift_date/shiftStartTime are Singapore-nominal wall-clock (see src/lib/singaporeTime) — the
// clock-in instants below are expressed with an explicit +08:00 offset so they read as "the
// worker actually clocked in at this Singapore wall-clock moment", matching a real clock_in_time
// (always a genuine UTC instant). Expected results are the UTC instant that SGT moment becomes.
describe('applyClockInGracePeriod (UC49)', () => {
  it('rounds an exactly-on-time clock-in down to the scheduled start', () => {
    const result = applyClockInGracePeriod('2026-07-01T08:00:00+08:00', '2026-07-01', '08:00')
    expect(result).toBe('2026-07-01T00:00:00.000Z')
  })

  it('rounds a clock-in within the 10-minute grace window down to the scheduled start', () => {
    const result = applyClockInGracePeriod('2026-07-01T08:07:00+08:00', '2026-07-01', '08:00')
    expect(result).toBe('2026-07-01T00:00:00.000Z')
  })

  it('rounds a clock-in exactly at the 10-minute boundary down to the scheduled start', () => {
    const result = applyClockInGracePeriod('2026-07-01T08:10:00+08:00', '2026-07-01', '08:00')
    expect(result).toBe('2026-07-01T00:00:00.000Z')
  })

  it('keeps the real clock-in time once past the 10-minute grace window', () => {
    const result = applyClockInGracePeriod('2026-07-01T08:11:00+08:00', '2026-07-01', '08:00')
    expect(result).toBe('2026-07-01T00:11:00.000Z')
  })

  it('keeps the real clock-in time when clocking in early (before the scheduled start)', () => {
    const result = applyClockInGracePeriod('2026-07-01T07:45:00+08:00', '2026-07-01', '08:00')
    expect(result).toBe('2026-06-30T23:45:00.000Z')
  })
})
