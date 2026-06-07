'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { BarChart3, Download, RefreshCw, Sparkles, TrendingUp, CheckSquare, Clock, Users, AlertTriangle } from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import { AIAnomaly } from '@/types/AI'
import { WorkforceAnalyticsReport } from '@/types/Report'

type Department = { id: string; name: string }

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const today = new Date()
const weekStart = new Date(today)
weekStart.setDate(today.getDate() - 6)

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; accent: string }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 16,
      padding: '20px 22px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#A0AEC0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div>
        <strong style={{ display: 'block', fontSize: '1.875rem', color: '#1A202C', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</strong>
        {sub && <p style={{ margin: '5px 0 0', color: '#9CA3AF', fontSize: '0.775rem', fontWeight: 500 }}>{sub}</p>}
      </div>
    </div>
  )
}

export default function ReportPage() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [dateFrom, setDateFrom] = useState(isoDate(weekStart))
  const [dateTo, setDateTo] = useState(isoDate(today))
  const [report, setReport] = useState<WorkforceAnalyticsReport | null>(null)
  const [anomalies, setAnomalies] = useState<AIAnomaly[]>([])
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchReport = useCallback(async (cid: string, from = dateFrom, to = dateTo, dept = departmentId) => {
    if (!cid) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ company_id: cid, date_from: from, date_to: to })
      if (dept) params.set('department_id', dept)
      const res = await fetch(`/api/report?${params}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to fetch report')
      setReport(data.report)
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
      if (!cancelled) await fetchReport(cid)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchReport])

  const summary = report?.summary
  const completionLabel = useMemo(() => `${summary?.task_completion_rate ?? 0}%`, [summary])

  const exportCsv = () => {
    if (!report) return
    const header = ['Department', 'Shifts', 'Assignments', 'Tasks', 'Completed Tasks', 'Attendance Records', 'Approved Attendance', 'Rejected Attendance']
    const rows = report.departments.map(row => [
      row.department_name,
      row.shifts,
      row.assignments,
      row.tasks,
      row.completed_tasks,
      row.attendance_records,
      row.approved_attendance,
      row.rejected_attendance,
    ])
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, minHeight: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Page header — matches Dashboard style */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              {companyName ? `Report for ${companyName}` : 'Report'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {ownerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ width: 26, height: 26, borderRadius: 999, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{ownerName.charAt(0).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ownerName}</span>
              </div>
            )}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        <div style={{ padding: '0 28px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Filter controls row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} style={filterStyle} />
            <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>to</span>
            <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} style={filterStyle} />
            <select value={departmentId} onChange={event => setDepartmentId(event.target.value)} style={filterStyle}>
              <option value="">All departments</option>
              {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <button onClick={() => fetchReport(companyId)} disabled={loading || !companyId} style={actionBtnStyle('#374151', loading || !companyId)}>
              <RefreshCw size={13} style={{ flexShrink: 0 }} /> Apply
            </button>
            <button onClick={detectAnomalies} disabled={aiLoading || !companyId} style={actionBtnStyle('#7C3AED', aiLoading || !companyId)}>
              {aiLoading ? <RefreshCw size={13} style={{ flexShrink: 0 }} /> : <Sparkles size={13} style={{ flexShrink: 0 }} />} Detect
            </button>
            <button onClick={exportCsv} disabled={!report} style={actionBtnStyle('#F97316', !report)}>
              <Download size={13} style={{ flexShrink: 0 }} /> Export
            </button>
          </div>
          {error && (
            <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.875rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 14 }}>
            <StatCard label="Shifts" value={summary?.shifts ?? 0} sub={`${summary?.assignments ?? 0} assignments`} icon={<TrendingUp size={15} />} accent="#F97316" />
            <StatCard label="Tasks" value={summary?.tasks ?? 0} sub={`${summary?.completed_tasks ?? 0} completed`} icon={<CheckSquare size={15} />} accent="#8B5CF6" />
            <StatCard label="Completion" value={completionLabel} sub="task completion rate" icon={<BarChart3 size={15} />} accent="#3B82F6" />
            <StatCard label="Attendance" value={summary?.attendance_records ?? 0} sub={`${summary?.pending_attendance ?? 0} pending`} icon={<Clock size={15} />} accent="#F59E0B" />
            <StatCard label="Approved" value={summary?.approved_attendance ?? 0} sub={`${summary?.rejected_attendance ?? 0} rejected`} icon={<Users size={15} />} accent="#10B981" />
          </div>

          {/* Main grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

            {/* Department table */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={14} color="#F97316" />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4A5568', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Department Performance</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F7F8FA' }}>
                      {['Department', 'Shifts', 'Assigned', 'Tasks', 'Done', 'Attendance', 'Approved', 'Rejected'].map(col => (
                        <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Department' ? 'left' : 'center', fontSize: '0.68rem', fontWeight: 700, color: '#A0AEC0', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} style={{ padding: '28px 20px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.875rem' }}>Loading...</td></tr>
                    ) : (report?.departments.length ?? 0) === 0 ? (
                      <tr><td colSpan={8} style={{ padding: '28px 20px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.875rem' }}>No report data for this range.</td></tr>
                    ) : report?.departments.map((row, i) => (
                      <tr key={row.department_id ?? 'none'} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', transition: 'background 0.1s' }}>
                        <td style={{ padding: '13px 14px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', borderBottom: '1px solid #F0F4F8' }}>{row.department_name}</td>
                        {[row.shifts, row.assignments, row.tasks, row.completed_tasks, row.attendance_records, row.approved_attendance, row.rejected_attendance].map((val, j) => (
                          <td key={j} style={{ padding: '13px 14px', fontSize: '0.875rem', color: '#4A5568', textAlign: 'center', borderBottom: '1px solid #F0F4F8', fontWeight: 500 }}>{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* AI Anomalies */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} color="#7C3AED" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4A5568', letterSpacing: '0.05em', textTransform: 'uppercase' }}>AI Anomalies</span>
                </div>
                {anomalies.length === 0 ? (
                  <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                      <Sparkles size={15} color="#CBD5E0" />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9CA3AF' }}>Run detection to surface risks.</p>
                  </div>
                ) : anomalies.map(item => (
                  <div key={item.id} style={{ padding: '14px 20px', borderBottom: '1px solid #F0F4F8' }}>
                    <span style={{
                      display: 'inline-block', marginBottom: 7, borderRadius: 999, padding: '2px 9px',
                      background: item.severity === 'high' ? '#FEF2F2' : '#FFF7ED',
                      color: item.severity === 'high' ? '#B91C1C' : '#C2410C',
                      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{item.severity}</span>
                    <strong style={{ display: 'block', color: '#111827', fontSize: '0.875rem', marginBottom: 4 }}>{item.title}</strong>
                    <p style={{ margin: '0 0 6px', color: '#6B7280', fontSize: '0.8rem', lineHeight: 1.5 }}>{item.evidence[0] ?? item.recommended_action}</p>
                    <p style={{ margin: 0, color: '#374151', fontSize: '0.8rem', fontWeight: 600 }}>{item.recommended_action}</p>
                  </div>
                ))}
              </div>

              {/* Recent Activity */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={14} color="#F97316" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4A5568', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Recent Activity</span>
                </div>
                {(report?.recent_activity.length ?? 0) === 0 ? (
                  <div style={{ padding: '24px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.8125rem' }}>No recent activity.</div>
                ) : report?.recent_activity.map((item, index) => (
                  <div key={`${item.type}-${index}`} style={{ padding: '14px 20px', borderBottom: '1px solid #F0F4F8', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{
                      flexShrink: 0, marginTop: 1, borderRadius: 999, padding: '2px 9px',
                      background: item.type === 'task' ? '#EFF6FF' : '#FFF7ED',
                      color: item.type === 'task' ? '#1D4ED8' : '#C2410C',
                      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>{item.type}</span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', color: '#111827', fontSize: '0.8375rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</strong>
                      <p style={{ margin: 0, color: '#6B7280', fontSize: '0.775rem', lineHeight: 1.5 }}>{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

const filterStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.1)',
  color: '#FFFFFF',
  padding: '7px 10px',
  fontSize: '0.8125rem',
  fontWeight: 500,
  outline: 'none',
}

function actionBtnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return {
    border: 'none',
    borderRadius: 8,
    background: disabled ? 'rgba(255,255,255,0.08)' : bg,
    color: disabled ? 'rgba(255,255,255,0.35)' : '#FFFFFF',
    padding: '7px 12px',
    fontWeight: 600,
    fontSize: '0.8125rem',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.12s',
    flexShrink: 0,
  }
}
