'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  ListChecks, CheckSquare, ClipboardList, UserPlus,
  ArrowRightLeft, Calendar, Eye, Users, Check, ArrowRight, ArrowDown, CheckCircle2,
  Clock, Coffee, Hourglass, ChevronDown, ChevronUp, AlertCircle, Search, Bell, UserCog, UserRound,
} from 'lucide-react'
import DepartmentBadge from '@/components/DepartmentBadge'
import { deptColor } from '@/lib/deptColor'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { ShowcaseCard } from '@/components/panel'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import {
  AttendanceDepartmentGroup, AttendancePersonRow, AttendanceRoleGroup,
  OwnerDashboardSummary, TaskNotificationItem, TaskOverviewGroup, WaitingOnYouItem, WaitingOnYouItemId,
} from '@/types/OwnerDashboard'
import RoleAvatar from '@/components/RoleAvatar'
import { ModalOverlay, ModalBox, ModalHeader } from '@/components/modal'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'
import {
  CLOCK_IN_WINDOW_MINUTES_BEFORE, canClockIn, canClockOut,
  fmtShiftTime, fmtShiftTimeMinusMinutes, fmtClockStamp,
  ClockFlowButton, ClockFlowConnector,
} from '@/components/dashboard/ClockFlow'
import { sgtTodayKey } from '@/lib/singaporeTime'

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '20px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>
      {text}
    </div>
  )
}

function SkeletonLine({ width = '100%', height = 14, radius = 999 }: { width?: number | string; height?: number; radius?: number }) {
  return (
    <span
      className="dashboard-skeleton"
      style={{ display: 'inline-block', width, height, borderRadius: radius, flexShrink: 0 }}
    />
  )
}

// ─── My Shift Today (UC49/UC57 break) — Manager's own clock in/out + break in/out ────────────
// Same shape and API (/api/employee/attendance) as AttendanceView's personal-clock strip; break
// in/out is new here since that strip never wired those buttons up (backend already supported
// them — see employeeAttendanceService.breakIn/breakOut).
type MyShiftRecord = { id: string; clock_in_time: string | null; clock_out_time: string | null; break_in_time: string | null; break_out_time: string | null }
type MyShift = {
  assignment: { id: string; user_id: string }
  shift: { id: string; shift_date: string; start_time: string; end_time: string; is_open_ended: boolean }
  record: MyShiftRecord | null
}

