'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Coffee, Users, Phone } from 'lucide-react'
import EmployeeSidebar from '@/components/EmployeeSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import RoleAvatar from '@/components/RoleAvatar'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'
import { ShowcaseCard } from '@/components/panel'
import {
  CLOCK_IN_WINDOW_MINUTES_BEFORE, canClockIn, canClockOut,
  fmtShiftTime, fmtShiftTimeMinusMinutes, fmtClockStamp,
  ClockFlowButton, ClockFlowConnector,
} from '@/components/dashboard/ClockFlow'
import EmployeeMyTasksBoard from '@/components/employee/EmployeeMyTasksBoard'
import EmployeeChatbox from '@/components/employee/EmployeeChatbox'

const TEXT   = '#111827'
const MUTED  = '#6B7280'
const ACCENT = '#F97316'

type MyShiftRecord = { id: string; clock_in_time: string | null; clock_out_time: string | null; break_in_time: string | null; break_out_time: string | null; status: string }
type MyShift = {
  assignment: { id: string; user_id: string }
  shift: { id: string; title: string | null; shift_date: string; start_time: string; end_time: string; is_open_ended: boolean }
  record: MyShiftRecord | null
}

type ClockOutReleaseItem = {
  id: string
  casual_worker_id: string
  worker_name: string
  clock_in_time: string | null
  shift_title: string | null
  shift_date: string
  start_time: string
}

type SupervisedWorker = {
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
}

