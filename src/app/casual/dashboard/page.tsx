'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Briefcase, Building2, CalendarDays, Check, ClipboardList, Clock, Coffee, ExternalLink, Mail, MapPin, MessageCircle, Phone, UserCheck, XCircle } from 'lucide-react'
import CasualTaskBoard from '@/components/casual/CasualTaskBoard'
import CasualMessagePanel from '@/components/casual/CasualMessagePanel'
import { TitledBlock } from '@/components/panel'
import RoleAvatar from '@/components/RoleAvatar'
import { JobDetailPanel, JobView } from '@/components/jobs/JobPresentation'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'

type JobItem = {
  assignment_id: string
  shift_id: string
  company_id: string
  department_id: string
  title: string
  shift_date: string
  start_time: string
  end_time: string
  is_open_ended: boolean
  company_name: string | null
  location: string | null
  job_posting_id: string | null
  supervisor: { id: string; full_name: string; phone_number: string | null; email_address: string; profile_photo_url: string | null } | null
  posted_by: { id: string; full_name: string; role: string; phone_number: string | null; email_address: string; profile_photo_url: string | null } | null
  clock_in_time: string | null
  clock_out_time: string | null
  break_in_time: string | null
  break_out_time: string | null
  clock_out_released_at: string | null
}

const pageKeyframes = `
  @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
  @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
`

// UC49: the Clock In window opens 30 minutes before the shift's scheduled start and stays open
// after that too — a late worker can still clock in, the real time is what's recorded. The same
// moment also unlocks the other work actions (task board, messaging): before it, the Dashboard
// shows job information only.
const CLOCK_IN_WINDOW_MINUTES_BEFORE = 30

function workActionsUnlocked(job: JobItem): boolean {
  const shiftStart = new Date(`${job.shift_date}T${job.start_time}Z`)
  const earliestClockIn = new Date(shiftStart.getTime() - CLOCK_IN_WINDOW_MINUTES_BEFORE * 60000)
  return Date.now() >= earliestClockIn.getTime()
}

