'use client'

// Shared data source for "which Casual Workers are under this Employee today" — used by the
// Tasks page's Member panel (merged in 2026-08-02, replacing the old standalone "Casual Workers
// Today" block) to render View/Assign cards and the worker detail modal.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'
import { sgtDateKeyPlusDays, sgtInstant } from '@/lib/singaporeTime'

export type ClockOutReleaseItem = {
  id: string
  user_id: string
  worker_name: string
  clock_in_time: string | null
  shift_title: string | null
  shift_date: string
  start_time: string
}

export type SupervisedWorker = {
  shift_assignment_id: string
  id: string
  full_name: string
  email_address: string
  phone_number: string
  profile_photo_url: string | null
  shift_id: string
  shift_title: string
  start_time: string
  end_time: string
  is_open_ended: boolean
  clock_in_time: string | null
  break_in_time: string | null
  break_out_time: string | null
  clock_out_time: string | null
}

// `enabled` gates the actual fetching — TasksView.tsx is shared by Owner/Partner/Manager/Employee,
// so this must not fire network calls for roles other than Employee just because the hook was
// called (hooks themselves can't be conditional, so the guard lives inside instead).
export function useSupervisedCasualWorkers(enabled: boolean) {
  const [authUserId, setAuthUserId] = useState('')
  const [supervisedWorkers, setSupervisedWorkers] = useState<SupervisedWorker[]>([])
  const [releaseQueue, setReleaseQueue] = useState<ClockOutReleaseItem[]>([])
  const [releaseBusyId, setReleaseBusyId] = useState('')
  const [releaseError, setReleaseError] = useState('')

  const fetchSupervisedWorkers = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/employee/dashboard?user_id=${uid}`)
      const data = await res.json()
      if (data.success) setSupervisedWorkers(data.supervised_workers ?? [])
    } catch {}
  }, [])

  const fetchReleaseQueue = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${uid}&resource=clockout_release_queue`)
      const data = await res.json()
      if (data.success) setReleaseQueue(data.queue ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    if (!enabled) return
    const uid = localStorage.getItem('tasking_user_id')
    if (!uid) return
    setAuthUserId(uid)
    void fetchSupervisedWorkers(uid)
    void fetchReleaseQueue(uid)
  }, [enabled, fetchSupervisedWorkers, fetchReleaseQueue])

  useResourceInvalidation(['dashboard', 'shifts', 'attendance', 'team'], () => {
    if (!enabled || !authUserId) return
    void fetchSupervisedWorkers(authUserId)
    void fetchReleaseQueue(authUserId)
  })

  // Real-time day rollover — this list is scoped to "today" (Singapore calendar day) server-side,
  // so without this it only ever picks up the new day on a manual reload or an unrelated realtime
  // event. One-shot timer to the next SGT midnight, same pattern as casual/dashboard/page.tsx's
  // own boundaryTick: fire once, refetch (today's workers drop out, tomorrow's appear, all in the
  // same query since it's re-evaluated against the now-rolled-over "today"), then re-arm for the
  // day after (2026-08-02).
  const [, setDayBoundaryTick] = useState(0)
  const dayBoundaryRef = useRef({ authUserId, enabled })
  dayBoundaryRef.current = { authUserId, enabled }
  useEffect(() => {
    if (!enabled) return
    const now = Date.now()
    const nextMidnight = sgtInstant(sgtDateKeyPlusDays(1), '00:00:00').getTime()
    const timer = setTimeout(() => {
      const { authUserId: uid, enabled: stillEnabled } = dayBoundaryRef.current
      if (stillEnabled && uid) {
        void fetchSupervisedWorkers(uid)
        void fetchReleaseQueue(uid)
      }
      setDayBoundaryTick(t => t + 1)
    }, nextMidnight - now + 250)
    return () => clearTimeout(timer)
  })

  const releaseClockOut = async (item: ClockOutReleaseItem) => {
    setReleaseBusyId(item.id)
    try {
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release_clockout', user_id: authUserId, attendance_record_id: item.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to release clock-out')
      setReleaseQueue(prev => prev.filter(q => q.id !== item.id))
    } catch (err) {
      setReleaseError(err instanceof Error ? err.message : 'Failed to release clock-out')
    } finally { setReleaseBusyId('') }
  }

  return { supervisedWorkers, releaseQueue, releaseBusyId, releaseError, releaseClockOut }
}