export default function EmployeeDashboard() {
  const router = useRouter()

  const [userId, setUserId]       = useState('')
  const [authUserId, setAuthUserId] = useState('')
  const [companyId, setCompanyId] = useState('')

  // My Shift
  const [myShifts, setMyShifts]       = useState<MyShift[]>([])
  const [clockBusyId, setClockBusyId] = useState('')
  const [clockMessage, setClockMessage] = useState('')

  // Supervised Casual Workers today + clock-out release queue
  const [supervisedWorkers, setSupervisedWorkers] = useState<SupervisedWorker[]>([])
  const [releaseQueue, setReleaseQueue]           = useState<ClockOutReleaseItem[]>([])
  const [releaseBusyId, setReleaseBusyId]         = useState('')

  const fetchMyShift = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${uid}&resource=my_shift`)
      const data = await res.json()
      if (data.success) setMyShifts(data.myShift?.shifts ?? [])
    } catch {}
  }, [])

  const fetchReleaseQueue = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${uid}&resource=clockout_release_queue`)
      const data = await res.json()
      if (data.success) setReleaseQueue(data.queue ?? [])
    } catch {}
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
      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }
      const internalId = meData.user.id ?? uid
      setUserId(internalId)
      setAuthUserId(uid)

      const dash = await fetchDashboard(uid)
      if (cancelled) return
      if (dash.success) {
        setCompanyId(dash.company_id ?? '')
        setSupervisedWorkers(dash.supervised_workers ?? [])
      }

      void fetchMyShift(internalId)
      void fetchReleaseQueue(uid)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchDashboard, fetchMyShift, fetchReleaseQueue])

  // Live-updates the Shift/Supervised Workers widgets when a Manager reassigns a shift or a
  // Casual Worker clocks in/out (My Tasks and Messages handle their own realtime refresh
  // internally — see EmployeeMyTasksBoard/EmployeeChatbox) — matching the Owner/Manager
  // dashboards' realtime behavior instead of requiring a manual refresh.
  useResourceInvalidation(['dashboard', 'shifts', 'attendance', 'team'], () => {
    if (!authUserId || !userId) return
    void fetchMyShift(userId)
    void fetchReleaseQueue(authUserId)
    void fetchDashboard(authUserId).then(dash => {
      if (dash.success) setSupervisedWorkers(dash.supervised_workers ?? [])
    })
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
      await fetchMyShift(userId)
      const msgs: Record<string, string> = { clock_in: 'Clocked in.', clock_out: 'Clocked out.', break_in: 'Break started.', break_out: 'Break ended.' }
      setClockMessage(msgs[action] ?? 'Done.')
    } catch (err) {
      setClockMessage(err instanceof Error ? err.message : 'Attendance action failed')
    } finally { setClockBusyId('') }
  }

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
      setClockMessage(err instanceof Error ? err.message : 'Failed to release clock-out')
    } finally { setReleaseBusyId('') }
  }

  const title = "Today's Overview"
  // Shift dates are UTC-nominal (see casualAttendanceService's Clock In window), but between
  // local midnight and the local UTC offset the local and UTC calendar days disagree — matching
  // either key (not just the local one) keeps a genuinely-today shift from vanishing then.
  const myTodayShifts = myShifts.filter(s => {
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const utcTodayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
    return s.shift.shift_date === todayKey || s.shift.shift_date === utcTodayKey
  })
  // Earliest start time first, so the grid fills left-to-right in shift order.
  const sortedSupervisedWorkers = [...supervisedWorkers].sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F1F5F9' }}>
      <style>{`@keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }`}</style>
      <EmployeeSidebar />

      <main style={{ marginLeft: 64, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, gap: 0, animation: 'blockSlideUp 0.38s ease both 0.04s' }}>
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">{title}</h1>
          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {userId && companyId && <OwnerUserBadge userId={userId} companyId={companyId} />}
          </div>
        </div>

        {/* CSS Grid with an explicit blank spacer at row 1/column 2 — the Clock card (row 1,
            column 1) is short and content-sized, so without a matching-height placeholder beside
            it, "My Tasks" (row 2, column 1) and "Casual Workers Today" (row 2, column 2) would
            start at different Y positions. The spacer has no content, so row 1's auto height is
            still driven only by the Clock card — it just reserves that same height on the right
            so row 2 lines up across both columns. */}
        <div style={{ padding: '0 28px 28px', flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 16 }}>
            {/* My Shift — same Clock In/Break In/Break Out/Clock Out stepper as Manager's
                Dashboard (src/components/dashboard/ClockFlow.tsx). Manager's own version isn't
                wrapped in a titled panel either — just the bare button row in a plain bordered
                box — so this matches that exactly instead of adding a "My Shift" header. */}
            <div style={{ gridColumn: 1, gridRow: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            {clockMessage && (
              <div style={{ padding: '8px 12px', background: clockMessage.toLowerCase().includes('fail') || clockMessage.toLowerCase().includes('wait') ? '#FEF2F2' : '#ECFDF5', color: clockMessage.toLowerCase().includes('fail') || clockMessage.toLowerCase().includes('wait') ? '#B91C1C' : '#047857', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
                {clockMessage}
              </div>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: '100%', height: 92, boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '0 18px', overflow: 'hidden' }}>
              {myTodayShifts.length === 0 ? (
                <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>No shift scheduled today.</p>
              ) : myTodayShifts.map(shift => {
                const clockedIn = !!shift.record?.clock_in_time
                const clockedOut = !!shift.record?.clock_out_time
                const breakInDone = !!shift.record?.break_in_time
                const breakOutDone = !!shift.record?.break_out_time
                const clockInEnabled = !clockBusyId && !clockedIn && canClockIn(shift.shift)
                const breakInEnabled = !clockBusyId && clockedIn && !clockedOut && !breakInDone
                const breakOutEnabled = !clockBusyId && clockedIn && !clockedOut && breakInDone && !breakOutDone
                const clockOutEnabled = !clockBusyId && clockedIn && !clockedOut && canClockOut(shift.shift)
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

            {/* Blank spacer — see the comment on the grid container above. */}
            <div style={{ gridColumn: 2, gridRow: 1, minHeight: 0 }} />

            {/* My Tasks — assigned to this Employee by their Manager. Same Kanban board design
                as Manager's Tasks page "My Tasks" tab (see EmployeeMyTasksBoard's header comment). */}
            <div style={{ gridColumn: 1, gridRow: 2, minHeight: 0, minWidth: 0 }}>
              <EmployeeMyTasksBoard companyId={companyId} internalUserId={userId} />
            </div>

          <div style={{ gridColumn: 2, gridRow: 2, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Supervised Casual Workers today — same contact-row language as the Casual Worker's
                own "Supervisor" block (src/app/casual/dashboard/page.tsx): avatar, name, phone.
                Side-by-side cards once there's more than one worker. Shift line shows the full
                start–end range for a normal shift, or just the start time for a one-off
                (open-ended) job, since those have no scheduled end. A Casual Worker on a one-off
                job can't clock out on their own page until this Employee approves it (see
                employeeAttendanceService.releaseClockOut) — that action sits inline on the card.
                Height hugs its own content up to a cap (own scrollbar beyond that) instead of
                being forced to match Chatbox's height. */}
            <div style={{ maxHeight: 260, display: 'flex', flexDirection: 'column' }}>
              <ShowcaseCard icon={<Users size={15} color={ACCENT} />} title="Casual Workers Today" fillHeight>
                {supervisedWorkers.length === 0 ? (
                  <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>No Casual Workers under you today.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
                    {sortedSupervisedWorkers.map(w => {
                      const release = releaseQueue.find(r => r.casual_worker_id === w.id)
                      return (
                        <div key={w.shift_assignment_id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 12, border: '1px solid #E5E7EB', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <RoleAvatar role="Casual Worker" photoUrl={w.profile_photo_url} size={44} />
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5, color: TEXT }}>{w.full_name}</p>
                              {w.phone_number && (
                                <a href={`tel:${w.phone_number}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: TEXT, textDecoration: 'none' }}>
                                  <Phone size={11} color={ACCENT} style={{ flexShrink: 0 }} /> {w.phone_number}
                                </a>
                              )}
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <Clock size={11} color={ACCENT} style={{ flexShrink: 0 }} />
                                {w.is_open_ended ? `From ${fmtShiftTime(w.start_time)}` : `${fmtShiftTime(w.start_time)} – ${fmtShiftTime(w.end_time)}`}
                              </span>
                            </div>
                          </div>
                          {release && (
                            <button
                              type="button"
                              onClick={() => releaseClockOut(release)}
                              disabled={!!releaseBusyId}
                              style={{ width: '100%', height: 30, padding: '0 12px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: releaseBusyId ? 'default' : 'pointer' }}
                            >
                              {releaseBusyId === release.id ? '…' : 'Approve Clock Out'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </ShowcaseCard>
            </div>

            {/* Messages — same "Chatbox" design as Owner/Partner/Manager's Communication page
                (conversation list + up to 4 side-by-side chat panels via drag-and-drop), scoped
                to this Employee's Manager/colleagues/supervised Casual Workers. */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <EmployeeChatbox companyId={companyId} internalUserId={userId} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
