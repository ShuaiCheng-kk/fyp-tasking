'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  AlertTriangle, Briefcase, Building2, ChevronDown, Download,
  Minus, Sparkles, TrendingDown, TrendingUp, UserCheck, Users,
} from 'lucide-react'
import {
  BarChart, Bar, Funnel, FunnelChart, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { ShowcaseCard } from '@/components/panel'
import { AIAnomaly } from '@/types/AI'
import { CompanyReport } from '@/types/Report'

type Department = { id: string; name: string }

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

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    const from = prevRef.current
    const to = value
    if (from === to) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / 500, 1)
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else prevRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value])
  return <>{display.toLocaleString()}</>
}

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

function TrendTag({ current, previous, format, judged }: {
  current: number | null
  previous: number | null
  format: 'percent' | 'money'
  // true = an increase reads as an improvement (attendance / on-time / fill rate).
  // false = neither direction is inherently good or bad (labor cost) — shown in neutral gray.
  judged: boolean
}) {
  if (current === null || previous === null) return null
  const delta = format === 'money' ? Math.round((current - previous) * 100) / 100 : current - previous
  const magnitude = format === 'money' ? `$${Math.abs(delta).toLocaleString()}` : `${Math.abs(delta)}%`
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const color = !judged || delta === 0 ? '#94A3B8' : delta > 0 ? '#059669' : '#DC2626'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color }}>
      <Icon size={12} /> {magnitude} <span style={{ fontWeight: 500, color: '#9CA3AF' }}>vs last period</span>
    </span>
  )
}

// ─── Overview rate card ─────────────────────────────────────────────────────────

