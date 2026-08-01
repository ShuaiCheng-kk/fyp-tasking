'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  AlertTriangle, Briefcase, Building2, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, DollarSign, Download,
  HardHat, Info, Minus, TrendingDown, TrendingUp, UserCheck, Users,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Rectangle,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Sector,
} from 'recharts'
import DatePickerField from '@/components/DatePickerField'
import RoleAvatar from '@/components/RoleAvatar'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import { deptColor, setDeptColorOverrides } from '@/lib/deptColor'
import { useRealtimeNotifications } from '@/components/realtime/RealtimeNotificationsProvider'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { ShowcaseCard } from '@/components/panel'
import { ModalOverlay, ModalBox, ModalHeader, modalLabelStyle } from '@/components/modal'
import { AIAnomaly } from '@/types/AI'
import { CompanyReport } from '@/types/Report'

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const todayDate = new Date()
const yesterday = new Date(todayDate)
yesterday.setDate(todayDate.getDate() - 1)
const weekStart = new Date(yesterday)
weekStart.setDate(yesterday.getDate() - 6)
const YESTERDAY = isoDate(yesterday)
const DEFAULT_FROM = isoDate(weekStart)

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// Matches DashboardView's EmptyRow — the shared "nothing to show" treatment for a panel body
// (soft filled box + centered muted text), so an empty Report block reads the same as an empty
// Dashboard block instead of floating unstyled text.
function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '20px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>
      {text}
    </div>
  )
}

// ─── Trend (vs. previous period of the same length) ────────────────────────────

function TrendTag({ current, previous, format, judged, invert }: {
  current: number | null
  previous: number | null
  format: 'percent' | 'money' | 'days'
  // true = a direction reads as an improvement (attendance / on-time / fill rate).
  // false = neither direction is inherently good or bad (labor cost) — shown in neutral gray.
  judged: boolean
  // true = a DECREASE is the improvement (e.g. Average Time to Fill — fewer days is better).
  invert?: boolean
}) {
  if (current === null || previous === null) return null
  const delta = format === 'percent' ? current - previous : Math.round((current - previous) * 100) / 100
  const magnitude = format === 'money' ? `$${Math.abs(delta).toLocaleString()}`
    : format === 'days' ? `${Math.abs(delta).toFixed(1)} Days`
    : `${Math.abs(delta)}%`
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const improved = invert ? delta < 0 : delta > 0
  const color = !judged || delta === 0 ? '#94A3B8' : improved ? '#059669' : '#DC2626'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 16, fontWeight: 800, color, flexShrink: 0 }}>
      <Icon size={16} /> {magnitude}
    </span>
  )
}

// ─── Overview rate card ─────────────────────────────────────────────────────────

function RateCard({
  label, value, previous, format, judged, invert, icon, accentBg, accentColor, loading, breakdown, onClick, active,
}: {
  label: string
  value: number | null
  previous: number | null
  format: 'percent' | 'money' | 'count' | 'days'
  judged: boolean
  invert?: boolean
  icon: React.ReactNode
  accentBg: string
  accentColor: string
  loading?: boolean
  // Optional full split of `value`'s denominator (e.g. On-time / Late / Absent), shown side by
  // side in place of the main number when the card is clicked; color matches the attendance badges.
  breakdown?: Array<{ label: string; value: number | null; color: string }>
  // Clicking the card highlights its matching chart block below (Internal Analytics grid).
  onClick?: () => void
  active?: boolean
}) {
  const display = value === null
    ? 'No data'
    : format === 'percent' ? `${value}%`
    : format === 'money' ? `$${Math.round(value).toLocaleString()}`
    : format === 'days' ? `${value.toFixed(1)} Days`
    : value.toLocaleString()
  const hasBreakdown = !loading && !!breakdown && breakdown.some(b => b.value !== null)
  return (
    <article
      className="report-stat-card"
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '18px 18px 22px',
        boxShadow: active
          ? '0 8px 24px rgba(249,115,22,0.16), 0 0 0 2px #F97316'
          : '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)',
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{label}</p>
        <div className="stat-icon" style={{ width: 32, height: 32, borderRadius: 10, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accentColor }}>
          {icon}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {hasBreakdown ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {breakdown!.map((b, i) => (
              <Fragment key={b.label}>
                {i > 0 && <span style={{ width: 1, alignSelf: 'stretch', background: '#E5E7EB', flexShrink: 0 }} />}
                <p style={{ fontSize: 26, fontWeight: 800, color: b.value === null ? '#CBD5E1' : b.color, lineHeight: 1, margin: 0, letterSpacing: '-0.5px' }}>
                  {b.value === null ? '—' : `${b.value}%`}
                </p>
              </Fragment>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 26, fontWeight: 800, color: value === null ? '#CBD5E1' : '#0F172A', lineHeight: 1, margin: 0, letterSpacing: '-0.5px' }}>
            {loading ? <Spinner size={14} dark /> : display}
          </p>
        )}
        {!loading && format !== 'count' && (
          <TrendTag current={value} previous={previous} format={format} judged={judged} invert={invert} />
        )}
      </div>
    </article>
  )
}

function actionBtn(bg: string, disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    padding: '0 14px',
    border: 'none',
    borderRadius: 8,
    background: disabled ? '#E5E7EB' : bg,
    color: disabled ? '#9CA3AF' : '#FFFFFF',
    fontWeight: 600,
    fontSize: '0.8125rem',
    cursor: disabled ? 'default' : 'pointer',
    flexShrink: 0,
    transition: 'background 0.12s',
  }
}

function thStyle(align: 'left' | 'center'): React.CSSProperties {
  return { padding: '10px 12px', textAlign: align, fontSize: '0.66rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }
}

function tdStyle(align: 'left' | 'center'): React.CSSProperties {
  return { padding: '11px 12px', fontSize: '0.8125rem', color: '#4A5568', textAlign: align, borderBottom: '1px solid #F0F4F8', fontWeight: 500, whiteSpace: 'nowrap' }
}

function RateBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span style={{ fontSize: 11, fontWeight: 600, color: '#CBD5E1' }}>No data</span>
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#F1F5F9', color: '#334155' }}>
      {value}%
    </span>
  )
}

function money(v: number): string {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

// Hover "pop out" pie slice — grows the sector's own outer radius (never shifts its center),
// so the cursor never drifts outside the shape mid-hover (which is what caused the flicker/
// delay: offsetting cx/cy moves the wedge out from under the mouse, so the browser keeps
// losing and re-firing mouseover). Growing in place keeps the mouse inside the hit area at
// every step, and the `transition` on the path lets the browser animate the `d` attribute
// smoothly instead of snapping.
function renderPulledOutSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius} outerRadius={outerRadius + 10}
      startAngle={startAngle} endAngle={endAngle}
      fill={fill}
      style={{ transition: 'all 0.2s ease-out' }}
    />
  )
}

