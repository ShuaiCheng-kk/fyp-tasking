'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Coffee } from 'lucide-react'
import EmployeeSidebar from '@/components/EmployeeSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'
import {
  CLOCK_IN_WINDOW_MINUTES_BEFORE, canClockIn, canClockOut,
  fmtShiftTime, fmtShiftTimeMinusMinutes, fmtClockStamp,
  ClockFlowButton, ClockFlowConnector,
  DASHBOARD_SKELETON_KEYFRAMES, SkeletonLine,
} from '@/components/dashboard/ClockFlow'
import { sgtTodayKey } from '@/lib/singaporeTime'
import EmployeeMyTasksBoard from '@/components/employee/EmployeeMyTasksBoard'
import { useEmployeeClockedOut } from '@/hooks/useEmployeeClockedOut'

const TEXT   = '#111827'
const MUTED  = '#6B7280'
const ACCENT = '#F97316'

type MyShiftRecord = { id: string; clock_in_time: string | null; clock_out_time: string | null; break_in_time: string | null; break_out_time: string | null; status: string }
type MyShift = {
  assignment: { id: string; user_id: string }
  shift: { id: string; shift_date: string; start_time: string; end_time: string; is_open_ended: boolean }
  record: MyShiftRecord | null
}

export default function EmployeeDashboard() {
  const router = useRouter()

  const [userId, setUserId]       = useState('')
  const [authUserId, setAuthUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  // My Shift
  const [myShifts, setMyShifts]       = useState<MyShift[]>([])
  const [myShiftLoading, setMyShiftLoading] = useState(true)
  const [clockBusyId, setClockBusyId] = useState('')
  const [clockMessage, setClockMessage] = useState('')

  const fetchMyShift = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${uid}&resource=my_shift`)
      const data = await res.json()
      if (data.success) setMyShifts(data.myShift?.shifts ?? [])
    } catch {} finally { setMyShiftLoading(false) }
  }, [])

  const fetchDashboard = useCallback(async (uid: string) => {
    const res = await fetch(`/api/employee/dashboard?user_id=${uid}`)
    const data = await res.json()
    return data
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const uid = localStorage.getItem('tasking_user_id')
      if (!uid) { router.replace('/signin'); return }
      // `/user/me` and `/employee/dashboard` don't depend on each other — both only need `uid` —
      // so fire them together instead of one-after-another; each downstream fetch (My Shift) then
      // starts the instant its own dependency (internalId) resolves rather than waiting on the
      // other request too (2026-08-03, same "don't serialize independent fetches" pass as the
      // Casual Worker dashboard's clock-button responsiveness fix).
      const mePromise = fetch(`/api/user/me?user_id=${uid}`).then(r => r.json())
      const dashPromise = fetchDashboard(uid)

      const meData = await mePromise
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }
      const internalId = meData.user.id ?? uid
      setUserId(internalId)
      setAuthUserId(uid)
      void fetchMyShift(internalId)

      const dash = await dashPromise
      if (cancelled) return
      if (dash.success) {
        setCompanyId(dash.company_id ?? '')
        setDepartmentId(dash.department_id ?? '')
      }
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchDashboard, fetchMyShift])

  // Live-updates the My Shift widget when a Manager reassigns a shift or a clock action happens
  // elsewhere (My Tasks and the Casual Workers panel handle their own realtime refresh internally
  // — see EmployeeMyTasksBoard/SupervisedCasualWorkersPanel) — matching the Owner/Manager
  // dashboards' realtime behavior instead of requiring a manual refresh.
  useResourceInvalidation(['dashboard', 'shifts', 'attendance', 'team'], () => {
    if (!authUserId || !userId) return
    void fetchMyShift(userId)
  })

  const runClockAction = async (shift: MyShift, action: 'clock_in' | 'clock_out' | 'break_in' | 'break_out') => {
    setClockBusyId(`${shift.assignment.id}:${action}`)
    setClockMessage('')
    try {
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: authUserId, shift_assignment_id: shift.assignment.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Attendance action failed')
      // Optimistic patch — advance the stepper the instant the server confirms instead of
      // blocking the button on a second full my_shift round-trip; refetch still runs in the
      // background to catch anything else that changed (same pattern as the Casual Worker
      // dashboard's clock buttons, 2026-08-03).
      setMyShifts(prev => prev.map(s => s.assignment.id === shift.assignment.id ? { ...s, record: data.record } : s))
      void fetchMyShift(userId)
      // No success badge here on purpose — the stepper's own button states (green/orange/locked)
      // already show what just happened, so a "Clocked in." / "Break started." toast on top of
      // that was pure redundant noise (2026-08-02). Errors still surface below, since those have
      // no other visual signal.
    } catch (err) {
      setClockMessage(err instanceof Error ? err.message : 'Attendance action failed')
    } finally { setClockBusyId('') }
  }

  const title = "Today's Overview"
  // Shift dates are Singapore-nominal (see ClockFlow's sgtInstant) — "today" must be the
  // Singapore calendar day, not the machine's own local timezone or true UTC, or a shift that's
  // "today" only by one of those would either vanish or double up against a genuinely different
  // day's shift (see project memory module5-clockin-timezone-bug).
  const myTodayShifts = myShifts.filter(s => s.shift.shift_date === sgtTodayKey())
  // Clocked out and not yet clocked back in = My Tasks below locks to read-only (2026-08-02) —
  // same rule as the Casual Worker's own board. Locked until the next actual Clock In, not just
  // until the calendar date rolls over — an off-day with no shift stays locked too (2026-08-03,
  // see useEmployeeClockedOut).
  const clockedOutForToday = useEmployeeClockedOut(userId)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F1F5F9' }}>
      <style>{`
        @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes employeeDashboardBlockIn { from { opacity: 0; transform: translateY(18px) scale(0.985); filter: blur(2px) } to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0) } }
        ${DASHBOARD_SKELETON_KEYFRAMES}
      `}</style>
      <EmployeeSidebar />

      <main style={{ marginLeft: 64, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, gap: 0, animation: 'blockSlideUp 0.38s ease both 0.04s' }}>
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">{title}</h1>
          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {userId && companyId && <OwnerUserBadge userId={userId} companyId={companyId} />}
          </div>
        </div>

        <div style={{ padding: '0 28px 28px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* My Shift stepper — Casual Workers Today moved to the Tasks page, below the Member
                panel (2026-08-02). */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {/* My Shift — same Clock In/Break In/Break Out/Clock Out stepper as Manager's
                Dashboard (src/components/dashboard/ClockFlow.tsx). Manager's own version isn't
                wrapped in a titled panel either — just the bare button row in a plain bordered
                box — so this matches that exactly instead of adding a "My Shift" header. */}
            <div style={{ flexShrink: 0, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            {clockMessage && (
              // Only ever an error now — runClockAction no longer sets this on success.
              <div style={{ padding: '8px 12px', background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
                {clockMessage}
              </div>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: '100%', height: 92, boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '0 18px', overflow: 'hidden', animation: 'employeeDashboardBlockIn 0.46s cubic-bezier(0.22,1,0.36,1) both 40ms' }}>
              {myShiftLoading ? (
                // Shimmer stand-in for the clock chain (same shape/rhythm as Manager's own My
                // Shift skeleton in DashboardView.tsx) instead of flashing "No shift scheduled
                // today." while the fetch is still in flight (2026-08-03).
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, width: '100%', justifyContent: 'center' }}>
                  <SkeletonLine width={140} height={62} radius={12} />
                  <SkeletonLine width={40} height={10} />
                  <SkeletonLine width={140} height={62} radius={12} />
                  <SkeletonLine width={40} height={10} />
                  <SkeletonLine width={140} height={62} radius={12} />
                  <SkeletonLine width={40} height={10} />
                  <SkeletonLine width={140} height={62} radius={12} />
                </div>
              ) : myTodayShifts.length === 0 ? (
                <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>No shift scheduled today.</p>
              ) : myTodayShifts.map(shift => {
                const clockedIn = !!shift.record?.clock_in_time
                const clockedOut = !!shift.record?.clock_out_time
                const breakInDone = !!shift.record?.break_in_time
                const breakOutDone = !!shift.record?.break_out_time
                const clockInEnabled = !clockBusyId && !clockedIn && canClockIn(shift.shift)
                const breakInEnabled = !clockBusyId && clockedIn && !clockedOut && !breakInDone
                const breakOutEnabled = !clockBusyId && clockedIn && !clockedOut && breakInDone && !breakOutDone
                // Employee (like Manager, unlike a Shift Job Casual Worker) must complete both
                // break steps before clocking out — only a One-Off Job Casual Worker skips the
                // break requirement entirely, and even then their Clock Out is supervisor-released
                // rather than self-serve (see casual dashboard's clockout_release_queue).
                const clockOutEnabled = !clockBusyId && clockedIn && !clockedOut && breakInDone && breakOutDone && canClockOut(shift.shift)
                return (
                    <div key={shift.assignment.id} style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
                      <ClockFlowButton
                        icon={<Clock size={19} />}
                        label="Clock In"
                        sub={clockedIn && shift.record?.clock_in_time ? `At ${fmtClockStamp(shift.record.clock_in_time)}` : `From ${fmtShiftTimeMinusMinutes(shift.shift.start_time, CLOCK_IN_WINDOW_MINUTES_BEFORE)}`}
                        enabled={clockInEnabled}
                        completed={clockedIn}
                        activeColor={ACCENT}
                        onClick={() => void runClockAction(shift, 'clock_in')}
                      />
                      <ClockFlowConnector />
                      <ClockFlowButton
                        icon={<Coffee size={19} />}
                        label="Break In"
                        sub={breakInDone && shift.record?.break_in_time ? `At ${fmtClockStamp(shift.record.break_in_time)}` : ''}
                        enabled={breakInEnabled}
                        completed={breakInDone}
                        activeColor={ACCENT}
                        onClick={() => void runClockAction(shift, 'break_in')}
                      />
                      <ClockFlowConnector />
                      <ClockFlowButton
                        icon={<Coffee size={19} />}
                        label="Break Out"
                        sub={breakOutDone && shift.record?.break_out_time ? `At ${fmtClockStamp(shift.record.break_out_time)}` : ''}
                        enabled={breakOutEnabled}
                        completed={breakOutDone}
                        activeColor={ACCENT}
                        onClick={() => void runClockAction(shift, 'break_out')}
                      />
                      <ClockFlowConnector />
                      <ClockFlowButton
                        icon={<Clock size={19} />}
                        label="Clock Out"
                        sub={clockedOut && shift.record?.clock_out_time ? `At ${fmtClockStamp(shift.record.clock_out_time)}` : shift.shift.is_open_ended ? 'When done' : `After ${fmtShiftTime(shift.shift.end_time)}`}
                        enabled={clockOutEnabled}
                        completed={clockedOut}
                        activeColor="#334155"
                        onClick={() => void runClockAction(shift, 'clock_out')}
                      />
                    </div>
                )
              })}
            </div>
            </div>

            </div>

            {/* My Tasks — assigned to this Employee by their Manager. Same Kanban board design as
                Manager's Tasks page "My Tasks" tab (see EmployeeMyTasksBoard's header comment).
                Now full-width: Announcements/Chatbox moved to their own Communication page
                (confirmed 2026-07-31), so this fills the space they used to occupy. */}
            <div style={{ flex: 1, minHeight: 0, minWidth: 0, animation: 'employeeDashboardBlockIn 0.46s cubic-bezier(0.22,1,0.36,1) both 90ms' }}>
              <EmployeeMyTasksBoard companyId={companyId} internalUserId={userId} clockedOut={clockedOutForToday} />
            </div>
        </div>
      </main>

    </div>
  )
}