function RateCard({
  label, value, previous, format, judged, icon, accentBg, accentColor, loading,
}: {
  label: string
  value: number | null
  previous: number | null
  format: 'percent' | 'money'
  judged: boolean
  icon: React.ReactNode
  accentBg: string
  accentColor: string
  loading?: boolean
}) {
  const display = value === null
    ? 'No data'
    : format === 'percent' ? `${value}%` : `$${Math.round(value).toLocaleString()}`
  return (
    <article className="report-stat-card" style={{
      background: '#FFFFFF',
      borderRadius: 16,
      padding: '16px 18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)',
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
        <div className="stat-icon" style={{ width: 32, height: 32, borderRadius: 10, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accentColor }}>
          {icon}
        </div>
      </div>
      <div>
        <p style={{ fontSize: 26, fontWeight: 800, color: value === null ? '#CBD5E1' : '#0F172A', lineHeight: 1, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
          {loading ? <Spinner size={14} dark /> : display}
        </p>
        {!loading && <TrendTag current={value} previous={previous} format={format} judged={judged} />}
      </div>
    </article>
  )
}

const filterInputStyle: React.CSSProperties = {
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  background: '#FFFFFF',
  color: '#374151',
  padding: '7px 10px',
  fontSize: '0.8125rem',
  fontWeight: 500,
  outline: 'none',
  height: 36,
  boxSizing: 'border-box',
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM)
  const [dateTo, setDateTo] = useState(YESTERDAY)
  const [report, setReport] = useState<CompanyReport | null>(null)
  const [anomalies, setAnomalies] = useState<AIAnomaly[]>([])
  const [anomaliesRequested, setAnomaliesRequested] = useState(false)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchReport = useCallback(async (
    cid: string,
    from = dateFrom,
    to = dateTo,
    dept = departmentId,
  ) => {
    if (!cid) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ company_id: cid, date_from: from, date_to: to })
      if (dept) params.set('department_id', dept)
      const res = await fetch(`/api/report/company?${params}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to fetch report')
      setReport(data.report)
      setAnomalies([])
      setAnomaliesRequested(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, departmentId])

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
      const deptData = await deptRes.json()
      if (!cancelled && companyData.success) setCurrentPlan(companyData.company?.plan ?? 'Free')
      if (!cancelled && deptData.success) setDepartments(deptData.departments ?? [])
      if (!cancelled) await fetchReport(cid)
    }
    void run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const detectAnomalies = async () => {
    if (!companyId) return
    setAiLoading(true)
    setError('')
    setAnomaliesRequested(true)
    try {
      const params = new URLSearchParams({ company_id: companyId, date_from: dateFrom, date_to: dateTo })
      if (departmentId) params.set('department_id', departmentId)
      const res = await fetch(`/api/ai/anomalies?${params}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to detect anomalies')
      setAnomalies(data.anomalies ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect anomalies')
    } finally {
      setAiLoading(false)
    }
  }

  // UC64 — export every real number the report computed, grouped the same way the page shows it.
  const exportCsv = () => {
    if (!report) return
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const line = (cells: (string | number)[]) => cells.map(esc).join(',')
    const rows: string[] = []

    rows.push(line(['Report period', `${report.period.date_from} to ${report.period.date_to}`]))
    rows.push('')
    rows.push(line(['Overview']))
    rows.push(line(['Metric', 'Value']))
    rows.push(line(['Attendance rate', report.overview.attendance_rate === null ? 'No data' : `${report.overview.attendance_rate}%`]))
    rows.push(line(['Task on-time completion rate', report.overview.on_time_completion_rate === null ? 'No data' : `${report.overview.on_time_completion_rate}%`]))
    rows.push(line(['Recruitment fill rate', report.overview.recruitment_fill_rate === null ? 'No data' : `${report.overview.recruitment_fill_rate}%`]))
    rows.push(line(['Total labor cost', report.overview.labor_cost]))
    rows.push(line(['Assignments with no rate on file', report.overview.uncosted_assignments]))
    rows.push(line(['Total shifts', report.overview.total_shifts]))
    rows.push(line(['Total assignments', report.overview.total_assignments]))
    rows.push(line(['Total tasks', report.overview.total_tasks]))
    rows.push(line(['Total confirmed hires', report.overview.total_hires]))
    rows.push('')

    rows.push(line(['Department & Manager Performance']))
    rows.push(line(['Department', 'Manager(s)', 'Shifts', 'Assignments', 'Tasks Total', 'Tasks Completed', 'On-Time Rate', 'Rework', 'Overdue Open', 'Late', 'Absent', 'Labor Cost']))
    report.departments.forEach(row => rows.push(line([
      row.department_name, row.manager_names.join('; '), row.shifts, row.assignments,
      row.tasks_total, row.tasks_completed, row.on_time_rate === null ? 'No data' : `${row.on_time_rate}%`,
      row.rework_count, row.overdue_open, row.late_count, row.absent_count, row.labor_cost,
    ])))
    rows.push('')

    rows.push(line(['Casual Worker Reliability']))
    rows.push(line(['Worker', 'Shifts Worked', 'Rejected Shifts', 'Late', 'Absent']))
    report.casual.workers.forEach(row => rows.push(line([row.full_name, row.worked, row.rejected_shifts, row.late, row.absent])))
    rows.push('')

    rows.push(line(['Recruitment Postings']))
    rows.push(line(['Title', 'Department', 'Status', 'Openings', 'Applicants', 'Accepted', 'Confirmed', 'Days to Fill']))
    report.casual.postings.forEach(row => rows.push(line([
      row.title, row.department_name ?? '—', row.status, row.openings ?? '—',
      row.applicants, row.accepted, row.confirmed, row.days_to_fill ?? 'Not yet filled',
    ])))

    const csv = rows.join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `tasking-report-${dateFrom}-to-${dateTo}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const deptChartData = (report?.departments ?? [])
    .filter(d => d.on_time_rate !== null)
    .slice(0, 10)
    .map(d => ({
      name: d.department_name.length > 14 ? d.department_name.slice(0, 13) + '…' : d.department_name,
      on_time_rate: d.on_time_rate as number,
    }))

  const funnelData = report ? [
    { name: 'Applied', value: report.casual.funnel.applied, fill: '#94A3B8' },
    { name: 'Accepted', value: report.casual.funnel.accepted, fill: '#F97316' },
    { name: 'Confirmed', value: report.casual.funnel.confirmed, fill: '#059669' },
  ] : []

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
        .report-tr:hover td { background: #FFF7ED !important; }
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

        <div style={{ padding: '4px 28px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Filter bar ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            <input type="date" value={dateFrom} max={YESTERDAY} onChange={e => setDateFrom(e.target.value)} style={filterInputStyle} />
            <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>to</span>
            <input type="date" value={dateTo} max={YESTERDAY} onChange={e => setDateTo(e.target.value)} style={filterInputStyle} />
            <div style={{ position: 'relative' }}>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                style={{ ...filterInputStyle, paddingRight: 28, appearance: 'none', cursor: 'pointer' }}
              >
                <option value="">All departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
            </div>
            <button onClick={() => fetchReport(companyId)} disabled={loading || !companyId} style={actionBtn('#374151', loading || !companyId)}>
              {loading ? <Spinner size={13} /> : null} Apply
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={exportCsv} disabled={!report} style={actionBtn('#F97316', !report)}>
                <Download size={13} /> Export CSV
              </button>
              <button onClick={detectAnomalies} disabled={aiLoading || !companyId} style={actionBtn('#7C3AED', aiLoading || !companyId)}>
                {aiLoading ? <Spinner size={13} /> : <Sparkles size={13} />} Detect Anomalies
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.875rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* ── Overview (top) ─────────────────────────────────────────────── */}
          <ShowcaseCard icon={<Users size={15} style={{ color: '#F97316' }} />} title="Overview — This Period vs. Last Period">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <RateCard
                label="Attendance Rate" format="percent" judged
                value={report?.overview.attendance_rate ?? null} previous={report?.previous_overview.attendance_rate ?? null}
                icon={<UserCheck size={15} />} accentBg="#ECFDF5" accentColor="#10B981" loading={loading}
              />
              <RateCard
                label="Task On-Time Rate" format="percent" judged
                value={report?.overview.on_time_completion_rate ?? null} previous={report?.previous_overview.on_time_completion_rate ?? null}
                icon={<Building2 size={15} />} accentBg="#EFF6FF" accentColor="#3B82F6" loading={loading}
              />
              <RateCard
                label="Recruitment Fill Rate" format="percent" judged
                value={report?.overview.recruitment_fill_rate ?? null} previous={report?.previous_overview.recruitment_fill_rate ?? null}
                icon={<Briefcase size={15} />} accentBg="#FFF7ED" accentColor="#F97316" loading={loading}
              />
              <RateCard
                label="Labor Cost" format="money" judged={false}
                value={report?.overview.labor_cost ?? null} previous={report?.previous_overview.labor_cost ?? null}
                icon={<Sparkles size={15} />} accentBg="#F5F3FF" accentColor="#7C3AED" loading={loading}
              />
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
              {[
                { label: 'Shifts', value: report?.overview.total_shifts ?? 0 },
                { label: 'Assignments', value: report?.overview.total_assignments ?? 0 },
                { label: 'Tasks', value: report?.overview.total_tasks ?? 0 },
                { label: 'Confirmed Hires', value: report?.overview.total_hires ?? 0 },
              ].map(item => (
                <div key={item.label}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#334155' }}>{loading ? <Spinner size={12} dark /> : <AnimatedNumber value={item.value} />}</span>
                  <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginLeft: 6 }}>{item.label}</span>
                </div>
              ))}
              {report && report.overview.uncosted_assignments > 0 && (
                <div>
                  <span style={{ fontSize: 12, color: '#D97706', fontWeight: 700 }}>{report.overview.uncosted_assignments} assignment(s) have no pay rate on file</span>
                </div>
              )}
            </div>
          </ShowcaseCard>

          {/* ── Left: Department/Manager · Right: Casual Workforce ───────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(440px, 1.35fr) minmax(380px, 1fr)', gap: 20, alignItems: 'start' }}>

            {/* ── Left · Department & Manager ─────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <ShowcaseCard icon={<Building2 size={15} style={{ color: '#F97316' }} />} title="Department On-Time Task Completion">
                {loading ? (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
                ) : deptChartData.length === 0 ? (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>No department has a task with both a deadline and a completion date in this range</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(160, deptChartData.length * 40)}>
                    <BarChart data={deptChartData} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={(v) => [`${v}% completed on time`, '']} />
                      <Bar dataKey="on_time_rate" fill="#F97316" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ShowcaseCard>

              <ShowcaseCard icon={<Building2 size={15} style={{ color: '#F97316' }} />} title="Department & Manager Performance">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        <th style={thStyle('left')}>Department</th>
                        <th style={thStyle('left')}>Manager</th>
                        <th style={thStyle('center')}>Shifts</th>
                        <th style={thStyle('center')} title="Assignments">Assigned</th>
                        <th style={thStyle('center')}>Tasks</th>
                        <th style={thStyle('center')}>On-Time</th>
                        <th style={thStyle('center')} title="Rework / Overdue">Rework/OD</th>
                        <th style={thStyle('center')} title="Late / Absent">Late/Abs</th>
                        <th style={thStyle('center')}>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={9} style={{ padding: '28px 20px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.875rem' }}>Loading…</td></tr>
                      ) : (report?.departments.length ?? 0) === 0 ? (
                        <tr><td colSpan={9} style={{ padding: '28px 20px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.875rem' }}>No department data for this range.</td></tr>
                      ) : report?.departments.map((row, i) => (
                        <tr key={row.department_id ?? 'none'} className="report-tr" style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                          <td style={{ ...tdStyle('left'), fontWeight: 600, color: '#111827', padding: 0 }}>
                            <div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', padding: '11px 12px' }} title={row.department_name}>{row.department_name}</div>
                          </td>
                          <td style={{ ...tdStyle('left'), padding: 0 }}>
                            <div style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', padding: '11px 12px' }} title={row.manager_names.join(', ')}>{row.manager_names.length > 0 ? row.manager_names.join(', ') : '—'}</div>
                          </td>
                          <td style={tdStyle('center')}>{row.shifts}</td>
                          <td style={tdStyle('center')}>{row.assignments}</td>
                          <td style={tdStyle('center')}>{row.tasks_completed}/{row.tasks_total}</td>
                          <td style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid #F0F4F8' }}><RateBadge value={row.on_time_rate} /></td>
                          <td style={{ ...tdStyle('center'), color: (row.rework_count + row.overdue_open) > 0 ? '#DC2626' : '#4A5568', fontWeight: (row.rework_count + row.overdue_open) > 0 ? 700 : 500 }}>{row.rework_count}/{row.overdue_open}</td>
                          <td style={{ ...tdStyle('center'), color: (row.late_count + row.absent_count) > 0 ? '#D97706' : '#4A5568', fontWeight: (row.late_count + row.absent_count) > 0 ? 700 : 500 }}>{row.late_count}/{row.absent_count}</td>
                          <td style={{ ...tdStyle('center'), fontWeight: 700, color: '#111827' }}>{money(row.labor_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ShowcaseCard>
            </div>

            {/* ── Right · Casual Workforce ─────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              <ShowcaseCard icon={<Briefcase size={15} style={{ color: '#F97316' }} />} title="Recruitment Funnel">
                {loading ? (
                  <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
                ) : funnelData.every(d => d.value === 0) ? (
                  <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>No postings created in this range</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <FunnelChart>
                        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={(v, n) => [`${v}`, String(n)]} />
                        {/* isAnimationActive off: this recharts build only shows Funnel labels once
                            its entrance-animation-end callback fires, which is unreliable — the
                            plain-text legend below is the labels that are guaranteed to render. */}
                        <Funnel dataKey="value" data={funnelData} isAnimationActive={false} />
                      </FunnelChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 2 }}>
                      {funnelData.map(d => (
                        <div key={d.name} style={{ textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: d.fill }}>{d.value}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{d.name}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                      <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Fill Rate: </span>
                      <RateBadge value={report?.casual.fill_rate ?? null} />
                    </div>
                  </>
                )}
              </ShowcaseCard>

              <ShowcaseCard icon={<Briefcase size={15} style={{ color: '#F97316' }} />} title="Recruitment Postings">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        <th style={thStyle('left')}>Title</th>
                        <th style={thStyle('center')}>Openings</th>
                        <th style={thStyle('center')} title="Applied → Accepted → Confirmed">Funnel</th>
                        <th style={thStyle('center')}>Days to Fill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={4} style={{ padding: '24px 16px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.8125rem' }}>Loading…</td></tr>
                      ) : (report?.casual.postings.length ?? 0) === 0 ? (
                        <tr><td colSpan={4} style={{ padding: '24px 16px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.8125rem' }}>No postings created in this range.</td></tr>
                      ) : report?.casual.postings.map((row, i) => (
                        <tr key={row.posting_id} className="report-tr" style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                          <td style={{ ...tdStyle('left'), fontWeight: 600, color: '#111827', padding: 0 }}>
                            <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', padding: '11px 12px' }} title={row.title}>{row.title}</div>
                          </td>
                          <td style={tdStyle('center')}>{row.openings ?? '—'}</td>
                          <td style={tdStyle('center')} title="Applied → Accepted → Confirmed">{row.applicants}→{row.accepted}→{row.confirmed}</td>
                          <td style={tdStyle('center')}>{row.days_to_fill !== null ? `${row.days_to_fill}d` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ShowcaseCard>

              <ShowcaseCard icon={<UserCheck size={15} style={{ color: '#F97316' }} />} title="Casual Worker Reliability">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Worker', 'Worked', 'Rejected', 'Late', 'Absent'].map(col => (
                          <th key={col} style={thStyle(col === 'Worker' ? 'left' : 'center')}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={5} style={{ padding: '24px 16px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.8125rem' }}>Loading…</td></tr>
                      ) : (report?.casual.workers.length ?? 0) === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '24px 16px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.8125rem' }}>No casual worker shifts in this range.</td></tr>
                      ) : report?.casual.workers.slice(0, 10).map((row, i) => (
                        <tr key={row.user_id} className="report-tr" style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                          <td style={{ ...tdStyle('left'), fontWeight: 600, color: '#111827' }}>{row.full_name}</td>
                          <td style={tdStyle('center')}>{row.worked}</td>
                          <td style={{ ...tdStyle('center'), color: row.rejected_shifts > 0 ? '#DC2626' : '#4A5568', fontWeight: row.rejected_shifts > 0 ? 700 : 500 }}>{row.rejected_shifts}</td>
                          <td style={{ ...tdStyle('center'), color: row.late > 0 ? '#D97706' : '#4A5568', fontWeight: row.late > 0 ? 700 : 500 }}>{row.late}</td>
                          <td style={{ ...tdStyle('center'), color: row.absent > 0 ? '#DC2626' : '#4A5568', fontWeight: row.absent > 0 ? 700 : 500 }}>{row.absent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ShowcaseCard>

              <ShowcaseCard icon={<Users size={15} style={{ color: '#F97316' }} />} title="Verified Casual Worker Pool">
                <div>
                  {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}><Spinner size={16} dark /></div>
                  ) : (report?.casual.pool.length ?? 0) === 0 ? (
                    <p style={{ margin: '14px 0 4px', color: '#9CA3AF', fontSize: '0.8125rem', textAlign: 'center' }}>No verified pool workers yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {report?.casual.pool.map((w, i) => (
                        <div key={w.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #F1F5F9' }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.full_name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#9CA3AF' }}>{w.skills || 'No listed skills'}</p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#059669' }}>{w.completed_shifts} shifts</p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#9CA3AF' }}>last {w.last_worked_date ? w.last_worked_date : '—'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ShowcaseCard>

            </div>
          </div>

          {/* ── AI Anomaly Detection — only appears once "Detect Anomalies" has been run ── */}
          {anomaliesRequested && (
            <ShowcaseCard icon={<AlertTriangle size={15} style={{ color: '#F97316' }} />} title="AI Anomaly Detection">
              {aiLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}><Spinner size={16} dark /> <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>Analyzing this period&apos;s data…</span></div>
              ) : anomalies.length === 0 ? (
                <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.8125rem' }}>No notable anomalies found in this period.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                  {anomalies.map(item => (
                    <div key={item.id} style={{ border: '1px solid #F0F4F8', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          borderRadius: 999, padding: '3px 10px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: item.severity === 'high' ? '#FEF2F2' : item.severity === 'medium' ? '#FFF7ED' : '#FFFBEB',
                          color: item.severity === 'high' ? '#B91C1C' : item.severity === 'medium' ? '#C2410C' : '#B45309',
                        }}>{item.severity}</span>
                        <span style={{ fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 600 }}>{item.area}</span>
                      </div>
                      <div style={{ padding: '12px 16px' }}>
                        <strong style={{ display: 'block', color: '#111827', fontSize: '0.875rem', marginBottom: 6 }}>{item.title}</strong>
                        <p style={{ margin: '0 0 8px', color: '#6B7280', fontSize: '0.78rem', lineHeight: 1.5 }}>{item.evidence[0] ?? ''}</p>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 10px', background: '#FFFBEB', borderRadius: 7, border: '1px solid #FDE68A' }}>
                          <AlertTriangle size={12} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                          <p style={{ margin: 0, color: '#92400E', fontSize: '0.75rem', fontWeight: 600 }}>{item.recommended_action}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ShowcaseCard>
          )}

        </div>
      </main>
    </div>
  )
}
