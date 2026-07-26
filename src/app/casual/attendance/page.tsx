'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Briefcase, Building2, CalendarDays, ChevronLeft, ChevronRight, Clock, Coffee,
  DollarSign, FileText, History, Mail, Phone, UserCheck, UserRound, Wallet, X,
} from 'lucide-react'
import { TitledBlock } from '@/components/panel'
import { JobDetailPanel, JobView } from '@/components/jobs/JobPresentation'
import RoleAvatar from '@/components/RoleAvatar'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'

type HistoryEntry = {
  id: string
  title: string | null
  job_posting_id: string | null
  company_name: string | null
  location: string | null
  supervisor_name: string | null
  supervisor_phone: string | null
  supervisor_email: string | null
  supervisor_photo_url: string | null
  poster_name: string | null
  poster_role: string | null
  poster_phone: string | null
  poster_email: string | null
  poster_photo_url: string | null
  is_open_ended: boolean
  shift_date: string
  start_time: string
  end_time: string
  status: 'working' | 'completed'
  clock_in_time: string | null
  clock_out_time: string | null
  break_in_time: string | null
  break_out_time: string | null
  hours: number | null
  hourly_rate: number | null
  flat_rate: number | null
  pay: number | null
  notes: string | null
  completed_tasks: string[]
}

// Windowed page numbers ("1 … 4 5 6 … 9") so the pagination row never overflows the block.
function pageItems(current: number, total: number): (number | '…')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const items: (number | '…')[] = [1]
  const lo = Math.max(2, current - 1)
  const hi = Math.min(total - 1, current + 1)
  if (lo > 2) items.push('…')
  for (let p = lo; p <= hi; p++) items.push(p)
  if (hi < total - 1) items.push('…')
  items.push(total)
  return items
}

function formatDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

// Shift times are stored UTC-nominal on purpose — format the raw HH:MM, never via Date.
function formatShiftTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

// Clock times are stored raw in the DB; every attendance display snaps them to the nearest
// 5-minute slot (same convention as the Owner Attendance page's isoToAmPm/fmtTime).
const FIVE_MINUTES_MS = 5 * 60000

