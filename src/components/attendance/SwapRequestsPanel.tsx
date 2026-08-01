'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Calendar, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight,
  ClipboardList, Clock, Eye, Inbox, Settings, UserCog, UserRound, X,
} from 'lucide-react'
import Spinner from '@/components/Spinner'
import RoleAvatar from '@/components/RoleAvatar'
import DropdownField from '@/components/DropdownField'
import { ModalOverlay, ModalBox, ModalHeader, modalErrorBoxStyle, modalPrimaryButtonStyle, modalDestructiveButtonStyle, modalGhostButtonStyle, modalInputStyle, modalLabelStyle } from '@/components/modal'
import { ShiftSwapRequestView, ShiftSwapMovableTask } from '@/types/Attendance'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import { useIsCompactContainer } from '@/hooks/useIsCompactContainer'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'
import { EmptyState } from '@/components/panel'

// Manager's Shift Swap approval queue — byte-for-byte the same UI as AttendanceView's
// reqTab === 'swaps' (Requests queue / Review Request + Current Schedule + Task Changes /
// Completed Requests, 3-column layout), just relocated onto the Shift page. Built as a fresh,
// self-contained component rather than reused in place from AttendanceView, since that block is
// deeply interleaved with Owner/Partner's settings-editing UI and the Fixed Day Off queue — this
// keeps AttendanceView (and Owner/Partner's page) completely untouched.

const PANEL_BORDER = '#E2E8F0'
const TEXT_DARK = '#0F172A'

function formatSwapDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const dayMonth = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${weekday}, ${dayMonth}`
}

function formatOwnerDecisionTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const dayMonth = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const suffix = hours < 12 ? 'AM' : 'PM'
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${weekday}, ${dayMonth}, ${hour12}:${String(minutes).padStart(2, '0')}${suffix}`
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = value.includes('T') ? new Date(value) : null
  const [h, m] = date
    ? [date.getHours(), date.getMinutes()]
    : value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return value.slice(0, 5)
  const suffix = h < 12 ? 'am' : 'pm'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