function canClockOut(job: JobItem): boolean {
  if (job.is_open_ended) return !!job.clock_out_released_at
  const shiftEnd = new Date(`${job.shift_date}T${job.end_time}Z`)
  return Date.now() >= shiftEnd.getTime()
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatShiftDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

// Timeline group heading — "Today, 17 Jul" / "Tomorrow, 18 Jul" / "Mon, 21 Jul".
function formatTimelineDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`)
  const dayMonth = date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
  const today = new Date()
  if (dateKey === localDateKey(today)) return `Today, ${dayMonth}`
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateKey === localDateKey(tomorrow)) return `Tomorrow, ${dayMonth}`
  return `${date.toLocaleDateString('en-SG', { weekday: 'short' })}, ${dayMonth}`
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

// "HH:MM" minus N minutes, formatted — e.g. the Clock In tile's "Available from 8:30 AM".
function formatTimeMinusMinutes(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number)
  const total = (h * 60 + m - minutes + 1440) % 1440
  return formatTime(`${Math.floor(total / 60)}:${total % 60}`)
}

// A recorded clock-in/out timestamp (real ISO moment) shown as a wall-clock time.
function formatClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })
}

export default function CasualDashboardPage() {
  const router = useRouter()
  // The timeline column is only 300px wide, so side-by-side still fits comfortably at the
  // reference 1192px laptop viewport — stack only below ~980px.
  const isCompact = useIsCompactViewport(980)

  const [authId, setAuthId] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [upcomingJobs, setUpcomingJobs] = useState<JobItem[]>([])
  const [currentAssignmentId, setCurrentAssignmentId] = useState<string | null>(null)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bumped by a one-shot timer at the next availability boundary (window open / shift end) so
  // buttons and the task/message blocks appear the moment they unlock — no polling.
  const [, setBoundaryTick] = useState(0)
  // Posting this job was hired from (pay, description, requirements) — shown inline in the
  // locked layout via the same JobDetailPanel the worker saw when applying.
  const [detailJob, setDetailJob] = useState<JobView | null>(null)
  const [hoveredTimelineId, setHoveredTimelineId] = useState<string | null>(null)
  const [cancelHover, setCancelHover] = useState(false)

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(''), 3000)
  }

  const load = async (uid: string) => {
    const res = await fetch(`/api/casual/dashboard?user_id=${uid}`)
    const data = await res.json()
    if (!data.success) {
      router.replace('/signin')
      return
    }
    const jobs: JobItem[] = data.dashboard.upcoming_jobs ?? []
    const currentId: string | null = data.dashboard.current_job?.assignment_id ?? null
    setInternalUserId(data.dashboard.user.id)
    setUpcomingJobs(jobs)
    setCurrentAssignmentId(currentId)
    // Keep the worker's selection across reloads if that job still exists; otherwise fall back
    // to the current (actionable) job.
    setSelectedAssignmentId(prev =>
      prev && jobs.some(j => j.assignment_id === prev) ? prev : currentId ?? jobs[0]?.assignment_id ?? null
    )
    setDetailJob(null) // the selected job may have changed — refetch its posting on next open
    setLoading(false)
  }

  const selectedJob = upcomingJobs.find(j => j.assignment_id === selectedAssignmentId) ?? null
  const currentJob = upcomingJobs.find(j => j.assignment_id === currentAssignmentId) ?? null
  const isCurrentSelected = !!selectedJob && selectedJob.assignment_id === currentAssignmentId

  const selectJob = (assignmentId: string) => {
    if (assignmentId === selectedAssignmentId) return
    setSelectedAssignmentId(assignmentId)
    setDetailJob(null) // posting detail belongs to the previous selection
  }

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    if (!uid) {
      router.replace('/signin')
      return
    }
    setAuthId(uid)
    void load(uid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Availability flips at exact wall-clock moments: the Clock In window opening (start − 30 min)
  // and, for a clocked-in fixed-end shift, the scheduled end time. Schedule one re-render at the
  // nearest upcoming boundary; the effect re-runs after each render and re-arms for the next one.
  useEffect(() => {
    if (!currentJob) return
    const now = Date.now()
    const boundaries: number[] = []
    const windowOpensAt = new Date(`${currentJob.shift_date}T${currentJob.start_time}Z`).getTime() - CLOCK_IN_WINDOW_MINUTES_BEFORE * 60000
    if (now < windowOpensAt) boundaries.push(windowOpensAt)
    if (currentJob.clock_in_time && !currentJob.clock_out_time && !currentJob.is_open_ended) {
      const endsAt = new Date(`${currentJob.shift_date}T${currentJob.end_time}Z`).getTime()
      if (now < endsAt) boundaries.push(endsAt)
    }
    if (boundaries.length === 0) return
    const timer = setTimeout(() => setBoundaryTick(t => t + 1), Math.min(...boundaries) - now + 250)
    return () => clearTimeout(timer)
  })

  const runClockAction = async (action: 'clock_in' | 'clock_out' | 'break_in' | 'break_out') => {
    if (!currentJob) return
    setBusy(true)
    try {
      const res = await fetch('/api/casual/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: authId, shift_assignment_id: currentJob.assignment_id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Attendance action failed')
      showToast(
        action === 'clock_in' ? 'Clocked in.'
        : action === 'clock_out' ? 'Clocked out — see you next time.'
        : action === 'break_in' ? 'Break started.'
        : 'Break ended — welcome back.'
      )
      await load(authId)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Attendance action failed')
    } finally {
      setBusy(false)
    }
  }

  const confirmCancel = async () => {
    if (!selectedJob) return
    setCancelling(true); setCancelError('')
    try {
      const res = await fetch('/api/casual/shift-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: authId, shift_id: selectedJob.shift_id, reason: cancelReason.trim() || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to cancel shift')
      setShowCancelConfirm(false); setCancelReason('')
      showToast('Shift cancelled — the employer has been notified.')
      await load(authId)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel shift')
    } finally {
      setCancelling(false)
    }
  }

  const clockedIn = !!currentJob?.clock_in_time
  const clockedOut = !!currentJob?.clock_out_time
  const actionsUnlocked = !!currentJob && workActionsUnlocked(currentJob)

  // Preserve API order (date + start time ascending) while grouping by day.
  const timelineGroups: { dateKey: string; jobs: JobItem[] }[] = []
  for (const job of upcomingJobs) {
    const group = timelineGroups[timelineGroups.length - 1]
    if (group && group.dateKey === job.shift_date) group.jobs.push(job)
    else timelineGroups.push({ dateKey: job.shift_date, jobs: [job] })
  }

  const timelinePanel = (
    <TitledBlock
      icon={<CalendarDays size={15} color="#F97316" />}
      title="Upcoming Jobs"
      containerStyle={isCompact ? undefined : { height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={isCompact
        ? { maxHeight: 300, overflowY: 'auto' }
        : { flex: 1, minHeight: 0, overflowY: 'auto' }}
    >
      {timelineGroups.map(group => (
        <div key={group.dateKey} style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 800, color: '#F97316', letterSpacing: '0.01em' }}>
            {formatTimelineDate(group.dateKey)}
          </p>
          <div style={{ position: 'relative', paddingLeft: 16 }}>
            {/* Timeline rail for this day's jobs. */}
            <div style={{ position: 'absolute', left: 4, top: 10, bottom: 10, width: 2, background: '#E5E7EB', borderRadius: 1 }} />
            {group.jobs.map(job => {
              const isSelected = job.assignment_id === selectedAssignmentId
              const isCurrent = job.assignment_id === currentAssignmentId
              const isCompleted = !!job.clock_out_time
              const isHovered = hoveredTimelineId === job.assignment_id
              return (
                <div key={job.assignment_id} style={{ position: 'relative', marginBottom: 8 }}>
                  <span style={{
                    position: 'absolute', left: -16, top: 13, width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box',
                    background: isCurrent ? '#F97316' : isCompleted ? '#CBD5E1' : '#FFFFFF',
                    border: isCurrent ? '2px solid #FED7AA' : '2px solid #CBD5E1',
                  }} />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => selectJob(job.assignment_id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectJob(job.assignment_id) } }}
                    onMouseEnter={() => setHoveredTimelineId(job.assignment_id)}
                    onMouseLeave={() => setHoveredTimelineId(null)}
                    style={{
                      border: `1.5px solid ${isSelected ? '#FDBA74' : isHovered ? '#FDBA74' : '#E5E7EB'}`,
                      background: isSelected ? '#FFF7ED' : '#FFFFFF',
                      borderRadius: 10,
                      padding: '13px 14px',
                      cursor: 'pointer',
                      opacity: isCompleted ? 0.6 : 1,
                      transform: isHovered && !isSelected ? 'translateY(-1px)' : 'none',
                      boxShadow: isHovered && !isSelected ? '0 4px 12px rgba(249,115,22,0.10)' : 'none',
                      transition: 'border-color 0.16s ease, background 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#000000', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</span>
                      {isCompleted && (
                        <span style={{ flexShrink: 0, fontSize: '0.625rem', fontWeight: 800, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, padding: '1px 7px' }}>
                          Completed
                        </span>
                      )}
                    </p>
                    <p style={{ margin: '7px 0 0', fontSize: '0.8125rem', color: '#000000', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={13} color="#F97316" style={{ flexShrink: 0 }} />
                      <span>{formatTime(job.start_time)}{job.is_open_ended ? ' — until done' : ` – ${formatTime(job.end_time)}`}</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </TitledBlock>
  )

  // Clock tile states — captions and availability read from the SELECTED job so a future job
  // shows its own times; the buttons themselves only ever act on the current job.
  const selClockedIn = !!selectedJob?.clock_in_time
  const selClockedOut = !!selectedJob?.clock_out_time
  const breakInEnabled = isCurrentSelected && clockedIn && !clockedOut && !currentJob?.break_in_time && !busy
  const breakOutEnabled = isCurrentSelected && !!currentJob?.break_in_time && !currentJob?.break_out_time && !busy
  const clockInEnabled = isCurrentSelected && !clockedIn && actionsUnlocked && !busy
  const clockOutEnabled = isCurrentSelected && clockedIn && !clockedOut && !!currentJob && canClockOut(currentJob) && !busy
  const awaitingRelease = !!selectedJob?.is_open_ended && selClockedIn && !selClockedOut && !selectedJob?.clock_out_released_at
  const clockInCompleted = selClockedIn
  const breakInCompleted = !!selectedJob?.break_in_time
  const breakOutCompleted = !!selectedJob?.break_out_time
  const clockOutCompleted = selClockedOut
  // Work panels (clock tiles, task board, messaging) only exist once Clock In has unlocked
  // for the current job — future/other jobs show just the job info and location.
  const showWorkPanels = isCurrentSelected && actionsUnlocked

  // The locked layout embeds the posting detail inline — fetch it as soon as it's needed.
  useEffect(() => {
    if (showWorkPanels || detailJob || !selectedJob?.job_posting_id) return
    let stale = false
    ;(async () => {
      const res = await fetch(`/api/recruitment?resource=job_posting&job_id=${selectedJob.job_posting_id}`)
      const data = await res.json()
      if (!stale && data.success) setDetailJob(data.posting as JobView)
    })()
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWorkPanels, detailJob, selectedJob?.job_posting_id])

  // Shared pieces used by both the locked and unlocked layouts below.
  const jobInfoHeader = selectedJob && (
    <>
      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '1.25rem', color: '#111827' }}>
        {selectedJob.title}
      </p>

      {/* Line 2 — company | location (gray). */}
      {(selectedJob.company_name || selectedJob.location) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.8425rem', color: '#6B7280', marginBottom: 12 }}>
          {selectedJob.company_name && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={14} /> {selectedJob.company_name}
            </span>
          )}
          {selectedJob.company_name && selectedJob.location && (
            <span style={{ width: 1, height: 14, background: '#E5E7EB', flexShrink: 0 }} />
          )}
          {selectedJob.location && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} /> {selectedJob.location}
            </span>
          )}
        </div>
      )}

      {/* Line 3 — date | time (orange icons). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.8425rem', color: '#111827' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CalendarDays size={14} color="#F97316" /> {formatShiftDate(selectedJob.shift_date)}
        </span>
        <span style={{ width: 1, height: 14, background: '#E5E7EB', flexShrink: 0 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Clock size={14} color="#F97316" />
          {formatTime(selectedJob.start_time)}{selectedJob.is_open_ended ? ' — until done' : ` – ${formatTime(selectedJob.end_time)}`}
        </span>
      </div>
    </>
  )


  // One contact row — avatar left, name/phone/email beside it. Used for the shift Supervisor
  // and for the Owner/Manager who posted the job (roleLabel distinguishes the poster).
  const contactRow = (
    person: { full_name: string; phone_number: string | null; email_address: string; profile_photo_url: string | null },
    role: string,
    roleLabel: string | null,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <RoleAvatar role={role} size={56} photoUrl={person.profile_photo_url} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: 0 }}>
          {person.full_name}
          {roleLabel && <span style={{ marginLeft: 8, fontWeight: 600, fontSize: '0.75rem', color: '#6B7280' }}>{roleLabel}</span>}
        </p>
        {person.phone_number && (
          <a href={`tel:${person.phone_number}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: '#111827', textDecoration: 'none' }}>
            <Phone size={15} color="#F97316" style={{ flexShrink: 0 }} /> {person.phone_number}
          </a>
        )}
        <a href={`mailto:${person.email_address}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: '#111827', textDecoration: 'none', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Mail size={15} color="#F97316" style={{ flexShrink: 0 }} /> {person.email_address}
        </a>
      </div>
    </div>
  )

  const supervisorBlock = selectedJob && (selectedJob.supervisor || selectedJob.posted_by) && (
    <TitledBlock
      icon={<UserCheck size={15} color="#F97316" />}
      title="Supervisor"
      containerStyle={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, minHeight: 0 }}
    >
      <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', alignItems: 'stretch', gap: 14 }}>
        {selectedJob.supervisor && (
          <div style={{ flex: 1, minWidth: 0 }}>{contactRow(selectedJob.supervisor, 'Employee', null)}</div>
        )}
        {selectedJob.supervisor && selectedJob.posted_by && (
          <div style={isCompact ? { height: 1, background: '#F3F4F6' } : { width: 1, background: '#F3F4F6' }} />
        )}
        {/* The poster is the fallback contact if the supervisor can't be reached during the shift. */}
        {selectedJob.posted_by && (
          <div style={{ flex: 1, minWidth: 0 }}>{contactRow(selectedJob.posted_by, selectedJob.posted_by.role, 'Backup Contact')}</div>
        )}
      </div>
    </TitledBlock>
  )

  const detailColumn = selectedJob && (!showWorkPanels ? (
    /* Locked — future/other job: narrow Job Detail with the full posting shown inline (same
       JobDetailPanel UI as the Job Board), beside Supervisor + half-width Job Location. */
    <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: 16, alignItems: 'stretch', height: isCompact ? undefined : '100%' }}>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <TitledBlock
          icon={<Briefcase size={15} color="#F97316" />}
          title="Job Detail"
          containerStyle={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
          headerRight={!selClockedIn ? (
            <button
              type="button"
              onClick={() => { setShowCancelConfirm(true); setCancelReason(''); setCancelError('') }}
              onMouseEnter={() => setCancelHover(true)}
              onMouseLeave={() => setCancelHover(false)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
                borderRadius: 8, border: '1px solid #FECACA', whiteSpace: 'nowrap',
                background: cancelHover ? '#FEE2E2' : '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                transition: 'background 0.16s ease',
              }}
            >
              <XCircle size={13} /> Cancel Shift
            </button>
          ) : undefined}
        >
          {jobInfoHeader}
          {selectedJob.job_posting_id && (
            <div style={{ marginTop: 16, borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
              {detailJob
                /* The posting's advertised schedule can differ from this assignment's actual
                   occurrence (recurring shifts) — show THIS shift's date and times. */
                ? <JobDetailPanel
                    job={{ ...detailJob, shift_date: selectedJob.shift_date, shift_start_time: selectedJob.start_time, shift_end_time: selectedJob.end_time }}
                    variant="inline"
                  />
                : <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6B7280' }}>Loading job details…</p>}
            </div>
          )}
        </TitledBlock>
      </div>

      <div style={{ flex: 1.35, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {supervisorBlock && <div style={{ flexShrink: 0 }}>{supervisorBlock}</div>}
        {selectedJob.location && (
          <div style={{ flex: 1, minHeight: isCompact ? undefined : 0 }}>
            <TitledBlock
              icon={<MapPin size={15} color="#F97316" />}
              title="Job Location"
              containerStyle={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, minHeight: 0, padding: 14, display: 'flex', flexDirection: 'column' }}
              headerRight={
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedJob.location)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 8, border: '1.5px solid #FDBA74', background: '#FFFFFF', color: '#EA580C', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none' }}
                >
                  Open in Maps <ExternalLink size={13} />
                </a>
              }
            >
              <iframe
                title="Job location map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(selectedJob.location)}&output=embed`}
                loading="lazy"
                style={{ width: '100%', flex: 1, minHeight: isCompact ? 220 : 0, border: 0, borderRadius: 10, display: 'block' }}
              />
              <p style={{ margin: '12px 0 0', flexShrink: 0, fontSize: '0.8425rem', color: '#374151' }}>{selectedJob.location}</p>
            </TitledBlock>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: isCompact ? undefined : '100%' }}>
      {/* Row 1 — Job Detail (info + clock buttons in one compact row) beside Supervisor; stretched
          to the same height so the two cards line up evenly regardless of content length. */}
      <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: 16, alignItems: 'stretch', flexShrink: 0 }}>
        <div style={{ flex: isCompact ? undefined : 1.6, minWidth: 0 }}>
          <TitledBlock
            icon={<Briefcase size={15} color="#F97316" />}
            title="Job Detail"
            containerStyle={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, minHeight: 0 }}
          >
            <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: 16, alignItems: isCompact ? 'stretch' : 'center', flexWrap: 'wrap' }}>
              {/* Job info — the title re-opens the full posting detail (pay, description,
                  requirements), same panel the worker saw when applying. */}
              <div style={{ flex: '0 1 auto', minWidth: 160 }}>
                {jobInfoHeader}
              </div>

              {showWorkPanels && !isCompact && <div style={{ width: 1, alignSelf: 'stretch', background: '#F3F4F6', flexShrink: 0, marginLeft: 'auto' }} />}

              {/* Clock buttons — all four always rendered in fixed positions once Clock In has
                  unlocked, so a worker sees the whole sequence ahead of time, connected by arrows
                  to read as one flow. Each button gates itself independently (its own *Enabled
                  flag); nothing is swapped or hidden after a click. They act on the current job. */}
              {showWorkPanels && (
              <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', alignItems: 'center', gap: isCompact ? 8 : 6, flexShrink: 0, marginLeft: isCompact ? undefined : 20 }}>
                <button
                  type="button"
                  disabled={!clockInEnabled}
                  onClick={() => runClockAction('clock_in')}
                  style={{
                    border: 'none', borderRadius: 12, padding: '0 16px', height: 54, boxSizing: 'border-box', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 9, minWidth: isCompact ? undefined : 140,
                    background: clockInCompleted ? '#16A34A' : clockInEnabled ? '#F97316' : '#F3F4F6',
                    color: clockInCompleted || clockInEnabled ? '#FFFFFF' : '#9CA3AF',
                    cursor: clockInEnabled ? 'pointer' : 'default',
                    boxShadow: clockInCompleted ? '0 6px 16px rgba(22,163,74,0.35)' : clockInEnabled ? '0 6px 16px rgba(249,115,22,0.35)' : 'none',
                  }}
                >
                  <Clock size={17} style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>Clock In</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 500, marginTop: 1, opacity: 0.92, whiteSpace: 'nowrap' }}>
                      {selClockedIn && selectedJob.clock_in_time ? `At ${formatClockTime(selectedJob.clock_in_time)}`
                        : `From ${formatTimeMinusMinutes(selectedJob.start_time, CLOCK_IN_WINDOW_MINUTES_BEFORE)}`}
                    </span>
                  </span>
                </button>

                <ArrowRight size={16} color="#D1D5DB" style={{ flexShrink: 0, transform: isCompact ? 'rotate(90deg)' : undefined }} />

                <button
                  type="button"
                  disabled={!breakInEnabled}
                  onClick={() => runClockAction('break_in')}
                  style={{
                    border: 'none', borderRadius: 12, padding: '0 16px', height: 54, boxSizing: 'border-box', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 9, minWidth: isCompact ? undefined : 140,
                    background: breakInCompleted ? '#16A34A' : breakInEnabled ? '#F97316' : '#F3F4F6',
                    color: breakInCompleted || breakInEnabled ? '#FFFFFF' : '#9CA3AF',
                    cursor: breakInEnabled ? 'pointer' : 'default',
                    boxShadow: breakInCompleted ? '0 6px 16px rgba(22,163,74,0.35)' : breakInEnabled ? '0 6px 16px rgba(249,115,22,0.35)' : 'none',
                  }}
                >
                  <Coffee size={17} style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>Break In</span>
                    {selectedJob.break_in_time && (
                      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 500, marginTop: 1, opacity: 0.92, whiteSpace: 'nowrap' }}>
                        At {formatClockTime(selectedJob.break_in_time)}
                      </span>
                    )}
                  </span>
                </button>

                <ArrowRight size={16} color="#D1D5DB" style={{ flexShrink: 0, transform: isCompact ? 'rotate(90deg)' : undefined }} />

                <button
                  type="button"
                  disabled={!breakOutEnabled}
                  onClick={() => runClockAction('break_out')}
                  style={{
                    border: 'none', borderRadius: 12, padding: '0 16px', height: 54, boxSizing: 'border-box', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 9, minWidth: isCompact ? undefined : 140,
                    background: breakOutCompleted ? '#16A34A' : breakOutEnabled ? '#F97316' : '#F3F4F6',
                    color: breakOutCompleted || breakOutEnabled ? '#FFFFFF' : '#9CA3AF',
                    cursor: breakOutEnabled ? 'pointer' : 'default',
                    boxShadow: breakOutCompleted ? '0 6px 16px rgba(22,163,74,0.35)' : breakOutEnabled ? '0 6px 16px rgba(249,115,22,0.35)' : 'none',
                  }}
                >
                  <Coffee size={17} style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>Break Out</span>
                    {selectedJob.break_out_time && (
                      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 500, marginTop: 1, opacity: 0.92, whiteSpace: 'nowrap' }}>
                        At {formatClockTime(selectedJob.break_out_time)}
                      </span>
                    )}
                  </span>
                </button>

                <ArrowRight size={16} color="#D1D5DB" style={{ flexShrink: 0, transform: isCompact ? 'rotate(90deg)' : undefined }} />

                <button
                  type="button"
                  disabled={!clockOutEnabled}
                  onClick={() => runClockAction('clock_out')}
                  style={{
                    border: 'none', borderRadius: 12, padding: '0 16px', height: 54, boxSizing: 'border-box', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 9, minWidth: isCompact ? undefined : 140,
                    background: clockOutCompleted ? '#16A34A' : clockOutEnabled ? '#334155' : '#F3F4F6',
                    color: clockOutCompleted || clockOutEnabled ? '#FFFFFF' : '#9CA3AF',
                    cursor: clockOutEnabled ? 'pointer' : 'default',
                    boxShadow: clockOutCompleted ? '0 6px 16px rgba(22,163,74,0.35)' : clockOutEnabled ? '0 6px 16px rgba(51,65,85,0.30)' : 'none',
                  }}
                >
                  <Clock size={17} style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>Clock Out</span>
                    {/* Open-ended jobs have no scheduled end — Clock Out stays locked until the
                        supervising Employee reviews the work and releases it. */}
                    <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 500, marginTop: 1, opacity: 0.92, whiteSpace: 'nowrap' }}>
                      {selClockedOut && selectedJob.clock_out_time ? `At ${formatClockTime(selectedJob.clock_out_time)}`
                        : selectedJob.is_open_ended
                        ? (awaitingRelease ? 'Awaiting release' : 'After release')
                        : `After ${formatTime(selectedJob.end_time)}`}
                    </span>
                  </span>
                </button>
              </div>
              )}
            </div>
          </TitledBlock>
        </div>

        {/* Supervisor — avatar + role badge, then direct contact rows. */}
        {supervisorBlock && (
          <div style={{ flex: isCompact ? undefined : 1, minWidth: isCompact ? 0 : 280 }}>
            {supervisorBlock}
          </div>
        )}
      </div>

      {/* Row 2 — Assigned Tasks (Kanban) beside Job Location + Message; the row fills the rest
          of the viewport so all three blocks reach the bottom of the page. */}
      <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: 16, alignItems: 'stretch', flex: isCompact ? undefined : 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, width: isCompact ? '100%' : undefined }}>
          {isCurrentSelected && actionsUnlocked && currentJob ? (
            <CasualTaskBoard companyId={currentJob.company_id} shiftId={currentJob.shift_id} userId={internalUserId} />
          ) : (
            <TitledBlock
              icon={<ClipboardList size={15} color="#F97316" />}
              title="Tasks"
              containerStyle={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '26px 12px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <ClipboardList size={24} color="#F97316" />
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>Tasks will appear here</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6B7280' }}>after your shift starts.</p>
              </div>
            </TitledBlock>
          )}
        </div>

        <div style={isCompact
          ? { width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }
          : { width: 500, flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {/* Job Location is only useful before the worker is on-site — once Clock In has
              unlocked, this space goes to messaging with the supervisor instead. */}
          <div style={{ flex: 1, minHeight: isCompact ? 200 : 0 }}>
            {isCurrentSelected && actionsUnlocked && currentJob?.supervisor ? (
              <CasualMessagePanel
                authId={authId}
                companyId={currentJob.company_id}
                supervisorId={currentJob.supervisor.id}
                supervisorName={currentJob.supervisor.full_name}
              />
            ) : (
              <TitledBlock
                icon={<MessageCircle size={15} color="#F97316" />}
                title="Message"
                containerStyle={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '26px 12px' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <MessageCircle size={24} color="#F97316" />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>Messages will appear here</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6B7280' }}>
                    after your shift starts. You can chat with your supervisor during the shift.
                  </p>
                </div>
              </TitledBlock>
            )}
          </div>
        </div>
      </div>
    </div>
  ))

  return (
    <>
      <style>{pageKeyframes}</style>

      <main style={pageStyle}>
        <div style={{ marginBottom: 20, flexShrink: 0 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
            Dashboard
          </h1>
        </div>

        {/* Real data typically isn't ready the instant the page mounts (API round-trip), so the
            entrance animation lives on THIS block (a fresh DOM node born the moment `loading`
            flips false) rather than on <main> — animating the empty shell while content is still
            loading finishes long before there's anything visible to show for it. */}
        {loading ? null : upcomingJobs.length === 0 ? (
          <p style={{ margin: 0, color: '#6B7280', fontSize: '0.95rem' }}>No active job right now.</p>
        ) : isCompact ? (
          // Narrow viewport: single internally-scrolling column — timeline on top, detail below.
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, animation: 'blockSlideUp 0.38s ease both' }}>
            <div style={{ maxWidth: 720 }}>{timelinePanel}</div>
            {detailColumn}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, alignItems: 'stretch', animation: 'blockSlideUp 0.38s ease both' }}>
            <div style={{ width: 300, flexShrink: 0, minHeight: 0 }}>{timelinePanel}</div>
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>{detailColumn}</div>
          </div>
        )}
      </main>

      {showCancelConfirm && selectedJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 9999, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div style={{ width: '100%', maxWidth: 440, background: '#FFFFFF', borderRadius: 16, padding: 26, boxShadow: '0 24px 64px rgba(0,0,0,0.16)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
              Cancel this shift?
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.5 }}>
              {selectedJob.title} — {formatShiftDate(selectedJob.shift_date)}. The employer will be notified and your spot goes back up for hire.
            </p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Reason (optional), e.g. family emergency"
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', color: '#111827', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
            />
            {cancelError && <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#DC2626' }}>{cancelError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowCancelConfirm(false)} disabled={cancelling}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#6B7280', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                Keep Shift
              </button>
              <button onClick={confirmCancel} disabled={cancelling}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: cancelling ? '#9CA3AF' : '#DC2626', color: '#FFFFFF', fontWeight: 700, fontSize: '0.8125rem', cursor: cancelling ? 'default' : 'pointer' }}>
                {cancelling ? 'Cancelling…' : 'Cancel Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0F172A', color: '#FFFFFF', borderRadius: 999, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 9999,
          animation: 'fadeSlideUpToast 0.22s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <Check size={15} style={{ color: '#10B981', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </>
  )
}

const pageStyle: React.CSSProperties = {
  height: '100vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  padding: '20px 28px 28px',
}
