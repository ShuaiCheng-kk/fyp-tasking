import { describe, it, expect } from 'vitest'
import { applyClockInGracePeriod } from './attendanceGrace'

describe('applyClockInGracePeriod (UC49)', () => {
  it('rounds an exactly-on-time clock-in down to the scheduled start', () => {
    const result = applyClockInGracePeriod('2026-07-01T08:00:00Z', '2026-07-01', '08:00')
    expect(result).toBe('2026-07-01T08:00:00.000Z')
  })

  it('rounds a clock-in within the 10-minute grace window down to the scheduled start', () => {
    const result = applyClockInGracePeriod('2026-07-01T08:07:00Z', '2026-07-01', '08:00')
    expect(result).toBe('2026-07-01T08:00:00.000Z')
  })

  it('rounds a clock-in exactly at the 10-minute boundary down to the scheduled start', () => {
    const result = applyClockInGracePeriod('2026-07-01T08:10:00Z', '2026-07-01', '08:00')
    expect(result).toBe('2026-07-01T08:00:00.000Z')
  })

  it('keeps the real clock-in time once past the 10-minute grace window', () => {
    const result = applyClockInGracePeriod('2026-07-01T08:11:00Z', '2026-07-01', '08:00')
    expect(result).toBe('2026-07-01T08:11:00.000Z')
  })

  it('keeps the real clock-in time when clocking in early (before the scheduled start)', () => {
    const result = applyClockInGracePeriod('2026-07-01T07:45:00Z', '2026-07-01', '08:00')
    expect(result).toBe('2026-07-01T07:45:00.000Z')
  })
})