function formatCompactAt(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString([], { month: 'short' })
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '')
  return `${day} ${month}, ${time}`
}

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// ─── CurrentShiftsBlock ─────────────────────────────────────────────────────
function CurrentShiftsBlock({ show, deptName, rows, loading, panelBorder, highlightRequest, anchorDate, onNavigateDay, fixedOffByUserDate }: {
  show: boolean
  deptName: string
  rows: TimelineRow[]
  loading: boolean
  panelBorder: string
  highlightRequest?: ShiftSwapRequestView | null
  anchorDate: string
  onNavigateDay: (dir: number) => void
  fixedOffByUserDate: Map<string, boolean>
}) {
  const wheelAreaRef = useRef<HTMLDivElement | null>(null)
  const wheelAccumRef = useRef(0)
  const onNavigateDayRef = useRef(onNavigateDay)
  onNavigateDayRef.current = onNavigateDay
  useEffect(() => {
    const el = wheelAreaRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      wheelAccumRef.current += delta
      while (wheelAccumRef.current >= 60) { onNavigateDayRef.current(1); wheelAccumRef.current -= 60 }
      while (wheelAccumRef.current <= -60) { onNavigateDayRef.current(-1); wheelAccumRef.current += 60 }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [show])

  if (!show) return null
  const today = new Date()
  const mon = new Date(`${anchorDate}T00:00:00`)
  const csWeekDates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const todayKey2 = today.toISOString().slice(0, 10)
  const csIconButtonStyle: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${panelBorder}`,
    background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: TEXT_DARK, flexShrink: 0,
  }
  const sortedRows = [...rows].sort((a, b) => {
    const ra = a.role === 'Manager' ? 0 : 1
    const rb = b.role === 'Manager' ? 0 : 1
    return ra - rb || a.full_name.localeCompare(b.full_name)
  })
  const EDGE = '2px solid rgba(15,23,42,0.45)'
  const isSameClock = (a: string | null, b: string | null) => !!a && !!b && a.slice(0, 5) === b.slice(0, 5)
  const isHighlightedShift = (row: TimelineRow, shift: TimelineShiftBlock) => {
    if (!highlightRequest) return false
    if (
      shift.assignment_id &&
      (shift.assignment_id === highlightRequest.requester_assignment_id ||
       shift.assignment_id === highlightRequest.counterpart_assignment_id)
    ) return true
    const matchesRequester =
      row.user_id === highlightRequest.requester_id &&
      shift.shift_date === highlightRequest.requester_shift_date &&
      isSameClock(shift.start_time, highlightRequest.requester_start_time) &&
      isSameClock(shift.end_time, highlightRequest.requester_end_time)
    const matchesCounterpart =
      row.user_id === highlightRequest.counterpart_id &&
      shift.shift_date === highlightRequest.counterpart_shift_date &&
      isSameClock(shift.start_time, highlightRequest.counterpart_start_time) &&
      isSameClock(shift.end_time, highlightRequest.counterpart_end_time)
    return matchesRequester || matchesCounterpart
  }

  return (
    <section style={{ background: '#FFFFFF', border: `1px solid ${panelBorder}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${panelBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CalendarDays size={15} style={{ color: '#F97316' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Current Schedule</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => onNavigateDay(-1)} aria-label="Shift window back one day" disabled={!deptName} style={{ ...csIconButtonStyle, opacity: deptName ? 1 : 0.4, cursor: deptName ? 'pointer' : 'default' }}><ChevronLeft size={15} /></button>
          <button type="button" onClick={() => onNavigateDay(1)} aria-label="Shift window forward one day" disabled={!deptName} style={{ ...csIconButtonStyle, opacity: deptName ? 1 : 0.4, cursor: deptName ? 'pointer' : 'default' }}><ChevronRight size={15} /></button>
        </div>
        {loading && <Spinner size={13} dark />}
      </div>
      <div ref={wheelAreaRef} style={{ overflowX: 'auto', padding: '22px 18px 28px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, gap: 8, color: '#9CA3AF' }}>
            <Spinner size={14} dark /> <span style={{ fontSize: 13, fontWeight: 600 }}>Loading…</span>
          </div>
        ) : !deptName ? (
          <EmptyState variant="plain" icon={<CalendarDays size={22} strokeWidth={1.5} />} message="Select a request to preview shifts" />
        ) : sortedRows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 100, gap: 10, color: '#9CA3AF' }}>
            <CalendarDays size={22} strokeWidth={1.5} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>No shifts for this week</span>
          </div>
        ) : (
          <div style={{ minWidth: 700, borderRadius: 12, overflow: 'hidden', border: `1px solid ${panelBorder}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 100%)', height: 62 }}>
              <div style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.08)' }} />
              {csWeekDates.map(date => {
                const d = new Date(date + 'T00:00:00')
                const isToday = date === todayKey2
                return (
                  <div key={date} style={{ padding: '10px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isToday ? '#F97316' : 'rgba(255,255,255,0.85)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{String(d.getDate()).padStart(2, '0')} {d.toLocaleDateString('en-AU', { month: 'short' })}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 500, color: isToday ? '#F97316' : 'rgba(255,255,255,0.5)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{d.toLocaleDateString('en-AU', { weekday: 'long' })}</p>
                  </div>
                )
              })}
            </div>
            <div style={{ borderLeft: EDGE, borderRight: EDGE, borderBottom: EDGE }}>
              {sortedRows.map((row, rowIdx) => {
                const isManager = row.role === 'Manager'
                const borderTop = rowIdx > 0 ? `1px solid ${panelBorder}` : 'none'
                const maxPerDay = Math.max(1, ...csWeekDates.map(d => row.shifts.filter((s: TimelineShiftBlock) => s.shift_date === d).length))
                const rowH = Math.max(72, maxPerDay * 34 + (maxPerDay - 1) * 6 + 38)
                return (
                  <div key={row.user_id} style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', borderTop, background: '#FFFFFF', height: rowH }}>
                    <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${panelBorder}`, overflow: 'hidden', height: rowH }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 18px', minWidth: 0, flex: 1 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 999, background: row.profile_photo_url ? 'transparent' : (isManager ? '#FFF7ED' : '#F3F4F6'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {row.profile_photo_url
                            ? <img src={row.profile_photo_url} alt={row.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : isManager ? <UserCog size={13} color="#EA580C" /> : <UserRound size={13} color="#4B5563" />}
                        </div>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.full_name}</span>
                      </div>
                    </div>
                    {csWeekDates.map(date => {
                      const dayShifts = row.shifts.filter((s: TimelineShiftBlock) => s.shift_date === date)
                      return (
                        <div key={date} style={{ padding: '0 8px', borderRight: `1px solid ${panelBorder}`, height: rowH, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', justifyContent: 'center', background: 'transparent' }}>
                          {dayShifts.length === 0 ? (
                            fixedOffByUserDate.get(`${row.user_id}|${date}`) ? (
                              <div style={{ borderRadius: 999, background: '#F5F3FF', border: '1.5px solid #C4B5FD', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, gap: 4 }}>
                                <Calendar size={11} color="#7C3AED" />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', whiteSpace: 'nowrap' }}>Off Day</span>
                              </div>
                            ) : (
                              <div style={{ borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Off</span>
                              </div>
                            )
                          ) : dayShifts.map((shift: TimelineShiftBlock) => {
                            const highlighted = isHighlightedShift(row, shift)
                            return (
                              <div key={shift.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', height: 32, background: highlighted ? '#FFF7ED' : '#F8FAFC', borderRadius: 999, opacity: shift.publication_status === 'draft' ? 0.72 : 1, border: highlighted ? '1.5px solid #FDBA74' : shift.publication_status === 'draft' ? '1.5px dashed #CBD5E1' : '1px solid #E2E8F0', boxShadow: highlighted ? '0 0 0 3px rgba(249,115,22,0.12)' : 'none' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 800, color: highlighted ? '#C2410C' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {formatShiftHour(shift.start_time)} – {formatShiftHour(shift.end_time)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── TaskChangeBlock ────────────────────────────────────────────────────────
const TASK_CHANGES_PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Low:    { bg: '#F1F5F9', text: '#475569' },
  Medium: { bg: '#DBEAFE', text: '#1D4ED8' },
  High:   { bg: '#FFEDD5', text: '#C2410C' },
  Urgent: { bg: '#FEE2E2', text: '#B91C1C' },
}
const TASK_CHANGES_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Assigned':    { bg: '#E2E8F0', text: '#475569' },
  'In Progress': { bg: '#DBEAFE', text: '#2563EB' },
  'Review':      { bg: '#FED7AA', text: '#EA580C' },
  'Complete':    { bg: '#BBF7D0', text: '#16A34A' },
}
function formatTaskChangeDueDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const dayMonth = date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const hour12 = hours % 12 || 12
  const suffix = hours < 12 ? 'AM' : 'PM'
  const time = minutes === 0 ? `${hour12}${suffix}` : `${hour12}:${String(minutes).padStart(2, '0')}${suffix}`
  return `${dayMonth}, ${time}`
}

function TaskChangeCard({ task, onSelect }: { task: ShiftSwapMovableTask; onSelect: () => void }) {
  const priorityStyle = task.priority ? TASK_CHANGES_PRIORITY_COLORS[task.priority] : null
  const statusStyle = TASK_CHANGES_STATUS_COLORS[task.status]
  const dueLabel = formatTaskChangeDueDate(task.due_at)
  return (
    <div
      className="task-card"
      onClick={onSelect}
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 16px', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {priorityStyle && task.priority && (
          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: priorityStyle.bg, color: priorityStyle.text, letterSpacing: '0.01em' }}>
            {task.priority}
          </span>
        )}
        {statusStyle && (
          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: statusStyle.bg, color: statusStyle.text, letterSpacing: '0.01em' }}>
            {task.status}
          </span>
        )}
      </div>
      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0, lineHeight: 1.4 }}>{task.title}</p>
      {dueLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12 }}>
          <Clock size={11} color="#9CA3AF" />
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{dueLabel}</span>
        </div>
      )}
    </div>
  )
}

function TaskChangePersonColumn({ name, role, photoUrl, tasks, onSelectTask }: {
  name: string
  role: string
  photoUrl: string | null
  tasks: ShiftSwapMovableTask[]
  onSelectTask: (task: ShiftSwapMovableTask) => void
}) {
  const [index, setIndex] = useState(0)
  const clampedIndex = Math.min(index, Math.max(tasks.length - 1, 0))
  const activeTask = tasks[clampedIndex]

  return (
    <div style={{ flex: 1, minWidth: 0, border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <RoleAvatar role={role} size={36} photoUrl={photoUrl} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        </div>
        {tasks.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setIndex((clampedIndex - 1 + tasks.length) % tasks.length)}
              aria-label="Previous task"
              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronLeft size={12} style={{ color: '#6B7280' }} />
            </button>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{clampedIndex + 1}/{tasks.length}</span>
            <button
              type="button"
              onClick={() => setIndex((clampedIndex + 1) % tasks.length)}
              aria-label="Next task"
              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronRight size={12} style={{ color: '#6B7280' }} />
            </button>
          </div>
        )}
      </div>
      {activeTask ? (
        <TaskChangeCard task={activeTask} onSelect={() => onSelectTask(activeTask)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 80, border: '1px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF' }}>
          <ClipboardList size={18} strokeWidth={1.5} />
          <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>No task to move</span>
        </div>
      )}
    </div>
  )
}

function TaskChangeBlock({ title, show, request, panelBorder, useCounterpartTasksForRequester, onSelectTask }: {
  title: string
  show: boolean
  request: ShiftSwapRequestView | null
  panelBorder: string
  useCounterpartTasksForRequester: boolean
  onSelectTask: (task: ShiftSwapMovableTask) => void
}) {
  if (!show) return null
  const requesterMovableTasks = request?.requester_movable_tasks ?? []
  const counterpartMovableTasks = request?.counterpart_movable_tasks ?? []
  const hasChanges = requesterMovableTasks.length > 0 || counterpartMovableTasks.length > 0

  const requesterTasks = useCounterpartTasksForRequester ? counterpartMovableTasks : requesterMovableTasks
  const counterpartTasks = useCounterpartTasksForRequester ? requesterMovableTasks : counterpartMovableTasks

  return (
    <section style={{ flex: 1, minWidth: 0, background: '#FFFFFF', border: `1px solid ${panelBorder}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${panelBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ClipboardList size={15} style={{ color: '#F97316' }} />
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>{title}</span>
      </div>
      <div key={request?.id ?? 'none'} className="att-fade-in">
      {!request ? (
        <div style={{ padding: '18px' }}>
          <EmptyState variant="plain" icon={<ClipboardList size={22} strokeWidth={1.5} />} message="Select a request to preview task changes" />
        </div>
      ) : !hasChanges ? (
        <div style={{ padding: '18px' }}>
          <EmptyState variant="plain" icon={<ClipboardList size={22} strokeWidth={1.5} />} message="No tasks will move if this swap is approved" />
        </div>
      ) : (
        <div style={{ padding: '18px', display: 'flex', alignItems: 'stretch', gap: 14 }}>
          <TaskChangePersonColumn name={request.requester_name} role={request.requester_role} photoUrl={request.requester_photo_url} tasks={requesterTasks} onSelectTask={onSelectTask} />
          <TaskChangePersonColumn name={request.counterpart_name} role={request.counterpart_role} photoUrl={request.counterpart_photo_url} tasks={counterpartTasks} onSelectTask={onSelectTask} />
        </div>
      )}
      </div>
    </section>
  )
}

// Hoisted to module scope (2026-08-02) — this used to be defined INSIDE SwapRequestsPanel's own
// body ("const SwapCard = (...) => {...}"), which is a classic React anti-pattern: a component
// defined inside another component gets a brand-new function identity on every single render of
// the parent, so React treats every <SwapCard/> as a different component TYPE each time and
// fully unmounts + remounts it — replaying every entrance animation (att-fade-in/att-list-in) in
// the process. That's why Review Request and Completed Requests visibly "flashed" on literally
// any interaction in the parent (Settings, Reject, calendar nav, anything that causes a
// re-render), even when the swap-request data itself hadn't changed at all. Passing fresh
// callback props on every render (onApprove/onReject/onSelectIndex below) is fine and does NOT
// cause remounting — only the component's own declaration identity does, and that's now fixed
// forever by being declared once at module load.
function SwapCard({
  req, compact, newlyProcessedId, actionNeeded, actionIndex, reqActionLoading,
  onSelectIndex, onApprove, onReject,
}: {
  req: ShiftSwapRequestView
  compact?: boolean
  newlyProcessedId: string | null
  actionNeeded: ShiftSwapRequestView[]
  actionIndex: number
  reqActionLoading: boolean
  onSelectIndex: (idx: number) => void
  onApprove: (req: ShiftSwapRequestView) => void
  onReject: (req: ShiftSwapRequestView) => void
}) {
  const isReadyForDecision = req.counterpart_status === 'approved' && req.status === 'pending'

  const [rejectReasonRevealed, setRejectReasonRevealed] = useState(false)

  if (compact) {
    const isNew = req.id === newlyProcessedId
    const isPending = req.status === 'pending'
    const approved = req.status === 'approved'
    const StatusIcon = approved ? Check : X
    const statusTone = approved
      ? { bg: '#ECFDF5', text: '#047857', border: '#86EFAC' }
      : { bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5' }
    const isSelected = isPending && actionNeeded.indexOf(req) === Math.min(actionIndex, Math.max(actionNeeded.length - 1, 0))
    const miniShiftCard = (name: string, role: string, photoUrl: string | null, shiftDate: string | null, startTime: string | null, endTime: string | null, mirror = false) => (
      <div style={{ flex: 1, minWidth: 0, border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 10px', display: 'flex', alignItems: 'center', justifyContent: mirror ? 'flex-end' : undefined, gap: 16, background: '#FFFFFF' }}>
        {mirror && (
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748B', minWidth: 0, maxWidth: '100%' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{formatSwapDate(shiftDate)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748B', minWidth: 0, maxWidth: '100%' }}>
              <Clock size={12} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{formatTime(startTime)} – {formatTime(endTime)}</span>
            </div>
          </div>
        )}
        <RoleAvatar role={role} size={54} photoUrl={photoUrl} />
        {!mirror && (
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748B', minWidth: 0, maxWidth: '100%' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{formatSwapDate(shiftDate)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748B', minWidth: 0, maxWidth: '100%' }}>
              <Clock size={12} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{formatTime(startTime)} – {formatTime(endTime)}</span>
            </div>
          </div>
        )}
      </div>
    )
    return (
      <div
        className={`att-request-card att-list-in${isNew ? ' att-request-card-new' : ''}`}
        onClick={isPending ? () => onSelectIndex(actionNeeded.indexOf(req)) : undefined}
        style={{
          background: isSelected ? '#FFF7ED' : '#F9FAFB',
          border: `1.5px solid ${isSelected ? '#F97316' : isNew ? '#FED7AA' : PANEL_BORDER}`,
          borderRadius: 14, padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0,
          cursor: isPending ? 'pointer' : 'default',
          boxShadow: isSelected ? '0 4px 16px rgba(249,115,22,0.14)' : 'none',
          transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 6 }}>
          {!approved && req.reviewer_name && (
            <span
              onClick={e => { e.stopPropagation(); setRejectReasonRevealed(v => !v) }}
              title={req.owner_review_reason ? 'Click to view reason' : undefined}
              style={{ fontSize: '0.68rem', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0, cursor: req.owner_review_reason ? 'pointer' : 'default' }}
            >
              Rejected by {req.reviewer_name}
            </span>
          )}
          {approved && req.reviewer_name && (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>Approved by {req.reviewer_name}</span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0, flexWrap: 'wrap', rowGap: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B', whiteSpace: 'nowrap' }}>
                {isPending ? formatOwnerDecisionTime(req.created_at) : formatOwnerDecisionTime(req.reviewed_at)}
              </span>
            </div>
            {isPending ? (
              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {req.counterpart_status === 'approved' && (
                  <>
                    <button onClick={() => onReject(req)} disabled={reqActionLoading} title="Reject" style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #FECACA', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>
                      <X size={13} style={{ color: '#DC2626' }} />
                    </button>
                    <button onClick={() => onApprove(req)} disabled={reqActionLoading} title="Approve" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>
                      <Check size={13} style={{ color: '#FFFFFF' }} />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {approved && req.reviewed_by === null && (
                  <span title="Approved automatically by the Shift Swap auto-approval rules" style={{ fontSize: '0.62rem', fontWeight: 800, color: '#7C3AED', background: '#F5F3FF', borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>Auto-Approved</span>
                )}
                <span title={req.status === 'approved' ? 'Approved' : 'Rejected'} style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: statusTone.bg, color: statusTone.text, border: `1.5px solid ${statusTone.border}`, borderRadius: 999, flexShrink: 0 }}>
                  <StatusIcon size={12} strokeWidth={3} />
                </span>
              </>
            )}
          </div>
        </div>
        {rejectReasonRevealed && req.owner_review_reason && (
          <div onClick={e => e.stopPropagation()} style={{ fontSize: '0.72rem', fontWeight: 600, color: '#57534E', background: '#F5F5F4', border: '1px solid #E7E5E4', borderRadius: 10, padding: '6px 10px' }}>
            <strong style={{ fontWeight: 800 }}>Reason:</strong> {req.owner_review_reason}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {miniShiftCard(req.requester_name, req.requester_role, req.requester_photo_url, req.requester_shift_date, req.requester_start_time, req.requester_end_time, true)}
          <div className="swap-arrows" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
            <svg width="24" height="8" viewBox="0 0 24 8" fill="none">
              <line x1="1" y1="4" x2="19" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <polyline points="16,1 22,4 16,7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <svg width="24" height="8" viewBox="0 0 24 8" fill="none">
              <line x1="23" y1="4" x2="5" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <polyline points="8,1 2,4 8,7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {miniShiftCard(req.counterpart_name, req.counterpart_role, req.counterpart_photo_url, req.counterpart_shift_date, req.counterpart_start_time, req.counterpart_end_time)}
        </div>
      </div>
    )
  }

  const dividerStyle: React.CSSProperties = { width: 1, alignSelf: 'stretch', background: '#E5E7EB', flexShrink: 0 }
  const ruleConfigured = req.limit_exceeded != null || req.deadline_exceeded != null
  const rulePill = (ok: boolean, label: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', fontWeight: 700, color: ok ? '#15803D' : '#B91C1C', background: ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}`, borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>
      {ok ? <Check size={11} strokeWidth={3} style={{ flexShrink: 0 }} /> : <X size={11} strokeWidth={3} style={{ flexShrink: 0 }} />}
      {label}
    </span>
  )
  const personBlock = (name: string, role: string, photo: string | null, swapsLeft: number | null | undefined, mirror: boolean) => (
    <div style={{ display: 'flex', flexDirection: mirror ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      <RoleAvatar role={role} size={56} photoUrl={photo} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: mirror ? 'flex-end' : 'flex-start' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>{name}</span>
        {swapsLeft != null && (
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: swapsLeft <= 0 ? '#B91C1C' : '#15803D', whiteSpace: 'nowrap' }}>
            {swapsLeft}/{req.monthly_swap_limit} swaps left
          </span>
        )}
      </div>
    </div>
  )
  return (
    <div className="att-request-card att-fade-in" style={{ width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: `1.5px solid ${PANEL_BORDER}`, borderRadius: 16, padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {req.reason && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#57534E', background: '#F5F5F4', border: '1px solid #E7E5E4', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 480 }}>
            <strong style={{ fontWeight: 800 }}>Reason:</strong> {req.reason}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 12, gap: 20 }}>
        {personBlock(req.requester_name, req.requester_role, req.requester_photo_url, req.requester_swaps_left, false)}
        <svg className="swap-arrow-duo" width="26" height="14" viewBox="0 0 24 14" fill="none" style={{ flexShrink: 0, color: '#94A3B8' }}>
          <line x1="2" y1="4" x2="19" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <polyline points="16,1 22,4 16,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="22" y1="10" x2="5" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <polyline points="8,7 2,10 8,13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {personBlock(req.counterpart_name, req.counterpart_role, req.counterpart_photo_url, req.counterpart_swaps_left, true)}

        {ruleConfigured && (
          <>
            <div style={dividerStyle} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: 0 }}>Rule Check</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {req.limit_exceeded != null && rulePill(!req.limit_exceeded, req.limit_exceeded ? 'Monthly limit exceeded' : 'Within monthly limit')}
                {req.deadline_exceeded != null && rulePill(!req.deadline_exceeded, req.deadline_exceeded ? 'Submitted after deadline' : 'Before deadline')}
              </div>
            </div>
          </>
        )}

        <div style={dividerStyle} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: 0 }}>Submitted</label>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{formatOwnerDecisionTime(req.created_at)}</span>
        </div>

        {isReadyForDecision && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
            <button
              onClick={() => onApprove(req)}
              disabled={reqActionLoading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 999, padding: '6px 16px', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.6 : 1, transition: 'background 0.15s, border-color 0.15s' }}
            >
              <Check size={13} /> Approve
            </button>
            <button
              onClick={() => onReject(req)}
              disabled={reqActionLoading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 999, padding: '6px 16px', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.6 : 1, transition: 'background 0.15s, border-color 0.15s' }}
            >
              <X size={13} /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SwapRequestsPanel({
  companyId, internalUserId, showSuccessToast, showErrorToast, onAttentionCount, readOnly = false,
}: {
  companyId: string
  internalUserId: string
  showSuccessToast: (message: string) => void
  showErrorToast: (message: string) => void
  onAttentionCount?: (count: number) => void
  // Once the Manager viewing this has clocked out for the day, approving/rejecting an Employee's
  // swap request and editing the department's auto-approval settings both lock — same "done for
  // the day" rule as My Tasks/My Requests (2026-08-03).
  readOnly?: boolean
}) {
  const isCompactReqLayout = useIsCompactViewport(1300)
  const [taskChangeRowRef, taskChangeRowCompact] = useIsCompactContainer<HTMLDivElement>(1100)

  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequestView[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [reqError, setReqError] = useState('')
  const [reqActionLoading, setReqActionLoading] = useState(false)
  const [actionIndex, setActionIndex] = useState(0)
  const [newlyProcessedId, setNewlyProcessedId] = useState<string | null>(null)
  const [taskChangeDetail, setTaskChangeDetail] = useState<ShiftSwapMovableTask | null>(null)

  // Manager's own department scope, resolved once — used both to filter fixed-off-day lookups
  // (none needed here beyond an empty map, since this panel doesn't fetch off-day data) and to
  // scope the Current Schedule preview.
  const fixedOffByUserDate = useState(() => new Map<string, boolean>())[0]

  // silent skips the reqLoading flip — reqLoading swaps the entire Review Request/Completed
  // Requests area out for a "Loading..." placeholder and back, which replays every entrance
  // animation in it (att-fade-in/att-list-in). That's fine for the true first mount, but every
  // other caller here is a background refresh (the realtime invalidation below fires on ANY
  // attendance/shift change, not just this panel's own actions) — those should update the data
  // quietly, not visibly flash the whole panel (2026-08-02).
  const fetchSwapRequests = useCallback(async (cid: string, silent = false) => {
    if (!cid || !internalUserId) return
    if (!silent) setReqLoading(true)
    setReqError('')
    try {
      const res = await fetch(`/api/attendance?company_id=${cid}&resource=shift_swaps&manager_id=${internalUserId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setSwapRequests(data.requests ?? [])
    } catch (err) {
      setReqError(err instanceof Error ? err.message : 'Failed to fetch requests')
    } finally { if (!silent) setReqLoading(false) }
  }, [internalUserId])

  useEffect(() => {
    if (companyId) void fetchSwapRequests(companyId)
  }, [companyId, fetchSwapRequests])

  useResourceInvalidation(['attendance', 'shifts'], () => {
    if (companyId) void fetchSwapRequests(companyId, true)
  })

  const pendingCount = swapRequests.filter(r => r.status === 'pending').length
  useEffect(() => {
    onAttentionCount?.(pendingCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount])

  const [rejectSwapTarget, setRejectSwapTarget] = useState<{ id: string; requesterName: string } | null>(null)
  const [rejectSwapReason, setRejectSwapReason] = useState('')
  const [rejectSwapError, setRejectSwapError] = useState('')

  const decideRequest = async (id: string, decision: 'approved' | 'rejected', targetName?: string, reason?: string): Promise<boolean> => {
    if (readOnly || !internalUserId || !companyId) return false
    setReqActionLoading(true); setReqError('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide_shift_swap', id, reviewer_id: internalUserId, decision, reason }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update request')
      setNewlyProcessedId(id)
      setTimeout(() => setNewlyProcessedId(null), 800)
      setActionIndex(0)
      // The Current Schedule preview below caches by department+date-range and would otherwise
      // keep showing the pre-swap schedule after approving (BUG-038) — an approve/reject just
      // changed the underlying shift_assignments, so that cache is now stale regardless of
      // whether the next active request happens to share the same department+range.
      csFetchedRangeRef.current = null
      await fetchSwapRequests(companyId, true)
      showSuccessToast(decision === 'approved' ? 'Shift swap approved.' : 'Shift swap rejected.')
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update request'
      setReqError(message)
      showErrorToast(message)
      return false
    } finally { setReqActionLoading(false) }
  }

  const confirmRejectSwap = async () => {
    if (readOnly || !rejectSwapTarget) return
    const reason = rejectSwapReason.trim()
    if (!reason) { setRejectSwapError('A reason is required to reject this request.'); return }
    setRejectSwapError('')
    const ok = await decideRequest(rejectSwapTarget.id, 'rejected', rejectSwapTarget.requesterName, reason)
    if (ok) {
      setRejectSwapTarget(null)
      setRejectSwapReason('')
    }
  }

  // ── Current Schedule preview (department roster around the selected request's dates) ──
  const [currentShiftsRows, setCurrentShiftsRows] = useState<TimelineRow[]>([])
  const [currentShiftsLoading, setCurrentShiftsLoading] = useState(false)
  const [currentShiftsDept, setCurrentShiftsDept] = useState<string | null>(null)
  const [csAnchorDate, setCsAnchorDate] = useState<string>(() => toISODate(new Date()))
  const navigateCurrentShiftsDay = useCallback((dir: number) => {
    setCsAnchorDate(prev => {
      const d = new Date(`${prev}T00:00:00`)
      d.setDate(d.getDate() + dir)
      return toISODate(d)
    })
  }, [])
  const csFetchedRangeRef = useRef<{ key: string; from: string; to: string } | null>(null)
  const fetchCurrentShifts = useCallback(async (cid: string, deptName: string, anchorDate: string) => {
    if (!cid || !deptName) return
    setCurrentShiftsLoading(true)
    setCurrentShiftsDept(deptName)
    try {
      const anchor = new Date(`${anchorDate}T00:00:00`)
      const from = new Date(anchor); from.setDate(anchor.getDate() - 7)
      const to = new Date(anchor); to.setDate(anchor.getDate() + 13)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${fmt(from)}&date_to=${fmt(to)}`)
      const data = await res.json()
      const all: TimelineRow[] = data.success ? data.rows ?? [] : []
      setCurrentShiftsRows(all.filter(r => r.department_name === deptName && r.user_id && (r.role === 'Manager' || r.role === 'Employee')))
      if (data.success) csFetchedRangeRef.current = { key: `${cid}_${deptName}`, from: fmt(from), to: fmt(to) }
    } catch {
      setCurrentShiftsRows([])
    } finally {
      setCurrentShiftsLoading(false)
    }
  }, [])

  const actionNeeded = swapRequests
    .filter(r => r.status === 'pending')
    .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
  const processed = swapRequests
    .filter(r => r.status !== 'pending')
    .sort((a, b) => new Date(b.reviewed_at ?? 0).getTime() - new Date(a.reviewed_at ?? 0).getTime())

  const activeSwapRequest = actionNeeded[Math.min(actionIndex, Math.max(actionNeeded.length - 1, 0))] ?? null

  useEffect(() => {
    if (!activeSwapRequest) return
    const dates = [activeSwapRequest.requester_shift_date, activeSwapRequest.counterpart_shift_date]
      .filter((d): d is string => !!d)
    if (dates.length === 0) return
    const earlier = dates.reduce((a, b) => (a < b ? a : b))
    const later = dates.reduce((a, b) => (a > b ? a : b))
    const spanDays = Math.round((new Date(`${later}T00:00:00`).getTime() - new Date(`${earlier}T00:00:00`).getTime()) / 86400000) + 1
    const leftPad = spanDays >= 7 ? 0 : Math.floor((7 - spanDays) / 2)
    setCsAnchorDate(toISODate(addDays(new Date(`${earlier}T00:00:00`), -leftPad)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSwapRequest?.id, activeSwapRequest?.requester_shift_date, activeSwapRequest?.counterpart_shift_date])

  useEffect(() => {
    if (!companyId || !activeSwapRequest?.department_name) return
    const winEnd = new Date(`${csAnchorDate}T00:00:00`); winEnd.setDate(winEnd.getDate() + 6)
    const cached = csFetchedRangeRef.current
    if (
      cached &&
      cached.key === `${companyId}_${activeSwapRequest.department_name}` &&
      csAnchorDate >= cached.from && toISODate(winEnd) <= cached.to
    ) {
      setCurrentShiftsDept(activeSwapRequest.department_name)
      return
    }
    void fetchCurrentShifts(companyId, activeSwapRequest.department_name, csAnchorDate)
  }, [companyId, activeSwapRequest?.department_name, csAnchorDate, fetchCurrentShifts])

  // ── Department-scoped auto-approval settings (Manager can edit their own department's rules) ──
  const [managerSwapSettingsOpen, setManagerSwapSettingsOpen] = useState(false)
  const [managerSwapDepartments, setManagerSwapDepartments] = useState<{ department_id: string; department_name: string }[]>([])
  const [managerSwapDeptId, setManagerSwapDeptId] = useState<string | null>(null)
  const [managerSwapSettingsLoading, setManagerSwapSettingsLoading] = useState(false)
  const [managerSwapSettingsError, setManagerSwapSettingsError] = useState('')
  const [managerSwapSettingsSaving, setManagerSwapSettingsSaving] = useState(false)
  const [managerSwapAutoApprovalEnabled, setManagerSwapAutoApprovalEnabled] = useState(false)
  const [managerSwapMonthlyLimit, setManagerSwapMonthlyLimit] = useState<number | null>(null)
  const [managerSwapDeadlineHours, setManagerSwapDeadlineHours] = useState<number | null>(null)
  const [managerSwapReviewOnLimitExceeded, setManagerSwapReviewOnLimitExceeded] = useState(true)
  const [managerSwapReviewOnDeadlineExceeded, setManagerSwapReviewOnDeadlineExceeded] = useState(true)

  const loadManagerSwapDepartments = useCallback(async () => {
    if (!companyId || !internalUserId) return
    try {
      const res = await fetch(`/api/manager/departments?manager_id=${internalUserId}&company_id=${companyId}`)
      const data = await res.json()
      if (!data.success) return
      const rows = (data.departments ?? []) as { department_id: string; department_name: string }[]
      setManagerSwapDepartments(rows)
      setManagerSwapDeptId(prev => (prev && rows.some(r => r.department_id === prev) ? prev : rows[0]?.department_id ?? null))
    } catch { /* modal shows its own load error once a department is picked */ }
  }, [companyId, internalUserId])

  const loadManagerSwapSettings = useCallback(async (deptId: string) => {
    if (!companyId || !internalUserId || !deptId) return
    setManagerSwapSettingsLoading(true)
    setManagerSwapSettingsError('')
    try {
      const res = await fetch(`/api/attendance/shift-swap-department-settings?company_id=${companyId}&department_id=${deptId}&manager_id=${internalUserId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to load shift swap settings')
      setManagerSwapAutoApprovalEnabled(!!data.settings.auto_approval_enabled)
      setManagerSwapMonthlyLimit(data.settings.monthly_swap_limit ?? null)
      setManagerSwapDeadlineHours(data.settings.deadline_hours_before_shift ?? null)
      setManagerSwapReviewOnLimitExceeded(data.settings.require_review_on_limit_exceeded ?? true)
      setManagerSwapReviewOnDeadlineExceeded(data.settings.require_review_on_deadline_exceeded ?? true)
    } catch (err) {
      setManagerSwapSettingsError(err instanceof Error ? err.message : 'Failed to load shift swap settings')
    } finally {
      setManagerSwapSettingsLoading(false)
    }
  }, [companyId, internalUserId])

  useEffect(() => {
    if (managerSwapSettingsOpen) void loadManagerSwapDepartments()
  }, [managerSwapSettingsOpen, loadManagerSwapDepartments])

  useEffect(() => {
    if (managerSwapSettingsOpen && managerSwapDeptId) void loadManagerSwapSettings(managerSwapDeptId)
  }, [managerSwapSettingsOpen, managerSwapDeptId, loadManagerSwapSettings])

  const saveManagerSwapSettings = async () => {
    if (readOnly || !companyId || !internalUserId || !managerSwapDeptId) return
    setManagerSwapSettingsSaving(true)
    setManagerSwapSettingsError('')
    try {
      const res = await fetch('/api/attendance/shift-swap-department-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_settings', company_id: companyId, department_id: managerSwapDeptId, manager_id: internalUserId,
          auto_approval_enabled: managerSwapAutoApprovalEnabled,
          monthly_swap_limit: managerSwapMonthlyLimit,
          deadline_hours_before_shift: managerSwapDeadlineHours,
          require_review_on_limit_exceeded: managerSwapReviewOnLimitExceeded,
          require_review_on_deadline_exceeded: managerSwapReviewOnDeadlineExceeded,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save shift swap settings')
      showSuccessToast('Settings saved successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save shift swap settings'
      setManagerSwapSettingsError(message)
      showErrorToast(message)
    } finally {
      setManagerSwapSettingsSaving(false)
    }
  }

  const clampedIndex = Math.min(actionIndex, Math.max(actionNeeded.length - 1, 0))
  const currentSwap = actionNeeded[clampedIndex] ?? null

  return (
    <>
      <style>{`
        @keyframes slideInFromLeft { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes attBlockIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .att-fade-in { animation: attBlockIn 0.28s cubic-bezier(0.22,1,0.36,1) both; }
        .att-request-card { transition: box-shadow 0.18s ease, transform 0.18s ease; }
        .att-request-card:hover { box-shadow: 0 8px 22px rgba(15,23,42,0.08); transform: translateY(-2px); }
        .att-request-card-new { animation: slideInFromLeft 0.38s cubic-bezier(0.22,1,0.36,1) both !important; }
        @keyframes attListIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .att-list-in { animation: attListIn 0.32s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes swapNudgeR { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
        @keyframes swapNudgeL { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-4px); } }
        .att-request-card:hover .swap-arrows > svg:nth-child(1) { animation: swapNudgeR 0.8s ease-in-out infinite; }
        .att-request-card:hover .swap-arrows > svg:nth-child(2) { animation: swapNudgeL 0.8s ease-in-out infinite; }
        .att-request-card:hover .swap-arrow-duo { animation: swapNudgeR 0.8s ease-in-out infinite; }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: isCompactReqLayout ? '1fr' : 'minmax(260px, 326px) minmax(400px, 1fr) minmax(380px, 620px)', gridTemplateRows: isCompactReqLayout ? 'auto' : 'auto minmax(0, 1fr)', gap: 16, alignItems: 'start', height: '100%', minHeight: 0, overflow: isCompactReqLayout ? 'auto' : 'hidden' }}>

        {/* ── LEFT: Requests queue ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, gridColumn: '1', gridRow: isCompactReqLayout ? 'auto' : '1 / span 2', alignSelf: isCompactReqLayout ? 'auto' : 'stretch', minHeight: 0 }}>
          <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: '0 1 auto', minHeight: 0 }}>
            <div style={{ height: 58, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Inbox size={15} style={{ color: '#F97316' }} />
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Requests</span>
              {reqLoading && <Spinner size={13} dark />}
            </div>
            {actionNeeded.length === 0 ? (
              <EmptyState fill variant="plain" icon={<CheckCheck size={20} strokeWidth={1.5} />} message="No pending requests" />
            ) : (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {actionNeeded.map((req, idx) => {
                  const isSelected = idx === clampedIndex
                  return (
                    <button
                      key={req.id}
                      type="button"
                      className="att-request-card att-list-in"
                      onClick={() => setActionIndex(idx)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12, width: '100%', boxSizing: 'border-box', textAlign: 'left',
                        border: `1.5px solid ${isSelected ? '#FDBA74' : '#E5E7EB'}`,
                        background: isSelected ? '#FFF7ED' : '#FFFFFF',
                        borderRadius: 12, padding: '14px 14px 16px', cursor: 'pointer', flexShrink: 0,
                        animationDelay: '0ms',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                          <RoleAvatar role={req.requester_role} size={48} photoUrl={req.requester_photo_url} />
                          <span style={{ maxWidth: '100%', fontSize: '0.82rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.requester_name}</span>
                        </div>
                        <svg className="swap-arrow-duo" width="24" height="14" viewBox="0 0 24 14" fill="none" style={{ flexShrink: 0, color: '#94A3B8' }}>
                          <line x1="2" y1="4" x2="19" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <polyline points="16,1 22,4 16,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="22" y1="10" x2="5" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <polyline points="8,7 2,10 8,13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                          <RoleAvatar role={req.counterpart_role} size={48} photoUrl={req.counterpart_photo_url} />
                          <span style={{ maxWidth: '100%', fontSize: '0.82rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.counterpart_name}</span>
                        </div>
                      </div>
                      <span style={{ alignSelf: 'flex-end', fontSize: '0.75rem', color: '#9CA3AF' }}>Submitted on {formatCompactAt(req.created_at)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── MIDDLE: Review Request + Current Schedule + Task Changes ── */}
        {reqError && (
          <div style={{ gridColumn: isCompactReqLayout ? '1' : '2 / 4', padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 800 }}>{reqError}</div>
        )}
        {reqLoading ? (
          <div style={{ gridColumn: isCompactReqLayout ? '1' : '2 / 4', padding: '32px', textAlign: 'center', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Spinner size={16} dark /> Loading...</div>
        ) : (
          <div style={{ gridColumn: isCompactReqLayout ? '1' : '2', gridRow: isCompactReqLayout ? 'auto' : '1 / span 2', alignSelf: isCompactReqLayout ? 'auto' : 'stretch', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 58, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ClipboardList size={15} style={{ color: '#F97316' }} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1 }}>Review Request</span>
                <button onClick={() => setManagerSwapSettingsOpen(true)} disabled={readOnly} title="Settings" style={{ width: 36, height: 30, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: readOnly ? 'default' : 'pointer', flexShrink: 0, opacity: readOnly ? 0.5 : 1 }}>
                  <Settings size={16} style={{ color: '#6B7280' }} />
                </button>
              </div>
              {currentSwap ? (
                <div key={currentSwap.id} className="att-fade-in" style={{ padding: '14px 16px' }}>
                  <SwapCard
                    req={currentSwap}
                    newlyProcessedId={newlyProcessedId}
                    actionNeeded={actionNeeded}
                    actionIndex={actionIndex}
                    reqActionLoading={reqActionLoading || readOnly}
                    onSelectIndex={setActionIndex}
                    onApprove={r => void decideRequest(r.id, 'approved', r.requester_name)}
                    onReject={r => { setRejectSwapTarget({ id: r.id, requesterName: r.requester_name }); setRejectSwapReason(''); setRejectSwapError('') }}
                  />
                </div>
              ) : (
                <EmptyState fill variant="plain" icon={<CheckCheck size={22} strokeWidth={1.5} />} message="All caught up — nothing needs action" />
              )}
            </section>
            <CurrentShiftsBlock
              show
              deptName={currentShiftsDept ?? ''}
              rows={currentShiftsRows}
              loading={currentShiftsLoading}
              panelBorder={PANEL_BORDER}
              highlightRequest={activeSwapRequest}
              anchorDate={csAnchorDate}
              onNavigateDay={navigateCurrentShiftsDay}
              fixedOffByUserDate={fixedOffByUserDate}
            />
            <div ref={taskChangeRowRef} style={{ display: 'flex', flexDirection: taskChangeRowCompact ? 'column' : 'row', alignItems: 'stretch', gap: 16, flexShrink: 0 }}>
              <TaskChangeBlock
                title="Current Task Assignment"
                show
                request={activeSwapRequest}
                panelBorder={PANEL_BORDER}
                useCounterpartTasksForRequester={false}
                onSelectTask={setTaskChangeDetail}
              />
              <TaskChangeBlock
                title="Task Assignment After Swap"
                show
                request={activeSwapRequest}
                panelBorder={PANEL_BORDER}
                useCounterpartTasksForRequester={true}
                onSelectTask={setTaskChangeDetail}
              />
            </div>
          </div>
        )}

        {/* ── RIGHT: Completed Requests ── */}
        {!reqLoading && (
          <section style={{ gridColumn: isCompactReqLayout ? '1' : '3', gridRow: isCompactReqLayout ? 'auto' : '1 / span 2', alignSelf: 'start', maxHeight: isCompactReqLayout ? undefined : '100%', minHeight: 0, background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 58, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCheck size={15} style={{ color: '#F97316' }} />
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1 }}>Completed Requests</span>
              {/* Manager's queue is already scoped to their own department(s), so there's nothing
                  for a department filter to filter — Owner/Partner's version has one, this doesn't. */}
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {processed.length === 0
                ? <EmptyState variant="plain" icon={<CheckCheck size={20} strokeWidth={1.5} />} message="No processed requests" />
                : processed.map(req => (
                    <div key={req.id} className="att-list-in" style={{ animationDelay: '0ms', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                      <SwapCard
                        req={req}
                        compact
                        newlyProcessedId={newlyProcessedId}
                        actionNeeded={actionNeeded}
                        actionIndex={actionIndex}
                        reqActionLoading={reqActionLoading}
                        onSelectIndex={setActionIndex}
                        onApprove={r => void decideRequest(r.id, 'approved', r.requester_name)}
                        onReject={r => setRejectSwapTarget({ id: r.id, requesterName: r.requester_name })}
                      />
                    </div>
                  ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Reject reason modal ──────────────────────────────────────────── */}
      {rejectSwapTarget && (
        <ModalOverlay onClose={() => { setRejectSwapTarget(null); setRejectSwapReason(''); setRejectSwapError('') }} maxWidth="420px">
          <ModalBox>
            <ModalHeader
              title="Reject Shift Swap"
              icon={<X size={15} color="#fff" strokeWidth={2.5} />}
              onClose={() => { setRejectSwapTarget(null); setRejectSwapReason(''); setRejectSwapError('') }}
            />
            <div style={{ padding: '20px 24px 20px' }}>
              <label style={{ ...modalLabelStyle, marginBottom: 10 }}>Reason for {rejectSwapTarget.requesterName}</label>
              <textarea
                autoFocus
                value={rejectSwapReason}
                onChange={e => { setRejectSwapReason(e.target.value); if (rejectSwapError) setRejectSwapError('') }}
                placeholder="Explain why this swap is being rejected..."
                rows={4}
                style={{ ...modalInputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            {rejectSwapError && <div style={modalErrorBoxStyle}>{rejectSwapError}</div>}
            <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={() => { setRejectSwapTarget(null); setRejectSwapReason(''); setRejectSwapError('') }} disabled={reqActionLoading} style={modalGhostButtonStyle}>Cancel</button>
              <button type="button" onClick={() => void confirmRejectSwap()} disabled={reqActionLoading || !rejectSwapReason.trim()} style={modalDestructiveButtonStyle(reqActionLoading || !rejectSwapReason.trim())}>
                {reqActionLoading ? <Spinner size={13} /> : <X size={13} />} Reject
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Task Change detail modal ─────────────────────────────────────── */}
      {taskChangeDetail && (() => {
        const task = taskChangeDetail
        const priorityStyle = task.priority ? TASK_CHANGES_PRIORITY_COLORS[task.priority] : null
        const statusStyle = TASK_CHANGES_STATUS_COLORS[task.status]
        const viewFieldValue: React.CSSProperties = { ...modalInputStyle, display: 'flex', alignItems: 'center' }
        const viewEmpty: React.CSSProperties = { ...viewFieldValue, color: '#9CA3AF', fontStyle: 'italic' }
        return (
          <ModalOverlay onClose={() => setTaskChangeDetail(null)} maxWidth="440px">
            <ModalBox>
              <ModalHeader title={`${task.title}'s Details`} icon={<Eye size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setTaskChangeDetail(null)} />
              <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(90vh - 130px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {priorityStyle && task.priority && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: priorityStyle.bg, color: priorityStyle.text, letterSpacing: '0.01em' }}>
                      {task.priority}
                    </span>
                  )}
                  {statusStyle && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: statusStyle.bg, color: statusStyle.text, letterSpacing: '0.01em' }}>
                      {task.status}
                    </span>
                  )}
                </div>
                <div>
                  <label style={modalLabelStyle}>Description</label>
                  {task.description
                    ? <div style={{ ...viewFieldValue, alignItems: 'flex-start', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{task.description}</div>
                    : <div style={viewEmpty}>No description</div>
                  }
                </div>
                <div>
                  <label style={modalLabelStyle}>Assigned Time</label>
                  <div style={viewFieldValue}>
                    {new Date(task.created_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {task.due_at && (
                  <div>
                    <label style={modalLabelStyle}>Due</label>
                    <div style={viewFieldValue}>{formatTaskChangeDueDate(task.due_at)}</div>
                  </div>
                )}
              </div>
            </ModalBox>
          </ModalOverlay>
        )
      })()}

      {/* ── Department-scoped Shift Swap settings modal ──────────────────── */}
      {managerSwapSettingsOpen && (
        <ModalOverlay onClose={() => setManagerSwapSettingsOpen(false)} maxWidth="480px">
          <ModalBox>
            <ModalHeader title="Shift Swap Settings" icon={<Settings size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setManagerSwapSettingsOpen(false)} />
            <div style={{ padding: '20px 24px 24px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {managerSwapSettingsError && (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12, fontWeight: 700 }}>{managerSwapSettingsError}</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {managerSwapDepartments.length > 1 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Department</label>
                    <DropdownField
                      value={managerSwapDeptId ?? ''}
                      onChange={v => setManagerSwapDeptId(v)}
                      options={managerSwapDepartments.map(d => ({ value: d.department_id, label: d.department_name }))}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Monthly Swap Limit / Person</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box', cursor: 'text' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={managerSwapMonthlyLimit ?? ''}
                      placeholder="No limit"
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '')
                        setManagerSwapMonthlyLimit(digits === '' ? null : Math.max(1, Number(digits)))
                      }}
                      style={{ width: `${String(managerSwapMonthlyLimit ?? 'No limit').length}ch`, minWidth: 10, border: 'none', outline: 'none', padding: 0, fontSize: '0.9375rem', color: '#111827', background: 'transparent' }}
                    />
                    <span style={{ fontSize: '0.9375rem', color: '#111827' }}>swap</span>
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Swap Deadline</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box', cursor: 'text' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={managerSwapDeadlineHours ?? ''}
                      placeholder="No deadline"
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '')
                        setManagerSwapDeadlineHours(digits === '' ? null : Math.max(1, Number(digits)))
                      }}
                      style={{ width: `${String(managerSwapDeadlineHours ?? 'No deadline').length}ch`, minWidth: 10, border: 'none', outline: 'none', padding: 0, fontSize: '0.9375rem', color: '#111827', background: 'transparent' }}
                    />
                    <span style={{ fontSize: '0.9375rem', color: '#111827' }}>hours before shift</span>
                  </label>
                </div>

                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={managerSwapAutoApprovalEnabled}
                      onChange={e => setManagerSwapAutoApprovalEnabled(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#F97316', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>Auto Approval</span>
                  </label>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Monthly Limit Exceeded</label>
                    <DropdownField
                      value={managerSwapReviewOnLimitExceeded ? 'review' : 'reject'}
                      onChange={v => setManagerSwapReviewOnLimitExceeded(v === 'review')}
                      options={[{ value: 'review', label: 'Send to Manager' }, { value: 'reject', label: 'Auto Reject' }]}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Submitted After Deadline</label>
                    <DropdownField
                      value={managerSwapReviewOnDeadlineExceeded ? 'review' : 'reject'}
                      onChange={v => setManagerSwapReviewOnDeadlineExceeded(v === 'review')}
                      options={[{ value: 'review', label: 'Send to Manager' }, { value: 'reject', label: 'Auto Reject' }]}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => void saveManagerSwapSettings()} disabled={managerSwapSettingsSaving || managerSwapSettingsLoading || !managerSwapDeptId} style={modalPrimaryButtonStyle(managerSwapSettingsSaving || managerSwapSettingsLoading || !managerSwapDeptId)}>
                    {managerSwapSettingsSaving ? <Spinner size={13} /> : <Check size={14} />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}
    </>
  )
}
