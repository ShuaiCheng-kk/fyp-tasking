'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  BarChart3, Briefcase, CalendarDays, CheckSquare,
  ChevronDown, Clock, Download, Users, TrendingUp, ClipboardList, UserCog,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import ManagerSidebar from '@/components/ManagerSidebar'
import { WorkforceAnalyticsReport } from '@/types/Report'

const BLUE = '#2563EB'
const APP_BG = '#F1F5F9'
const PANEL = '#FFFFFF'
const BORDER = '#E5E7EB'

type Department = { id: string; name: string }
type AssignedDept = { department_id: string; department_name: string }

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

function Spinner({ size = 16, blue = false }: { size?: number; blue?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={blue ? 'rgba(37,99,235,0.2)' : 'rgba(17,24,39,0.12)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={blue ? BLUE : '#374151'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

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

function StatCard({
  label, value, sub, icon, accentBg, accentColor, loading,
}: {
  label: string; value: number | string; sub?: string
  icon: React.ReactNode; accentBg: string; accentColor: string; loading?: boolean
}) {
  return (
    <div style={{ background: PANEL, borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: `1px solid ${BORDER}`, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accentColor }}>
          {icon}
        </div>
      </div>
      <div>
        <p style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
          {loading ? <Spinner size={14} blue /> : (typeof value === 'number' ? <AnimatedNumber value={value} /> : value)}
        </p>
        {sub && <p style={{ margin: 0, fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500 }}>{sub}</p>}
      </div>
    </div>
  )
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: BLUE }}>
        {icon}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>{title}</span>
    </div>
  )
}

