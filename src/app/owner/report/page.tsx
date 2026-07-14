'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  AlertTriangle, Award, Briefcase, Building2, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, Clock, DollarSign, Download,
  Flame, Minus, Repeat, ShieldCheck, Star, TrendingDown, TrendingUp, UserCheck, Users,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, ReferenceLine,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Sector,
} from 'recharts'
import DatePickerField from '@/components/DatePickerField'
import { deptColor, setDeptColorOverrides } from '@/lib/deptColor'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { ShowcaseCard } from '@/components/panel'
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

// ─── Internal / Casual Worker pill toggle ──────────────────────────────────────
// Same design as the Kanban / Deadline Calendar switcher on the Tasks page: white pill bar
// with a border + soft shadow, and a dark sliding indicator measured off the active button.

type WorkforceTab = 'internal' | 'casual'
const WORKFORCE_TABS: Array<{ id: WorkforceTab; label: string }> = [
  { id: 'internal', label: 'Internal' },
  { id: 'casual', label: 'Casual Worker' },
]

function WorkforceTabToggle({ value, onChange }: { value: WorkforceTab; onChange: (v: WorkforceTab) => void }) {
  const barRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Record<WorkforceTab, HTMLButtonElement | null>>({ internal: null, casual: null })
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 })

  useLayoutEffect(() => {
    const container = barRef.current
    const activeButton = buttonRefs.current[value]
    if (!container || !activeButton) return
    const containerRect = container.getBoundingClientRect()
    const activeRect = activeButton.getBoundingClientRect()
    setIndicator({ left: activeRect.left - containerRect.left, width: activeRect.width, opacity: 1 })
  }, [value])

  return (
    <div
      ref={barRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: 4,
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 999,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 4,
          left: indicator.left,
          width: indicator.width,
          height: 'calc(100% - 8px)',
          borderRadius: 999,
          background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
          boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
          opacity: indicator.opacity,
          transform: indicator.opacity ? 'translateY(0)' : 'translateY(4px)',
          transition: 'left 0.24s cubic-bezier(0.22, 1, 0.36, 1), width 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
          pointerEvents: 'none',
        }}
      />
      {WORKFORCE_TABS.map(tab => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            ref={el => { buttonRefs.current[tab.id] = el }}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              zIndex: 1,
              height: 36,
              padding: '0 18px',
              borderRadius: 999,
              border: 'none',
              background: active ? '#0F172A' : 'transparent',
              color: active ? '#FFFFFF' : '#64748B',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'color 0.18s ease, transform 0.18s ease',
              transform: active ? 'translateY(-0.5px)' : 'translateY(0)',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
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

function truncateDeptName(name: string): string {
  return name.length > 14 ? name.slice(0, 13) + '…' : name
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
  data, loading, emptyMessage, barColor, tooltipSuffix, unit = 'percent', orientation = 'bar',
}: {
  data: Array<{ name: string; rate: number }>
  loading: boolean
  emptyMessage: string
  barColor: string
  tooltipSuffix: string
  unit?: 'percent' | 'days'
  orientation?: 'bar' | 'column'
}) {
  if (loading) {
    return <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
  }
  if (data.length === 0) {
    return <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '0 12px' }}>{emptyMessage}</div>
  }
  const targetLineProps = {
    stroke: '#94A3B8', strokeDasharray: '4 4', strokeWidth: 1.5,
    label: { value: 'Target 80%', fontSize: 10, fill: '#94A3B8', fontWeight: 600 },
  }
  if (orientation === 'column') {
    return (
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 4 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} interval={0} />
          {unit === 'percent' ? (
            <YAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          ) : (
            <YAxis type="number" tickFormatter={v => `${v}d`} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
          )}
          <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={v => [`${v}${tooltipSuffix}`, '']} />
          {unit === 'percent' && <ReferenceLine y={80} {...targetLineProps} label={{ ...targetLineProps.label, position: 'insideTopRight' }} />}
          <Bar dataKey="rate" fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48)}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
        {unit === 'percent' ? (
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        ) : (
          <XAxis type="number" tickFormatter={v => `${v}d`} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
        )}
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={92} />
        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={v => [`${v}${tooltipSuffix}`, '']} />
        {unit === 'percent' && <ReferenceLine x={80} {...targetLineProps} label={{ ...targetLineProps.label, position: 'insideTopRight' }} />}
        <Bar dataKey="rate" fill={barColor} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Worker-level count bar chart (Rehire Count, Shifts Worked) ───────────────
