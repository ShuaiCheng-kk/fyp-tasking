'use client'

// Shared across every Employee page (Dashboard, Tasks, Shifts, Communication) — once an Employee
// has clocked out of every shift scheduled for today, they've left for the day and every write
// action on those pages locks to read-only, the same "done once clocked out" rule the Casual
// Worker's own board already follows (2026-08-02). No shift at all today isn't "clocked out", so
// it stays unlocked (there's nothing to have left from).

import { useCallback, useEffect, useState } from 'react'
import { sgtTodayKey } from '@/lib/singaporeTime'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'

type MyShiftEntry = {
  shift: { shift_date: string }
  record: { clock_out_time: string | null } | null
}

export function useEmployeeClockedOut(internalUserId: string): boolean {
  const [clockedOut, setClockedOut] = useState(false)

  const check = useCallback(() => {
    if (!internalUserId) return
    fetch(`/api/employee/attendance?user_id=${encodeURIComponent(internalUserId)}&resource=my_shift`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) return
        const shifts = (data.myShift?.shifts ?? []) as MyShiftEntry[]
        const today = shifts.filter(s => s.shift.shift_date === sgtTodayKey())
        setClockedOut(today.length > 0 && today.every(s => !!s.record?.clock_out_time))
      })
      .catch(() => {})
  }, [internalUserId])

  useEffect(() => { check() }, [check])
  useResourceInvalidation(['attendance', 'dashboard'], check)

  return clockedOut
}