// Passed as a ShowcaseCard `icon` (which takes any ReactNode, so the shared panel primitive stays
// untouched). It replaces each analytics block's decorative glyph: the icon carried no meaning, so
// it earns its place by explaining what the chart below actually answers, on hover. Deliberately a
// hover affordance rather than a caption line under the title — see CLAUDE.md's no-subtitles rule.
const CHART_INFO_BG = '#F3F4F6'
function ChartInfo({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Info size={15} style={{ color: '#6B7280' }} />
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', left: -8, zIndex: 30,
            width: 'max-content', maxWidth: 240, pointerEvents: 'none',
            background: '#FFFFFF', color: '#374151',
            border: '1px solid #E5E7EB', borderRadius: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            padding: '8px 11px', fontSize: 12, fontWeight: 500, lineHeight: 1.5,
            ...CHART_TEXT_STYLE,
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}

interface ReliableWorkerRow {
  user_id: string
  full_name: string
  profile_photo_url: string | null
  worked: number
  on_time_attendance_rate: number | null
  on_time_task_completion_rate: number | null
  avgRate: number
}

const carouselArrowBtn = (disabled: boolean): React.CSSProperties => ({
  width: 26, height: 26, borderRadius: 999, border: 'none',
  cursor: disabled ? 'default' : 'pointer',
  background: disabled ? '#F8FAFC' : '#F1F5F9', color: disabled ? '#CBD5E1' : '#334155',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  transition: 'background 0.15s ease, color 0.15s ease',
})

// The Team page's Casual Worker avatar card (avatar + name), with a small badge pinned to its
// corner — the shared face of both carousels below; only the border tone and badge differ.
// Clicking it opens the same Casual Worker Detail the Team page shows, so it's a real button
// with the hover lift every clickable surface carries (.cw-carousel-card, styled in the page CSS).
function CwWorkerCard({ name, photoUrl, borderColor, badge, badgeStyle, onClick }: {
  name: string
  photoUrl: string | null
  borderColor: string
  badge: React.ReactNode
  badgeStyle: React.CSSProperties
  onClick: () => void
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={onClick} className="cw-carousel-card" style={{
        width: 136, padding: '16px 8px 12px', borderRadius: 8, border: `1.5px solid ${borderColor}`, background: '#FFFFFF',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', cursor: 'pointer',
      }}>
        <RoleAvatar role="Casual Worker" size={84} photoUrl={photoUrl} />
        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px', maxWidth: '100%' }}>
          {name}
        </p>
      </button>
      <span style={{
        position: 'absolute', top: -8, left: -8, width: 24, height: 24, borderRadius: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, pointerEvents: 'none',
        ...badgeStyle,
      }}>{badge}</span>
    </div>
  )
}

// The one shared fact set under BOTH carousel cards — always the same three lines, on the same
// two dimensions the reliability score judges (attendance + tasks), so the reliable view and the
// needing-attention view read as two sides of the same analysis rather than two different reports.
function buildCwFacts(w: { worked: number; on_time_attendance_rate: number | null; on_time_task_completion_rate: number | null }): Array<{ label: string; value: string }> {
  return [
    { label: 'Shifts:', value: `${w.worked}` },
    { label: 'Present:', value: w.on_time_attendance_rate !== null ? `${w.on_time_attendance_rate}%` : 'No data' },
    { label: 'Tasks:', value: w.on_time_task_completion_rate !== null ? `${w.on_time_task_completion_rate}%` : 'No data' },
  ]
}

// Label:value facts under a carousel card, centered as a unit — labels in a fixed track, values
// left-aligned right beside them. Shared by both carousels so their detail lines read identically.
function CwFactsGrid({ facts }: { facts: Array<{ label: string; value: string }> }) {
  return (
    <div style={{ width: 'fit-content', display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 14, rowGap: 10, alignItems: 'center' }}>
      {facts.map(f => (
        <Fragment key={f.label}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{f.label}</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{f.value}</span>
        </Fragment>
      ))}
    </div>
  )
}

// Top Reliable Workers as a one-at-a-time carousel: the current rank's worker card, arrows to
// page through the ranks, and under the card the score plus the numbers it is built from.
// `dir` remembers which arrow was pressed so the incoming card slides in from that side
// (keyed remount replays the animation on every switch).
function ReliableCarousel({ workers, onSelect }: { workers: ReliableWorkerRow[]; onSelect: (userId: string) => void }) {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  // Clamp instead of trusting state — safe even the render right after the list shrinks
  // (e.g. the date range changes), before any effect could reset the index.
  const clamped = Math.min(index, workers.length - 1)
  const w = workers[clamped]
  const facts = buildCwFacts(w)
  // No overflow clipping on the row below, on purpose: CSS forces a non-'visible' overflow-x/-y
  // pair to both become 'auto', which would silently clip the worker card's top (avatar + rank
  // badge) whenever this row's content is taller than its 50% share of the block — the scrollable
  // wrapper in CwPoolBlock handles that instead. The ±26px slide-in only overflows briefly.
  return (
    <div style={{ flex: '1 0 auto', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" aria-label="Previous worker" disabled={clamped === 0} onClick={() => { setDir('prev'); setIndex(clamped - 1) }} style={carouselArrowBtn(clamped === 0)}>
        <ChevronLeft size={15} />
      </button>
      <div key={w.user_id} className={dir === 'next' ? 'cw-slide-from-right' : 'cw-slide-from-left'} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <CwWorkerCard
          name={w.full_name} photoUrl={w.profile_photo_url} borderColor="#86EFAC"
          badge={clamped + 1} badgeStyle={{ background: '#FFFBEB', color: '#B45309', border: '1.5px solid #FDE68A' }}
          onClick={() => onSelect(w.user_id)}
        />
        <span style={{
          borderRadius: 999, padding: '4px 14px', fontSize: 13, fontWeight: 800,
          background: w.avgRate >= 85 ? '#ECFDF5' : w.avgRate >= 70 ? '#FFFBEB' : '#FEF2F2',
          color: w.avgRate >= 85 ? '#15803D' : w.avgRate >= 70 ? '#B45309' : '#B91C1C',
        }}>
          {`Score ${w.avgRate}`}
        </span>
        <CwFactsGrid facts={facts} />
      </div>
      <button type="button" aria-label="Next worker" disabled={clamped === workers.length - 1} onClick={() => { setDir('next'); setIndex(clamped + 1) }} style={carouselArrowBtn(clamped === workers.length - 1)}>
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

// Workers Needing Attention as the same one-at-a-time carousel — red-toned card, and instead of a
// score the plain reason this worker is on the list (their period's issues), over the exact same
// three facts the reliable view shows, so both halves analyse the same dimensions.
function AttentionCarousel({ workers, onSelect }: {
  workers: Array<{
    user_id: string; full_name: string; profile_photo_url: string | null; issues: string[]
    worked: number; on_time_attendance_rate: number | null; on_time_task_completion_rate: number | null
  }>
  onSelect: (userId: string) => void
}) {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const clamped = Math.min(index, workers.length - 1)
  const w = workers[clamped]
  const facts = buildCwFacts(w)
  // No overflow clipping on the row below, on purpose: CSS forces a non-'visible' overflow-x/-y
  // pair to both become 'auto', which would silently clip the worker card's top (avatar + rank
  // badge) whenever this row's content is taller than its 50% share of the block — the scrollable
  // wrapper in CwPoolBlock handles that instead. The ±26px slide-in only overflows briefly.
  return (
    <div style={{ flex: '1 0 auto', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" aria-label="Previous worker" disabled={clamped === 0} onClick={() => { setDir('prev'); setIndex(clamped - 1) }} style={carouselArrowBtn(clamped === 0)}>
        <ChevronLeft size={15} />
      </button>
      <div key={w.user_id} className={dir === 'next' ? 'cw-slide-from-right' : 'cw-slide-from-left'} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <CwWorkerCard
          name={w.full_name} photoUrl={w.profile_photo_url} borderColor="#FCA5A5"
          badge={<AlertTriangle size={12} />} badgeStyle={{ background: '#FEF2F2', color: '#B91C1C', border: '1.5px solid #FECACA' }}
          onClick={() => onSelect(w.user_id)}
        />
        <span style={{ borderRadius: 999, padding: '4px 14px', fontSize: 13, fontWeight: 700, background: '#FEF2F2', color: '#B91C1C', textAlign: 'center' }}>
          {w.issues.join(' · ')}
        </span>
        <CwFactsGrid facts={facts} />
      </div>
      <button type="button" aria-label="Next worker" disabled={clamped === workers.length - 1} onClick={() => { setDir('next'); setIndex(clamped + 1) }} style={carouselArrowBtn(clamped === workers.length - 1)}>
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

// Casual Worker Pool — folded into the Internal grid as ONE block instead of its own tab: the
// pool's data doesn't carry enough distinct signal to earn a full page (Most Requested Workers /
// Task Quality got cut). Both surviving lists stack in the same card — an Owner only ever reads
// the top few reliable names anyway, and the attention list is short by nature, so neither view
// deserves to hide the other behind a toggle. Each list keeps its own section label.
function CwPoolBlock({ loading, topReliable, attention, onSelectWorker, compact }: {
  loading: boolean
  topReliable: ReliableWorkerRow[]
  attention: Array<{
    user_id: string; full_name: string; profile_photo_url: string | null; issues: string[]
    worked: number; on_time_attendance_rate: number | null; on_time_task_completion_rate: number | null
  }>
  onSelectWorker: (userId: string) => void
  // Stacked (compact) layout has no grid rows to span, so the block brings its own height —
  // enough for both carousels' cards + facts at 50/50.
  compact: boolean
}) {
  const sectionLabel: React.CSSProperties = {
    margin: 0, fontSize: 15, fontWeight: 700, color: '#111827',
  }
  return (
    <div style={compact ? { height: 760, display: 'flex' } : { gridRow: '1 / 3', display: 'flex' }}>
      <ShowcaseCard
        className="report-block"
        icon={<ChartInfo text="Who to call first next time you need a casual worker, and who to think twice about" />}
        iconBg={CHART_INFO_BG}
        title="Casual Worker Pool"
        fillHeight
      >
        {loading ? (
          <div style={{ height: '100%', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
        ) : (
          /* Two carousels split the card 50/50 (flex: 1 each), one worker card at a time in each.
             A populated carousel's own content (avatar + name + score + facts) can be taller than
             its 50% share once the grid's row-spanning layout gives this block less height than
             that needs — this wrapper scrolls internally rather than letting the carousel below
             clip the worker card's top edge (was cutting off the avatar/rank badge). */
          <div style={{ height: '100%', minHeight: 220, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <p style={sectionLabel}>Top Reliable Workers</p>
            {topReliable.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><EmptyRow text="No casual worker shifts in this range" /></div>
            ) : (
              <ReliableCarousel workers={topReliable} onSelect={onSelectWorker} />
            )}

            <p style={{ ...sectionLabel, marginTop: 14, paddingTop: 14, borderTop: '1px solid #E5E7EB' }}>Workers Needing Attention</p>
            {attention.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 24 }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={17} />
                </div>
                <span style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>No lateness, no-shows, or cancellations this period</span>
              </div>
            ) : (
              <AttentionCarousel workers={attention} onSelect={onSelectWorker} />
            )}
          </div>
        )}
      </ShowcaseCard>
    </div>
  )
}

interface AttendanceDatum { name: string; rate: number | null; late: number | null; absent: number | null; fill?: string }

// Horizontal-bar equivalent of renderPulledOutSlice: on hover the bar "pops" — grows a touch with
// the same 0.2s ease-out transition as the pie slice — instead of the default translucent grey
// cursor box framing it. Deliberately NO css `filter` (e.g. drop-shadow) here: a filter creates a
// stacking context, which promotes the hovered bar into a later paint phase and makes it jump on
// top of the dashed guides that are supposed to stay in front of every bar.
function renderActiveBar(props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props
  const grow = 4
  return (
    <Rectangle
      x={x} y={y - grow} width={width + grow} height={height + grow * 2}
      radius={[0, 4, 4, 0]} fill={fill}
      style={{ transition: 'all 0.2s ease-out' }}
    />
  )
}

// Vertical-column counterpart of renderActiveBar — pops upward off its baseline on hover. Same
// no-filter rule as renderActiveBar, for the same stacking-context reason.
function renderActiveColumn(props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props
  const grow = 4
  return (
    <Rectangle
      x={x - grow} y={y - grow} width={width + grow * 2} height={height + grow}
      radius={[4, 4, 0, 0]} fill={fill}
      style={{ transition: 'all 0.2s ease-out' }}
    />
  )
}

// Single-value department tooltip (Task Completion / Hiring Success / Time to Fill) — same box +
// typography as the attendance one, department name tinted its own colour, just one number instead
// of a three-way split. Built per value format so every chart reads identically.
function makeDeptValueTooltip(format: (value: number) => string) {
  return function DeptValueTooltip(props: { active?: boolean; payload?: Array<{ payload: { name: string; rate: number; fill?: string } }> }) {
    if (!props.active || !props.payload?.length) return null
    const d = props.payload[0].payload
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E5E7EB', padding: '9px 13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', ...CHART_TEXT_STYLE, fontSize: 13 }}>
        <div style={{ fontWeight: 700, color: d.fill ?? '#111827', marginBottom: 5 }}>{d.name}</div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', color: d.fill ?? '#111827' }}>{format(d.rate)}</div>
      </div>
    )
  }
}
const DeptPercentTooltip = makeDeptValueTooltip(v => `${v}%`)
// Time to Fill is a duration, not a ratio — a raw "3.33 days" reads as false precision, so it's
// rounded to the nearest half day (3 / 3.5 / 4).
const DeptDaysTooltip = makeDeptValueTooltip(v => {
  const days = Math.round(v * 2) / 2
  return `${days} ${days === 1 ? 'day' : 'days'}`
})

// Attendance tooltip — same white rounded box / inherited font as the Casual Worker Cost pie
// tooltip, showing the Present / Late / Absent split per department. The department name is tinted
// its own colour (like the pie tooltip); the three percentages are shown value-only (no words),
// divider-separated, in the SAME green/amber/red as the On-time Attendance Rate KPI card's breakdown.
function AttendanceTooltip(props: { active?: boolean; payload?: Array<{ payload: AttendanceDatum }> }) {
  if (!props.active || !props.payload?.length) return null
  const d = props.payload[0].payload
  const parts: Array<{ value: number | null; color: string }> = [
    { value: d.rate, color: '#15803D' },
    { value: d.late, color: '#A16207' },
    { value: d.absent, color: '#B91C1C' },
  ]
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E5E7EB', padding: '9px 13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', ...CHART_TEXT_STYLE, fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: d.fill ?? '#111827', marginBottom: 7 }}>{d.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        {parts.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <span style={{ width: 1, alignSelf: 'stretch', background: '#E5E7EB', flexShrink: 0 }} />}
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', color: p.value === null ? '#CBD5E1' : p.color }}>
              {p.value === null ? '—' : `${p.value}%`}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// SVG <text> doesn't inherit the page's font the way HTML does unless it's told to explicitly —
// recharts' default label/tooltip text was rendering in the browser's fallback sans-serif instead
// of the app's actual font, which is why it read as mismatched next to the KPI cards. `inherit`
// picks up whatever font-family is already cascading from the page (same one the cards use).
const CHART_TEXT_STYLE: React.CSSProperties = { fontFamily: 'inherit' }

// Custom pie-slice % label — same weight/family as the KPI card numbers, just sized down; keeps
// each label colored to match its own slice (recharts' default behavior) instead of one flat color.
function renderPieSliceLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, fill } = props
  const RADIAN = Math.PI / 180
  const radius = outerRadius + 22
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text
      x={x} y={y} fill={fill}
      textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
      style={{ ...CHART_TEXT_STYLE, fontSize: 15, fontWeight: 700 }}
    >
      {`${Math.round((percent ?? 0) * 100)}%`}
    </text>
  )
}

// ─── Department-level analysis block (horizontal bar chart, single series) ────────
// Shared by Charts 1–4 of the Internal Analytics grid — same chart shape, different
// metric/color/tooltip. `unit` picks the value axis: percent (fixed 0–100 domain) or
// days (auto domain, for Average Time to Fill). `orientation` picks horizontal bars (long
// department names read best left-to-right) vs vertical columns (better for eyeballing
// magnitude across departments) — mixing both across the 4 Internal Analytics charts keeps
// them visually distinct instead of four identical-looking bar charts. Percent-unit charts get
// an 80% target reference line for free (unit === 'percent' implies it); Days charts don't.
function DeptRateBarChart({
  data, loading, emptyMessage, barColor, tooltipSuffix, unit = 'percent', orientation = 'bar', customTooltip, fillHeight,
}: {
  data: Array<{ name: string; rate: number; fill?: string }>
  loading: boolean
  emptyMessage: string
  barColor: string
  tooltipSuffix: string
  unit?: 'percent' | 'days'
  orientation?: 'bar' | 'column'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customTooltip?: (props: any) => React.ReactNode
  // Stretch the plot to the card's full height (Internal Analytics blocks) instead of sizing it to
  // the row count (Casual Worker "by Worker" charts, whose cards grow with their content).
  fillHeight?: boolean
}) {
  if (loading) {
    return <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
  }
  if (data.length === 0) {
    return <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}><EmptyRow text={emptyMessage} /></div>
  }
  // Value scale + dashed guides, shared by both orientations: percent is a fixed 0–100 labelled every
  // 25% with a guide every 10%; days uses a tight domain (largest value + 1 day of headroom) labelled
  // and guided on every whole day. Labels stay sparse, guides are denser, and the final value
  // (100% / max day) gets a guide too. No hard-coded 80% target line — it isn't meaningful here.
  const isDays = unit === 'days'
  const maxVal = data.length ? Math.max(...data.map(d => d.rate)) : 0
  const domainMax = isDays ? Math.floor(maxVal) + 1 : 100
  const labelTicks = isDays
    ? Array.from({ length: domainMax + 1 }, (_, i) => i)
    : [0, 25, 50, 75, 100]
  // Columns get a guide on each labelled tick only (25/50/75/100); the denser every-10%/every-day
  // grid is for the horizontal percent/days charts, whose long bars need the finer reference. Both
  // include the origin so the scale is anchored at its start too.
  const gridValues = orientation === 'column'
    ? labelTicks
    : isDays
      ? Array.from({ length: domainMax + 1 }, (_, i) => i)
      : [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  // CartesianGrid (not ReferenceLine) — it's the chart's background layer, so the guides are always
  // painted behind the bars, on first render and while hovering alike. ReferenceLine renders above
  // the graphical items in recharts 3 (no isFront prop any more), which put the guides in front of
  // the bars until a hover re-layered them. `*Values` places the lines at data values, so the guides
  // can be denser than the labelled ticks.
  const gridNode = orientation === 'column'
    ? <CartesianGrid vertical={false} horizontalValues={gridValues} stroke="#CBD5E1" strokeDasharray="4 4" />
    : <CartesianGrid horizontal={false} verticalValues={gridValues} stroke="#CBD5E1" strokeDasharray="4 4" />
  const tooltipNode = customTooltip
    ? <Tooltip cursor={false} content={customTooltip} />
    : (
      <Tooltip
        cursor={false}
        contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, ...CHART_TEXT_STYLE }}
        itemStyle={{ ...CHART_TEXT_STYLE, fontWeight: 600 }}
        labelStyle={CHART_TEXT_STYLE}
        formatter={v => [`${v}${tooltipSuffix}`, '']}
      />
    )

  if (orientation === 'column') {
    // Department name under each column, one space-separated word per line, centred on the column and
    // dropped clear of the baseline so there's the same air between name and bar as the horizontal
    // charts have between name and bar.
    const renderColumnDeptTick = (props: { x?: number | string; y?: number | string; payload?: { value?: string | number } }) => {
      const x = Number(props.x ?? 0)
      const y = Number(props.y ?? 0)
      const words = String(props.payload?.value ?? '').split(' ')
      const lineHeight = 14
      return (
        <text x={x} y={y} textAnchor="middle" fill="#111827" fontSize={13} fontWeight={600} style={{ fontFamily: 'inherit' }}>
          {words.map((w, i) => <tspan key={i} x={x} dy={i === 0 ? 20 : lineHeight}>{w}</tspan>)}
        </text>
      )
    }
    // Value axis (0% / 25% …). The zero tick sits ON the baseline — bottom of "0%" flush with the
    // foot of the columns, mirroring the horizontal charts where "0%" starts flush with the bar's
    // origin — while every other tick stays centred on its guide.
    const renderColumnValueTick = (props: { x?: number | string; y?: number | string; payload?: { value?: number } }) => {
      const x = Number(props.x ?? 0)
      const y = Number(props.y ?? 0)
      const value = props.payload?.value
      const label = isDays ? `${value}d` : `${value}%`
      return (
        <text
          x={x} y={y} textAnchor="end" dominantBaseline={value === 0 ? 'auto' : 'middle'}
          fill="#111827" fontSize={13} fontWeight={600} style={{ fontFamily: 'inherit' }}
        >
          {label}
        </text>
      )
    }
    // Column width adapts to the department count the same way the horizontal bars' thickness does:
    // recharts sizes each column off its category band, so few departments ⇒ wide columns that fill
    // the block, many ⇒ proportionally narrower. maxBarSize only caps the extreme (a couple of
    // departments across a wide card) so a column never becomes a slab.
    return (
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barCategoryGap="25%">
          <XAxis dataKey="name" tick={renderColumnDeptTick} axisLine={false} tickLine={false} interval={0} height={52} />
          <YAxis
            type="number" domain={[0, domainMax]} ticks={labelTicks}
            tick={renderColumnValueTick} axisLine={false} tickLine={false} allowDecimals={false} width={48}
          />
          {gridNode}
          {tooltipNode}
          <Bar dataKey="rate" fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={120} activeBar={renderActiveColumn} isAnimationActive={false}>
            {data.map((entry, i) => <Cell key={`${entry.name}-${i}`} fill={entry.fill ?? barColor} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }
  // Department name wraps one space-separated word per line (e.g. "Customer Support" → two lines),
  // vertically centred on the bar. Nudged left of the axis so there's clear air between the name
  // and where the bar / value axis begins.
  const renderDeptTick = (props: { x?: number | string; y?: number | string; payload?: { value?: string | number } }) => {
    const x = Number(props.x ?? 0) - 10
    const y = Number(props.y ?? 0)
    const words = String(props.payload?.value ?? '').split(' ')
    const lineHeight = 15
    return (
      <text x={x} y={y} textAnchor="end" dominantBaseline="middle" fill="#111827" fontSize={13} fontWeight={600} style={{ fontFamily: 'inherit' }}>
        {words.map((w, i) => (
          <tspan key={i} x={x} dy={i === 0 ? -((words.length - 1) * lineHeight) / 2 : lineHeight}>{w}</tspan>
        ))}
      </text>
    )
  }
  // Value axis (0% / 25% … or 0d / 2d …). The first tick is left-anchored so "0%" lines up flush
  // with the bar's origin instead of straddling it; the rest stay centred.
  const renderValueTick = (props: { x?: number | string; y?: number | string; index?: number; payload?: { value?: number } }) => {
    const x = Number(props.x ?? 0)
    const y = Number(props.y ?? 0)
    const label = unit === 'percent' ? `${props.payload?.value}%` : `${props.payload?.value}d`
    return (
      <text x={x} y={y} dy={16} textAnchor={props.index === 0 ? 'start' : 'middle'} fill="#111827" fontSize={13} fontWeight={600} style={{ fontFamily: 'inherit' }}>{label}</text>
    )
  }
  const chart = (
    <BarChart data={data} layout="vertical" margin={{ left: 4, right: 48, top: 4, bottom: 0 }} barCategoryGap="22%">
      <XAxis type="number" domain={[0, domainMax]} ticks={labelTicks} tick={renderValueTick} axisLine={false} tickLine={false} allowDecimals={false} />
      <YAxis type="category" dataKey="name" tick={renderDeptTick} axisLine={false} tickLine={false} width={104} />
      {gridNode}
      {tooltipNode}
      <Bar dataKey="rate" fill={barColor} radius={[0, 4, 4, 0]} maxBarSize={64} activeBar={renderActiveBar} isAnimationActive={false}>
        {data.map((entry, i) => <Cell key={`${entry.name}-${i}`} fill={entry.fill ?? barColor} />)}
      </Bar>
    </BarChart>
  )
  // fillHeight (the Internal Analytics blocks): the plot fills the whole card, so bars auto-distribute
  // over the space available — few departments ⇒ thick bars that fill the block, many ⇒ proportionally
  // thinner — adapting to the count instead of a hard-coded per-bar height. maxBarSize only caps the
  // thickness so one or two departments don't become giant slabs.
  if (fillHeight) {
    return (
      <div style={{ height: '100%', minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={180}>{chart}</ResponsiveContainer>
      </div>
    )
  }
  // Otherwise (Casual Worker "by Worker" charts) the card has no fixed height of its own, so the chart
  // grows with the row count instead — squeezing 10 workers into a filled block would be unreadable.
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 50 + 30)}>{chart}</ResponsiveContainer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportView({ sidebar, hidePlanBadge = false }: { sidebar: React.ReactNode; hidePlanBadge?: boolean }) {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  // Live Free/Paid plan (src/lib/paidFeatures.ts) — sourced from the realtime provider instead of
  // a local fetch so an upgrade/downgrade reflects here the instant the DB changes, no refresh.
  const currentPlan = useRealtimeNotifications().plan
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM)
  const [dateTo, setDateTo] = useState(YESTERDAY)
  const [report, setReport] = useState<CompanyReport | null>(null)
  // setDeptColorOverrides mutates a module-level Map (no React state of its own), so this flag
  // exists purely to force a re-render once the company's custom department colors are in —
  // otherwise the pie chart could paint once with deptColor's hash-only fallback and never
  // refresh, since nothing else here depends on this fetch resolving.
  const [deptColorsReady, setDeptColorsReady] = useState(false)
  const [anomalies, setAnomalies] = useState<AIAnomaly[]>([])
  // Clicking a KPI card highlights its matching chart block in the analytics grid below — click the
  // same card again to clear the highlight.
  type BlockId = 'attendance' | 'task' | 'hiring' | 'timeToFill' | 'cost'
  const [highlightedBlock, setHighlightedBlock] = useState<BlockId | null>(null)
  const toggleHighlight = (id: BlockId) => setHighlightedBlock(prev => (prev === id ? null : id))

  // Per-block entrance stagger (same pattern as the Attendance page): each block gets an
  // incremental animation-delay in DOM order so they cascade in one after another. When a
  // block's own entrance ends it's flagged so the entrance rule stops matching, and the inline
  // delay is cleared so a later highlight pop starts immediately instead of inheriting it.
  useLayoutEffect(() => {
    const blocks = document.querySelectorAll<HTMLElement>('.report-block')
    blocks.forEach((el, i) => {
      el.style.animationDelay = `${Math.min(i, 8) * 70}ms`
      const onEnd = (e: AnimationEvent) => {
        if (e.target !== el) return // child animations (e.g. stat cards) bubble up here too
        el.dataset.blockEntered = '1'
        el.style.animationDelay = ''
        el.removeEventListener('animationend', onEnd)
      }
      el.addEventListener('animationend', onEnd)
    })
  }, [])
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [error, setError] = useState('')
  // Below this width the 3-column analytics grid can't hold its charts readably — everything
  // stacks into one scrolling column instead (same 1300 breakpoint the Attendance page uses).
  const isCompactLayout = useIsCompactViewport(1300)

  // ── Casual Worker Detail modal (clicking a carousel card) — same modal the Team page opens ──
  // The report rows only carry name/photo, so the full profile (email/DOB/phone/resume) comes from
  // the Team members endpoint, fetched once per visit and cached for subsequent card clicks.
  interface CwDetail {
    id: string; name: string; photoUrl: string | null; email: string | null
    dateOfBirth: string | null; phoneNumber: string | null; skills: string | null; resumeUrl: string | null
  }
  interface CwTeamMemberRow {
    id: string; full_name: string; profile_photo_url?: string | null; email_address?: string | null
    date_of_birth?: string | null; phone_number?: string | null; skills?: string | null; resume_url?: string | null
  }
  const [cwDetail, setCwDetail] = useState<CwDetail | null>(null)
  const [cwCertificates, setCwCertificates] = useState<Array<{ id: string; name: string; certificate_url: string | null }>>([])
  const [cwCertificatesLoading, setCwCertificatesLoading] = useState(false)
  const teamMembersCacheRef = useRef<Map<string, CwTeamMemberRow> | null>(null)

  const openCwDetail = useCallback(async (userId: string) => {
    // Open instantly with what the report row already knows (name/photo), then enrich with the
    // full profile once the members lookup resolves — no dead click while the fetch runs.
    const row = report?.casual.workers.find(x => x.user_id === userId)
    setCwDetail({
      id: userId, name: row?.full_name ?? '', photoUrl: row?.profile_photo_url ?? null,
      email: null, dateOfBirth: null, phoneNumber: null, skills: row?.skills ?? null, resumeUrl: null,
    })
    setCwCertificates([])
    setCwCertificatesLoading(true)
    fetch(`/api/team/casual-worker-certificates?user_id=${userId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setCwCertificates(d.certificates ?? []) })
      .catch(() => {})
      .finally(() => setCwCertificatesLoading(false))
    try {
      if (!teamMembersCacheRef.current) {
        const res = await fetch(`/api/team/members?company_id=${companyId}`)
        const data = await res.json()
        if (!data.success) return
        teamMembersCacheRef.current = new Map((data.members as CwTeamMemberRow[] ?? []).map(m => [m.id, m]))
      }
      const m = teamMembersCacheRef.current.get(userId)
      if (!m) return
      // Re-check against the CURRENT modal target — the user may have paged on and clicked
      // another worker while this fetch was in flight; never overwrite the newer selection.
      setCwDetail(prev => (prev?.id === userId ? {
        id: m.id, name: m.full_name, photoUrl: m.profile_photo_url ?? null,
        email: m.email_address ?? null, dateOfBirth: m.date_of_birth ?? null,
        phoneNumber: m.phone_number ?? null, skills: m.skills ?? null, resumeUrl: m.resume_url ?? null,
      } : prev))
    } catch { /* profile enrichment is best-effort; the modal already shows the basics */ }
  }, [companyId, report])

  const fetchReport = useCallback(async (cid: string, from = dateFrom, to = dateTo) => {
    if (!cid) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ company_id: cid, date_from: from, date_to: to })
      const res = await fetch(`/api/report/company?${params}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to fetch report')
      setReport(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  // Runs automatically alongside the report itself — the "Recent Anomalies" panel shows
  // whatever this finds without the user having to press a button.
  const detectAnomalies = useCallback(async (cid: string, from = dateFrom, to = dateTo) => {
    if (!cid) return
    setAiLoading(true)
    try {
      // Recent Anomalies (Internal tab) only ever sees internal-staff signals — no individual
      // Casual Worker attendance/reliability or job-posting detail, which lives on the Casual tab.
      const params = new URLSearchParams({ company_id: cid, date_from: from, date_to: to, scope: 'internal' })
      const res = await fetch(`/api/ai/anomalies?${params}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to detect anomalies')
      setAnomalies(data.anomalies ?? [])
    } catch {
      setAnomalies([])
    } finally {
      setAiLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let authId = localStorage.getItem('tasking_user_id')
      if (!authId) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          authId = session.user.id
          localStorage.setItem('tasking_user_id', authId)
        }
      }
      if (!authId) { router.replace('/signin'); return }
      const meRes = await fetch(`/api/user/me?user_id=${authId}`)
      const meData = await meRes.json()
      if (!meData.success || cancelled) return
      if (meData.user?.full_name) setOwnerName(meData.user.full_name)
      if (meData.user?.id) setInternalUserId(meData.user.id)
      const cid = localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
      if (!cid) return
      setCompanyId(cid)
      const deptRes = await fetch(`/api/company/departments?company_id=${cid}`)
      // Same department → color mapping the Team page and DepartmentBadge use everywhere else —
      // without this the Cost Distribution pie would fall back to deptColor's hash-only default,
      // which drifts from a company's custom colors set on the Departments page.
      const deptData = await deptRes.json()
      if (!cancelled && deptData.success) {
        setDeptColorOverrides(deptData.departments)
        setDeptColorsReady(true)
      }
    }
    void run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Auto-fetch the report and run anomaly detection whenever the company or date range
  // changes — no Apply button, no manual "Detect Anomalies" trigger.
  useEffect(() => {
    if (!companyId) return
    void fetchReport(companyId)
    void detectAnomalies(companyId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, dateFrom, dateTo])

  // UC64 — the export is ALL tables, no chart screenshots: a printed chart loses exactly the
  // information hover carries on screen (which slice is which department, the dollar amounts, the
  // Present/Late/Absent split), so each on-screen chart becomes a table of its full underlying
  // data instead. Structure: period → Company Overview KPIs → one table per chart (cost
  // distribution, attendance, task completion, hiring, time to fill) → the Casual Worker Pool
  // ranked tables. Recent Anomalies is deliberately not exported (an on-screen working panel,
  // not a report figure).
  const exportReport = async () => {
    if (!report || exportLoading) return
    setExportLoading(true)
    try {
      const pct = (v: number | null) => (v === null ? 'No data' : `${v}%`)
      const days = (v: number | null) => (v === null ? 'No data' : `${v.toFixed(1)} Days`)
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const marginLeft = 40
      const pageWidth = doc.internal.pageSize.width
      const pageHeight = doc.internal.pageSize.height
      const contentWidth = pageWidth - marginLeft * 2
      let y = 40

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('Company Report', marginLeft, y)
      y += 18
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(107, 114, 128)
      doc.text(`${report.period.date_from} to ${report.period.date_to}`, marginLeft, y)
      doc.setTextColor(0, 0, 0)
      y += 24

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - 40) {
          doc.addPage()
          y = 40
        }
      }

      const addSection = (title: string, head: string[], body: (string | number)[][]) => {
        ensureSpace(50)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(title, marginLeft, y)
        y += 12
        autoTable(doc, {
          head: [head],
          body,
          startY: y,
          margin: { left: marginLeft, right: marginLeft },
          styles: { fontSize: 8, cellPadding: 4, font: 'helvetica' },
          headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [249, 250, 251] },
        })
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24
      }

      addSection('Company Overview', ['Metric', 'This Period', 'Previous Period'], [
        ['On-time Attendance Rate', pct(report.overview.on_time_attendance_rate), pct(report.previous_overview.on_time_attendance_rate)],
        ['  Late', pct(report.overview.on_time_attendance_late_rate), pct(report.previous_overview.on_time_attendance_late_rate)],
        ['  Absent', pct(report.overview.on_time_attendance_absent_rate), pct(report.previous_overview.on_time_attendance_absent_rate)],
        ['On-Time Task Completion Rate', pct(report.overview.on_time_task_completion_rate), pct(report.previous_overview.on_time_task_completion_rate)],
        ['Hiring Success Rate', pct(report.overview.hiring_success_rate), pct(report.previous_overview.hiring_success_rate)],
        ['Average Time to Fill', days(report.overview.average_time_to_fill_days), days(report.previous_overview.average_time_to_fill_days)],
        ['Total Casual Worker Cost', money(report.overview.total_casual_worker_cost), money(report.previous_overview.total_casual_worker_cost)],
      ])

      // ── One table per on-screen chart, carrying everything hover would have shown ──
      const costRows = report.departments.filter(d => d.casual_labor_cost > 0)
      const costTotal = costRows.reduce((sum, d) => sum + d.casual_labor_cost, 0)
      addSection(
        'Casual Worker Cost Distribution',
        ['Department', 'Cost', 'Share'],
        [...costRows]
          .sort((a, b) => b.casual_labor_cost - a.casual_labor_cost)
          .map(d => [d.department_name, money(d.casual_labor_cost), costTotal > 0 ? `${Math.round((d.casual_labor_cost / costTotal) * 100)}%` : '—']),
      )

      addSection(
        'On-time Attendance Rate by Department',
        ['Department', 'Present', 'Late', 'Absent'],
        report.departments
          .filter(d => d.internal_attendance_rate !== null)
          .map(d => [d.department_name, pct(d.internal_attendance_rate), pct(d.internal_attendance_late_rate), pct(d.internal_attendance_absent_rate)]),
      )

      addSection(
        'On-time Task Completion Rate by Department',
        ['Department', 'Completed On Time'],
        report.departments
          .filter(d => d.internal_task_on_time_rate !== null)
          .map(d => [d.department_name, pct(d.internal_task_on_time_rate)]),
      )

      addSection(
        'Hiring Success Rate by Department',
        ['Department', 'Positions Filled'],
        report.departments
          .filter(d => d.hiring_success_rate !== null)
          .map(d => [d.department_name, pct(d.hiring_success_rate)]),
      )

      addSection(
        'Average Time to Fill by Department',
        ['Department', 'Days to Fill'],
        report.departments
          .filter(d => d.average_time_to_fill_days !== null)
          .map(d => [d.department_name, days(d.average_time_to_fill_days)]),
      )

      // ── Casual Worker Pool, as data rows (rank, who, and the same three facts the cards show) ──
      const emptyNote = (title: string, note: string) => {
        ensureSpace(40)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(title, marginLeft, y)
        y += 14
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(107, 114, 128)
        doc.text(note, marginLeft, y)
        doc.setTextColor(0, 0, 0)
        y += 24
      }
      if (topReliableData.length > 0) {
        addSection(
          'Casual Worker Pool - Top Reliable Workers',
          ['Rank', 'Worker', 'Score', 'Shifts', 'Present', 'Tasks'],
          topReliableData.map((w, i) => [
            `#${i + 1}`, w.full_name, `${w.avgRate}`, w.worked,
            pct(w.on_time_attendance_rate), pct(w.on_time_task_completion_rate),
          ]),
        )
      } else {
        emptyNote('Casual Worker Pool - Top Reliable Workers', 'No casual worker shifts in this range.')
      }
      if (attentionData.length > 0) {
        addSection(
          'Casual Worker Pool - Workers Needing Attention',
          ['Worker', 'Issues', 'Shifts', 'Present', 'Tasks'],
          attentionData.map(w => [
            w.full_name, w.issues.join(', '), w.worked,
            pct(w.on_time_attendance_rate), pct(w.on_time_task_completion_rate),
          ]),
        )
      } else {
        emptyNote('Casual Worker Pool - Workers Needing Attention', 'No lateness, no-shows, or cancellations this period.')
      }

      doc.save(`tasking-report-${dateFrom}-to-${dateTo}.pdf`)
    } finally {
      setExportLoading(false)
    }
  }

  // ── Internal Analytics grid (Charts 1–5 + Company Insights) — department-level ──
  // Memoized on `report` alone: these arrays feed straight into recharts' `data` prop, and
  // recharts replays its entrance animation (labels fade out/in) whenever it sees a new array
  // reference — which a plain recompute-every-render would produce on every unrelated click
  // (highlighting a card, paging Recent Anomalies), making charts flicker for no data reason.
  const attendanceChartData = useMemo(() => (report?.departments ?? [])
    .filter(d => d.internal_attendance_rate !== null)
    .slice(0, 10)
    .map(d => ({ name: d.department_name, rate: d.internal_attendance_rate as number, late: d.internal_attendance_late_rate, absent: d.internal_attendance_absent_rate, fill: d.department_id ? deptColor(d.department_id) : undefined })), [report, deptColorsReady])

  const taskCompletionChartData = useMemo(() => (report?.departments ?? [])
    .filter(d => d.internal_task_on_time_rate !== null)
    .slice(0, 10)
    .map(d => ({ name: d.department_name, rate: d.internal_task_on_time_rate as number, fill: d.department_id ? deptColor(d.department_id) : undefined })), [report, deptColorsReady])

  const hiringChartData = useMemo(() => (report?.departments ?? [])
    .filter(d => d.hiring_success_rate !== null)
    .slice(0, 10)
    .map(d => ({ name: d.department_name, rate: d.hiring_success_rate as number, fill: d.department_id ? deptColor(d.department_id) : undefined })), [report, deptColorsReady])

  const timeToFillChartData = useMemo(() => (report?.departments ?? [])
    .filter(d => d.average_time_to_fill_days !== null)
    .slice(0, 10)
    .map(d => ({ name: d.department_name, rate: d.average_time_to_fill_days as number, fill: d.department_id ? deptColor(d.department_id) : undefined })), [report, deptColorsReady])

  // Same color every other page uses for this department (Team page's dept dots, DepartmentBadge,
  // etc.) — never a locally-invented palette. deptColor falls back to a deterministic per-id hash
  // when the company hasn't set a custom color, so it's still stable even before the override
  // fetch below resolves — deptColorsReady is a dep purely so this recomputes once real colors load.
  const costChartData = useMemo(() => (report?.departments ?? [])
    .filter((d): d is typeof d & { department_id: string } => d.casual_labor_cost > 0 && d.department_id !== null)
    .map(d => ({ name: d.department_name, value: d.casual_labor_cost, fill: deptColor(d.department_id) })), [report, deptColorsReady])

  const periodDays = Math.round(
    (new Date(`${dateTo}T00:00:00Z`).getTime() - new Date(`${dateFrom}T00:00:00Z`).getTime()) / 86400000,
  ) + 1
  const periodLabel = `Compared with last ${periodDays} day${periodDays === 1 ? '' : 's'}`

  // ── Casual Worker Pool — folded into the Internal grid as one block (CwPoolBlock), not a
  // separate tab: the pool's data doesn't carry enough distinct signal to justify a whole page, so
  // only the two most useful lists survive — who's reliable, and who needs a second look. Top 5
  // each: an Owner picking someone to call never reads past the first few names anyway.
  const TOP_WORKERS = 5
  // `allCasualWorkers` is unfiltered — a worker who only cancelled a confirmed job (no shift
  // assignment at all this period) still has a row and must still be findable. `poolWorkers` is
  // the narrower "actually had a countable shift" population the first two blocks need.
  const allCasualWorkers = report?.casual.workers ?? []
  const poolWorkers = allCasualWorkers.filter(w => w.worked + w.absent > 0)

  // ① Top Reliable Workers (Selected Period) — the score blends THIS period's attendance rate
  // and task completion rate (a worker with no deadline task this period isn't penalized for it —
  // the average falls back to attendance alone). Equal scores tie-break on shifts worked: a
  // proven run outranks a single lucky day of 100%.
  const topReliableData = poolWorkers
    .filter(w => w.worked > 0)
    .map(w => {
      const attendanceRate = w.on_time_attendance_rate ?? 0
      const avgRate = w.on_time_task_completion_rate !== null
        ? Math.round((attendanceRate + w.on_time_task_completion_rate) / 2)
        : attendanceRate
      return { ...w, avgRate }
    })
    .sort((a, b) => b.avgRate - a.avgRate || b.worked - a.worked)
    .slice(0, TOP_WORKERS)

  // ② Workers Needing Attention — this period's risk signals, worst first: a confirmed-job
  // cancellation (recruitment fell through, not just a bad shift), a no-show, or lateness.
  const attentionData = allCasualWorkers
    .filter(w => w.late > 0 || w.absent > 0 || w.cancellations > 0)
    .map(w => {
      const issues: string[] = []
      if (w.cancellations > 0) issues.push(`${w.cancellations} Cancellation${w.cancellations === 1 ? '' : 's'}`)
      if (w.absent > 0) issues.push(`${w.absent} No-show${w.absent === 1 ? '' : 's'}`)
      if (w.late > 0) issues.push(`${w.late} Late`)
      return { ...w, issues }
    })
    .sort((a, b) => (b.cancellations * 3 + b.absent * 2 + b.late) - (a.cancellations * 3 + a.absent * 2 + a.late))
    .slice(0, TOP_WORKERS)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
      <style>{`
        /* recharts 3 turns its accessibilityLayer on by default, which makes the chart and its bars
           / slices focusable — so a plain mouse click leaves a black focus ring boxing the shape.
           Nothing in these charts is clickable (hover alone shows the tooltip), so drop the ring for
           pointer focus. :not(:focus-visible) keeps it for keyboard users, who do need it to see
           where they are while arrowing through the series. */
        .recharts-wrapper:focus:not(:focus-visible),
        .recharts-wrapper *:focus:not(:focus-visible) {
          outline: none;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* Per-block entrance (same motion as the other owner pages): every block cascades in on
           mount, staggered in DOM order by the useLayoutEffect below. Once a block's entrance
           finishes it's flagged data-block-entered, dropping this rule — otherwise toggling the
           highlight class later would swap the animation property and replay the entrance. */
        .report-block:not([data-block-entered]) { animation: fadeSlideUp 0.42s cubic-bezier(0.22,1,0.36,1) both; }
        /* Blocks stacked in the scroll column must keep their intrinsic height — ShowcaseCard's
           own minHeight:0 otherwise lets flex-shrink crush a direct-child card (Company Overview
           collapsed to its borders) once the column's content overflows, painting its children
           over the blocks below. Overflow belongs to the column's scrollbar, not to shrinking. */
        .report-scroll > * { flex-shrink: 0; }
        /* Casual Worker Pool carousels — the incoming card slides in from the side whose arrow
           was pressed (the content wrapper is keyed by worker id, so switching remounts it and
           replays the animation). */
        @keyframes cwSlideFromRight {
          from { opacity: 0; transform: translateX(26px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes cwSlideFromLeft {
          from { opacity: 0; transform: translateX(-26px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .cw-slide-from-right { animation: cwSlideFromRight 0.24s ease; }
        .cw-slide-from-left  { animation: cwSlideFromLeft 0.24s ease; }
        .cw-carousel-card {
          transition: box-shadow 0.22s ease, transform 0.22s ease;
        }
        .cw-carousel-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(15,23,42,0.14);
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          40%      { transform: translateY(-4px); }
          70%      { transform: translateY(-2px); }
        }
        .report-stat-card {
          transition: box-shadow 0.22s ease, transform 0.22s ease;
          cursor: default;
        }
        .report-stat-card:hover {
          box-shadow: 0 8px 28px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(249,115,22,0.18) !important;
          transform: translateY(-3px) scale(1.015);
        }
        .report-stat-card:hover .stat-icon { animation: iconBounce 0.5s ease forwards; }
        .report-stat-card:nth-child(1) { animation: fadeSlideUp 0.34s ease both 0.04s; }
        .report-stat-card:nth-child(2) { animation: fadeSlideUp 0.34s ease both 0.08s; }
        .report-stat-card:nth-child(3) { animation: fadeSlideUp 0.34s ease both 0.12s; }
        .report-stat-card:nth-child(4) { animation: fadeSlideUp 0.34s ease both 0.16s; }
        .report-stat-card:nth-child(5) { animation: fadeSlideUp 0.34s ease both 0.20s; }
        .report-tr:hover td { background: #FFF7ED !important; }
        @keyframes reportBlockPop {
          0%   { box-shadow: 0 0 0 0 rgba(249,115,22,0.35); }
          60%  { box-shadow: 0 10px 28px rgba(249,115,22,0.20), 0 0 0 3px rgba(249,115,22,0.55); }
          100% { box-shadow: 0 8px 24px rgba(249,115,22,0.14), 0 0 0 2px #F97316; }
        }
        /* Doubled-up class so the highlight pop outranks the entrance rule if a KPI card is
           clicked while blocks are still cascading in. */
        .report-block.report-block-highlighted {
          animation: reportBlockPop 0.4s ease-out both;
          border-color: #F97316 !important;
        }
      `}</style>

      {sidebar}
      {/* No-page-scroll shell: main is locked to the viewport, the page header stays put, and the
          content region below it is the only thing that scrolls. */}
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', minHeight: 0, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Report
            </h1>
          </div>
          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && !hidePlanBadge && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        <div className="report-scroll" style={{ padding: '4px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0, overflowY: 'auto' }}>

          {error && (
            <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.875rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* ── Top KPI block — Company Overview ── */}
          <ShowcaseCard
            className="report-block"
            icon={<Users size={15} style={{ color: '#F97316' }} />}
            title="Company Overview"
            rightContent={<span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', marginLeft: -12 }}>({periodLabel})</span>}
            actions={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: 140 }}><DatePickerField value={dateFrom} onChange={setDateFrom} max={YESTERDAY} clearable={false} compact /></div>
                <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>to</span>
                <div style={{ width: 140 }}><DatePickerField value={dateTo} onChange={setDateTo} max={YESTERDAY} clearable={false} compact /></div>
                {loading && <Spinner size={14} dark />}
                <button onClick={exportReport} disabled={!report || exportLoading} style={actionBtn('#F97316', !report || exportLoading)}>
                  {exportLoading ? <Spinner size={13} /> : <Download size={13} />} {exportLoading ? 'Exporting…' : 'Export Report'}
                </button>
              </div>
            }
          >
            {/* Compact: the five cards can't share one row, so they reflow into an auto-fit grid
                (2–3 per row) instead of squeezing unreadably narrow. */}
            <div style={isCompactLayout
              ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }
              : { display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <RateCard
                label="On-time Attendance Rate" format="percent" judged
                value={report?.overview.on_time_attendance_rate ?? null} previous={report?.previous_overview.on_time_attendance_rate ?? null}
                icon={<UserCheck size={15} />} accentBg="#ECFDF5" accentColor="#10B981" loading={loading}
                breakdown={[
                  { label: 'On-time', value: report?.overview.on_time_attendance_rate ?? null, color: '#15803D' },
                  { label: 'Late', value: report?.overview.on_time_attendance_late_rate ?? null, color: '#A16207' },
                  { label: 'Absent', value: report?.overview.on_time_attendance_absent_rate ?? null, color: '#B91C1C' },
                ]}
                onClick={() => toggleHighlight('attendance')} active={highlightedBlock === 'attendance'}
              />
              <RateCard
                label="On-Time Task Completion Rate" format="percent" judged
                value={report?.overview.on_time_task_completion_rate ?? null} previous={report?.previous_overview.on_time_task_completion_rate ?? null}
                icon={<Building2 size={15} />} accentBg="#EFF6FF" accentColor="#3B82F6" loading={loading}
                onClick={() => toggleHighlight('task')} active={highlightedBlock === 'task'}
              />
              <RateCard
                label="Hiring Success Rate" format="percent" judged
                value={report?.overview.hiring_success_rate ?? null} previous={report?.previous_overview.hiring_success_rate ?? null}
                icon={<Briefcase size={15} />} accentBg="#FFF7ED" accentColor="#F97316" loading={loading}
                onClick={() => toggleHighlight('hiring')} active={highlightedBlock === 'hiring'}
              />
              <RateCard
                label="Average Time to Fill" format="days" judged invert
                value={report?.overview.average_time_to_fill_days ?? null} previous={report?.previous_overview.average_time_to_fill_days ?? null}
                icon={<ClipboardList size={15} />} accentBg="#F0F9FF" accentColor="#0284C7" loading={loading}
                onClick={() => toggleHighlight('timeToFill')} active={highlightedBlock === 'timeToFill'}
              />
              <RateCard
                label="Total Casual Worker Cost" format="money" judged={false}
                value={report?.overview.total_casual_worker_cost ?? null} previous={report?.previous_overview.total_casual_worker_cost ?? null}
                icon={<DollarSign size={15} />} accentBg="#F5F3FF" accentColor="#7C3AED" loading={loading}
                onClick={() => toggleHighlight('cost')} active={highlightedBlock === 'cost'}
              />
            </div>
          </ShowcaseCard>

          {/* ── Company Analytics — Casual Worker Pool block, Recent Anomalies + Cost pie, and the
              4 department bar charts, all in one 3-column grid (no separate Casual Worker tab —
              the pool's data doesn't carry enough distinct signal to earn a full page on its own).
              Compact: the three columns stack into one, each block keeping a workable height. */}
          <div style={isCompactLayout
            ? { display: 'flex', flexDirection: 'column', gap: 16 }
            : { display: 'grid', gridTemplateColumns: 'minmax(200px, 0.4fr) minmax(230px, 0.62fr) 1.92fr', gridTemplateRows: 'auto auto', gap: 16, alignItems: 'stretch' }}>
            <CwPoolBlock loading={loading} topReliable={topReliableData} attention={attentionData} onSelectWorker={openCwDetail} compact={isCompactLayout} />
              {/* CSS subgrid — this column and the 4-chart column (below) both opt into the SAME
                  outer row tracks via gridTemplateRows: 'subgrid', so row 1 (Recent Anomalies /
                  Attendance / Task) and row 2 (Cost Distribution / Hiring / Time to Fill) size to
                  whichever cell in that row is naturally tallest, on both sides at once — no
                  manual pixel guessing, no JS measuring, and it stays correct if any chart's
                  content height changes later. Compact: the stacked flex parent provides no row
                  tracks, so both fillHeight cards get explicit rows here instead (Anomalies'
                  absolutely-positioned scroll area collapses to zero without one). */}
              <div style={isCompactLayout
                ? { display: 'grid', gridTemplateRows: '360px 400px', gap: 16 }
                : { display: 'grid', gridTemplateRows: 'subgrid', gridRow: '1 / 3', gap: 16 }}>
                <ShowcaseCard className="report-block" icon={<AlertTriangle size={15} style={{ color: '#7C3AED' }} />} iconBg="#F5F3FF" title="Recent Anomalies" fillHeight>
                  {loading ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
                  ) : aiLoading ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <Spinner size={20} dark />
                      <span style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>Analyzing this period&apos;s data for anomalies…</span>
                    </div>
                  ) : anomalies.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 999, background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={20} />
                      </div>
                      <span style={{ color: '#9CA3AF', fontSize: 13 }}>No anomalies found</span>
                    </div>
                  ) : (() => {
                    /* Grouped by department, groups ordered by their worst finding (the list
                       arrives sorted by severity, so first appearance = severity order).
                       One badge per department; its findings sit indented under it as
                       bullet points, never level with the badge. */
                    const groups: { department: string; items: AIAnomaly[] }[] = []
                    for (const item of anomalies) {
                      const group = groups.find(g => g.department === item.department)
                      if (group) group.items.push(item)
                      else groups.push({ department: item.department, items: [item] })
                    }
                    return (
                      /* Absolutely-positioned scroll area: the list must never contribute
                         intrinsic height, or it would stretch the shared subgrid row and make
                         this block taller than the charts beside it. The block height stays
                         chart-driven; overflow scrolls inside. */
                      <div style={{ position: 'relative', height: '100%' }}>
                        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 2 }}>
                          {groups.map((group, gi) => {
                            const deptRow = report?.departments.find(d => d.department_name === group.department)
                            const color = deptRow?.department_id ? deptColor(deptRow.department_id) : '#6B7280'
                            return (
                              <div key={group.department} style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingBottom: 14, borderBottom: gi < groups.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                                <span style={{ alignSelf: 'flex-start', borderRadius: 999, padding: '2px 11px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em', background: `${color}1C`, color }}>{group.department}</span>
                                <div style={{ paddingLeft: 15, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {group.items.map((item, i) => (
                                    <div key={item.id || i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                      <span style={{ width: 5, height: 5, borderRadius: 999, background: '#000000', flexShrink: 0, marginTop: 7 }} />
                                      <span style={{ color: '#374151', fontSize: '0.8125rem', lineHeight: 1.5 }}>{item.title}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </ShowcaseCard>

                <div style={{ display: 'flex' }}>
                  <ShowcaseCard
                    icon={<ChartInfo text="Which departments spend the most on casual workers" />}
                    iconBg={CHART_INFO_BG} title="Casual Worker Cost Distribution"
                    className={highlightedBlock === 'cost' ? 'report-block report-block-highlighted' : 'report-block'}
                    fillHeight
                  >
                    {loading ? (
                      <div style={{ height: '100%', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
                    ) : costChartData.length === 0 ? (
                      <div style={{ height: '100%', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><EmptyRow text="No Casual Worker cost recorded in this range" /></div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                        <PieChart>
                          <Pie
                            data={costChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}
                            label={renderPieSliceLabel}
                            labelLine={false}
                            activeShape={renderPulledOutSlice}
                            // recharts replays its mount-in animation (labels fade out then back in)
                            // on ANY re-render that reflows this chart's box — not just a genuine data
                            // change, e.g. a sibling card gaining a highlight ring shifts layout enough
                            // for ResponsiveContainer to re-measure. The hover "pop" already has its
                            // own CSS transition (see renderPulledOutSlice), so no animation is lost.
                            isAnimationActive={false}
                          >
                            {costChartData.map(entry => <Cell key={entry.name} fill={entry.fill} style={{ transition: 'all 0.2s ease-out' }} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit' }}
                            itemStyle={{ fontFamily: 'inherit', fontWeight: 600 }}
                            labelStyle={{ fontFamily: 'inherit' }}
                            formatter={(value, name) => [money(Number(value)), name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </ShowcaseCard>
                </div>
              </div>

              <div style={isCompactLayout
                ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: 470, gap: 16 }
                : { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'subgrid', gridRow: '1 / 3', gap: 16 }}>
                <ShowcaseCard
                  icon={<ChartInfo text="Which departments show up on time, and who is late or absent" />}
                  iconBg={CHART_INFO_BG} title="On-time Attendance Rate"
                  className={highlightedBlock === 'attendance' ? 'report-block report-block-highlighted' : 'report-block'}
                >
                  <DeptRateBarChart
                    data={attendanceChartData} loading={loading} barColor="#10B981" tooltipSuffix="% on time"
                    emptyMessage="No internal-staff attendance judged in this range" customTooltip={AttendanceTooltip} fillHeight
                  />
                </ShowcaseCard>

                <ShowcaseCard
                  icon={<ChartInfo text="Which departments finish their work by the deadline" />}
                  iconBg={CHART_INFO_BG} title="On-time Task Completion Rate"
                  className={highlightedBlock === 'task' ? 'report-block report-block-highlighted' : 'report-block'}
                >
                  <DeptRateBarChart
                    data={taskCompletionChartData} loading={loading} barColor="#3B82F6" tooltipSuffix="% completed on time"
                    emptyMessage="No internal-staff task has a deadline in this range" orientation="column"
                    customTooltip={DeptPercentTooltip}
                  />
                </ShowcaseCard>

                <ShowcaseCard
                  icon={<ChartInfo text="Which departments fill all the positions they recruit for" />}
                  iconBg={CHART_INFO_BG} title="Hiring Success Rate"
                  className={highlightedBlock === 'hiring' ? 'report-block report-block-highlighted' : 'report-block'}
                >
                  <DeptRateBarChart
                    data={hiringChartData} loading={loading} barColor="#F97316" tooltipSuffix="% hired"
                    emptyMessage="No Closed posting created in this range" orientation="column"
                    customTooltip={DeptPercentTooltip}
                  />
                </ShowcaseCard>

                <ShowcaseCard
                  icon={<ChartInfo text="How many days a job post takes to be completely filled" />}
                  iconBg={CHART_INFO_BG} title="Average Time to Fill"
                  className={highlightedBlock === 'timeToFill' ? 'report-block report-block-highlighted' : 'report-block'}
                >
                  <DeptRateBarChart
                    data={timeToFillChartData} loading={loading} barColor="#0284C7" tooltipSuffix=" days to fill" unit="days"
                    emptyMessage="No fully-filled posting created in this range" fillHeight customTooltip={DeptDaysTooltip}
                  />
                </ShowcaseCard>
              </div>
          </div>

        </div>
      </main>

      {/* Casual Worker Detail — same modal the Team page opens from its Casual Workers strip,
          minus the Active/Inactive action (the Report is read-only; manage status on Team). */}
      {cwDetail && (
        <ModalOverlay onClose={() => setCwDetail(null)} maxWidth="420px">
          <ModalBox>
            <ModalHeader title="Casual Worker Detail" icon={<HardHat size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setCwDetail(null)} />

            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 14 }}>
              <RoleAvatar role="Casual Worker" size={44} photoUrl={cwDetail.photoUrl} />
              <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: 0 }}>{cwDetail.name}</p>
            </div>

            <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column' }}>
              {[
                { label: 'Email Address', value: cwDetail.email || '—' },
                { label: 'Date of Birth', value: cwDetail.dateOfBirth ? new Date(cwDetail.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                { label: 'Phone Number', value: cwDetail.phoneNumber || '—' },
                { label: 'Skills', value: cwDetail.skills || '—' },
              ].map(field => (
                <div key={field.label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{field.label}</label>
                  <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>{field.value}</p>
                </div>
              ))}
              {cwDetail.resumeUrl && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>Resume</label>
                  <a href={cwDetail.resumeUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.9375rem', color: '#EA580C', textDecoration: 'underline' }}>View Resume</a>
                </div>
              )}
              {!cwCertificatesLoading && cwCertificates.length > 0 && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>Certificates</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {cwCertificates.map(cert => (
                      cert.certificate_url
                        ? <a key={cert.id} href={cert.certificate_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.9375rem', color: '#EA580C', textDecoration: 'underline' }}>{cert.name}</a>
                        : <p key={cert.id} style={{ fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{cert.name}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ModalBox>
        </ModalOverlay>
      )}
    </div>
  )
}