function CountChip({ value }: { value: string | number }) {
  return (
    <span style={{ fontSize: 13, fontWeight: 700, color: '#64748B', background: '#F1F5F9', borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

// Same look as ShowcaseCard's built-in search input (Team page) - used in block headers where
// the search must sit to the LEFT of the corner link action.
function HeaderSearchInput({ value, onChange, width = 180 }: { value: string; onChange: (v: string) => void; width?: number }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width, height: 34, borderRadius: 999, border: '1px solid #E5E7EB', background: '#F9FAFB', padding: '0 12px 0 32px', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
        onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#FFFFFF' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
      />
    </div>
  )
}

function LinkAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', color: '#F97316', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', padding: '2px 4px', whiteSpace: 'nowrap' }}
    >
      {label}
    </button>
  )
}

// ─── Waiting On You ─────────────────────────────────────────────────────────────

// Icons mirror what each destination page/block actually uses: Shift Swap cards use the ⇄
// glyph (ArrowRightLeft), Off Day uses Calendar, Pending Approval uses ClipboardList,
// the Applicants panel uses Users, and the Tasks Review status uses Eye.
const WAITING_META: Record<WaitingOnYouItemId, { icon: React.ReactNode; accent: string; accentBg: string; sub: string }> = {
  shift_swap:           { icon: <ArrowRightLeft size={26} />, accent: '#DC2626', accentBg: '#FEF2F2', sub: 'Swaps need your decision' },
  off_day_deadline:     { icon: <Calendar size={26} />,       accent: '#CA8A04', accentBg: '#FEFCE8', sub: 'Time to plan next week' },
  job_posting_approval: { icon: <ClipboardList size={26} />,  accent: '#0D9488', accentBg: '#F0FDFA', sub: 'New postings to review' },
  applicant_accept:     { icon: <Users size={26} />,          accent: '#3B82F6', accentBg: '#EFF6FF', sub: 'Applicants awaiting review' },
  task_review:          { icon: <Eye size={26} />,            accent: '#DB2777', accentBg: '#FDF2F8', sub: 'Tasks need your review' },
}

// Relative to the role's base path — prefixed with basePath at push time.
const WAITING_ROUTES: Record<WaitingOnYouItemId, string> = {
  shift_swap: '/attendance?tab=swaps',
  off_day_deadline: '/attendance?tab=fixedoff',
  job_posting_approval: '/recruitment?view=pending',
  applicant_accept: '/recruitment',
  task_review: '/tasks',
}

// Shared stat-action card look (Waiting On You + Recruitment Overview): icon badge with a big
// count, label + arrow; count 0 flips into the green done state.
function StatActionCard({ count, label, sub, icon, accent, accentBg, onClick, value, compact = false, disableDoneClick = false }: {
  count: number; label: string; sub: string; icon: React.ReactNode; accent: string; accentBg: string; onClick: () => void; value?: React.ReactNode; compact?: boolean; disableDoneClick?: boolean
}) {
  const done = count === 0
  const clickable = !(done && disableDoneClick)
  const meta = { icon, accent, accentBg, sub }
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        flex: 1, minWidth: 150, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12,
        padding: '18px 19px', borderRadius: 14,
        background: done ? '#F0FDF4' : '#FFFFFF',
        border: `1px solid ${done ? '#D1FAE5' : '#E5E7EB'}`,
        cursor: clickable ? 'pointer' : 'default', transition: 'transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease',
      }}
      onMouseEnter={e => {
        if (!clickable) return
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(15,23,42,0.08)'
        e.currentTarget.style.borderColor = done ? '#A7F3D0' : '#CBD5E1'
      }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = done ? '#D1FAE5' : '#E5E7EB' }}
    >
      {/* Top row: icon badge with the big count sitting to its right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{
          width: 56, height: 56, borderRadius: 15, background: done ? '#DCFCE7' : meta.accentBg,
          color: done ? '#16A34A' : meta.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {done ? <Check size={28} /> : meta.icon}
        </span>
        {!done && (
          <span style={{ fontSize: value ? 19 : 32, fontWeight: 800, lineHeight: 1.08, color: meta.accent, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {value ?? count}
          </span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{
            fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: '#0F172A',
            textDecoration: done ? 'line-through' : 'none', textDecorationThickness: done ? '1.5px' : undefined,
          }}>
            {label}
          </span>
          {!done && (
            <span style={{ color: meta.accent, display: 'flex', flexShrink: 0 }}>
              <ArrowRight size={18} />
            </span>
          )}
        </div>
        {!compact && (
          <p style={{ fontSize: 12.5, fontWeight: 600, margin: '5px 0 0', color: done ? '#16A34A' : '#64748B' }}>
            {done ? 'All caught up' : meta.sub}
          </p>
        )}
      </div>
    </div>
  )
}

function WaitingOnYouCard({ item, onClick, managerMode = false }: { item: WaitingOnYouItem; onClick: () => void; managerMode?: boolean }) {
  const meta = WAITING_META[item.id]
  return (
    <StatActionCard
      count={item.count}
      label={item.label}
      sub={meta.sub}
      icon={meta.icon}
      accent={meta.accent}
      accentBg={meta.accentBg}
      value={managerMode && item.id === 'off_day_deadline' && item.detail ? item.detail : undefined}
      compact={managerMode}
      disableDoneClick={managerMode}
      onClick={onClick}
    />
  )
}

// ─── Task Overview ──────────────────────────────────────────────────────────────

// href: where "View all …" (and the group's task rows) deep-link on the Task page — every group
// highlights+floats its matching tasks to the top of their column (same treatment the Task Delay
// Alert count uses); Overdue also presets the Kanban sort to Nearest Deadline.
const TASK_GROUP_META: Record<string, { color: string; chipBg: string; iconBg: string; bar: string; rowBg: string; viewAll: string; icon: React.ReactNode; sub: string; href: string }> = {
  overdue:     { color: '#DC2626', chipBg: '#FEF2F2', iconBg: '#FEE2E2', bar: '#F87171', rowBg: '#FFFFFF', viewAll: 'View all overdue tasks', icon: <Clock size={26} />,        sub: 'Act now',  href: '/tasks?sort=deadline&show=overdue' },
  delay_alert: { color: '#EA580C', chipBg: '#FFF7ED', iconBg: '#FFEDD5', bar: '#FDBA74', rowBg: '#FFFBF5', viewAll: 'View all delay alerts',  icon: <Hourglass size={26} />,    sub: 'Due soon', href: '/tasks?show=delay_alerts' },
  completed:   { color: '#16A34A', chipBg: '#F0FDF4', iconBg: '#DCFCE7', bar: '#86EFAC', rowBg: '#FFFFFF', viewAll: 'View all completed tasks', icon: <CheckCircle2 size={26} />, sub: 'Great job!', href: '/tasks?show=completed_today' },
  due_today:   { color: '#EA580C', chipBg: '#FFF7ED', iconBg: '#FFEDD5', bar: '#FDBA74', rowBg: '#FFFFFF', viewAll: 'View tasks due today', icon: <Hourglass size={26} />, sub: 'Today', href: '/tasks?sort=deadline&show=due_today' },
  due_this_week: { color: '#2563EB', chipBg: '#EFF6FF', iconBg: '#DBEAFE', bar: '#93C5FD', rowBg: '#FFFFFF', viewAll: 'View tasks due this week', icon: <Calendar size={26} />, sub: 'This week', href: '/tasks?sort=deadline&show=due_this_week' },
}

const DASHBOARD_TASK_PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Low:    { bg: '#F1F5F9', text: '#475569' },
  Medium: { bg: '#DBEAFE', text: '#1D4ED8' },
  High:   { bg: '#FFEDD5', text: '#C2410C' },
  Urgent: { bg: '#FEE2E2', text: '#B91C1C' },
}

// Left summary card, one per non-empty group — white card, icon bubble, big count.
// Display-only (not clickable); fills its pair-row's height (see the Task Overview body layout).
const TASK_NOTIFICATION_META: Record<TaskNotificationItem['id'], { icon: React.ReactNode; accent: string; accentBg: string; route: string; text: string }> = {
  new_assigned_task:    { icon: <CheckSquare size={15} />,     accent: '#2563EB', accentBg: '#EFF6FF', route: '/tasks?tab=my', text: 'New tasks assigned to you' },
  task_rejected:        { icon: <AlertCircle size={15} />,     accent: '#DC2626', accentBg: '#FEF2F2', route: '/tasks?tab=my&show=rework', text: 'Your tasks were rejected' },
  // Manager-only notification list — Attendance is folded into the Shifts page for Manager.
  shift_swap_rejected:  { icon: <ArrowRightLeft size={15} />,  accent: '#D97706', accentBg: '#FFF7ED', route: '/shifts?tab=swaps', text: 'Shift swaps were rejected' },
}

function TaskNotificationLine({ item, onClick }: { item: TaskNotificationItem; onClick: () => void }) {
  const meta = TASK_NOTIFICATION_META[item.id]
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 38, border: '1px solid #E5E7EB', borderRadius: 999, background: '#FFFFFF',
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 12px 0 8px',
        color: '#334155', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
      }}
    >
      <span style={{ width: 24, height: 24, borderRadius: 999, background: meta.accentBg, color: meta.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {meta.icon}
      </span>
      <span>{item.count} {meta.text}</span>
    </button>
  )
}

function TaskStatCard({ group, hideSub = false }: { group: TaskOverviewGroup; hideSub?: boolean }) {
  const meta = TASK_GROUP_META[group.key]
  return (
    <div style={{
      height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', gap: 10, padding: '18px 12px', borderRadius: 16,
      background: '#FFFFFF', border: '1px solid #E5E7EB',
    }}>
      <span style={{
        width: 56, height: 56, borderRadius: 999, background: meta.iconBg, color: meta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 4,
      }}>
        {meta.icon}
      </span>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{group.label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: meta.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{group.count}</div>
      {!hideSub && <div style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>{meta.sub}</div>}
    </div>
  )
}

// "5 days overdue" / "Overdue today" — from the row's local-wall-clock due date
// (same formatDateKey convention as the service; never a raw UTC slice).
function taskOverdueLabel(due_at: string | null): string | null {
  if (!due_at) return null
  const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const diffDays = Math.round((new Date(`${dayKey(new Date(due_at))}T00:00:00`).getTime() - new Date(`${dayKey(new Date())}T00:00:00`).getTime()) / 86_400_000)
  if (diffDays >= 0) return 'Overdue today'
  return diffDays === -1 ? '1 day overdue' : `${-diffDays} days overdue`
}

// "17 Jul, 12:49PM" — exact clone of the Task page kanban card's deadline display.
function formatTaskStamp(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hour12 = d.getHours() % 12 || 12
  const time = `${String(hour12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}${d.getHours() < 12 ? 'AM' : 'PM'}`
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-US', { month: 'short' })}, ${time}`
}

function TaskGroupSection({ group, onOpenTask, managerStyle = false }: { group: TaskOverviewGroup; onOpenTask: () => void; managerStyle?: boolean }) {
  const isCompleted = group.key === 'completed'
  // Scrollable list whose viewport height snaps to a whole number of cards, so the resting
  // view never shows a half-cut card. The down-chevron under it is a pure HINT (not a button)
  // that there is more below the current scroll position — it fades out at the bottom.
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [listHeight, setListHeight] = useState<number | null>(null)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)
  useEffect(() => {
    const wrap = wrapRef.current
    const list = listRef.current
    if (!wrap || !list) return
    const GAP = 10
    const HINT_H = 28 // hint row height incl. its top margin — keep in sync with the hint div below
    const measure = () => {
      const first = list.firstElementChild as HTMLElement | null
      // Fractional height (borders/subpixels included) — offsetHeight rounds down and clips
      // the last visible card's bottom border. The +2px slack stays inside the 10px card gap.
      const cardH = first?.getBoundingClientRect().height ?? 0
      if (!cardH) return
      const fit = Math.max(1, Math.floor((wrap.clientHeight - HINT_H + GAP) / (cardH + GAP)))
      setListHeight(fit < group.tasks.length ? Math.ceil(fit * (cardH + GAP) - GAP) + 2 : null)
    }
    const updateHint = () => setHasMoreBelow(list.scrollTop + list.clientHeight < list.scrollHeight - 4)
    measure()
    updateHint()
    list.addEventListener('scroll', updateHint, { passive: true })
    const wrapObserver = new ResizeObserver(measure)
    wrapObserver.observe(wrap)
    const listObserver = new ResizeObserver(updateHint)
    listObserver.observe(list)
    return () => { list.removeEventListener('scroll', updateHint); wrapObserver.disconnect(); listObserver.disconnect() }
  }, [group.tasks.length])
  return (
    <div ref={wrapRef} style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        ref={listRef}
        style={{
          height: listHeight ?? undefined, flexGrow: listHeight == null ? 1 : 0, flexShrink: 0,
          minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable', scrollSnapType: 'y proximity',
        }}
      >
        {group.tasks.map(task => {
          const stamp = isCompleted
            ? formatTaskStamp(task.completed_at)
            : group.key === 'overdue'
              ? taskOverdueLabel(task.due_at)
              : formatTaskStamp(task.due_at)
          const warning = !isCompleted && !!task.due_at &&
            (new Date(task.due_at) < new Date() || new Date(task.due_at).getTime() - Date.now() <= 2 * 60 * 60 * 1000)
          const priority = task.priority ? DASHBOARD_TASK_PRIORITY_COLORS[task.priority] : null
          return (
            <div
              key={task.id}
              onClick={onOpenTask}
              className="task-card"
              style={{
                background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: managerStyle ? '16px' : '14px 16px',
                marginBottom: 10, cursor: 'pointer', scrollSnapAlign: 'start',
                transition: 'transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(15,23,42,0.07)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
            >
              {managerStyle ? (
                <>
                  {priority && task.priority && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, paddingRight: 24 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: priority.bg, color: priority.text, letterSpacing: '0.01em' }}>
                        {task.priority}
                      </span>
                    </div>
                  )}
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: '0 0 8px', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 26 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: task.assignee_photo_url ? 'transparent' : '#FFF3E8', border: '1.5px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {task.assignee_photo_url
                          ? <img src={task.assignee_photo_url} alt={task.assignee_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <UserCog size={14} color="#F97316" strokeWidth={2} />}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.assignee_name}
                      </span>
                    </div>
                    {stamp && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {warning ? <AlertCircle size={11} color="#EF4444" /> : <Clock size={11} color="#9CA3AF" />}
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: warning ? '#EF4444' : '#9CA3AF', whiteSpace: 'nowrap' }}>{stamp}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {task.department_id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <DepartmentBadge departmentId={task.department_id} departmentName={task.department_name} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0, lineHeight: 1.4, minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</p>
                    {stamp && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {warning ? <AlertCircle size={11} color="#EF4444" /> : <Clock size={11} color="#9CA3AF" />}
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: warning ? '#EF4444' : '#9CA3AF', whiteSpace: 'nowrap' }}>{stamp}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
      {/* Scroll hint — display only, never interactive; height always reserved so nothing shifts */}
      <div style={{
        height: 18, marginTop: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#94A3B8', pointerEvents: 'none', opacity: hasMoreBelow ? 1 : 0, transition: 'opacity 0.15s ease',
      }}>
        <ChevronDown size={16} />
      </div>
    </div>
  )
}