function roundToFiveMinutes(iso: string): Date {
  return new Date(Math.round(new Date(iso).getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS)
}

function formatClockTime(value: string | null) {
  if (!value) return '–'
  return roundToFiveMinutes(value).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
}

const pageKeyframes = `
  @keyframes attendanceFadeSlideUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes attendanceFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes attendanceLiveDotPulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.35; transform: scale(0.7) } }
  @keyframes attendanceSpin { to { transform: rotate(360deg) } }
  .attendance-page-btn { transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease; }
  .attendance-page-btn:not(:disabled):hover { background: #FFF7ED; color: #EA580C; }
  .attendance-page-btn:not(:disabled):active { transform: scale(0.92); }
`

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', animation: 'attendanceSpin 0.7s linear infinite' }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(249,115,22,0.2)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// Small pulsing dot next to "Working" badges — signals the shift is still live/ongoing.
function LiveDot() {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EA580C', display: 'inline-block', animation: 'attendanceLiveDotPulse 1.4s ease-in-out infinite' }} />
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Compact month-picker popover — trigger button (shows "All Months" or the selected "Mon YYYY")
// + year-stepped 3x4 month grid, with a clear ("x") affordance once a month is picked. Filters
// Total Earned's Jobs/Pay and the Records list to that calendar month; null = show everything.
// Portaled to document.body (same pattern as DatePickerField) — a plain position:absolute child
// gets trapped behind later sibling blocks whenever an ancestor's own animation/transform
// promotes it to a stacking context (this page's TitledBlocks all animate in on mount).
function MonthPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => (value ? Number(value.slice(0, 4)) : new Date().getFullYear()))
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || popoverRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const label = value ? `${MONTH_NAMES[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}` : 'All Months'
  const POPOVER_WIDTH = 224

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 8) })
      setViewYear(value ? Number(value.slice(0, 4)) : new Date().getFullYear())
    }
    setOpen(o => !o)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700,
          color: value ? '#EA580C' : '#374151', background: value ? '#FFF7ED' : '#FFFFFF',
          border: `1.5px solid ${value ? '#FDBA74' : '#E5E7EB'}`, borderRadius: 8, padding: '6px 10px 6px 8px',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <CalendarDays size={13} /> {label}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Clear month filter"
          style={{
            position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%',
            background: '#DC2626', color: '#FFFFFF', border: '1.5px solid #FFFFFF', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
          }}
        >
          <X size={9} strokeWidth={3} />
        </button>
      )}
      {open && mounted && createPortal(
        <div ref={popoverRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999, width: POPOVER_WIDTH,
          background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 12,
          boxShadow: '0 16px 48px rgba(15,23,42,0.14), 0 2px 8px rgba(0,0,0,0.06)', padding: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={() => setViewYear(y => y - 1)}
              style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#111827' }}>{viewYear}</span>
            <button type="button" onClick={() => setViewYear(y => y + 1)}
              style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {MONTH_NAMES.map((m, i) => {
              const key = `${viewYear}-${String(i + 1).padStart(2, '0')}`
              const active = value === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { onChange(key); setOpen(false) }}
                  style={{
                    padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${active ? '#F97316' : '#E5E7EB'}`,
                    background: active ? '#FFF7ED' : '#FFFFFF',
                    color: active ? '#EA580C' : '#374151', fontSize: '0.78rem', fontWeight: 700,
                  }}
                >
                  {m}
                </button>
              )
            })}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              style={{ marginTop: 10, width: '100%', padding: '7px 0', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#6B7280', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Clear Filter
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

export default function CasualAttendancePage() {
  const router = useRouter()
  const isCompact = useIsCompactViewport(1300)
  // True phone width (isPhone implies isCompact, 640 < 1300). On phone the always-both-panels
  // split becomes a two-level list -> detail navigation instead, and the page itself scrolls.
  const isPhone = useIsCompactViewport(640)
  const [phoneView, setPhoneView] = useState<'list' | 'detail'>('list')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  // null = no filter (every record). 'YYYY-MM' scopes Total Earned's Jobs/Pay and the Records
  // list to that calendar month, cleared via the MonthPicker's own "x"/Clear Filter affordance.
  const [monthFilter, setMonthFilter] = useState<string | null>(null)
  // Records per page is derived from the list's real height so the cards always fill the block
  // exactly — no dead space under the last card, no internal scrolling.
  const [pageSize, setPageSize] = useState(8)
  const listRef = useRef<HTMLDivElement | null>(null)
  // Full posting detail for the selected record's Job Detail block — same inline JobDetailPanel
  // the Dashboard shows for a not-yet-started job. Re-fetched per selection, cleared immediately
  // on change so a previous record's posting never flashes under the newly selected one.
  const [detailJob, setDetailJob] = useState<JobView | null>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const GAP = 10
    const compute = () => {
      const card = el.firstElementChild as HTMLElement | null
      const cardHeight = card ? card.offsetHeight : 100
      setPageSize(Math.max(1, Math.floor((el.clientHeight + GAP) / (cardHeight + GAP))))
    }
    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading, history.length])

  const [authId, setAuthId] = useState('')

  const loadHistory = async (uid: string) => {
    const res = await fetch(`/api/casual/attendance?resource=history&user_id=${uid}`)
    const data = await res.json()
    if (data.success) {
      setHistory(data.history)
      if (data.history.length > 0) setSelectedId(prev => prev ?? data.history[0].id)
    }
    setLoading(false)
  }

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    if (!uid) {
      router.replace('/signin')
      return
    }
    setAuthId(uid)
    void loadHistory(uid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Live-updates the record list when a clock-in/out is recorded or an Owner/Manager edits a
  // clock time, matching the Manager/Employee attendance pages' realtime behavior.
  useResourceInvalidation(['attendance'], () => { if (authId) void loadHistory(authId) })

  const filteredHistory = monthFilter ? history.filter(e => e.shift_date.slice(0, 7) === monthFilter) : history

  const selected = filteredHistory.find(e => e.id === selectedId) ?? null

  useEffect(() => {
    setDetailJob(null)
    if (!selected?.job_posting_id) return
    let stale = false
    ;(async () => {
      const res = await fetch(`/api/recruitment?resource=job_posting&job_id=${selected.job_posting_id}`)
      const data = await res.json()
      if (!stale && data.success) setDetailJob(data.posting as JobView)
    })()
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.job_posting_id])

  // Changing the month filter can strand the current selection outside the new set (or leave the
  // list showing page 2 of a now-shorter list) — reset both to stay in sync with the new records.
  useEffect(() => {
    setPage(1)
    setSelectedId(filteredHistory.length > 0 ? filteredHistory[0].id : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthFilter])

  const totalEarned = filteredHistory.reduce((sum, e) => sum + (e.pay ?? 0), 0)
  const completedCount = filteredHistory.filter(e => e.status === 'completed').length

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageEntries = filteredHistory.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <main style={isPhone ? { ...pageStyle, height: 'auto', overflow: 'visible', padding: '12px 12px 12px' } : pageStyle}>
      <style>{pageKeyframes}</style>
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
          Attendance
        </h1>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={26} />
        </div>
      ) : history.length === 0 ? (
        <p style={{ margin: 0, color: '#6B7280', fontSize: '0.95rem' }}>No attendance records yet.</p>
      ) : (
        <div style={isPhone
          ? { display: 'flex', gap: 16 }
          : { flex: 1, minHeight: 0, display: 'flex', gap: 16 }}
        >
          {/* ===== Left rail — month earnings + paginated record list. On phone this is the
              whole screen (list view) or hidden entirely (detail view) instead of a fixed side
              column. ===== */}
          {(!isPhone || phoneView === 'list') && (
          <div style={isPhone
            ? { width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }
            : { width: 390, flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <TitledBlock
              icon={<Wallet size={15} color="#F97316" />}
              title="Total Earned"
              headerRight={<MonthPicker value={monthFilter} onChange={setMonthFilter} />}
              containerStyle={{ flexShrink: 0, animation: 'attendanceFadeSlideUp 0.35s ease both' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: 800, color: '#374151', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 999, padding: '6px 14px', whiteSpace: 'nowrap' }}>
                  {completedCount} Jobs
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#9CA3AF' }}>/</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: 800, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, padding: '6px 14px', whiteSpace: 'nowrap' }}>
                  ${totalEarned.toFixed(2)}
                </span>
              </div>
            </TitledBlock>

            <TitledBlock
              icon={<History size={15} color="#F97316" />}
              title="Records"
              containerStyle={isPhone
                ? { display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 320px)', animation: 'attendanceFadeSlideUp 0.35s ease both', animationDelay: '0.05s' }
                : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'attendanceFadeSlideUp 0.35s ease both', animationDelay: '0.05s' }}
              bodyStyle={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div ref={listRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredHistory.length === 0 && (
                <div style={{ padding: '28px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 12 }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#94A3B8' }}>No records for this month.</p>
                </div>
              )}
              {pageEntries.map((entry, i) => {
                const active = entry.id === selectedId
                const hovered = entry.id === hoveredId
                const day = new Date(`${entry.shift_date}T00:00:00`)
                const dateLabel = `${String(day.getDate()).padStart(2, '0')} ${day.toLocaleDateString('en-SG', { month: 'short' })}`
                return (
                  <div
                    key={entry.id}
                    onClick={() => { setSelectedId(entry.id); if (isPhone) setPhoneView('detail') }}
                    onMouseEnter={() => setHoveredId(entry.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      padding: '14px 16px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                      background: active ? '#FFF7ED' : '#FFFFFF',
                      border: `1.5px solid ${active ? '#FDBA74' : hovered ? '#FDBA74' : '#E5E7EB'}`,
                      boxShadow: hovered && !active ? '0 6px 16px rgba(0,0,0,0.07)' : '0 1px 3px rgba(0,0,0,0.04)',
                      transform: hovered && !active ? 'translateY(-1px)' : 'none',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease',
                      animation: 'attendanceFadeIn 0.3s ease both',
                      animationDelay: `${Math.min(i * 0.04, 0.3)}s`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: active ? '#EA580C' : '#111827' }}>
                        {dateLabel}
                      </span>
                      <span style={{ ...(entry.status === 'working' ? workingBadgeStyle : completedBadgeStyle), flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {entry.status === 'working' && <LiveDot />}
                        {entry.status === 'working' ? 'Working' : 'Completed'}
                      </span>
                    </div>
                    <p style={{ margin: '7px 0 0', fontWeight: 700, fontSize: '0.9rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.title || 'Job'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 7 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#111827', whiteSpace: 'nowrap' }}>
                        <Clock size={11} color="#F97316" />
                        {formatClockTime(entry.clock_in_time)} – {formatClockTime(entry.clock_out_time)}
                      </span>
                      {entry.pay !== null && (
                        <span style={{ fontSize: '0.845rem', fontWeight: 800, color: '#111827', flexShrink: 0 }}>
                          ${entry.pay.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>

              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button type="button" className="attendance-page-btn" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1}
                  style={{ ...pageButtonStyle, color: safePage === 1 ? '#D1D5DB' : '#6B7280', cursor: safePage === 1 ? 'default' : 'pointer' }}>
                  <ChevronLeft size={14} />
                </button>
                {pageItems(safePage, totalPages).map((item, i) => item === '…' ? (
                  <span key={`gap-${i}`} style={{ fontSize: '0.78rem', color: '#9CA3AF', padding: '0 2px' }}>…</span>
                ) : (
                  <button key={item} type="button" className="attendance-page-btn" onClick={() => setPage(item)}
                    style={{
                      ...pageButtonStyle,
                      border: item === safePage ? '1.5px solid #F97316' : '1.5px solid transparent',
                      color: item === safePage ? '#EA580C' : '#6B7280',
                      fontWeight: item === safePage ? 800 : 600,
                    }}>
                    {item}
                  </button>
                ))}
                <button type="button" className="attendance-page-btn" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}
                  style={{ ...pageButtonStyle, color: safePage === totalPages ? '#D1D5DB' : '#6B7280', cursor: safePage === totalPages ? 'default' : 'pointer' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
              </div>
            </TitledBlock>
          </div>
          )}

          {/* ===== Right — selected record detail, split into its own independent blocks
              (Job Detail / Supervisor / Attendance Timeline / Payment Summary) the same way the
              Dashboard lays out separate TitledBlocks, instead of one big wrapper card. On phone
              this is a separate screen (reached by tapping a record) with a back button, rather
              than a permanent side column. ===== */}
          {(!isPhone || phoneView === 'detail') && (
          <div style={isPhone
            ? { width: '100%', display: 'flex', flexDirection: 'column' }
            : { flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            {isPhone && (
              <button
                type="button"
                onClick={() => setPhoneView('list')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 12, padding: '6px 10px 6px 6px', border: 'none', background: 'none', color: '#374151', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                <ChevronLeft size={16} /> Records
              </button>
            )}
            {selected ? (
              <RecordDetail key={selected.id} entry={selected} isCompact={isPhone ? true : isCompact} detailJob={detailJob} />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#94A3B8' }}>No records for this month.</p>
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </main>
  )
}

function RecordDetail({ entry, isCompact, detailJob }: {
  entry: HistoryEntry
  isCompact: boolean
  detailJob: JobView | null
}) {
  const rateLabel = entry.flat_rate !== null
    ? `$${entry.flat_rate.toFixed(2)} flat`
    : entry.hourly_rate !== null ? `$${entry.hourly_rate.toFixed(2)} / hour` : '–'
  const breakLabel = entry.break_in_time
    ? `${formatClockTime(entry.break_in_time)} – ${formatClockTime(entry.break_out_time)}`
    : '—'
  // Derived from the same 5-minute-rounded punch times shown above (Clock In/Out, Break Start/
  // End) rather than the raw backend `hours` figure — otherwise the duration shown here wouldn't
  // reconcile with the rounded clock times displayed right next to it.
  const roundedHoursWorked = entry.clock_in_time && entry.clock_out_time
    ? (() => {
        let ms = roundToFiveMinutes(entry.clock_out_time!).getTime() - roundToFiveMinutes(entry.clock_in_time!).getTime()
        if (entry.break_in_time && entry.break_out_time) {
          ms -= roundToFiveMinutes(entry.break_out_time).getTime() - roundToFiveMinutes(entry.break_in_time).getTime()
        }
        return ms > 0 ? ms / 3600000 : 0
      })()
    : null
  const hoursWorkedLabel = roundedHoursWorked !== null
    ? `${Math.floor(roundedHoursWorked)}h ${Math.round((roundedHoursWorked - Math.floor(roundedHoursWorked)) * 60)}m`
    : '–'

  // Same avatar/name/contact-links layout as the Dashboard's Supervisor block contactRow.
  const contactRow = (
    person: { full_name: string; phone_number: string | null; email_address: string | null; profile_photo_url: string | null },
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
        {person.email_address && (
          <a href={`mailto:${person.email_address}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: '#111827', textDecoration: 'none', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Mail size={15} color="#F97316" style={{ flexShrink: 0 }} /> {person.email_address}
          </a>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Row 1 — Job Detail (left) beside Supervisor + Attendance Timeline stacked on the
          right — independent TitledBlocks, same split and same shared component the Dashboard
          uses for a not-yet-started job, instead of one wrapper card. ── */}
      <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: 16, alignItems: 'stretch' }}>
        <div style={{ flex: isCompact ? undefined : 1.2, minWidth: 0 }}>
          <TitledBlock
            icon={<Briefcase size={15} color="#F97316" />}
            title="Job Detail"
            headerRight={
              <span style={{ ...(entry.status === 'working' ? workingBadgeLargeStyle : completedBadgeLargeStyle), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {entry.status === 'working' && <LiveDot />}
                {entry.status === 'working' ? 'Working' : 'Completed'}
              </span>
            }
            containerStyle={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', animation: 'attendanceFadeSlideUp 0.35s ease both' }}
            bodyStyle={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
          >
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
              {entry.title || 'Job'}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.845rem', color: '#4B5563', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={14} color="#6B7280" /> {entry.company_name ?? '—'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap', fontSize: '0.845rem', color: '#374151' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CalendarDays size={14} color="#F97316" /> {formatDate(entry.shift_date)}
              </span>
              <span style={{ width: 1, height: 15, background: '#E5E7EB' }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#F97316" />
                {formatShiftTime(entry.start_time)}{entry.is_open_ended ? ' — until done' : ` – ${formatShiftTime(entry.end_time)}`}
              </span>
            </div>
            {entry.job_posting_id ? (
              <div style={{ marginTop: 16, borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
                {detailJob
                  ? <JobDetailPanel
                      job={{ ...detailJob, shift_date: entry.shift_date, shift_start_time: entry.start_time, shift_end_time: entry.end_time }}
                      variant="inline"
                    />
                  : <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6B7280' }}>Loading job details…</p>}
              </div>
            ) : (
              <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 14 }}>
                <DetailRow icon={<CalendarDays size={15} color="#F97316" />} label="Job Type" value={entry.is_open_ended ? 'One-off Job' : 'Shift Job'} />
                <DetailRow icon={<DollarSign size={15} color="#F97316" />} label="Rate" value={rateLabel} />
                <DetailRow icon={<Coffee size={15} color="#F97316" />} label="Break Time" value={breakLabel} />
                <DetailRow icon={<UserRound size={15} color="#F97316" />} label="Supervisor" value={entry.supervisor_name ?? '—'} last />
              </div>
            )}
          </TitledBlock>
        </div>

        <div style={{ flex: isCompact ? undefined : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(entry.supervisor_name || entry.poster_name) && (
            <TitledBlock icon={<UserCheck size={15} color="#F97316" />} title="Supervisor" containerStyle={{ flexShrink: 0, animation: 'attendanceFadeSlideUp 0.35s ease both', animationDelay: '0.06s' }}>
              <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', alignItems: 'stretch', gap: 14 }}>
                {entry.supervisor_name && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {contactRow({ full_name: entry.supervisor_name, phone_number: entry.supervisor_phone, email_address: entry.supervisor_email, profile_photo_url: entry.supervisor_photo_url }, 'Employee', null)}
                  </div>
                )}
                {entry.supervisor_name && entry.poster_name && (
                  <div style={isCompact ? { height: 1, background: '#F3F4F6' } : { width: 1, background: '#F3F4F6' }} />
                )}
                {/* The poster is the fallback contact if the supervisor can't be reached. */}
                {entry.poster_name && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {contactRow({ full_name: entry.poster_name, phone_number: entry.poster_phone, email_address: entry.poster_email, profile_photo_url: entry.poster_photo_url }, entry.poster_role ?? 'Employee', 'Backup Contact')}
                  </div>
                )}
              </div>
            </TitledBlock>
          )}

          <TitledBlock
            icon={<Clock size={15} color="#F97316" />}
            title="Attendance Timeline"
            containerStyle={{ flexShrink: 0, boxSizing: 'border-box', animation: 'attendanceFadeSlideUp 0.35s ease both', animationDelay: '0.12s' }}
          >
            <div style={{ position: 'relative', paddingLeft: 18 }}>
              <div style={{ position: 'absolute', left: 3, top: 18, bottom: 18, width: 2, background: '#E5E7EB', borderRadius: 1 }} />
              <TimelineRow icon={<Clock size={16} color="#16A34A" />} iconBg="#DCFCE7" label="Clock In" time={formatClockTime(entry.clock_in_time)} delay={0} />
              <TimelineRow icon={<Coffee size={16} color="#EA580C" />} iconBg="#FFEDD5" label="Break Start" time={formatClockTime(entry.break_in_time)} delay={0.05} />
              <TimelineRow icon={<Coffee size={16} color="#2563EB" />} iconBg="#DBEAFE" label="Break End" time={formatClockTime(entry.break_out_time)} delay={0.1} />
              <TimelineRow icon={<Clock size={16} color="#DC2626" />} iconBg="#FEE2E2" label="Clock Out" time={formatClockTime(entry.clock_out_time)} delay={0.15} last />
            </div>
          </TitledBlock>

          {/* ── Payment Summary — stacked below Attendance Timeline, same width as the rest of
              this right column. ── */}
          <TitledBlock icon={<Wallet size={15} color="#F97316" />} title="Payment Summary" containerStyle={{ flexShrink: 0, animation: 'attendanceFadeSlideUp 0.35s ease both', animationDelay: '0.18s' }}>
            <div style={{ position: 'relative', paddingLeft: 18 }}>
              <div style={{ position: 'absolute', left: 3, top: 18, bottom: 18, width: 2, background: '#E5E7EB', borderRadius: 1 }} />
              <TimelineRow icon={<DollarSign size={16} color="#EA580C" />} iconBg="#FFEDD5" label={entry.flat_rate !== null ? 'Flat Rate' : 'Hourly Rate'} time={rateLabel} delay={0} />
              <TimelineRow icon={<Clock size={16} color="#2563EB" />} iconBg="#DBEAFE" label="Hours Worked" time={hoursWorkedLabel} delay={0.05} />
              <TimelineRow icon={<Coffee size={16} color="#EA580C" />} iconBg="#FFEDD5" label="Break Time" time={breakLabel} delay={0.1} />
              <TimelineRow icon={<Wallet size={16} color="#16A34A" />} iconBg="#DCFCE7" label="Total Earnings" time={entry.pay !== null ? `$${entry.pay.toFixed(2)}` : '–'} delay={0.15} last />
            </div>
          </TitledBlock>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ icon, label, value, last = false }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: last ? 'none' : '1px solid #F3F4F6' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: '0.845rem', fontWeight: 600, color: '#374151', flexShrink: 0 }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: '0.845rem', fontWeight: 700, color: '#111827', textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function TimelineRow({ icon, iconBg, label, time, last = false, delay = 0 }: {
  icon: React.ReactNode
  iconBg: string
  label: string
  time: string
  last?: boolean
  delay?: number
}) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: last ? 'none' : '1px solid #F3F4F6', animation: 'attendanceFadeSlideUp 0.3s ease both', animationDelay: `${delay}s` }}>
      <span style={{ position: 'absolute', left: -18, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB' }} />
      <div style={{ width: 38, height: 38, borderRadius: 11, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 400, color: '#111827' }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 400, color: '#111827', flexShrink: 0 }}>{time}</span>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  height: '100vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  padding: '20px 28px 20px',
  boxSizing: 'border-box',
}

const pageButtonStyle: React.CSSProperties = {
  minWidth: 28,
  height: 28,
  padding: '0 6px',
  borderRadius: 8,
  border: '1.5px solid transparent',
  background: 'transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#6B7280',
  cursor: 'pointer',
}

const badgeBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '0.68rem',
  fontWeight: 700,
  borderRadius: 999,
  padding: '3px 9px',
  whiteSpace: 'nowrap',
}

const workingBadgeStyle: React.CSSProperties = {
  ...badgeBaseStyle,
  color: '#C2410C',
  background: '#FFF7ED',
  border: '1px solid #FED7AA',
}

const completedBadgeStyle: React.CSSProperties = {
  ...badgeBaseStyle,
  color: '#15803D',
  background: '#F0FDF4',
  border: '1px solid #BBF7D0',
}

const workingBadgeLargeStyle: React.CSSProperties = {
  ...workingBadgeStyle,
  fontSize: '0.8rem',
  padding: '6px 14px',
}

const completedBadgeLargeStyle: React.CSSProperties = {
  ...completedBadgeStyle,
  fontSize: '0.8rem',
  padding: '6px 14px',
}

