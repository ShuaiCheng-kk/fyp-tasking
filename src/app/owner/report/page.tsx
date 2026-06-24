'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  AlertTriangle, BarChart3, Briefcase, CheckSquare, ChevronDown,
  Clock, Crown, Download, Sparkles, Timer, TrendingDown,
  TrendingUp, Users, UserX,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { AIAnomaly } from '@/types/AI'
import { RecruitmentHistorySummary, WorkforceAnalyticsReport } from '@/types/Report'

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

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
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
  return <>{display.toLocaleString()}{suffix}</>
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

// ─── KPI stat card ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accentBg, accentColor, loading,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  accentBg: string
  accentColor: string
  loading?: boolean
}) {
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
        <p style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
          {loading ? <Spinner size={14} dark /> : (typeof value === 'number' ? <AnimatedNumber value={value} /> : value)}
        </p>
        {sub && <p style={{ margin: 0, fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500 }}>{sub}</p>}
      </div>
    </article>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>{title}</span>
    </div>
  )
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM)
  const [dateTo, setDateTo] = useState(YESTERDAY)
  const [report, setReport] = useState<WorkforceAnalyticsReport | null>(null)
  const [recruitment, setRecruitment] = useState<RecruitmentHistorySummary | null>(null)
  const [anomalies, setAnomalies] = useState<AIAnomaly[]>([])
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')

  // UC4 / UC5: Report tabs
  const [reportTab, setReportTab] = useState<'overview' | 'workforce' | 'anomalies'>('overview')
  // UC5: anomaly severity filter
  const [anomalySeverity, setAnomalySeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const fetchAll = useCallback(async (
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
      const [reportRes, recruitRes] = await Promise.all([
        fetch(`/api/report?${params}`),
        fetch(`/api/report/recruitment?${params}`),
      ])
      const reportData = await reportRes.json()
      const recruitData = await recruitRes.json()
      if (!reportData.success) throw new Error(reportData.message || 'Failed to fetch report')
      setReport(reportData.report)
      if (recruitData.success) setRecruitment(recruitData.recruitment)
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
      if (!cancelled && companyData.success) {
        setCompanyName(companyData.company?.name ?? '')
        setCurrentPlan(companyData.company?.plan ?? 'Free')
      }
      if (!cancelled && deptData.success) setDepartments(deptData.departments ?? [])
      if (!cancelled) await fetchAll(cid)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchAll])

  const summary = report?.summary
  const exportCsv = () => {
    if (!report) return
    const header = ['Department', 'Shifts', 'Assignments', 'Tasks', 'Completed', 'Completion %', 'Attendance', 'Approved', 'Rejected']
    const rows = report.departments.map(row => [
      row.department_name,
      row.shifts,
      row.assignments,
      row.tasks,
      row.completed_tasks,
      row.tasks > 0 ? `${Math.round((row.completed_tasks / row.tasks) * 100)}%` : '0%',
      row.attendance_records,
      row.approved_attendance,
      row.rejected_attendance,
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `tasking-report-${dateFrom}-to-${dateTo}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const detectAnomalies = async () => {
    if (!companyId) return
    setAiLoading(true)
    setError('')
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

  // Chart data
  const taskDonutData = report ? [
    { name: 'Assigned',    value: report.task_breakdown.assigned,    color: '#94A3B8' },
    { name: 'In Progress', value: report.task_breakdown.in_progress,  color: '#4F46E5' },
    { name: 'Review',      value: report.task_breakdown.review,       color: '#D97706' },
    { name: 'Complete',    value: report.task_breakdown.complete,      color: '#059669' },
  ].filter(d => d.value > 0) : []

  const deptBarData = report?.departments.slice(0, 8).map(d => ({
    name: d.department_name.length > 14 ? d.department_name.slice(0, 13) + '…' : d.department_name,
    tasks: d.tasks,
    completed: d.completed_tasks,
    pct: d.tasks > 0 ? Math.round((d.completed_tasks / d.tasks) * 100) : 0,
  })) ?? []

  const totalDonutTasks = taskDonutData.reduce((s, d) => s + d.value, 0)

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
        .report-stat-card:nth-child(2) { animation: fadeSlideUp 0.34s ease both 0.07s; }
        .report-stat-card:nth-child(3) { animation: fadeSlideUp 0.34s ease both 0.10s; }
        .report-stat-card:nth-child(4) { animation: fadeSlideUp 0.34s ease both 0.13s; }
        .report-stat-card:nth-child(5) { animation: fadeSlideUp 0.34s ease both 0.16s; }
        .report-stat-card:nth-child(6) { animation: fadeSlideUp 0.34s ease both 0.19s; }
        .report-stat-card:nth-child(7) { animation: fadeSlideUp 0.34s ease both 0.22s; }
        .report-stat-card:nth-child(8) { animation: fadeSlideUp 0.34s ease both 0.25s; }
        .report-panel { transition: box-shadow 0.2s ease; }
        .report-panel:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.09), 0 0 0 1.5px rgba(0,0,0,0.06) !important; }
        .report-filter-input {
          border: 1px solid #E2E8F0;
          borderRadius: 8px;
          background: #FFFFFF;
          color: #374151;
          padding: 7px 10px;
          fontSize: 0.8125rem;
          fontWeight: 500;
          outline: none;
          height: 36px;
        }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* ── UC4/UC5: Tab bar ──────────────────────────────────────────────────── */}
        <div style={{ padding: '8px 28px 0', display: 'flex', gap: 2, flexShrink: 0, borderBottom: '1.5px solid #E2E8F0' }}>
          {([
            { key: 'overview',  label: 'Overview' },
            { key: 'workforce', label: 'Workforce Analytics' },
            { key: 'anomalies', label: 'Anomaly Detection' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setReportTab(tab.key)}
              style={{
                padding: '9px 20px 10px',
                border: 'none',
                borderBottom: reportTab === tab.key ? '2.5px solid #F97316' : '2.5px solid transparent',
                borderRadius: 0,
                fontWeight: reportTab === tab.key ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                background: 'transparent',
                color: reportTab === tab.key ? '#0F172A' : '#94A3B8',
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: -1.5,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '28px 28px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Overview tab ────────────────────────────────────────────────── */}
          {reportTab === 'overview' && <>

          {/* ── A · Filters row ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            <input
              type="date"
              value={dateFrom}
              max={YESTERDAY}
              onChange={e => setDateFrom(e.target.value)}
              style={filterInputStyle}
            />
            <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>to</span>
            <input
              type="date"
              value={dateTo}
              max={YESTERDAY}
              onChange={e => setDateTo(e.target.value)}
              style={filterInputStyle}
            />
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
            <button
              onClick={() => fetchAll(companyId)}
              disabled={loading || !companyId}
              style={actionBtn('#374151', loading || !companyId)}
            >
              {loading ? <Spinner size={13} /> : <TrendingUp size={13} />} Apply
            </button>
            <button
              onClick={exportCsv}
              disabled={!report}
              style={actionBtn('#F97316', !report)}
            >
              <Download size={13} /> Export CSV
            </button>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.875rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* ── B · KPI Cards (8) ────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard label="Shifts"       value={summary?.shifts ?? 0}              sub={`${summary?.assignments ?? 0} assignments`}        icon={<TrendingUp size={15} />}   accentBg="#FFF7ED" accentColor="#F97316" loading={loading} />
            <StatCard label="Tasks"        value={summary?.tasks ?? 0}               sub={`${summary?.completed_tasks ?? 0} completed`}       icon={<CheckSquare size={15} />}  accentBg="#F5F3FF" accentColor="#7C3AED" loading={loading} />
            <StatCard label="Completion"   value={loading ? 0 : (summary?.task_completion_rate ?? 0)} sub="task completion rate"                       icon={<BarChart3 size={15} />}    accentBg="#EFF6FF" accentColor="#3B82F6" loading={loading} />
            <StatCard label="Attendance"   value={summary?.attendance_records ?? 0}  sub={`${summary?.pending_attendance ?? 0} pending`}      icon={<Clock size={15} />}        accentBg="#FFFBEB" accentColor="#F59E0B" loading={loading} />
            <StatCard label="Approved"     value={summary?.approved_attendance ?? 0} sub="attendance records"                                 icon={<Users size={15} />}        accentBg="#ECFDF5" accentColor="#10B981" loading={loading} />
            <StatCard label="Rejected"     value={summary?.rejected_attendance ?? 0} sub="attendance records"                                 icon={<TrendingDown size={15} />} accentBg="#FEF2F2" accentColor="#EF4444" loading={loading} />
            <StatCard label="Late Clock-in" value={summary?.late_attendance ?? 0}    sub="shifts with late arrival"                          icon={<Timer size={15} />}        accentBg="#FFF7ED" accentColor="#EA580C" loading={loading} />
            <StatCard label="Absent"       value={summary?.absent_count ?? 0}         sub="assignments w/o clock-in"                          icon={<UserX size={15} />}        accentBg="#F3F4F6" accentColor="#6B7280" loading={loading} />
          </div>

          {/* ── C · Charts + HR Requests ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr minmax(200px, 260px)', gap: 16, alignItems: 'start' }}>

            {/* Col 1 — Task Status Donut */}
            <div className="report-panel" style={panelStyle}>
              <SectionHeader icon={<CheckSquare size={15} style={{ color: '#F97316' }} />} title="Task Status" />
              {loading ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spinner size={20} dark />
                </div>
              ) : totalDonutTasks === 0 ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>No tasks in this range</div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={taskDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={88}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                      >
                        {taskDonutData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                        formatter={(v, n) => [`${v} tasks`, String(n)]}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{totalDonutTasks}</span>
                    <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>tasks</p>
                  </div>
                </div>
              )}
            </div>

            {/* Col 2 — Dept Performance Bar */}
            <div className="report-panel" style={panelStyle}>
              <SectionHeader icon={<BarChart3 size={15} style={{ color: '#F97316' }} />} title="Department Performance" />
              {loading ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spinner size={20} dark />
                </div>
              ) : deptBarData.length === 0 ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>No department data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={deptBarData} layout="vertical" margin={{ left: 4, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                      formatter={(v, n) => [v, n === 'tasks' ? 'Total' : 'Completed']}
                    />
                    <Bar dataKey="tasks" fill="#E2E8F0" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="completed" fill="#F97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Col 3 — HR Requests */}
            <div className="report-panel" style={panelStyle}>
              <SectionHeader icon={<Briefcase size={15} style={{ color: '#F97316' }} />} title="HR Requests" />
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                  <Spinner size={16} dark />
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Time Off</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {[
                      { label: 'Pending',  value: report?.hr_requests.time_off_pending ?? 0,  color: '#F59E0B' },
                      { label: 'Approved', value: report?.hr_requests.time_off_approved ?? 0, color: '#10B981' },
                      { label: 'Rejected', value: report?.hr_requests.time_off_rejected ?? 0, color: '#EF4444' },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{row.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: row.value > 0 ? row.color : '#CBD5E1' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 1, background: '#F1F5F9', marginBottom: 12 }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Shift Swaps</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: 'Pending',  value: report?.hr_requests.swap_pending ?? 0,  color: '#F59E0B' },
                      { label: 'Approved', value: report?.hr_requests.swap_approved ?? 0, color: '#10B981' },
                      { label: 'Rejected', value: report?.hr_requests.swap_rejected ?? 0, color: '#EF4444' },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{row.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: row.value > 0 ? row.color : '#CBD5E1' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Main row: Table + AI Sidebar ─────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

            {/* ── D · Department Performance Table ───────────────────────────── */}
            <div className="report-panel" style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={14} style={{ color: '#F97316' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Department Performance</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Department', 'Shifts', 'Assigned', 'Tasks', 'Done', 'Completion', 'Attendance', 'Approved', 'Rejected'].map(col => (
                        <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Department' ? 'left' : 'center', fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} style={{ padding: '28px 20px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.875rem' }}>Loading…</td></tr>
                    ) : (report?.departments.length ?? 0) === 0 ? (
                      <tr><td colSpan={9} style={{ padding: '28px 20px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.875rem' }}>No report data for this range.</td></tr>
                    ) : report?.departments.map((row, i) => {
                      const pct = row.tasks > 0 ? Math.round((row.completed_tasks / row.tasks) * 100) : 0
                      return (
                        <tr key={row.department_id ?? 'none'} className="report-tr" style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                          <td style={{ padding: '13px 14px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', borderBottom: '1px solid #F0F4F8' }}>{row.department_name}</td>
                          {[row.shifts, row.assignments, row.tasks, row.completed_tasks].map((val, j) => (
                            <td key={j} style={{ padding: '13px 14px', fontSize: '0.875rem', color: '#4A5568', textAlign: 'center', borderBottom: '1px solid #F0F4F8', fontWeight: 500 }}>{val}</td>
                          ))}
                          <td style={{ padding: '13px 14px', textAlign: 'center', borderBottom: '1px solid #F0F4F8' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                              background: pct >= 75 ? '#ECFDF5' : pct >= 40 ? '#FFFBEB' : '#FEF2F2',
                              color: pct >= 75 ? '#059669' : pct >= 40 ? '#D97706' : '#DC2626',
                            }}>{pct}%</span>
                          </td>
                          {[row.attendance_records, row.approved_attendance, row.rejected_attendance].map((val, j) => (
                            <td key={j} style={{ padding: '13px 14px', fontSize: '0.875rem', color: '#4A5568', textAlign: 'center', borderBottom: '1px solid #F0F4F8', fontWeight: 500 }}>{val}</td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── AI Anomalies — compact nudge in Overview tab ────────────────── */}
            <div className="report-panel" style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={14} style={{ color: '#7C3AED' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'block' }}>AI Anomaly Detection</span>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                    {anomalies.length > 0 ? `${anomalies.length} anomaly${anomalies.length > 1 ? 'ies' : ''} detected` : 'No anomalies detected yet'}
                  </span>
                </div>
                <button
                  onClick={() => setReportTab('anomalies')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  View Anomalies
                </button>
              </div>
            </div>
          </div>

          {/* ── E · Recruitment History ───────────────────────────────────────── */}
          <div className="report-panel" style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Briefcase size={14} style={{ color: '#F97316' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Recruitment History</span>
            </div>

            {/* Mini KPI row */}
            {recruitment && (
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #F0F4F8' }}>
                {[
                  { label: 'Past Postings',   value: recruitment.total_postings },
                  { label: 'Total Applicants', value: recruitment.total_applicants },
                  { label: 'Accepted',          value: recruitment.accepted },
                  { label: 'Conversion Rate',   value: `${recruitment.conversion_rate}%`, isStr: true },
                ].map((item, i) => (
                  <div key={item.label} style={{ flex: 1, padding: '14px 20px', borderRight: i < 3 ? '1px solid #F0F4F8' : 'none' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{item.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
                      {loading ? <Spinner size={12} dark /> : (item.isStr ? item.value : <AnimatedNumber value={item.value as number} />)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Title', 'Department', 'Status', 'Applicants', 'Accepted', 'Rejected', 'Date'].map(col => (
                      <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Title' || col === 'Department' ? 'left' : 'center', fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ padding: '28px 20px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.875rem' }}>Loading…</td></tr>
                  ) : (recruitment?.postings.length ?? 0) === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '28px 20px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.875rem' }}>No closed postings in this date range.</td></tr>
                  ) : recruitment?.postings.map((row, i) => (
                    <tr key={row.posting_id} className="report-tr" style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                      <td style={{ padding: '13px 14px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', borderBottom: '1px solid #F0F4F8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</td>
                      <td style={{ padding: '13px 14px', fontSize: '0.875rem', color: '#6B7280', borderBottom: '1px solid #F0F4F8' }}>{row.department_name ?? '—'}</td>
                      <td style={{ padding: '13px 14px', textAlign: 'center', borderBottom: '1px solid #F0F4F8' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: row.status === 'closed' ? '#FEF2F2' : '#F3F4F6', color: row.status === 'closed' ? '#DC2626' : '#6B7280' }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: '13px 14px', fontSize: '0.875rem', color: '#4A5568', textAlign: 'center', borderBottom: '1px solid #F0F4F8', fontWeight: 500 }}>{row.total_applicants}</td>
                      <td style={{ padding: '13px 14px', fontSize: '0.875rem', color: '#059669', textAlign: 'center', borderBottom: '1px solid #F0F4F8', fontWeight: 700 }}>{row.accepted}</td>
                      <td style={{ padding: '13px 14px', fontSize: '0.875rem', color: '#DC2626', textAlign: 'center', borderBottom: '1px solid #F0F4F8', fontWeight: 700 }}>{row.rejected}</td>
                      <td style={{ padding: '13px 14px', fontSize: '0.8125rem', color: '#9CA3AF', textAlign: 'center', borderBottom: '1px solid #F0F4F8' }}>{row.created_at.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          </> /* end Overview tab */ }

          {/* ── UC4: Workforce Analytics tab ────────────────────────────────── */}
          {reportTab === 'workforce' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Filters (reuse existing state) */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={dateFrom} max={YESTERDAY} onChange={e => setDateFrom(e.target.value)} style={filterInputStyle} />
                <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>to</span>
                <input type="date" value={dateTo} max={YESTERDAY} onChange={e => setDateTo(e.target.value)} style={filterInputStyle} />
                <div style={{ position: 'relative' }}>
                  <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} style={{ ...filterInputStyle, paddingRight: 28, appearance: 'none', cursor: 'pointer' }}>
                    <option value="">All departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
                <button onClick={() => fetchAll(companyId)} disabled={loading || !companyId} style={actionBtn('#374151', loading || !companyId)}>
                  {loading ? <Spinner size={13} /> : <TrendingUp size={13} />} Apply
                </button>
              </div>

              {/* 6 workforce metric cards */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <StatCard label="Total Shifts"      value={summary?.shifts ?? 0}               sub="in selected period"           icon={<TrendingUp size={15} />}   accentBg="#FFF7ED" accentColor="#F97316" loading={loading} />
                <StatCard label="Shift Hours"       value={loading ? 0 : (summary?.assignments ?? 0) * 8} sub="estimated (assignments × 8h)"  icon={<Clock size={15} />}        accentBg="#FFFBEB" accentColor="#F59E0B" loading={loading} />
                <StatCard label="Task Completion"   value={loading ? 0 : (summary?.task_completion_rate ?? 0)} sub="% tasks completed"             icon={<CheckSquare size={15} />}  accentBg="#F5F3FF" accentColor="#7C3AED" loading={loading} />
                <StatCard label="Attendance Rate"   value={loading ? 0 : (summary?.attendance_records ?? 0) > 0 ? Math.round(((summary?.approved_attendance ?? 0) / (summary?.attendance_records ?? 1)) * 100) : 0} sub="% approved attendance"         icon={<Users size={15} />}        accentBg="#ECFDF5" accentColor="#10B981" loading={loading} />
                <StatCard label="Utilisation"       value={loading ? 0 : (summary?.assignments ?? 0) > 0 ? Math.round(((summary?.shifts ?? 0) / Math.max(summary?.assignments ?? 1, 1)) * 100) : 0} sub="shift fill rate %"             icon={<BarChart3 size={15} />}    accentBg="#EFF6FF" accentColor="#3B82F6" loading={loading} />
                <StatCard label="Absence Risk"      value={summary?.absent_count ?? 0}          sub="assignments without clock-in"  icon={<UserX size={15} />}        accentBg="#FEF2F2" accentColor="#EF4444" loading={loading} />
              </div>

              {/* Hours by Department bar chart */}
              <div className="report-panel" style={panelStyle}>
                <SectionHeader icon={<BarChart3 size={15} style={{ color: '#F97316' }} />} title="Hours by Department (Estimated)" />
                {loading ? (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} dark /></div>
                ) : deptBarData.length === 0 ? (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>No department data for this range</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={deptBarData.map(d => ({ ...d, estimatedHours: d.tasks * 2 }))} layout="vertical" margin={{ left: 4, right: 16, top: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={(v) => [`${v} est. hrs`, 'Hours']} />
                      <Bar dataKey="estimatedHours" fill="#F97316" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9CA3AF' }}>* Estimated from task count. Actual hours tracking coming in a future update.</p>
              </div>

              {/* Workforce Risk Indicators table */}
              <div className="report-panel" style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={14} style={{ color: '#DC2626' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Workforce Risk Indicators</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Department', 'Workers', 'Avg Hours (est.)', 'Utilisation', 'Absent', 'Risk Level'].map(col => (
                          <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Department' ? 'left' : 'center', fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} style={{ padding: '28px 20px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.875rem' }}>Loading…</td></tr>
                      ) : (report?.departments.length ?? 0) === 0 ? (
                        <tr><td colSpan={6} style={{ padding: '28px 20px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.875rem' }}>No department data for this range.</td></tr>
                      ) : report?.departments.map((row, i) => {
                        const utilisationPct = row.assignments > 0 ? Math.round((row.shifts / Math.max(row.assignments, 1)) * 100) : 0
                        const riskLevel = row.rejected_attendance > 2 || utilisationPct < 50 ? 'High' : row.rejected_attendance > 0 || utilisationPct < 75 ? 'Medium' : 'Low'
                        const riskColor = riskLevel === 'High' ? { bg: '#FEF2F2', text: '#B91C1C' } : riskLevel === 'Medium' ? { bg: '#FFF7ED', text: '#C2410C' } : { bg: '#ECFDF5', text: '#047857' }
                        return (
                          <tr key={row.department_id ?? i} className="report-tr" style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                            <td style={{ padding: '13px 14px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', borderBottom: '1px solid #F0F4F8' }}>{row.department_name}</td>
                            <td style={{ padding: '13px 14px', fontSize: '0.875rem', color: '#4A5568', textAlign: 'center', borderBottom: '1px solid #F0F4F8' }}>{row.assignments}</td>
                            <td style={{ padding: '13px 14px', fontSize: '0.875rem', color: '#4A5568', textAlign: 'center', borderBottom: '1px solid #F0F4F8' }}>{row.assignments * 8}h</td>
                            <td style={{ padding: '13px 14px', textAlign: 'center', borderBottom: '1px solid #F0F4F8' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: utilisationPct >= 75 ? '#ECFDF5' : utilisationPct >= 50 ? '#FFFBEB' : '#FEF2F2', color: utilisationPct >= 75 ? '#059669' : utilisationPct >= 50 ? '#D97706' : '#DC2626' }}>{utilisationPct}%</span>
                            </td>
                            <td style={{ padding: '13px 14px', fontSize: '0.875rem', color: row.rejected_attendance > 0 ? '#DC2626' : '#4A5568', textAlign: 'center', borderBottom: '1px solid #F0F4F8', fontWeight: row.rejected_attendance > 0 ? 700 : 500 }}>{row.rejected_attendance}</td>
                            <td style={{ padding: '13px 14px', textAlign: 'center', borderBottom: '1px solid #F0F4F8' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: riskColor.bg, color: riskColor.text }}>{riskLevel}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ── UC5: Anomaly Detection tab ───────────────────────────────────── */}
          {reportTab === 'anomalies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Header + detect button + filters */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>Anomaly Detection</h2>
                  <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#6B7280' }}>Detect unusual scheduling, task, or attendance patterns across your workforce.</p>
                </div>
                <button
                  onClick={detectAnomalies}
                  disabled={aiLoading || !companyId}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: aiLoading || !companyId ? '#E5E7EB' : '#7C3AED', color: aiLoading || !companyId ? '#9CA3AF' : '#FFFFFF', fontSize: '0.8125rem', fontWeight: 700, cursor: aiLoading || !companyId ? 'default' : 'pointer' }}
                >
                  {aiLoading ? <Spinner size={13} /> : <Sparkles size={13} />} Detect Anomalies
                </button>
              </div>

              {/* Category pills + severity filter */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6B7280' }}>Category:</span>
                {(['Scheduling', 'Attendance', 'Task Patterns'] as const).map(cat => (
                  <span key={cat} style={{ padding: '4px 12px', borderRadius: 999, background: '#F3F4F6', color: '#374151', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #E5E7EB' }}>{cat}</span>
                ))}
                <div style={{ marginLeft: 'auto', position: 'relative' }}>
                  <select
                    value={anomalySeverity}
                    onChange={e => setAnomalySeverity(e.target.value as typeof anomalySeverity)}
                    style={{ ...filterInputStyle, paddingRight: 28, appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="all">All Severities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Anomaly cards */}
              {anomalies.length === 0 ? (
                <div className="report-panel" style={{ ...panelStyle, textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Sparkles size={20} color="#CBD5E0" />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#374151' }}>No anomalies detected yet</p>
                  <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: '#9CA3AF' }}>Click "Detect Anomalies" to analyse your workforce data for unusual patterns.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                  {anomalies
                    .filter(item => anomalySeverity === 'all' || item.severity === anomalySeverity)
                    .map(item => (
                      <div key={item.id} className="report-panel" style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ borderRadius: 999, padding: '3px 10px', background: item.severity === 'high' ? '#FEF2F2' : item.severity === 'medium' ? '#FFF7ED' : '#FFFBEB', color: item.severity === 'high' ? '#B91C1C' : item.severity === 'medium' ? '#C2410C' : '#B45309', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.severity}</span>
                          <button disabled title="Action flow coming in a future update" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#F8FAFC', color: '#9CA3AF', fontSize: 11, fontWeight: 600, cursor: 'not-allowed' }}>
                            Take Action
                          </button>
                        </div>
                        <div style={{ padding: '14px 18px' }}>
                          <strong style={{ display: 'block', color: '#111827', fontSize: '0.9rem', marginBottom: 6 }}>{item.title}</strong>
                          <p style={{ margin: '0 0 8px', color: '#6B7280', fontSize: '0.8rem', lineHeight: 1.5 }}>{item.evidence[0] ?? item.recommended_action}</p>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 10px', background: '#FFFBEB', borderRadius: 7, border: '1px solid #FDE68A' }}>
                            <AlertTriangle size={12} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                            <p style={{ margin: 0, color: '#92400E', fontSize: '0.78rem', fontWeight: 600 }}>{item.recommended_action}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

const panelStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 16,
  padding: '20px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)',
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