// ─── Attendance Overview (Internal + Casual Worker halves in one block) ─────────

// 8-segment progress bar, matching the mockup's notched track.
// Status colors mirror the Attendance page's weekly-grid capsules (present green / late amber /
// absent red) so the dashboard reads the same as the page it links to.
const PROGRESS_PRESENT_COLOR = '#10B981'
const PROGRESS_LATE_COLOR = '#F59E0B'
const PROGRESS_ABSENT_COLOR = '#EF4444'
const PROGRESS_EMPTY_COLOR = '#E2E8F0'

function SegmentedProgress({ present, late, absent, max, width, height = 8 }: {
  present: number; late: number; absent: number; max: number; width?: number; height?: number
}) {
  // One segment per expected person: on-time check-ins (green) then late (amber) fill from the
  // left; absent (red) pins to the far right — those people will never check in — and the gray
  // gap in between is whoever hasn't started yet.
  const segments = Math.max(1, max)
  const fills = Array<string>(segments).fill(PROGRESS_EMPTY_COLOR)
  for (let i = 0; i < Math.min(present, segments); i++) fills[i] = PROGRESS_PRESENT_COLOR
  for (let i = present; i < Math.min(present + late, segments); i++) fills[i] = PROGRESS_LATE_COLOR
  for (let i = Math.max(0, segments - absent); i < segments; i++) fills[i] = PROGRESS_ABSENT_COLOR
  return (
    <div style={{ display: 'flex', gap: segments > 20 ? 2 : 3, width, flex: width ? undefined : 1, minWidth: width ?? 40 }}>
      {Array.from({ length: segments }, (_, i) => (
        <div key={i} style={{ flex: 1, minWidth: 0, height, borderRadius: 999, background: fills[i] ?? PROGRESS_EMPTY_COLOR }} />
      ))}
    </div>
  )
}

// Note-text colors match the progress-bar segment colors exactly (present green / late amber /
// absent red), plus a neutral gray for people whose shift hasn't started.
const PERSON_STATUS_META = {
  present:     { label: 'Present', color: PROGRESS_PRESENT_COLOR },
  late:        { label: 'Late',    color: PROGRESS_LATE_COLOR },
  absent:      { label: 'Absent',  color: PROGRESS_ABSENT_COLOR },
  not_started: { label: 'Not Yet', color: '#64748B' },
} as const