export default function ManagerReportPage() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [managerName, setManagerName] = useState('')
  const [managerId, setManagerId] = useState('')
  const [assignedDepts, setAssignedDepts] = useState<AssignedDept[]>([])
  const [allDepts, setAllDepts] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false)
  const deptDropdownRef = useRef<HTMLDivElement>(null)

  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM)
  const [dateTo, setDateTo] = useState(YESTERDAY)
  const [report, setReport] = useState<WorkforceAnalyticsReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) setDeptDropdownOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const fetchReport = useCallback(async (
    cid: string, from: string, to: string, deptId: string,
  ) => {
    if (!cid) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ company_id: cid, date_from: from, date_to: to })
      if (deptId) params.set('department_id', deptId)
      const res = await fetch(`/api/report?${params}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to fetch report')
      setReport(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }, [])

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

      const { id: internalId, full_name, company_id } = meData.user
      if (full_name) setManagerName(full_name)
      if (internalId) setManagerId(internalId)
      if (!company_id) { setInitLoading(false); return }

      setCompanyId(company_id)
      localStorage.setItem(`tasking_company_id_${authId}`, company_id)

      const [compRes, deptRes, assignedRes] = await Promise.all([
        fetch(`/api/company/current?user_id=${authId}&company_id=${company_id}`),
        fetch(`/api/company/departments?company_id=${company_id}`),
        fetch(`/api/manager/departments?manager_id=${internalId}&company_id=${company_id}`),
      ])
      const compData = await compRes.json()
      const deptData = await deptRes.json()
      const assignedData = await assignedRes.json()
      if (cancelled) return

      if (compData.success) setCompanyName(compData.company?.name ?? '')
      if (deptData.success) setAllDepts(deptData.departments ?? [])

      let initialDeptId = ''
      if (assignedData.success && assignedData.departments.length > 0) {
        setAssignedDepts(assignedData.departments)
        initialDeptId = assignedData.departments[0].department_id
        setSelectedDeptId(initialDeptId)
      }

      setInitLoading(false)
      await fetchReport(company_id, DEFAULT_FROM, YESTERDAY, initialDeptId)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchReport])

  const handleApply = () => fetchReport(companyId, dateFrom, dateTo, selectedDeptId)

  const exportCsv = () => {
    if (!report) return
    const header = ['Department', 'Shifts', 'Assignments', 'Tasks', 'Completed', 'Completion %', 'Attendance', 'Approved', 'Rejected']
    const rows = report.departments.map(r => [
      r.department_name, r.shifts, r.assignments, r.tasks, r.completed_tasks,
      r.tasks > 0 ? `${Math.round((r.completed_tasks / r.tasks) * 100)}%` : '0%',
      r.attendance_records, r.approved_attendance, r.rejected_attendance,
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `report-${dateFrom}-to-${dateTo}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const selectedDeptName = assignedDepts.find(d => d.department_id === selectedDeptId)?.department_name
    ?? allDepts.find(d => d.id === selectedDeptId)?.name
    ?? ''

  const pageTitle = companyName && selectedDeptName
    ? `${companyName} — ${selectedDeptName} Report`
    : companyName ? `${companyName} — Report` : 'Report'

  const summary = report?.summary

  const taskDonutData = report ? [
    { name: 'Assigned',    value: report.task_breakdown.assigned,    color: '#94A3B8' },
    { name: 'In Progress', value: report.task_breakdown.in_progress, color: BLUE },
    { name: 'Review',      value: report.task_breakdown.review,      color: '#D97706' },
    { name: 'Complete',    value: report.task_breakdown.complete,     color: '#059669' },
  ].filter(d => d.value > 0) : []

  const totalDonutTasks = taskDonutData.reduce((s, d) => s + d.value, 0)

  const deptBarData = report?.departments.slice(0, 8).map(d => ({
    name: d.department_name.length > 14 ? d.department_name.slice(0, 13) + '…' : d.department_name,
    tasks: d.tasks,
    completed: d.completed_tasks,
  })) ?? []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: APP_BG, fontFamily: 'inherit' }}>
      <ManagerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, minHeight: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Report
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {managerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#1E3A5F', color: '#FFFFFF', flexShrink: 0 }}>
                  <UserCog size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{managerName}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '24px 28px', flex: 1 }}>
          {initLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF' }}><Spinner blue /> Loading…</div>
          ) : (
            <>
              {/* Filters */}
              <div style={{ background: PANEL, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* Dept selector */}
                {assignedDepts.length > 1 && (
                  <div ref={deptDropdownRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setDeptDropdownOpen(o => !o)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', background: '#F9FAFB', border: `1.5px solid ${BORDER}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                    >
                      {selectedDeptName || 'All Departments'}
                      <ChevronDown size={13} style={{ color: '#9CA3AF', transform: deptDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>
                    {deptDropdownOpen && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 180, zIndex: 50, overflow: 'hidden' }}>
                        {assignedDepts.map(d => (
                          <button key={d.department_id} onClick={() => { setSelectedDeptId(d.department_id); setDeptDropdownOpen(false) }}
                            style={{ width: '100%', textAlign: 'left', padding: '9px 13px', background: d.department_id === selectedDeptId ? '#EFF6FF' : 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: d.department_id === selectedDeptId ? BLUE : '#374151', fontWeight: d.department_id === selectedDeptId ? 600 : 400 }}
                          >
                            {d.department_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    style={{ height: 36, padding: '0 10px', border: `1.5px solid ${BORDER}`, borderRadius: 9, fontSize: 13, color: '#374151', outline: 'none', background: '#F9FAFB' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    style={{ height: 36, padding: '0 10px', border: `1.5px solid ${BORDER}`, borderRadius: 9, fontSize: 13, color: '#374151', outline: 'none', background: '#F9FAFB' }}
                  />
                </div>

                <button onClick={handleApply} disabled={loading}
                  style={{ height: 36, padding: '0 16px', background: BLUE, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {loading && <Spinner size={13} />}
                  {loading ? 'Loading…' : 'Apply'}
                </button>

                <button onClick={exportCsv} disabled={!report}
                  style={{ marginLeft: 'auto', height: 36, padding: '0 14px', background: '#F9FAFB', color: '#374151', border: `1.5px solid ${BORDER}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: !report ? 'not-allowed' : 'pointer', opacity: !report ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', color: '#DC2626', fontSize: 14, marginBottom: 20 }}>{error}</div>
              )}

              {/* KPI stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                <StatCard label="Total Shifts" value={summary?.shifts ?? 0} sub="in date range"
                  icon={<CalendarDays size={16} strokeWidth={1.8} />} accentBg="#EFF6FF" accentColor={BLUE} loading={loading} />
                <StatCard label="Assignments" value={summary?.assignments ?? 0} sub="shift assignments"
                  icon={<Users size={16} strokeWidth={1.8} />} accentBg="#F0FDF4" accentColor="#16A34A" loading={loading} />
                <StatCard label="Tasks Completed" value={summary?.completed_tasks ?? 0} sub={`of ${summary?.tasks ?? 0} total tasks`}
                  icon={<CheckSquare size={16} strokeWidth={1.8} />} accentBg="#F0FDF4" accentColor="#059669" loading={loading} />
                <StatCard
                  label="Completion Rate"
                  value={summary ? `${Math.round(summary.task_completion_rate)}%` : '0%'}
                  sub="tasks completed"
                  icon={<TrendingUp size={16} strokeWidth={1.8} />} accentBg="#FFF7ED" accentColor="#EA580C" loading={loading} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                <StatCard label="Attendance Records" value={summary?.attendance_records ?? 0} sub="CW attendance entries"
                  icon={<ClipboardList size={16} strokeWidth={1.8} />} accentBg="#EFF6FF" accentColor={BLUE} loading={loading} />
                <StatCard label="Approved" value={summary?.approved_attendance ?? 0} sub="attendance approved"
                  icon={<CheckSquare size={16} strokeWidth={1.8} />} accentBg="#F0FDF4" accentColor="#16A34A" loading={loading} />
                <StatCard label="Rejected" value={summary?.rejected_attendance ?? 0} sub="attendance rejected"
                  icon={<Clock size={16} strokeWidth={1.8} />} accentBg="#FEF2F2" accentColor="#DC2626" loading={loading} />
                <StatCard label="Pending Review" value={summary?.pending_attendance ?? 0} sub="awaiting approval"
                  icon={<Briefcase size={16} strokeWidth={1.8} />} accentBg="#FFF7ED" accentColor="#EA580C" loading={loading} />
              </div>

              {/* Charts */}
              {report && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20, marginBottom: 24 }}>
                  {/* Task donut */}
                  <div style={{ background: PANEL, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <SectionHeader icon={<ClipboardList size={15} />} title="Task Breakdown" />
                    {taskDonutData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie data={taskDonutData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={2} dataKey="value">
                              {taskDonutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' }}>
                          {taskDonutData.map(d => (
                            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: '#6B7280' }}>{d.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                                {totalDonutTasks > 0 ? `${Math.round((d.value / totalDonutTasks) * 100)}%` : '0%'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
                        {loading ? <Spinner blue /> : 'No task data'}
                      </div>
                    )}
                  </div>

                  {/* Dept bar */}
                  <div style={{ background: PANEL, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <SectionHeader icon={<BarChart3 size={15} />} title="Tasks by Department" />
                    {deptBarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={deptBarData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="tasks" name="Total" fill="#DBEAFE" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="completed" name="Done" fill={BLUE} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
                        {loading ? <Spinner blue /> : 'No department data'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Department table */}
              {report && report.departments.length > 0 && (
                <div style={{ background: PANEL, borderRadius: 14, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: 24 }}>
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
                    <SectionHeader icon={<Users size={15} />} title="Department Breakdown" />
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          {['Department', 'Shifts', 'Assignments', 'Tasks', 'Completed', 'Completion %', 'Attendance', 'Approved'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.departments.map((row, i) => {
                          const pct = row.tasks > 0 ? Math.round((row.completed_tasks / row.tasks) * 100) : 0
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid #F3F4F6` }}>
                              <td style={{ padding: '10px 14px', fontSize: 13.5, fontWeight: 600, color: '#111827' }}>{row.department_name}</td>
                              <td style={{ padding: '10px 14px', fontSize: 13.5, color: '#374151' }}>{row.shifts}</td>
                              <td style={{ padding: '10px 14px', fontSize: 13.5, color: '#374151' }}>{row.assignments}</td>
                              <td style={{ padding: '10px 14px', fontSize: 13.5, color: '#374151' }}>{row.tasks}</td>
                              <td style={{ padding: '10px 14px', fontSize: 13.5, color: '#374151' }}>{row.completed_tasks}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 6, background: '#E5E7EB', borderRadius: 99, minWidth: 60 }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#10B981' : pct >= 50 ? BLUE : '#F97316', borderRadius: 99 }} />
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', minWidth: 36 }}>{pct}%</span>
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: 13.5, color: '#374151' }}>{row.attendance_records}</td>
                              <td style={{ padding: '10px 14px', fontSize: 13.5, color: '#374151' }}>{row.approved_attendance}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent activity */}
              {report && report.recent_activity.length > 0 && (
                <div style={{ background: PANEL, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <SectionHeader icon={<ClipboardList size={15} />} title="Recent Activity" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {report.recent_activity.slice(0, 10).map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#F9FAFB', borderRadius: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.type === 'task' ? BLUE : item.type === 'attendance' ? '#10B981' : '#F97316', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                          <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{item.detail}</p>
                        </div>
                        <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!report && !loading && !error && (
                <div style={{ background: PANEL, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '48px 24px', textAlign: 'center', color: '#9CA3AF' }}>
                  Select a date range and click Apply to generate the report.
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
