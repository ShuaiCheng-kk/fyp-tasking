'use client'

// Shared across every Employee/Manager page (Dashboard, Tasks, Shifts, Communication) — once
// clocked out of their most recently-started shift, every write action on those pages locks to
// read-only, the same "done for now" rule the Casual Worker's own board already follows
// (2026-08-02). This is deliberately NOT tied to the calendar date or to whether a shift exists
// today: it stays locked through a midnight rollover and through any off-days with no shift
// scheduled at all in between, and only clears on the user's next actual Clock In — confirmed
// 2026-08-03 (see employeeAttendanceService.getClockLockStatus for the exact rule).

import { useCallback, useEffect, useState } from 'react'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'

export function useEmployeeClockedOut(internalUserId: string): boolean {
  const [clockedOut, setClockedOut] = useState(false)

  const check = useCallback(() => {
    if (!internalUserId) return
    fetch(`/api/employee/attendance?user_id=${encodeURIComponent(internalUserId)}&resource=clock_lock_status`)
      .then(r => r.json())
      .then(data => { if (data.success) setClockedOut(!!data.locked) })
      .catch(() => {})
  }, [internalUserId])

  useEffect(() => { check() }, [check])
  useResourceInvalidation(['attendance', 'dashboard'], check)

  return clockedOut
}