function initialsOf(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function formatShiftStart(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

function AttendanceDeptSection({ dept, open, onToggle, query = '', personColumnLabel = 'Employee' }: {
  dept: AttendanceDepartmentGroup; open: boolean; onToggle: () => void; query?: string; personColumnLabel?: string
}) {
  type RowStatus = keyof typeof PERSON_STATUS_META
  const rows: { person: AttendancePersonRow; status: RowStatus; clockIn: string; note: string }[] = [
    ...dept.present.map(p => ({ person: p, status: 'present' as const, clockIn: p.clock_in_label ?? '—', note: 'Present' })),
    ...dept.late.map(p => ({ person: p, status: 'late' as const, clockIn: p.clock_in_label ?? '—', note: 'Late' })),
    ...dept.absent.map(p => ({ person: p, status: 'absent' as const, clockIn: '—', note: 'Absent' })),
    ...dept.not_started.map(p => ({ person: p, status: 'not_started' as const, clockIn: '—', note: '' })),
  ]
  const gridTemplate = 'repeat(4, minmax(0, 1fr))'
  return (
    <div
      // Expanded card takes the full row width; collapsed cards sit two per row.
      style={{ gridColumn: open ? '1 / -1' : 'auto', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, transition: 'border-color 0.12s ease, box-shadow 0.12s ease' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Same format as the Attendance Progress strip above: name + big count, bar underneath */}
      <div onClick={onToggle} style={{ padding: '20px 18px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: `${dept.department_id ? deptColor(dept.department_id) : '#64748B'}1A`,
            color: dept.department_id ? deptColor(dept.department_id) : '#64748B',
            fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initialsOf(dept.department_name)}
          </span>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dept.department_name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {dept.checked_in} / {dept.expected}
          </span>
          {open
            ? <ChevronUp size={16} style={{ color: '#64748B', flexShrink: 0 }} />
            : <ChevronDown size={16} style={{ color: '#64748B', flexShrink: 0 }} />}
        </div>
        <div style={{ marginTop: 14 }}>
          <SegmentedProgress
            present={dept.present.length}
            late={dept.late.length}
            absent={dept.absent.length}
            max={dept.expected}
            height={24}
          />
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 12px 10px' }}>
          {/* All three columns center-aligned so the label/content gaps read as equal */}
          <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 10, padding: '6px 10px', borderBottom: '1px solid #F1F5F9' }}>
            {[personColumnLabel, 'Shift', 'Clock In', 'Note'].map(h => (
              <span key={h} style={{ fontSize: 11.5, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', textAlign: 'center' }}>{h}</span>
            ))}
          </div>
          {rows.map(({ person, status, clockIn, note }) => {
            const meta = PERSON_STATUS_META[status]
            const searchMatch = query.length > 0 && person.name.toLowerCase().includes(query)
            return (
              <div
                key={`${status}-${person.user_id}`}
                style={{
                  display: 'grid', gridTemplateColumns: gridTemplate, gap: 10, alignItems: 'center',
                  padding: '9px 10px', borderBottom: '1px solid #F8FAFC',
                  background: searchMatch ? '#FFF7ED' : 'transparent', borderRadius: searchMatch ? 8 : 0,
                }}
              >
                <span style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 400, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</span>
                <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 400, color: '#334155', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatShiftStart(person.shift_start)}
                </span>
                {status === 'not_started' ? (
                  // Shift hasn't started: one line centered across the Clock In + Note space.
                  <span style={{ gridColumn: '3 / 5', textAlign: 'center', fontSize: 12, fontWeight: 400, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Not started yet
                  </span>
                ) : status === 'absent' ? (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ width: 26, height: 2.5, borderRadius: 2, background: PROGRESS_ABSENT_COLOR }} />
                    </span>
                    <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: meta.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>
                  </>
                ) : (
                  <>
                    <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 400, color: '#334155', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{clockIn}</span>
                    <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: meta.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AttendanceFlatDetails({ group, search = '', personColumnLabel = 'Employee' }: { group: AttendanceRoleGroup; search?: string; personColumnLabel?: string }) {
  type RowStatus = keyof typeof PERSON_STATUS_META
  const query = search.trim().toLowerCase()
  const rows: { person: AttendancePersonRow; status: RowStatus; clockIn: string; note: string }[] = group.departments.flatMap(dept => [
    ...dept.present.map(p => ({ person: p, status: 'present' as const, clockIn: p.clock_in_label ?? '-', note: 'Present' })),
    ...dept.late.map(p => ({ person: p, status: 'late' as const, clockIn: p.clock_in_label ?? '-', note: 'Late' })),
    ...dept.absent.map(p => ({ person: p, status: 'absent' as const, clockIn: '-', note: 'Absent' })),
    ...dept.not_started.map(p => ({ person: p, status: 'not_started' as const, clockIn: '-', note: 'Not started yet' })),
  ])
  const gridTemplate = 'repeat(4, minmax(0, 1fr))'

  return (
    <div style={{ marginTop: 4, padding: '0 10px 4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 10, padding: '8px 8px 10px', borderBottom: '1px solid #E5E7EB' }}>
        {[personColumnLabel, 'Shift', 'Clock In', 'Note'].map(h => (
          <span key={h} style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', textAlign: 'center' }}>{h}</span>
        ))}
      </div>
      {rows.map(({ person, status, clockIn, note }) => {
        const meta = PERSON_STATUS_META[status]
        const searchMatch = query.length > 0 && person.name.toLowerCase().includes(query)
        return (
          <div
            key={`${status}-${person.user_id}`}
            style={{
              display: 'grid', gridTemplateColumns: gridTemplate, gap: 10, alignItems: 'center',
              padding: '11px 8px', borderBottom: '1px solid #F1F5F9',
              background: searchMatch ? '#FFF7ED' : 'transparent', borderRadius: searchMatch ? 8 : 0,
            }}
          >
            <span style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</span>
            <span style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 500, color: '#334155', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {formatShiftStart(person.shift_start)}
            </span>
            {status === 'not_started' ? (
              <span style={{ gridColumn: '3 / 5', textAlign: 'center', fontSize: 12.5, fontWeight: 500, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {note}
              </span>
            ) : (
              <>
                <span style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 500, color: '#334155', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{clockIn}</span>
                <span style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: meta.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function personsOf(dept: AttendanceDepartmentGroup): AttendancePersonRow[] {
  return [...dept.present, ...dept.late, ...dept.absent, ...dept.not_started]
}

function AttendanceHalf({ title, accent, accentBg, group, search = '', onOpenDetails, flatProgressHeader = false, showDepartmentBreakdown = true, personColumnLabel = 'Employee' }: {
  title: string; accent: string; accentBg: string; group: AttendanceRoleGroup; search?: string; onOpenDetails?: () => void; flatProgressHeader?: boolean; showDepartmentBreakdown?: boolean; personColumnLabel?: string
}) {
  const [openDepts, setOpenDepts] = useState<Set<string> | null>(null)
  const [flatDetailsOpen, setFlatDetailsOpen] = useState(false)
  const [hoverLegend, setHoverLegend] = useState<string | null>(null)
  const query = search.trim().toLowerCase()
  const matchedOpen = query
    ? new Set(group.departments.filter(d => personsOf(d).some(p => p.name.toLowerCase().includes(query))).map(d => d.department_name))
    : null
  const effectiveOpen = matchedOpen ?? openDepts ?? new Set<string>()
  const toggle = (name: string) => {
    if (query) return
    const next = new Set(effectiveOpen)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setOpenDepts(next)
  }
  const hasAttendance = group.departments.length > 0
  const canToggleFlatDetails = !showDepartmentBreakdown && hasAttendance
  const progressAction = showDepartmentBreakdown ? onOpenDetails : undefined
  const toggleFlatDetails = () => setFlatDetailsOpen(open => !open)
  return (
    <div style={{ flex: showDepartmentBreakdown ? 1 : '0 0 auto', minWidth: 0, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Half header */}
      <div style={{ display: flatProgressHeader ? 'grid' : 'flex', gridTemplateColumns: flatProgressHeader ? (hasAttendance ? '34px minmax(0, 1fr) 86px' : '34px minmax(0, 1fr)') : undefined, alignItems: 'center', gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: accentBg, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Users size={17} />
        </span>
        <span style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        {flatProgressHeader && hasAttendance && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontSize: 16, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }}>
            <span>{group.checked_in} / {group.expected}</span>
            {canToggleFlatDetails && (
              <button
                type="button"
                aria-label={flatDetailsOpen ? 'Collapse attendance details' : 'Expand attendance details'}
                onClick={toggleFlatDetails}
                style={{ border: 'none', background: 'transparent', padding: 2, margin: -2, color: '#64748B', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                {flatDetailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </span>
        )}
      </div>
      {/* Progress summary strip — skipped entirely when no one's scheduled today, so the block
          collapses to just the header + empty-state row instead of a 0/0 progress bar. */}
      {!hasAttendance ? null : (() => {
        const late = group.departments.reduce((n, d) => n + d.late.length, 0)
        const absent = group.departments.reduce((n, d) => n + d.absent.length, 0)
        const present = group.departments.reduce((n, d) => n + d.present.length, 0)
        const buildGroups = (key: 'present' | 'late' | 'absent', detail: (p: AttendancePersonRow) => string | null) =>
          group.departments
            .filter(d => d[key].length > 0)
            .map(d => ({
              dept_id: d.department_id,
              dept_name: d.department_name,
              people: d[key].map(p => ({ user_id: p.user_id, name: p.name, detail: detail(p) })),
            }))
        const legend = [
          { label: 'Present', count: present, dot: PROGRESS_PRESENT_COLOR, detailColor: '#15803D', groups: buildGroups('present', p => p.clock_in_label) },
          { label: 'Late', count: late, dot: PROGRESS_LATE_COLOR, detailColor: '#C2410C', groups: buildGroups('late', p => p.minutes_late != null ? `${p.minutes_late} min late` : p.clock_in_label) },
          { label: 'Absent', count: absent, dot: PROGRESS_ABSENT_COLOR, detailColor: '#B91C1C', groups: buildGroups('absent', () => 'No show') },
        ]
        return (
          <div
            role={progressAction ? 'button' : undefined}
            tabIndex={progressAction ? 0 : undefined}
            onClick={progressAction}
            onKeyDown={e => { if (progressAction && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); progressAction() } }}
            style={flatProgressHeader
              ? { padding: '4px 14px 2px', cursor: progressAction ? 'pointer' : 'default' }
              : { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 18px', marginTop: 4, cursor: progressAction ? 'pointer' : 'default', transition: 'transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease' }}
            onMouseEnter={e => { if (!flatProgressHeader && progressAction) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.08)' } }}
            onMouseLeave={e => { if (!flatProgressHeader && progressAction) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' } }}
          >
            {!flatProgressHeader && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap' }}>Attendance Progress</span>
                <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {group.checked_in} / {group.expected}
                </span>
              </div>
            )}
            <div style={{ marginTop: flatProgressHeader ? 0 : 14 }}>
              <SegmentedProgress present={present} late={late} absent={absent} max={group.expected} height={24} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              {legend.map(item => {
                const hovered = hoverLegend === item.label
                const showPop = hovered && item.groups.length > 0
                return (
                  <div
                    key={item.label}
                    style={{ position: 'relative' }}
                    onMouseEnter={() => setHoverLegend(item.label)}
                    onMouseLeave={() => setHoverLegend(null)}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px',
                      background: '#FFFFFF', border: `1px solid ${hovered ? '#CBD5E1' : '#E5E7EB'}`, borderRadius: 10,
                      boxShadow: hovered ? '0 4px 12px rgba(15,23,42,0.08)' : 'none',
                      transform: hovered ? 'translateY(-1px)' : 'none',
                      transition: 'transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease',
                      fontSize: 12, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', cursor: 'default',
                    }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: item.dot, flexShrink: 0 }} />
                      {item.count} {item.label}
                    </div>
                    {showPop && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40,
                        background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12,
                        boxShadow: '0 12px 28px rgba(15,23,42,0.16)', padding: '12px 14px',
                        minWidth: 240, maxWidth: 320, maxHeight: 280, overflowY: 'auto',
                      }}>
                        {item.groups.map((g, gi) => (
                          <div key={g.dept_name} style={{ marginBottom: gi === item.groups.length - 1 ? 0 : 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: g.dept_id ? deptColor(g.dept_id) : '#94A3B8', flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', whiteSpace: 'nowrap' }}>{g.dept_name}</span>
                            </div>
                            {g.people.map(p => (
                              <div key={`${g.dept_name}-${p.user_id}`} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, padding: '3px 0 3px 14px' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                                {p.detail && (
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: item.detailColor, whiteSpace: 'nowrap', flexShrink: 0 }}>{p.detail}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
      {group.departments.length === 0 ? (
        <EmptyRow text="No one scheduled today" />
      ) : showDepartmentBreakdown ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '-2px 0' }}>
            <span style={{
              width: 36, height: 36, borderRadius: 999, background: '#F97316', color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 2px 6px rgba(15,23,42,0.22)',
            }}>
              <ArrowDown size={19} />
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 12, rowGap: 22, alignItems: 'start' }}>
            {group.departments.map(dept => (
              <AttendanceDeptSection
                key={dept.department_name}
                dept={dept}
                open={effectiveOpen.has(dept.department_name)}
                onToggle={() => toggle(dept.department_name)}
                query={query}
                personColumnLabel={personColumnLabel}
              />
            ))}
          </div>
        </>
      ) : flatDetailsOpen ? (
        <AttendanceFlatDetails group={group} search={search} personColumnLabel={personColumnLabel} />
      ) : null}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Entrance animation — same blockSlideUp the other owner pages play on navigation.
type DashboardTeamMember = {
  id: string
  full_name: string
  role: string
  email_address?: string | null
  phone_number?: string | null
  date_of_birth?: string | null
  created_at?: string | null
  department_id?: string | null
  profile_photo_url?: string | null
  casual_worker_verified_at?: string | null
  casual_worker_inactive_at?: string | null
}

type DashboardTeamDetails = {
  owners: DashboardTeamMember[]
  partners: DashboardTeamMember[]
  managers: DashboardTeamMember[]
  employees: DashboardTeamMember[]
  casualWorkers: DashboardTeamMember[]
}

function formatDashboardDate(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DashboardProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 10, background: '#F8FAFC' }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#64748B', marginBottom: 4 }}>{label}</span>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F172A', wordBreak: 'break-word' }}>{value || '-'}</span>
    </div>
  )
}

function ManagerTeamMemberCard({ member, onClick }: { member: DashboardTeamMember; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
      width: '100%', minHeight: 126, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
      padding: '12px 10px', boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
      cursor: 'pointer', transition: 'transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(15,23,42,0.1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.08)' }}
    >
      <RoleAvatar role={member.role} size={60} photoUrl={member.profile_photo_url ?? null} />
      <span style={{ maxWidth: '100%', fontSize: 13.5, fontWeight: 800, color: '#0F172A', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {member.full_name}
      </span>
    </button>
  )
}

function ManagerTeamRoleSection({ title, members, emptyText, onMemberClick }: {
  title: string
  members: DashboardTeamMember[]
  emptyText: string
  onMemberClick: (member: DashboardTeamMember) => void
}) {
  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, background: '#FFFFFF', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 0' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>{members.length}</span>
      </div>
      {members.length === 0 ? (
        <div style={{ padding: '16px 14px', fontSize: 12.5, fontWeight: 600, color: '#94A3B8' }}>{emptyText}</div>
      ) : (
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(126px, 1fr))', gap: 12, overflowY: 'auto', minHeight: 0, scrollbarGutter: 'stable' }}>
          {members.map(member => <ManagerTeamMemberCard key={member.id} member={member} onClick={() => onMemberClick(member)} />)}
        </div>
      )}
    </div>
  )
}

function ManagerTeamProfileModal({ member, onClose }: { member: DashboardTeamMember; onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose} maxWidth="420px">
      <ModalBox>
        <ModalHeader title="Member Profile" icon={<UserRound size={15} color="#fff" strokeWidth={2.5} />} onClose={onClose} />

        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 14 }}>
          <RoleAvatar role={member.role} size={44} photoUrl={member.profile_photo_url ?? null} />
          <div>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: '0 0 5px' }}>{member.full_name}</p>
            <span style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: member.role === 'Owner' || member.role === 'Partner' ? '#0F172A' :
                member.role === 'Manager' ? '#FFF7ED' :
                member.role === 'Employee' ? '#F3F4F6' : '#EFF6FF',
              color: member.role === 'Owner' || member.role === 'Partner' ? '#FFFFFF' :
                member.role === 'Manager' ? '#EA580C' :
                member.role === 'Employee' ? '#4B5563' : '#2563EB',
            }}>
                {member.role}
            </span>
          </div>
        </div>

        <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column' }}>
          {[
            { label: 'Email Address', value: member.email_address || '-' },
            { label: 'Date of Birth', value: formatDashboardDate(member.date_of_birth) },
            { label: 'Phone Number', value: member.phone_number || '-' },
          ].map(field => (
            <div key={field.label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>{field.label}</label>
              <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>{field.value}</p>
            </div>
          ))}
          </div>
      </ModalBox>
    </ModalOverlay>
  )
}

function TeamOverviewBlock({ summary, loading, teamDetails, detailsLoading, onMemberClick }: {
  summary: OwnerDashboardSummary | null
  loading: boolean
  teamDetails: DashboardTeamDetails | null
  detailsLoading: boolean
  onMemberClick: (member: DashboardTeamMember) => void
}) {
  const internalMembers = teamDetails
    ? [...teamDetails.owners, ...teamDetails.partners, ...teamDetails.managers, ...teamDetails.employees]
    : []
  return (
    <ShowcaseCard
      fillHeight
      icon={<Users size={15} style={{ color: '#F97316' }} />}
      title="Team"
    >
      {!summary ? (
        <EmptyRow text={loading ? 'Loading...' : 'No data yet'} />
      ) : !teamDetails ? (
        <EmptyRow text={detailsLoading ? 'Loading team...' : 'No team data yet'} />
      ) : (
        <div className="manager-dashboard-content-in" style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
          {detailsLoading && <EmptyRow text="Loading team..." />}
          <ManagerTeamRoleSection title="Internal" members={internalMembers} emptyText="No internal members found" onMemberClick={onMemberClick} />
          <ManagerTeamRoleSection title="Casual Worker" members={teamDetails.casualWorkers} emptyText="No casual workers in this department yet" onMemberClick={onMemberClick} />
        </div>
      )}
    </ShowcaseCard>
  )
}

const pageKeyframes = `
  @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes managerDashboardBlockIn {
    from { opacity: 0; transform: translateY(18px) scale(0.985); filter: blur(2px); }
    to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
  }
  @keyframes managerDashboardContentIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes dashboardSkeletonPulse { 0%, 100% { opacity: .52 } 50% { opacity: 1 } }
  .dashboard-skeleton { background: linear-gradient(90deg, #E2E8F0 0%, #F1F5F9 45%, #E2E8F0 100%); background-size: 220% 100%; animation: dashboardSkeletonPulse 1.05s ease-in-out infinite; }
  .manager-dashboard-content-in { animation: managerDashboardContentIn 0.34s cubic-bezier(0.22,1,0.36,1) both; }
`

export default function DashboardView({ sidebar, basePath, viewerRole }: {
  sidebar: ReactNode
  basePath: string
  // 'Manager' scopes the summary to the viewer's departments and drops O/P-only cards.
  viewerRole?: 'Manager'
}) {
  const router = useRouter()
  const isCompact = useIsCompactViewport(1200)

  const [companyId, setCompanyId] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')

  const [summary, setSummary] = useState<OwnerDashboardSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attendanceSearch, setAttendanceSearch] = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  const [managerNotifications, setManagerNotifications] = useState<TaskNotificationItem[]>([])
  const [managerTeamDetails, setManagerTeamDetails] = useState<DashboardTeamDetails | null>(null)
  const [managerTeamLoading, setManagerTeamLoading] = useState(false)
  const [managerInitialLoading, setManagerInitialLoading] = useState(false)
  const [teamProfileMember, setTeamProfileMember] = useState<DashboardTeamMember | null>(null)

  // ── My Shift Today (Manager's own clock in/out + break in/out, UC49/UC56) ──
  const [myShifts, setMyShifts] = useState<MyShift[]>([])
  const [clockBusyId, setClockBusyId] = useState('')
  const [clockMessage, setClockMessage] = useState('')

  const fetchMyShift = useCallback(async (uid: string) => {
    if (!uid) return
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${uid}&resource=my_shift`)
      const data = await res.json()
      if (data.success) setMyShifts(data.myShift?.shifts ?? [])
    } catch {}
  }, [])

  // Shift dates are Singapore-nominal (see ClockFlow's sgtInstant) — "today" must be the
  // Singapore calendar day, not a mix of the machine's own timezone and true UTC, or a shift
  // that's "today" only by one of those would double up against a genuinely different day's
  // shift (see project memory module5-clockin-timezone-bug).
  const myTodayShifts = useMemo(() => {
    const today = sgtTodayKey()
    return myShifts.filter(s => s.shift.shift_date === today)
  }, [myShifts])

  const renderManagerClockChain = (compactLabel = false) => (
    <>
      {myTodayShifts.map(shift => {
        const clockedIn = !!shift.record?.clock_in_time
        const clockedOut = !!shift.record?.clock_out_time
        const breakInDone = !!shift.record?.break_in_time
        const breakOutDone = !!shift.record?.break_out_time
        const clockInEnabled = !clockBusyId && !clockedIn && canClockIn(shift.shift)
        const breakInEnabled = !clockBusyId && clockedIn && !clockedOut && !breakInDone
        const breakOutEnabled = !clockBusyId && clockedIn && !clockedOut && breakInDone && !breakOutDone
        const clockOutEnabled = !clockBusyId && clockedIn && !clockedOut && canClockOut(shift.shift)
        return (
          <div key={shift.assignment.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
            {!compactLabel && (
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Shift - {fmtShiftTime(shift.shift.start_time)} to {shift.shift.is_open_ended ? 'Open' : fmtShiftTime(shift.shift.end_time)}
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'nowrap' }}>
              <ClockFlowButton
                icon={<Clock size={19} />}
                label="Clock In"
                sub={clockedIn && shift.record?.clock_in_time ? `At ${fmtClockStamp(shift.record.clock_in_time)}` : `From ${fmtShiftTimeMinusMinutes(shift.shift.start_time, CLOCK_IN_WINDOW_MINUTES_BEFORE)}`}
                enabled={clockInEnabled}
                completed={clockedIn}
                activeColor="#F97316"
                onClick={() => void runClockAction(shift, 'clock_in')}
              />
              <ClockFlowConnector />
              <ClockFlowButton
                icon={<Coffee size={19} />}
                label="Break In"
                sub={breakInDone && shift.record?.break_in_time ? `At ${fmtClockStamp(shift.record.break_in_time)}` : ''}
                enabled={breakInEnabled}
                completed={breakInDone}
                activeColor="#F97316"
                onClick={() => void runClockAction(shift, 'break_in')}
              />
              <ClockFlowConnector />
              <ClockFlowButton
                icon={<Coffee size={19} />}
                label="Break Out"
                sub={breakOutDone && shift.record?.break_out_time ? `At ${fmtClockStamp(shift.record.break_out_time)}` : ''}
                enabled={breakOutEnabled}
                completed={breakOutDone}
                activeColor="#F97316"
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
          </div>
        )
      })}
      {clockMessage && (
        <span style={{ fontSize: 12.5, fontWeight: 600, color: clockMessage.includes('success') || clockMessage.includes('Break') ? '#059669' : '#DC2626', whiteSpace: 'nowrap' }}>{clockMessage}</span>
      )}
    </>
  )

  const runClockAction = async (shift: MyShift, action: 'clock_in' | 'clock_out' | 'break_in' | 'break_out') => {
    setClockBusyId(`${shift.assignment.id}:${action}`)
    setClockMessage('')
    try {
      const body: Record<string, unknown> = { action, user_id: internalUserId, shift_assignment_id: shift.assignment.id }
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Attendance action failed')
      await fetchMyShift(internalUserId)
    } catch (err) {
      setClockMessage(err instanceof Error ? err.message : 'Attendance action failed')
    } finally {
      setClockBusyId('')
    }
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let authId = localStorage.getItem('tasking_user_id')
      if (!authId) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) { authId = session.user.id; localStorage.setItem('tasking_user_id', authId) }
      }
      if (!authId) { router.replace('/signin'); return }
      const meRes = await fetch(`/api/user/me?user_id=${authId}`)
      const meData = await meRes.json()
      if (!meData.success || cancelled) return
      if (meData.user?.id) setInternalUserId(meData.user.id)
      const cid = localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
      if (!cid) return
      setCompanyId(cid)
      const companyRes = await fetch(`/api/company/current?user_id=${authId}&company_id=${cid}`)
      const companyData = await companyRes.json()
      if (!cancelled && companyData.success) setCurrentPlan(companyData.company?.plan ?? 'Free')
    }
    void run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const fetchSummary = useCallback(async (cid: string, ownerId: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/owner/dashboard?company_id=${cid}&owner_id=${ownerId}${viewerRole ? `&viewer_role=${viewerRole}` : ''}`)
      const data = await res.json()
      if (data.success) setSummary(data.summary)
      else setError(data.message || 'Failed to load dashboard')
    } catch {
      setError('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [viewerRole])

  const fetchManagerNotifications = useCallback(async (cid: string, uid: string) => {
    if (viewerRole !== 'Manager' || !cid || !uid) return
    try {
      const res = await fetch(`/api/task?company_id=${cid}&kanban=true&assigned_user_id=${encodeURIComponent(uid)}&viewer_id=${encodeURIComponent(uid)}`)
      const data = await res.json()
      if (!data.success) return
      const seenKey = `manager_mytasks_seen_${cid}_${uid}`
      let seen = new Set<string>()
      try {
        const raw = localStorage.getItem(seenKey)
        if (raw) seen = new Set(JSON.parse(raw))
      } catch {}
      const signature = (task: { id: string; rejected_at?: string | null }) => `${task.id}::${task.rejected_at ?? ''}`
      const assigned = ((data.groups?.Assigned ?? []) as Array<{ id: string; rejected_at?: string | null; parent_task_id?: string | null }>)
        .filter(task => !task.parent_task_id && !seen.has(signature(task)))
      const rejected = ((data.groups?.['In Progress'] ?? []) as Array<{ id: string; rejected_at?: string | null; rejection_reason?: string | null; parent_task_id?: string | null }>)
        .filter(task => !task.parent_task_id && !!task.rejection_reason && !!task.rejected_at && !seen.has(signature(task)))

      setManagerNotifications([
        { id: 'new_assigned_task', label: 'New Assigned Task', count: assigned.length, oldest_at: null, detail: 'Assigned by Owner or Partner' },
        { id: 'task_rejected', label: 'Task Rejected by Owner', count: rejected.length, oldest_at: null, detail: 'Needs rework' },
      ].filter(item => item.count > 0) as TaskNotificationItem[])
    } catch {}
  }, [viewerRole])

  const fetchManagerTeamDetails = useCallback(async (cid: string, uid: string) => {
    if (viewerRole !== 'Manager' || !cid || !uid) return
    setManagerTeamLoading(true)
    try {
      const [companyRes, deptRes] = await Promise.all([
        fetch(`/api/team/members?company_id=${encodeURIComponent(cid)}`),
        fetch(`/api/manager/departments?manager_id=${encodeURIComponent(uid)}&company_id=${encodeURIComponent(cid)}`),
      ])
      const [companyData, deptData] = await Promise.all([companyRes.json(), deptRes.json()])
      const companyMembers = (companyData.success ? companyData.members ?? [] : []) as DashboardTeamMember[]

      const departmentIds = ((deptData.success ? deptData.departments ?? [] : []) as Array<{ id?: string; department_id?: string }>)
        .map(dept => dept.id ?? dept.department_id)
        .filter((id): id is string => !!id)

      const departmentMemberGroups = await Promise.all(departmentIds.map(async departmentId => {
        const res = await fetch(`/api/team/members?company_id=${encodeURIComponent(cid)}&department_id=${encodeURIComponent(departmentId)}`)
        const data = await res.json()
        return (data.success ? data.members ?? [] : []) as DashboardTeamMember[]
      }))

      const unique = (members: DashboardTeamMember[]) => Array.from(new Map(members.map(member => [member.id, member])).values())
      const scopedMembers = unique(departmentMemberGroups.flat())

      setManagerTeamDetails({
        owners: unique(companyMembers.filter(member => member.role === 'Owner')),
        partners: unique(companyMembers.filter(member => member.role === 'Partner')),
        managers: unique(scopedMembers.filter(member => member.role === 'Manager')),
        employees: unique(scopedMembers.filter(member => member.role === 'Employee')),
        casualWorkers: unique(scopedMembers.filter(member =>
          member.role === 'Casual Worker' &&
          !!member.casual_worker_verified_at &&
          !member.casual_worker_inactive_at
        )),
      })
    } catch {
      setManagerTeamDetails({ owners: [], partners: [], managers: [], employees: [], casualWorkers: [] })
    } finally {
      setManagerTeamLoading(false)
    }
  }, [viewerRole])

  useEffect(() => {
    if (!companyId || !internalUserId) return
    if (viewerRole === 'Manager') return
    void fetchSummary(companyId, internalUserId)
  }, [companyId, internalUserId, viewerRole, fetchSummary])

  useEffect(() => {
    if (!companyId || !internalUserId || viewerRole !== 'Manager') return
    let cancelled = false
    const run = async () => {
      setManagerInitialLoading(true)
      await Promise.all([
        fetchSummary(companyId, internalUserId),
        fetchManagerTeamDetails(companyId, internalUserId),
        fetchManagerNotifications(companyId, internalUserId),
        fetchMyShift(internalUserId),
      ])
      if (!cancelled) setManagerInitialLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [companyId, internalUserId, viewerRole, fetchSummary, fetchManagerTeamDetails, fetchManagerNotifications, fetchMyShift])

  useEffect(() => {
    if (!companyId || !internalUserId || viewerRole !== 'Manager') return
    void fetchManagerNotifications(companyId, internalUserId)
    const handler = () => void fetchManagerNotifications(companyId, internalUserId)
    window.addEventListener('task-insights-updated', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('task-insights-updated', handler)
      window.removeEventListener('storage', handler)
    }
  }, [companyId, internalUserId, viewerRole, fetchManagerNotifications])

  useResourceInvalidation(['dashboard', 'tasks', 'attendance', 'recruitment', 'shifts', 'team'], () => {
    if (!companyId || !internalUserId) return
    void fetchSummary(companyId, internalUserId)
    if (viewerRole === 'Manager') {
      void fetchManagerNotifications(companyId, internalUserId)
      void fetchManagerTeamDetails(companyId, internalUserId)
      void fetchMyShift(internalUserId)
    }
  })

  const waitingCount = summary ? summary.waiting_on_you.filter(i => i.count > 0).length : 0
  const waitingTotal = summary?.waiting_on_you.length ?? 5
  const notificationCount = managerNotifications.reduce((sum, item) => sum + item.count, 0)
  const managerBootLoading = viewerRole === 'Manager' && !summary && !error
  const dashboardLoading = viewerRole === 'Manager' ? (managerInitialLoading || managerBootLoading) : loading
  const taskCount = summary ? summary.task_overview.reduce((sum, g) => sum + g.count, 0) : 0
  const taskQuery = viewerRole === 'Manager' ? '' : taskSearch.trim().toLowerCase()
  const visibleTaskGroups = (summary?.task_overview ?? [])
    .map(g => {
      const tasks = taskQuery ? g.tasks.filter(t => t.title.toLowerCase().includes(taskQuery)) : g.tasks
      return { ...g, tasks, count: taskQuery ? tasks.length : g.count }
    })
    .filter(g => g.count > 0)

  const openWaitingOnYouItem = useCallback((item: WaitingOnYouItem) => {
    if (item.id === 'applicant_accept') {
      router.push(item.detail ? `${basePath}/recruitment?job=${item.detail}` : `${basePath}/recruitment`)
      return
    }
    if (item.id === 'off_day_deadline' && viewerRole === 'Manager') {
      // Attendance is folded into the Shifts page for Manager (My Requests panel there still
      // reads this same ?submit=offday deep link to open straight to the Off Day step).
      router.push(`${basePath}/shifts?submit=offday`)
      return
    }
    if (item.id === 'shift_swap' && viewerRole === 'Manager') {
      // Swap Requests is a Shifts-page tab for Manager now (same ?tab=swaps deep-link convention
      // AttendanceView used before the move).
      router.push(`${basePath}/shifts?tab=swaps`)
      return
    }
    if (item.id === 'task_review' && viewerRole === 'Manager') {
      router.push(`${basePath}/tasks?tab=kanban`)
      return
    }
    router.push(basePath + WAITING_ROUTES[item.id])
  }, [basePath, router, viewerRole])

  const openTaskOverviewGroup = useCallback((groupKey: string) => {
    const href = TASK_GROUP_META[groupKey].href
    if (viewerRole !== 'Manager') {
      router.push(basePath + href)
      return
    }
    const [path, query = ''] = href.split('?')
    const params = new URLSearchParams(query)
    params.set('tab', 'kanban')
    router.push(`${basePath}${path}?${params.toString()}`)
  }, [basePath, router, viewerRole])

  // Blocks always render inside a viewport-locked grid on desktop: the page itself never
  // scrolls — overflow lives inside each block. Compact viewports fall back to one
  // naturally-sized column with normal page scrolling.
  const gridStyle: React.CSSProperties = isCompact
    ? { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridAutoRows: 'minmax(260px, 1fr)', gap: 16, overflowY: 'auto', scrollbarGutter: 'stable' }
    : {
        flex: 1, minHeight: 0, display: 'grid', gap: 16,
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        // Row 1 hugs the overview cards' natural height; row 2 takes everything left.
        gridTemplateRows: 'auto minmax(0, 1fr)',
      }

  const managerEntranceStyle = (delayMs: number): React.CSSProperties =>
    viewerRole === 'Manager'
      ? { animation: `managerDashboardBlockIn 0.46s cubic-bezier(0.22,1,0.36,1) both ${delayMs}ms`, willChange: 'opacity, transform' }
      : {}
  const managerContentClass = viewerRole === 'Manager' ? 'manager-dashboard-content-in' : undefined

  const cellStyle = (span: number, managerDelayMs?: number): React.CSSProperties => ({
    ...(isCompact
      ? { minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
      : { gridColumn: `span ${span}`, minHeight: 0, display: 'flex', flexDirection: 'column' }),
    ...(managerDelayMs == null ? {} : managerEntranceStyle(managerDelayMs)),
  })

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F1F5F9' }}>
      <style>{pageKeyframes}</style>
      {sidebar}
      {/* main is always viewport-locked (no page scroll at any width) — the header stays put and
          the block area below scrolls internally when the compact single-column layout is active */}
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'blockSlideUp 0.38s ease both 0.04s' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
            Today&apos;s Overview
          </h1>
          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {/* Subscription plan is Owner/Partner-only — Manager (and every other role) can't switch it. */}
            {companyId && !viewerRole && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* Manager notification + own shift clock chain */}
        {viewerRole === 'Manager' && (
          <div style={{ padding: '0 28px 12px', flexShrink: 0 }}>
            <div style={{ width: isCompact ? '100%' : 'calc(66.6667% - 5.33px)', maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ width: isCompact ? '100%' : 'fit-content', maxWidth: '100%', height: 92, boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 0, ...managerEntranceStyle(40) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bell size={16} style={{ color: '#F97316' }} />
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Task Notification</span>
                </div>
                {dashboardLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 300 }}>
                    <SkeletonLine width={150} height={34} />
                    <SkeletonLine width={170} height={34} />
                  </div>
                ) : !summary ? (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#94A3B8', whiteSpace: 'nowrap' }}>No data yet</span>
                ) : notificationCount === 0 ? (
                  <span className={managerContentClass} style={{ height: 34, border: '1px solid #BBF7D0', borderRadius: 999, background: '#F0FDF4', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 12px 0 8px', color: '#16A34A', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 999, background: '#DCFCE7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={14} />
                    </span>
                    All caught up
                  </span>
                ) : (
                  <div className={managerContentClass} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflowX: 'auto' }}>
                    {managerNotifications.map(item => (
                      <TaskNotificationLine
                        key={item.id}
                        item={item}
                        onClick={() => router.push(basePath + TASK_NOTIFICATION_META[item.id].route)}
                      />
                    ))}
                  </div>
                )}
              </div>
              {(dashboardLoading || myTodayShifts.length > 0) && (
                <div style={{ width: isCompact ? '100%' : 'auto', flex: isCompact ? undefined : '1 1 0', minWidth: isCompact ? undefined : 0, maxWidth: '100%', height: 92, boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, ...managerEntranceStyle(90) }}>
                  {dashboardLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, width: '100%', justifyContent: 'center' }}>
                      <SkeletonLine width={152} height={62} radius={12} />
                      <SkeletonLine width={46} height={12} />
                      <SkeletonLine width={152} height={62} radius={12} />
                      <SkeletonLine width={46} height={12} />
                      <SkeletonLine width={152} height={62} radius={12} />
                      <SkeletonLine width={46} height={12} />
                      <SkeletonLine width={152} height={62} radius={12} />
                    </div>
                  ) : <div className={managerContentClass} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>{renderManagerClockChain(true)}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{ margin: '0 28px 12px', padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.875rem', fontWeight: 600, flexShrink: 0 }}>
            {error}
          </div>
        )}

        <div style={{ padding: '4px 28px 24px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={gridStyle}>

            {/* ── Row 1 · Waiting On You (5 cards) ── */}
            <div style={cellStyle(8, 150)}>
              <ShowcaseCard
                fillHeight={viewerRole === 'Manager' || (!isCompact && viewerRole !== 'Manager')}
                icon={<ListChecks size={15} style={{ color: '#F97316' }} />}
                title="Waiting On You"
                rightContent={<CountChip value={`${waitingCount}/${waitingTotal}`} />}
                actions={dashboardLoading ? <Spinner size={14} dark /> : undefined}
              >
                {!summary ? (
                  <EmptyRow text={dashboardLoading ? 'Loading…' : 'No data yet'} />
                ) : waitingCount === 0 ? (
                  <div className={managerContentClass}><EmptyRow text="All caught up — nothing waiting on you" /></div>
                ) : (
                  <div className={managerContentClass} style={{ display: 'flex', gap: 12, flexWrap: isCompact ? 'wrap' : 'nowrap', overflowX: isCompact ? undefined : 'auto' }}>
                    {summary.waiting_on_you.map(item => (
                      <WaitingOnYouCard
                        key={item.id}
                        item={item}
                        managerMode={viewerRole === 'Manager'}
                        onClick={() => openWaitingOnYouItem(item)}
                      />
                    ))}
                  </div>
                )}
              </ShowcaseCard>
            </div>

            {/* ── Row 1 · Recruitment Overview ── */}
            <div style={cellStyle(4, 220)}>
              <ShowcaseCard
                fillHeight={viewerRole === 'Manager' || (!isCompact && viewerRole !== 'Manager')}
                icon={<UserPlus size={15} style={{ color: '#F97316' }} />}
                title="Recruitment Overview"
                actions={<LinkAction label="To Recruitment Page →" onClick={() => router.push(`${basePath}/recruitment`)} />}
              >
                {!summary ? (
                  <EmptyRow text={dashboardLoading ? 'Loading…' : 'No data yet'} />
                ) : summary.recruitment_overview.deadline_today.length === 0 && summary.recruitment_overview.starting_soon.length === 0 ? (
                  <div className={managerContentClass}><EmptyRow text="No recruitment activity to review" /></div>
                ) : (
                  <div className={managerContentClass} style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: 16, alignItems: 'stretch' }}>
                    <StatActionCard
                      count={summary.recruitment_overview.deadline_today.length}
                      label="Applications Close Today"
                      sub="Postings stop taking applicants"
                      icon={<ClipboardList size={26} />}
                      accent="#DC2626"
                      accentBg="#FEF2F2"
                      compact={viewerRole === 'Manager'}
                      disableDoneClick={viewerRole === 'Manager'}
                      onClick={() => {
                        const ids = summary.recruitment_overview.deadline_today.map(r => r.job_id)
                        router.push(ids.length > 0 ? `${basePath}/recruitment?highlight=${ids.join(',')}` : `${basePath}/recruitment`)
                      }}
                    />
                    <StatActionCard
                      count={summary.recruitment_overview.starting_soon.length}
                      label="Job Starting Soon"
                      sub="Understaffed, starts within 2 days"
                      icon={<Hourglass size={26} />}
                      accent="#D97706"
                      accentBg="#FFF7ED"
                      compact={viewerRole === 'Manager'}
                      disableDoneClick={viewerRole === 'Manager'}
                      onClick={() => {
                        const ids = summary.recruitment_overview.starting_soon.map(r => r.job_id)
                        router.push(ids.length > 0 ? `${basePath}/recruitment?highlight=${ids.join(',')}` : `${basePath}/recruitment`)
                      }}
                    />
                  </div>
                )}
              </ShowcaseCard>
            </div>

            {/* ── Row 2 · Task Overview ── */}
            <div style={cellStyle(4, 290)}>
              <ShowcaseCard
                fillHeight={!isCompact}
                icon={<CheckSquare size={15} style={{ color: '#F97316' }} />}
                title={viewerRole === 'Manager' ? 'Team Task Overview' : 'Task Overview'}
                actions={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {viewerRole !== 'Manager' && <HeaderSearchInput value={taskSearch} onChange={setTaskSearch} width={140} />}
                    <LinkAction label="To Task Page →" onClick={() => router.push(`${basePath}/tasks`)} />
                  </div>
                }
              >
                {!summary ? (
                  <EmptyRow text={dashboardLoading ? 'Loading…' : 'No data yet'} />
                ) : taskCount === 0 ? (
                  <div className={managerContentClass}><EmptyRow text="Nothing overdue, at risk, or due today" /></div>
                ) : visibleTaskGroups.length === 0 ? (
                  <div className={managerContentClass}><EmptyRow text="No tasks match your search" /></div>
                ) : (
                  /* Pair rows: stat card → colored arrow → detail panel (its "View all" link sits
                     BELOW the panel). Rows share the block's full height equally; a group with
                     many tasks scrolls inside its own panel instead of stretching the page. */
                  <div className={managerContentClass} style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                    {visibleTaskGroups.map(group => (
                      <div key={group.key} style={{ display: 'flex', alignItems: 'stretch', flex: 1, minHeight: viewerRole === 'Manager' ? 218 : 250 }}>
                        <div style={{ width: 176, flexShrink: 0 }}>
                          <TaskStatCard group={group} hideSub={viewerRole === 'Manager'} />
                        </div>
                        <div style={{ width: 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{
                            width: 26, height: 26, borderRadius: 999, background: TASK_GROUP_META[group.key].color, color: '#FFFFFF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(15,23,42,0.22)',
                          }}>
                            <ArrowRight size={14} />
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                          <TaskGroupSection group={group} onOpenTask={() => openTaskOverviewGroup(group.key)} managerStyle={viewerRole === 'Manager'} />
                          {viewerRole !== 'Manager' && (
                            <button
                              onClick={() => openTaskOverviewGroup(group.key)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0 0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                fontSize: 12.5, fontWeight: 700, color: TASK_GROUP_META[group.key].color, flexShrink: 0,
                              }}
                            >
                              {TASK_GROUP_META[group.key].viewAll} <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ShowcaseCard>
            </div>

            {/* ── Row 2 · Attendance Overview (Manager clock + team progress) ── */}
            <div style={cellStyle(viewerRole === 'Manager' ? 5 : 8, 360)}>
              <div style={{
                flex: isCompact ? undefined : 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column',
                background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <div style={{ minHeight: 78, padding: '20px 24px 14px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={15} style={{ color: '#F97316' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.2px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Attendance Overview</p>
                  </div>
                  <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
                    {viewerRole !== 'Manager' && <HeaderSearchInput value={attendanceSearch} onChange={setAttendanceSearch} />}
                    {/* Attendance is folded into the Shifts page for Manager — no standalone Attendance page to link to. */}
                    <LinkAction label="Go to Attendance Page →" onClick={() => router.push(viewerRole === 'Manager' ? `${basePath}/shifts` : `${basePath}/attendance`)} />
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #E5E7EB', flexShrink: 0 }} />
                <div style={{ flex: 1, minHeight: 0, padding: '18px 20px 16px', overflowY: 'auto' }}>
                  {!summary ? (
                    <EmptyRow text={dashboardLoading ? 'Loading…' : 'No data yet'} />
                  ) : (
                    <div className={managerContentClass} style={{ display: 'flex', flexDirection: viewerRole === 'Manager' || isCompact ? 'column' : 'row', gap: viewerRole === 'Manager' ? 16 : 32, alignItems: 'stretch', minHeight: viewerRole === 'Manager' ? undefined : '100%' }}>
                      <AttendanceHalf
                        title={viewerRole === 'Manager' ? 'Internal Attendance Progress' : 'Internal Attendance'}
                        accent="#2563EB"
                        accentBg="#EFF6FF"
                        group={summary.attendance_overview.internal}
                        search={viewerRole === 'Manager' ? '' : attendanceSearch}
                        onOpenDetails={viewerRole === 'Manager' ? () => router.push(`${basePath}/shifts`) : undefined}
                        flatProgressHeader={viewerRole === 'Manager'}
                        showDepartmentBreakdown={viewerRole !== 'Manager'}
                      />
                      {(viewerRole !== 'Manager' || summary.attendance_overview.casual.expected > 0) && (
                        <AttendanceHalf
                          title={viewerRole === 'Manager' ? 'Casual Worker Attendance Progress' : 'Casual Worker Attendance'}
                          accent="#16A34A"
                          accentBg="#F0FDF4"
                          group={summary.attendance_overview.casual}
                          search={viewerRole === 'Manager' ? '' : attendanceSearch}
                          onOpenDetails={viewerRole === 'Manager' ? () => router.push(`${basePath}/shifts`) : undefined}
                          flatProgressHeader={viewerRole === 'Manager'}
                          showDepartmentBreakdown={viewerRole !== 'Manager'}
                          personColumnLabel="Casual Worker"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {viewerRole === 'Manager' && (
              <div style={cellStyle(3, 430)}>
                <TeamOverviewBlock
                  summary={summary}
                  loading={dashboardLoading}
                  teamDetails={managerTeamDetails}
                  detailsLoading={managerInitialLoading || managerTeamLoading}
                  onMemberClick={setTeamProfileMember}
                />
              </div>
            )}

          </div>
        </div>
      </main>
      {teamProfileMember && (
        <ManagerTeamProfileModal member={teamProfileMember} onClose={() => setTeamProfileMember(null)} />
      )}
    </div>
  )
}


