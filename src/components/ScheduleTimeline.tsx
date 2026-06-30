'use client'

// Shared Schedule timeline widget — used by Owner Dashboard ("Schedule") and Owner Attendance
// ("Today's Attendance"). One UI, one set of behaviors (view modes, time window, drill-down,
// department legend); callers only vary companyId / date range / title per CLAUDE.md section 2.

import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays, Check, ChevronLeft, MoreHorizontal, SlidersHorizontal, UserCog, UserRound,
} from 'lucide-react'
import Spinner from '@/components/Spinner'
import { deptColor } from '@/lib/deptColor'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
}

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

function roleRank(role: string): number {
  if (role === 'Manager') return 0
  if (role === 'Employee') return 1
  return 2
}

function sortRowsByRole(rows: TimelineRow[]): TimelineRow[] {
  return [...rows].sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name))
}

function DeptCard({ deptId, deptName, rows, onClick }: {
  deptId: string; deptName: string; rows: TimelineRow[]; onClick: () => void
}) {
  const color = deptColor(deptId)
  const managerCount = rows.filter(row => row.role === 'Manager').length
  const employeeCount = rows.filter(row => row.role !== 'Manager').length

  return (
    <article
      data-testid="dept-timeline-card"
      onClick={onClick}
      className="dept-card"
      style={{
        position: 'relative',
        padding: '12px 12px 12px 15px',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.11)'
        e.currentTarget.style.borderColor = color
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = '#E2E8F0'
      }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: '12px 0 0 12px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0, display: 'inline-block' }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.15px' }}>{deptName}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
            <UserCog size={13} />
          </span>
          <span style={{ color: '#111827', fontSize: 13, fontWeight: 700 }}>{managerCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', flexShrink: 0 }}>
            <UserRound size={13} />
          </span>
          <span style={{ color: '#111827', fontSize: 13, fontWeight: 700 }}>{employeeCount}</span>
        </div>
      </div>
    </article>
  )
}

export interface ScheduleTimelineProps {
  companyId: string
  dateFrom: string
  dateTo: string
  title?: string
  headerExtra?: React.ReactNode
  /** Bump this value (e.g. from a realtime subscription) to force a refetch. */
  refreshKey?: number
  /** Fired after every fetch — lets the caller derive its own stats (e.g. dashboard stat cards) without a second fetch. */
  onRowsChange?: (rows: TimelineRow[]) => void
  onLoadingChange?: (loading: boolean) => void
  /** When set (non-null, possibly empty), matching rows are pulled to the top and highlighted; the rest are dimmed. */
  highlightUserIds?: Set<string> | null
}