// Same visual shape as DeptRateBarChart but for raw integer counts, not percentages.
function WorkerCountBarChart({
  data, loading, emptyMessage, barColor, tooltipSuffix,
}: {
  data: Array<{ name: string; value: number }>
  loading: boolean
  emptyMessage: string
  barColor: string
  tooltipSuffix: string
}) {
  if (loading) {
    return <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
  }
  if (data.length === 0) {
    return <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '0 12px' }}>{emptyMessage}</div>
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={92} />
        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={v => [`${v}${tooltipSuffix}`, '']} />
        <Bar dataKey="value" fill={barColor} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM)
  const [dateTo, setDateTo] = useState(YESTERDAY)
  const [report, setReport] = useState<CompanyReport | null>(null)
  // setDeptColorOverrides mutates a module-level Map (no React state of its own), so this flag
  // exists purely to force a re-render once the company's custom department colors are in —
  // otherwise the pie chart could paint once with deptColor's hash-only fallback and never
  // refresh, since nothing else here depends on this fetch resolving.
  const [deptColorsReady, setDeptColorsReady] = useState(false)
  const [anomalies, setAnomalies] = useState<AIAnomaly[]>([])
  // Recent Anomalies is a fixed-height single-card carousel, not a stacked list — index is
  // clamped at render time (not reset via effect) so a shrinking anomalies array never leaves
  // it pointing past the end.
  const [anomalyIndex, setAnomalyIndex] = useState(0)
  const [workforceTab, setWorkforceTab] = useState<'internal' | 'casual'>('internal')
  // Clicking a Company Overview KPI card highlights its matching chart block in the Internal
  // Analytics grid below — click the same card again (or switch tabs) to clear the highlight.
  type InternalBlockId = 'attendance' | 'task' | 'hiring' | 'timeToFill' | 'cost'
  const [highlightedBlock, setHighlightedBlock] = useState<InternalBlockId | null>(null)
  const toggleHighlight = (id: InternalBlockId) => setHighlightedBlock(prev => (prev === id ? null : id))
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [error, setError] = useState('')

  // Chart regions captured as images into the exported PDF (Export Report), one ref per
  // visual block — same regions the user sees on screen for the active tab.
  const costChartRef = useRef<HTMLDivElement>(null)
  const internalBarChartsRef = useRef<HTMLDivElement>(null)
  const casualBarChartsRef = useRef<HTMLDivElement>(null)
  const skillDonutRef = useRef<HTMLDivElement>(null)

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
      setAnomalyIndex(0)
    } catch {
      setAnomalies([])
      setAnomalyIndex(0)
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
      const [companyRes, deptRes] = await Promise.all([
        fetch(`/api/company/current?user_id=${authId}&company_id=${cid}`),
        fetch(`/api/company/departments?company_id=${cid}`),
      ])
      const companyData = await companyRes.json()
      if (!cancelled && companyData.success) setCurrentPlan(companyData.company?.plan ?? 'Free')
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

  // UC64 — export exactly what the active tab shows: Internal exports the Company Overview
  // KPIs plus the same per-department rates/costs behind its 4 bar charts + cost pie (as both
  // chart images and a data table); Casual Worker exports its own pool KPIs plus the same
  // per-worker rates behind its 4 bar charts + skill donut. Never mixes the two tabs' data.
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

      const scopeLabel = workforceTab === 'internal' ? 'Internal' : 'Casual Worker'
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text(`${scopeLabel} Report`, marginLeft, y)
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

      // Rasterizes a visible chart block exactly as shown on screen and drops it into the PDF
      // as an image — silently skipped if the ref never mounted (e.g. the tab was never opened).
      const addChartImage = async (ref: React.RefObject<HTMLDivElement | null>, title: string, maxWidth: number) => {
        const el = ref.current
        if (!el) return
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false })
        const imgWidth = Math.min(maxWidth, contentWidth)
        const imgHeight = (canvas.height / canvas.width) * imgWidth
        ensureSpace(imgHeight + 34)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(title, marginLeft, y)
        y += 14
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginLeft, y, imgWidth, imgHeight)
        y += imgHeight + 20
      }

      if (workforceTab === 'internal') {
        addSection('Company Overview', ['Metric', 'This Period', 'Previous Period'], [
          ['On-time Attendance Rate', pct(report.overview.on_time_attendance_rate), pct(report.previous_overview.on_time_attendance_rate)],
          ['  Late', pct(report.overview.on_time_attendance_late_rate), pct(report.previous_overview.on_time_attendance_late_rate)],
          ['  Absent', pct(report.overview.on_time_attendance_absent_rate), pct(report.previous_overview.on_time_attendance_absent_rate)],
          ['On-Time Task Completion Rate', pct(report.overview.on_time_task_completion_rate), pct(report.previous_overview.on_time_task_completion_rate)],
          ['Hiring Success Rate', pct(report.overview.hiring_success_rate), pct(report.previous_overview.hiring_success_rate)],
          ['Average Time to Fill', days(report.overview.average_time_to_fill_days), days(report.previous_overview.average_time_to_fill_days)],
          ['Total Casual Worker Cost', money(report.overview.total_casual_worker_cost), money(report.previous_overview.total_casual_worker_cost)],
        ])

        await addChartImage(costChartRef, 'Casual Worker Cost Distribution', 300)
        await addChartImage(internalBarChartsRef, 'Department Performance Charts', contentWidth)

        addSection(
          'Department Performance',
          ['Department', 'Manager(s)', 'On-time Attendance Rate', 'On-time Task Completion Rate', 'Hiring Success Rate', 'Average Time to Fill', 'Casual Worker Cost'],
          report.departments.map(row => [
            row.department_name, row.manager_names.join('; '),
            pct(row.internal_attendance_rate), pct(row.internal_task_on_time_rate),
            pct(row.hiring_success_rate), days(row.average_time_to_fill_days),
            money(row.casual_labor_cost),
          ]),
        )

        doc.save(`tasking-report-internal-${dateFrom}-to-${dateTo}.pdf`)
      } else {
        addSection('Casual Worker Pool Analytics', ['Metric', 'This Period', 'Previous Period'], [
          ['Rehire Rate', pct(report.overview.casual_rehire_rate), pct(report.previous_overview.casual_rehire_rate)],
          ['Reliable Worker Rate', pct(report.overview.casual_reliable_worker_rate), pct(report.previous_overview.casual_reliable_worker_rate)],
          ['On-time Attendance Rate', pct(report.overview.casual_on_time_attendance_rate), pct(report.previous_overview.casual_on_time_attendance_rate)],
          ['On-Time Task Completion Rate', pct(report.overview.casual_on_time_task_completion_rate), pct(report.previous_overview.casual_on_time_task_completion_rate)],
        ])

        await addChartImage(casualBarChartsRef, 'Casual Worker Pool Charts', contentWidth)
        await addChartImage(skillDonutRef, 'Worker Skill Distribution', 300)

        addSection(
          'Casual Worker Pool — by Worker',
          ['Worker', 'Shifts Worked (period)', 'Rehire Count (lifetime)', 'On-time Attendance Rate', 'On-time Task Completion Rate', 'Late', 'Absent', 'Rejected Shifts', 'Skills'],
          report.casual.workers.map(row => [
            row.full_name, row.worked, row.rehire_count,
            pct(row.on_time_attendance_rate), pct(row.on_time_task_completion_rate),
            row.late, row.absent, row.rejected_shifts, row.skills ?? '—',
          ]),
        )

        addSection('Worker Skill Distribution', ['Skill', 'Workers'],
          report.casual.skill_distribution.map(row => [row.skill, row.count]))

        doc.save(`tasking-report-casual-${dateFrom}-to-${dateTo}.pdf`)
      }
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
    .map(d => ({ name: truncateDeptName(d.department_name), rate: d.internal_attendance_rate as number })), [report])

  const taskCompletionChartData = useMemo(() => (report?.departments ?? [])
    .filter(d => d.internal_task_on_time_rate !== null)
    .slice(0, 10)
    .map(d => ({ name: truncateDeptName(d.department_name), rate: d.internal_task_on_time_rate as number })), [report])

  const hiringChartData = useMemo(() => (report?.departments ?? [])
    .filter(d => d.hiring_success_rate !== null)
    .slice(0, 10)
    .map(d => ({ name: truncateDeptName(d.department_name), rate: d.hiring_success_rate as number })), [report])

  const timeToFillChartData = useMemo(() => (report?.departments ?? [])
    .filter(d => d.average_time_to_fill_days !== null)
    .slice(0, 10)
    .map(d => ({ name: truncateDeptName(d.department_name), rate: d.average_time_to_fill_days as number })), [report])

  // Same color every other page uses for this department (Team page's dept dots, DepartmentBadge,
  // etc.) — never a locally-invented palette. deptColor falls back to a deterministic per-id hash
  // when the company hasn't set a custom color, so it's still stable even before the override
  // fetch below resolves — deptColorsReady is a dep purely so this recomputes once real colors load.
  const costChartData = useMemo(() => (report?.departments ?? [])
    .filter((d): d is typeof d & { department_id: string } => d.casual_labor_cost > 0 && d.department_id !== null)
    .map(d => ({ name: d.department_name, value: d.casual_labor_cost, fill: deptColor(d.department_id) })), [report, deptColorsReady])

  const funnelData = report ? [
    { name: 'Applied', value: report.casual.funnel.applied, fill: '#94A3B8' },
    { name: 'Accepted', value: report.casual.funnel.accepted, fill: '#F97316' },
    { name: 'Confirmed', value: report.casual.funnel.confirmed, fill: '#059669' },
  ] : []

  const periodDays = Math.round(
    (new Date(`${dateTo}T00:00:00Z`).getTime() - new Date(`${dateFrom}T00:00:00Z`).getTime()) / 86400000,
  ) + 1
  const periodLabel = `Compared with last ${periodDays} day${periodDays === 1 ? '' : 's'}`

  // ── Casual Worker Pool Analytics grid — everything below is charted "by Worker", never
  // by department (Internal answers "which department has a problem?"; Casual answers
  // "which people in our pool are worth rehiring?"). `worked` and `absent` from the service's
  // "workedCasuals" population, both exposed on every row.
  const TOP_WORKERS = 10
  const poolWorkers = (report?.casual.workers ?? []).filter(w => w.worked + w.absent > 0)

  const rehireChartData = [...poolWorkers]
    .sort((a, b) => b.rehire_count - a.rehire_count)
    .slice(0, TOP_WORKERS)
    .map(w => ({ name: truncateDeptName(w.full_name), value: w.rehire_count }))

  const shiftsWorkedChartData = poolWorkers
    .filter(w => w.worked > 0)
    .sort((a, b) => b.worked - a.worked)
    .slice(0, TOP_WORKERS)
    .map(w => ({ name: truncateDeptName(w.full_name), value: w.worked }))

  const workerAttendanceChartData = poolWorkers
    .filter(w => w.on_time_attendance_rate !== null)
    .sort((a, b) => (b.on_time_attendance_rate as number) - (a.on_time_attendance_rate as number))
    .slice(0, TOP_WORKERS)
    .map(w => ({ name: truncateDeptName(w.full_name), rate: w.on_time_attendance_rate as number }))

  const workerTaskChartData = poolWorkers
    .filter(w => w.on_time_task_completion_rate !== null)
    .sort((a, b) => (b.on_time_task_completion_rate as number) - (a.on_time_task_completion_rate as number))
    .slice(0, TOP_WORKERS)
    .map(w => ({ name: truncateDeptName(w.full_name), rate: w.on_time_task_completion_rate as number }))

  const SKILL_COLORS = ['#F97316', '#3B82F6', '#10B981', '#7C3AED', '#0284C7', '#DB2777', '#94A3B8']
  const skillChartData = (report?.casual.skill_distribution ?? [])
    .map((s, i) => ({ name: s.skill, value: s.count, fill: SKILL_COLORS[i % SKILL_COLORS.length] }))

  // ── Pool Insights — auto-picked standout worker per metric, same "best of the filtered
  // report" pattern as Company Insights above, just scoped to people instead of departments.
  const pickWorker = (
    metric: (w: NonNullable<typeof report>['casual']['workers'][number]) => number | null,
    direction: 'max' | 'min',
  ): { name: string; value: number } | null => {
    let best: { name: string; value: number } | null = null
    for (const w of poolWorkers) {
      const v = metric(w)
      if (v === null) continue
      if (!best || (direction === 'max' ? v > best.value : v < best.value)) {
        best = { name: w.full_name, value: v }
      }
    }
    return best
  }
  const poolInsights: Array<{ label: string; name: string; value: string; color: string; icon: React.ReactNode }> = []
  const mostRehired = pickWorker(w => (w.rehire_count > 0 ? w.rehire_count : null), 'max')
  if (mostRehired) poolInsights.push({ label: 'Most Rehired Worker', name: mostRehired.name, value: `${mostRehired.value} shifts`, color: '#F97316', icon: <Award size={14} /> })
  // Reliable = same three-condition definition as the Reliable Worker Rate KPI: no late, no
  // absence, every deadline-in-period task on time (or no tasks assigned this period).
  const reliableWorkers = poolWorkers.filter(w =>
    w.late === 0 && w.absent === 0 && (w.on_time_task_completion_rate === null || w.on_time_task_completion_rate === 100),
  )
  const mostReliable = reliableWorkers.length > 0
    ? reliableWorkers.reduce((best, w) => (w.rehire_count > best.rehire_count ? w : best))
    : null
  if (mostReliable) poolInsights.push({ label: 'Most Reliable Worker', name: mostReliable.full_name, value: `${mostReliable.on_time_attendance_rate}%`, color: '#7C3AED', icon: <Star size={14} /> })
  const bestAttendance = pickWorker(w => w.on_time_attendance_rate, 'max')
  if (bestAttendance) poolInsights.push({ label: 'Best Attendance', name: bestAttendance.name, value: `${bestAttendance.value}%`, color: '#10B981', icon: <Clock size={14} /> })
  const bestTasks = pickWorker(w => w.on_time_task_completion_rate, 'max')
  if (bestTasks) poolInsights.push({ label: 'Best Task Performance', name: bestTasks.name, value: `${bestTasks.value}%`, color: '#3B82F6', icon: <ClipboardCheck size={14} /> })
  const mostActive = pickWorker(w => (w.worked > 0 ? w.worked : null), 'max')
  if (mostActive) poolInsights.push({ label: 'Most Active Worker', name: mostActive.name, value: `${mostActive.value} shifts`, color: '#DB2777', icon: <Flame size={14} /> })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
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
        .report-block-highlighted {
          animation: reportBlockPop 0.4s ease-out both;
          border-color: #F97316 !important;
        }
      `}</style>

      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, minHeight: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Report
            </h1>
          </div>
          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* Internal / Casual Worker toggle — same placement/design as the Tasks page's Kanban / Deadline Calendar switcher */}
        <div style={{ padding: '0 28px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <WorkforceTabToggle value={workforceTab} onChange={setWorkforceTab} />
          </div>
        </div>

        <div style={{ padding: '4px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {error && (
            <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.875rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* ── Top KPI block — Company Overview (Internal) / Casual Worker Pool Analytics ── */}
          <ShowcaseCard
            icon={<Users size={15} style={{ color: '#F97316' }} />}
            title={workforceTab === 'internal' ? 'Company Overview' : 'Casual Worker Pool Analytics'}
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
            {workforceTab === 'internal' ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
            ) : (
              /* Pool analytics: every KPI counts each casual worker once — never per shift/task. */
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <RateCard
                  label="Rehire Rate" format="percent" judged
                  value={report?.overview.casual_rehire_rate ?? null} previous={report?.previous_overview.casual_rehire_rate ?? null}
                  icon={<Repeat size={15} />} accentBg="#FFF7ED" accentColor="#F97316" loading={loading}
                />
                <RateCard
                  label="Reliable Worker Rate" format="percent" judged
                  value={report?.overview.casual_reliable_worker_rate ?? null} previous={report?.previous_overview.casual_reliable_worker_rate ?? null}
                  icon={<ShieldCheck size={15} />} accentBg="#F5F3FF" accentColor="#7C3AED" loading={loading}
                />
                <RateCard
                  label="On-time Attendance Rate" format="percent" judged
                  value={report?.overview.casual_on_time_attendance_rate ?? null} previous={report?.previous_overview.casual_on_time_attendance_rate ?? null}
                  icon={<UserCheck size={15} />} accentBg="#ECFDF5" accentColor="#10B981" loading={loading}
                />
                <RateCard
                  label="On-Time Task Completion Rate" format="percent" judged
                  value={report?.overview.casual_on_time_task_completion_rate ?? null} previous={report?.previous_overview.casual_on_time_task_completion_rate ?? null}
                  icon={<ClipboardList size={15} />} accentBg="#EFF6FF" accentColor="#3B82F6" loading={loading}
                />
              </div>
            )}
          </ShowcaseCard>

          {workforceTab === 'internal' ? (
            /* ── Internal Analytics — left column: Company Insights over the Casual Worker
               Cost pie; right side: the 4 department bar charts in a 2×2 grid. Sized compact
               so the whole page fits without vertical scrolling. */
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.75fr) 2.2fr', gridTemplateRows: 'auto auto', gap: 16, alignItems: 'stretch' }}>
              {/* CSS subgrid — this column and the 4-chart column (below) both opt into the SAME
                  outer row tracks via gridTemplateRows: 'subgrid', so row 1 (Recent Anomalies /
                  Attendance / Task) and row 2 (Cost Distribution / Hiring / Time to Fill) size to
                  whichever cell in that row is naturally tallest, on both sides at once — no
                  manual pixel guessing, no JS measuring, and it stays correct if any chart's
                  content height changes later. */}
              <div style={{ display: 'grid', gridTemplateRows: 'subgrid', gridRow: '1 / 3', gap: 16 }}>
                <ShowcaseCard icon={<AlertTriangle size={15} style={{ color: '#F97316' }} />} title="Recent Anomalies" fillHeight>
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
                    // Clamp instead of trusting state — safe even the render right after the
                    // array shrinks, before the setAnomalyIndex(0) above has committed.
                    const clampedIndex = Math.min(anomalyIndex, anomalies.length - 1)
                    const item = anomalies[clampedIndex]
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
                        <div style={{ border: '1px solid #F0F4F8', borderRadius: 10, overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{
                              borderRadius: 999, padding: '2px 8px', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                              background: item.severity === 'high' ? '#FEF2F2' : item.severity === 'medium' ? '#FFF7ED' : '#FFFBEB',
                              color: item.severity === 'high' ? '#B91C1C' : item.severity === 'medium' ? '#C2410C' : '#B45309',
                            }}>{item.severity}</span>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 600 }}>{item.area}</span>
                          </div>
                          <div style={{ padding: '10px 12px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
                            <strong style={{ display: 'block', color: '#111827', fontSize: '0.8125rem', marginBottom: 5 }}>{item.title}</strong>
                            <p style={{ margin: '0 0 6px', color: '#6B7280', fontSize: '0.72rem', lineHeight: 1.5 }}>{item.evidence[0] ?? ''}</p>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, padding: '7px 9px', background: '#FFFBEB', borderRadius: 6, border: '1px solid #FDE68A' }}>
                              <AlertTriangle size={11} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                              <p style={{ margin: 0, color: '#92400E', fontSize: '0.7rem', fontWeight: 600 }}>{item.recommended_action}</p>
                            </div>
                          </div>
                        </div>
                        {anomalies.length > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => setAnomalyIndex(i => (i - 1 + anomalies.length) % anomalies.length)}
                              style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#374151', flexShrink: 0 }}
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#9CA3AF' }}>{clampedIndex + 1} / {anomalies.length}</span>
                            <button
                              type="button"
                              onClick={() => setAnomalyIndex(i => (i + 1) % anomalies.length)}
                              style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#374151', flexShrink: 0 }}
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </ShowcaseCard>

                <div ref={costChartRef} style={{ display: 'flex' }}>
                  <ShowcaseCard
                    icon={<DollarSign size={15} style={{ color: '#7C3AED' }} />} iconBg="#F5F3FF" title="Casual Worker Cost Distribution"
                    className={highlightedBlock === 'cost' ? 'report-block-highlighted' : undefined}
                    fillHeight
                  >
                    {loading ? (
                      <div style={{ height: '100%', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
                    ) : costChartData.length === 0 ? (
                      <div style={{ height: '100%', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>No Casual Worker cost recorded in this range</div>
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

              <div ref={internalBarChartsRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'subgrid', gridRow: '1 / 3', gap: 16 }}>
                <ShowcaseCard
                  icon={<UserCheck size={15} style={{ color: '#10B981' }} />} iconBg="#ECFDF5" title="On-time Attendance Rate"
                  className={highlightedBlock === 'attendance' ? 'report-block-highlighted' : undefined}
                >
                  <DeptRateBarChart
                    data={attendanceChartData} loading={loading} barColor="#10B981" tooltipSuffix="% on time"
                    emptyMessage="No internal-staff attendance judged in this range"
                  />
                </ShowcaseCard>

                <ShowcaseCard
                  icon={<Building2 size={15} style={{ color: '#3B82F6' }} />} iconBg="#EFF6FF" title="On-time Task Completion Rate"
                  className={highlightedBlock === 'task' ? 'report-block-highlighted' : undefined}
                >
                  <DeptRateBarChart
                    data={taskCompletionChartData} loading={loading} barColor="#3B82F6" tooltipSuffix="% completed on time"
                    emptyMessage="No internal-staff task has a deadline in this range" orientation="column"
                  />
                </ShowcaseCard>

                <ShowcaseCard
                  icon={<Briefcase size={15} style={{ color: '#F97316' }} />} iconBg="#FFF7ED" title="Hiring Success Rate"
                  className={highlightedBlock === 'hiring' ? 'report-block-highlighted' : undefined}
                >
                  <DeptRateBarChart
                    data={hiringChartData} loading={loading} barColor="#F97316" tooltipSuffix="% hired"
                    emptyMessage="No Closed posting created in this range" orientation="column"
                  />
                </ShowcaseCard>

                <ShowcaseCard
                  icon={<ClipboardList size={15} style={{ color: '#0284C7' }} />} iconBg="#F0F9FF" title="Average Time to Fill"
                  className={highlightedBlock === 'timeToFill' ? 'report-block-highlighted' : undefined}
                >
                  <DeptRateBarChart
                    data={timeToFillChartData} loading={loading} barColor="#0284C7" tooltipSuffix=" days to fill" unit="days"
                    emptyMessage="No fully-filled posting created in this range"
                  />
                </ShowcaseCard>
              </div>
            </div>
          ) : (
            /* ── Casual Worker Pool Analytics — everything below is charted "by Worker",
               never by department. Internal answers "which department has a problem?";
               this answers "which people in our pool are worth rehiring?" */
            <div style={{ display: 'grid', gridTemplateColumns: '2.15fr minmax(260px, 0.8fr)', gap: 16, alignItems: 'stretch' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div ref={casualBarChartsRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <ShowcaseCard icon={<Repeat size={15} style={{ color: '#F97316' }} />} title="Rehire Count by Worker">
                    <WorkerCountBarChart
                      data={rehireChartData} loading={loading} barColor="#F97316" tooltipSuffix=" lifetime shifts"
                      emptyMessage="No casual worker has a prior completed shift with this company"
                    />
                  </ShowcaseCard>

                  <ShowcaseCard icon={<Flame size={15} style={{ color: '#DB2777' }} />} title="Shifts Worked by Worker">
                    <WorkerCountBarChart
                      data={shiftsWorkedChartData} loading={loading} barColor="#DB2777" tooltipSuffix=" shifts this period"
                      emptyMessage="No casual worker shifts in this range"
                    />
                  </ShowcaseCard>

                  <ShowcaseCard icon={<UserCheck size={15} style={{ color: '#10B981' }} />} title="On-time Attendance Rate by Worker">
                    <DeptRateBarChart
                      data={workerAttendanceChartData} loading={loading} barColor="#10B981" tooltipSuffix="% on time"
                      emptyMessage="No casual worker attendance judged in this range"
                    />
                  </ShowcaseCard>

                  <ShowcaseCard icon={<ClipboardCheck size={15} style={{ color: '#3B82F6' }} />} title="On-Time Task Completion Rate by Worker">
                    <DeptRateBarChart
                      data={workerTaskChartData} loading={loading} barColor="#3B82F6" tooltipSuffix="% completed on time"
                      emptyMessage="No casual worker task has a deadline in this range"
                    />
                  </ShowcaseCard>
                </div>

                <div ref={skillDonutRef}>
                  <ShowcaseCard icon={<Users size={15} style={{ color: '#7C3AED' }} />} title="Worker Skill Distribution" fillHeight>
                    {loading ? (
                      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
                    ) : skillChartData.length === 0 ? (
                      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>No listed skills among workers in this range</div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={skillChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                              label={renderPieSliceLabel}
                              labelLine={false}
                              isAnimationActive={false}
                            >
                              {skillChartData.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
                            </Pie>
                            <Tooltip
                              contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit' }}
                              itemStyle={{ fontFamily: 'inherit', fontWeight: 600 }}
                              labelStyle={{ fontFamily: 'inherit' }}
                              formatter={(v, n) => [`${v} worker${Number(v) === 1 ? '' : 's'}`, n]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center', marginTop: 4 }}>
                          {skillChartData.map(d => (
                            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: d.fill, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{d.name} · {d.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </ShowcaseCard>
                </div>
              </div>

              <ShowcaseCard icon={<Award size={15} style={{ color: '#F97316' }} />} title="Pool Insights">
                {loading ? (
                  <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
                ) : poolInsights.length === 0 ? (
                  <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>No casual worker data in this range</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {poolInsights.map((item, i) => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid #F1F5F9' }}>
                        <div style={{ width: 26, height: 26, borderRadius: 8, background: `${item.color}1A`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {item.icon}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8' }}>{item.label}</p>
                          <p style={{ margin: '1px 0 0', fontSize: '0.8125rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                        </div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: item.color, flexShrink: 0 }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ShowcaseCard>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