export default function ScheduleTimeline({
  companyId, dateFrom, dateTo, title = 'Schedule', headerExtra, refreshKey, onRowsChange, onLoadingChange, highlightUserIds,
}: ScheduleTimelineProps) {
  const [timelineRows, setTimelineRows] = useState<TimelineRow[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineView, setTimelineView] = useState<'global' | 'dept'>('global')
  const [timeFrom, setTimeFrom] = useState(7)
  const [timeTo, setTimeTo] = useState(23)
  const [isAutoFit, setIsAutoFit] = useState(false)
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)

  const fetchTimeline = useCallback(async (cid: string) => {
    if (!cid) return
    setTimelineLoading(true)
    onLoadingChange?.(true)
    try {
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${dateFrom}&date_to=${dateTo}`)
      const data = await res.json()
      if (data.success) {
        const rows = data.rows ?? []
        setTimelineRows(rows)
        onRowsChange?.(rows)
      }
    } catch {}
    finally {
      setTimelineLoading(false)
      onLoadingChange?.(false)
    }
  }, [dateFrom, dateTo, onRowsChange, onLoadingChange])

  useEffect(() => {
    if (!companyId) return
    const timer = window.setTimeout(() => { void fetchTimeline(companyId) }, 0)
    return () => window.clearTimeout(timer)
  }, [companyId, fetchTimeline, refreshKey])

  const activeRows = timelineRows.filter(r => r.user_id && !['Owner', 'Partner'].includes(r.role) && r.shifts.length > 0)

  const PERSON_COL = 180
  const ROW_H = 58

  const autoFrom = activeRows.length > 0
    ? Math.max(0, Math.floor(Math.min(...activeRows.flatMap(r => r.shifts.map(s => timeToMinutes(s.start_time)))) / 60) - 1)
    : 7
  const autoTo = activeRows.length > 0
    ? Math.min(24, Math.ceil(Math.max(...activeRows.flatMap(r => r.shifts.map(s => timeToMinutes(s.end_time)))) / 60) + 1)
    : 23

  function positionForTime(minutes: number): number {
    const start = timeFrom * 60
    const end = timeTo * 60
    return ((Math.max(start, Math.min(end, minutes)) - start) / Math.max(end - start, 1)) * 100
  }

  const visibleTimelineRows = activeRows.filter(row => {
    const start = timeFrom * 60
    const end = timeTo * 60
    return row.shifts.some(s => timeToMinutes(s.start_time) < end && timeToMinutes(s.end_time) > start)
  })

  const deptGroups: Record<string, { name: string; rows: TimelineRow[] }> = {}
  for (const row of visibleTimelineRows) {
    if (!deptGroups[row.department_id]) deptGroups[row.department_id] = { name: row.department_name, rows: [] }
    deptGroups[row.department_id].rows.push(row)
  }
  for (const group of Object.values(deptGroups)) {
    group.rows = sortRowsByRole(group.rows)
  }

  const deptIds = Object.keys(deptGroups)

  const hourTicks: number[] = []
  for (let h = timeFrom; h <= timeTo; h++) hourTicks.push(h)

  const TIMELINE_PAD_PCT = 4
  function positionForTimeWithPad(minutes: number): number {
    const raw = positionForTime(minutes)
    return TIMELINE_PAD_PCT + (raw / 100) * (100 - TIMELINE_PAD_PCT * 2)
  }

  function renderRow(row: TimelineRow, key: string, options: { stripColor: string; isDeptBoundary: boolean; isHighlighted: boolean; dimmed: boolean }) {
    const segStart = timeFrom * 60
    const segEnd = timeTo * 60
    const EDGE = '2px solid rgba(15,23,42,0.45)'
    const { stripColor, isDeptBoundary, isHighlighted, dimmed } = options
    return (
      <div
        key={key}
        style={{
          display: 'flex', height: ROW_H, borderTop: isDeptBoundary ? EDGE : 'none',
          background: isHighlighted ? '#FFF7ED' : '#FFFFFF',
          opacity: dimmed ? 0.45 : 1,
          transition: 'background 0.15s ease, opacity 0.15s ease',
        }}
      >
        <div style={{ width: 8, flexShrink: 0, background: stripColor, opacity: 0.85 }} />

        <div style={{ width: PERSON_COL, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.profile_photo_url ? 'transparent' : (row.role === 'Manager' ? '#FFF7ED' : '#F3F4F6'), color: row.role === 'Manager' ? '#EA580C' : '#4B5563', borderRadius: 999, overflow: 'hidden' }}>
              {row.profile_photo_url
                ? <img src={row.profile_photo_url} alt={row.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.full_name}
            </span>
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1 }}>
          {hourTicks.map(h => (
            <div
              key={`grid-${h}`}
              style={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: `${positionForTimeWithPad(h * 60)}%`,
                width: 0,
                borderLeft: '1px solid rgba(15,23,42,0.12)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          ))}
          {row.shifts.map((shift: TimelineShiftBlock) => {
            const startMin = timeToMinutes(shift.start_time)
            const endMin = timeToMinutes(shift.end_time)
            if (endMin <= segStart || startMin >= segEnd) return null
            const left = positionForTimeWithPad(startMin)
            const right = positionForTimeWithPad(endMin)
            const width = right - left
            if (width <= 0) return null
            const color = deptColor(row.department_id)
            return (
              <div
                key={shift.id}
                style={{
                  position: 'absolute',
                  top: 10, bottom: 10,
                  left: `${left}%`,
                  width: `${Math.max(width, 1.5)}%`,
                  borderRadius: 999,
                  background: color,
                  border: isHighlighted ? '2px solid #F97316' : 'none',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', padding: '0 10px' }}>
                  {formatShiftHour(shift.start_time)} – {formatShiftHour(shift.end_time)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderTimelineContent(rows: TimelineRow[]) {
    if (rows.length === 0) {
      return (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
          No shifts scheduled today in this range
        </div>
      )
    }

    const EDGE = '2px solid rgba(15,23,42,0.45)'
    const hasHighlight = !!highlightUserIds
    const highlighted = hasHighlight ? rows.filter(row => row.user_id && highlightUserIds!.has(row.user_id)) : []
    const rest = hasHighlight ? rows.filter(row => !(row.user_id && highlightUserIds!.has(row.user_id))) : rows

    const deptOrder: string[] = []
    const deptMap: Record<string, { name: string; color: string; rows: TimelineRow[] }> = {}
    for (const row of rest) {
      if (!deptMap[row.department_id]) {
        deptOrder.push(row.department_id)
        deptMap[row.department_id] = { name: row.department_name, color: deptColor(row.department_id), rows: [] }
      }
      deptMap[row.department_id].rows.push(row)
    }

    return (
      <div style={{ borderRight: EDGE, borderBottom: EDGE }}>
        {highlighted.map((row, rowIdx) => renderRow(row, `hl_${row.user_id}_${rowIdx}`, {
          stripColor: deptColor(row.department_id),
          isDeptBoundary: false,
          isHighlighted: true,
          dimmed: false,
        }))}
        {deptOrder.map((deptId, deptIdx) => {
          const dept = deptMap[deptId]
          return dept.rows.map((row, rowIdx) => renderRow(row, `${row.user_id ?? row.department_id}_${rowIdx}`, {
            stripColor: dept.color,
            isDeptBoundary: (deptIdx > 0 && rowIdx === 0) || (highlighted.length > 0 && deptIdx === 0 && rowIdx === 0),
            isHighlighted: false,
            dimmed: hasHighlight,
          }))
        })}
      </div>
    )
  }

  function renderHourAxis() {
    return (
      <div style={{ display: 'flex', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: '12px 12px 0 0' }}>
        <div style={{ width: 8 + PERSON_COL, flexShrink: 0 }} />
        <div style={{ position: 'relative', height: 36, flex: 1 }}>
          {hourTicks.map((h) => {
            const left = `${positionForTimeWithPad(h * 60)}%`
            return (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  top: 0,
                  left,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                <span style={{
                  display: 'block',
                  marginTop: 9,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.55)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  letterSpacing: '0.02em',
                }}>
                  {formatHourLabel(h)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const selectedDeptRows = selectedDeptId ? (deptGroups[selectedDeptId]?.rows ?? []) : []
  const selectedDeptName = selectedDeptId ? (deptGroups[selectedDeptId]?.name ?? '') : ''

  return (
    <div className="panel-card" style={{ minWidth: 0, padding: '16px 20px', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
      {/* Timeline header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedDeptId ? (
            <>
              <button
                onClick={() => setSelectedDeptId(null)}
                className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                <ChevronLeft size={15} />
                All Departments
              </button>
              <span className="text-gray-200">·</span>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: deptColor(selectedDeptId) }} />
              <span className="text-sm font-semibold text-gray-900">{selectedDeptName}</span>
            </>
          ) : (
            <>
              <CalendarDays className="size-4 text-orange-500" />
              <span className="text-base font-semibold text-gray-900">{title}</span>
              {timelineLoading && <Spinner size={13} dark />}
              {headerExtra}
            </>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid="timeline-menu"
            aria-label="Options"
            className="flex size-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50"
          >
            <MoreHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={10} style={{ width: 300, borderRadius: 16, padding: 16, border: '1px solid #E5E7EB', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
              <SlidersHorizontal size={12} style={{ color: '#F97316' }} />
              Timeline view
            </p>
            <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
              {(['global', 'dept'] as const).map(v => (
                <DropdownMenuItem
                  key={v}
                  onClick={() => setTimelineView(v)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderRadius: 10, padding: '8px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: timelineView === v ? '#FFF7ED' : 'transparent',
                    color: timelineView === v ? '#EA580C' : '#374151',
                  }}
                >
                  <span>{v === 'global' ? 'All departments' : 'By department'}</span>
                  {timelineView === v && <Check size={13} />}
                </DropdownMenuItem>
              ))}
            </div>

            <div style={{ height: 1, background: '#F3F4F6', margin: '0 0 12px 0' }} />

            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>Time window</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {[
                {
                  label: 'Auto-fit',
                  onClick: () => { setTimeFrom(autoFrom); setTimeTo(autoTo); setIsAutoFit(true) },
                  active: isAutoFit,
                },
                {
                  label: 'Full day',
                  onClick: () => { setTimeFrom(0); setTimeTo(24); setIsAutoFit(false) },
                  active: !isAutoFit && timeFrom === 0 && timeTo === 24,
                },
              ].map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={opt.onClick}
                  style={{
                    cursor: 'pointer', borderRadius: 10, border: opt.active ? '1.5px solid #FDBA74' : '1px solid #E5E7EB',
                    background: opt.active ? '#FFF7ED' : '#F9FAFB', padding: '8px 6px', textAlign: 'center',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: opt.active ? '#EA580C' : '#374151' }}>{opt.label}</p>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'From', val: timeFrom, dec: () => { setIsAutoFit(false); setTimeFrom(Math.max(0, timeFrom - 1)) }, inc: () => { setIsAutoFit(false); setTimeFrom(Math.min(timeTo - 1, timeFrom + 1)) } },
                { label: 'To', val: timeTo, dec: () => { setIsAutoFit(false); setTimeTo(Math.max(timeFrom + 1, timeTo - 1)) }, inc: () => { setIsAutoFit(false); setTimeTo(Math.min(24, timeTo + 1)) } },
              ].map(ctrl => (
                <div key={ctrl.label} style={{ borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', padding: '8px 10px' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>{ctrl.label}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <button type="button" onClick={ctrl.dec} aria-label={`Decrease ${ctrl.label}`} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{formatHourLabel(ctrl.val)}</span>
                    <button type="button" onClick={ctrl.inc} aria-label={`Increase ${ctrl.label}`} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Department card grid (default — no drill-down) */}
      {!selectedDeptId && (
        <>
          {timelineLoading ? (
            <div className="py-10 flex justify-center"><Spinner size={20} dark /></div>
          ) : deptIds.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
              <CalendarDays size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No shifts scheduled today</p>
            </div>
          ) : timelineView === 'dept' ? (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
              {deptIds.map(deptId => (
                <DeptCard
                  key={deptId}
                  deptId={deptId}
                  deptName={deptGroups[deptId].name}
                  rows={deptGroups[deptId].rows}
                  onClick={() => setSelectedDeptId(deptId)}
                />
              ))}
            </div>
          ) : (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
              {renderHourAxis()}
              {renderTimelineContent(visibleTimelineRows)}
            </div>
          )}
        </>
      )}

      {/* Drill-down: single department timeline */}
      {selectedDeptId && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
          {renderHourAxis()}
          {renderTimelineContent(selectedDeptRows)}
        </div>
      )}

      {/* Department legend — only in all-departments view */}
      {!timelineLoading && deptIds.length > 0 && timelineView === 'global' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginRight: 4, flexShrink: 0 }}>Departments</span>
          {deptIds.map(deptId => {
            const color = deptColor(deptId)
            const name = deptGroups[deptId]?.name ?? deptId
            const count = deptGroups[deptId]?.rows?.length ?? 0
            return (
              <div key={deptId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '4px 10px 4px 6px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>{count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
