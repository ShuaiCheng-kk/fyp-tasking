'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { BarChart3, Download, RefreshCw, Sparkles } from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import { AIAnomaly } from '@/types/AI'
import { WorkforceAnalyticsReport } from '@/types/Report'

type Department = { id: string; name: string }

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const today = new Date()
const weekStart = new Date(today)
weekStart.setDate(today.getDate() - 6)

function card(label: string, value: string | number, sub?: string) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: 15 }}>
      <p style={{ margin: 0, color: '#6B7280', fontSize: '0.76rem', fontWeight: 900, textTransform: 'uppercase' }}>{label}</p>
      <strong style={{ display: 'block', marginTop: 8, fontSize: '1.45rem', color: '#111827' }}>{value}</strong>
      {sub && <p style={{ margin: '4px 0 0', color: '#9CA3AF', fontSize: '0.78rem' }}>{sub}</p>}
    </div>
  )
}

export default function ReportPage() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
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
      const cid = localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
      if (!cid) return
      setCompanyId(cid)

      const [companyRes, deptRes] = await Promise.all([
        fetch(`/api/company/current?user_id=${authId}&company_id=${cid}`),
        fetch(`/api/company/departments?company_id=${cid}`),
      ])
      const companyData = await companyRes.json()
      const deptData = await deptRes.json()
      if (!cancelled && companyData.success) setCompanyName(companyData.company?.name ?? '')
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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, minHeight: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 32px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center' }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>
            {companyName ? `${companyName} - Report` : 'Report'}
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} style={filterStyle} />
            <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} style={filterStyle} />
            <select value={departmentId} onChange={event => setDepartmentId(event.target.value)} style={filterStyle}>
              <option value="">All departments</option>
              {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <button onClick={() => fetchReport(companyId)} disabled={loading || !companyId} style={buttonStyle('#111827')}><RefreshCw size={15} /> Apply</button>
            <button onClick={detectAnomalies} disabled={aiLoading || !companyId} style={buttonStyle('#7C3AED')}>{aiLoading ? <RefreshCw size={15} /> : <Sparkles size={15} />} Detect</button>
            <button onClick={exportCsv} disabled={!report} style={buttonStyle('#F97316')}><Download size={15} /> Export</button>
          </div>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 18 }}>
          {error && <div style={{ padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 800 }}>{error}</div>}

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))', gap: 12 }}>
            {card('Shifts', summary?.shifts ?? 0, `${summary?.assignments ?? 0} assignments`)}
            {card('Tasks', summary?.tasks ?? 0, `${summary?.completed_tasks ?? 0} complete`)}
            {card('Completion', completionLabel, 'task completion rate')}
            {card('Attendance', summary?.attendance_records ?? 0, `${summary?.pending_attendance ?? 0} pending`)}
            {card('Approved', summary?.approved_attendance ?? 0, `${summary?.rejected_attendance ?? 0} rejected`)}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, alignItems: 'start' }}>
            <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: 14, borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280', fontSize: '0.78rem', fontWeight: 900, textTransform: 'uppercase' }}><BarChart3 size={15} /> Department Performance</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(7, 1fr)', gap: 0, padding: '10px 14px', borderBottom: '1px solid #F1F5F9', color: '#6B7280', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase' }}>
                {['Department', 'Shifts', 'Assign', 'Tasks', 'Done', 'Attend', 'Approved', 'Rejected'].map(item => <span key={item}>{item}</span>)}
              </div>
              {loading ? (
                <div style={{ padding: 20, color: '#9CA3AF' }}>Loading...</div>
              ) : (report?.departments.length ?? 0) === 0 ? (
                <div style={{ padding: 20, color: '#9CA3AF' }}>No report data for this range.</div>
              ) : report?.departments.map(row => (
                <div key={row.department_id ?? 'none'} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(7, 1fr)', gap: 0, padding: '13px 14px', borderBottom: '1px solid #F8FAFC', color: '#374151', fontSize: '0.84rem', alignItems: 'center' }}>
                  <strong style={{ color: '#111827' }}>{row.department_name}</strong>
                  <span>{row.shifts}</span>
                  <span>{row.assignments}</span>
                  <span>{row.tasks}</span>
                  <span>{row.completed_tasks}</span>
                  <span>{row.attendance_records}</span>
                  <span>{row.approved_attendance}</span>
                  <span>{row.rejected_attendance}</span>
                </div>
              ))}
            </section>

            <aside style={{ display: 'grid', gap: 14 }}>
              <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: 14, borderBottom: '1px solid #F1F5F9', color: '#6B7280', fontSize: '0.78rem', fontWeight: 900, textTransform: 'uppercase' }}>AI Anomalies</div>
                {anomalies.length === 0 ? <div style={{ padding: 18, color: '#9CA3AF', fontSize: '0.9rem' }}>Run detection to surface risks.</div> : anomalies.map(item => (
                  <div key={item.id} style={{ padding: 14, borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ display: 'inline-block', marginBottom: 6, borderRadius: 999, padding: '2px 8px', background: item.severity === 'high' ? '#FEF2F2' : '#FFF7ED', color: item.severity === 'high' ? '#B91C1C' : '#C2410C', fontSize: '0.68rem', fontWeight: 900 }}>{item.severity}</span>
                    <strong style={{ display: 'block', color: '#111827', fontSize: '0.88rem' }}>{item.title}</strong>
                    <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.8rem' }}>{item.evidence[0] ?? item.recommended_action}</p>
                    <p style={{ margin: '6px 0 0', color: '#374151', fontSize: '0.8rem', fontWeight: 700 }}>{item.recommended_action}</p>
                  </div>
                ))}
              </section>

              <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: 14, borderBottom: '1px solid #F1F5F9', color: '#6B7280', fontSize: '0.78rem', fontWeight: 900, textTransform: 'uppercase' }}>Recent Activity</div>
                {(report?.recent_activity.length ?? 0) === 0 ? (
                  <div style={{ padding: 18, color: '#9CA3AF', fontSize: '0.9rem' }}>No recent activity.</div>
                ) : report?.recent_activity.map((item, index) => (
                  <div key={`${item.type}-${index}`} style={{ padding: 14, borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ display: 'inline-block', marginBottom: 6, borderRadius: 999, padding: '2px 8px', background: item.type === 'task' ? '#EFF6FF' : '#FFF7ED', color: item.type === 'task' ? '#1D4ED8' : '#C2410C', fontSize: '0.68rem', fontWeight: 900 }}>{item.type}</span>
                    <strong style={{ display: 'block', color: '#111827', fontSize: '0.88rem' }}>{item.title}</strong>
                    <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.8rem' }}>{item.detail}</p>
                  </div>
                ))}
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}

const filterStyle: React.CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  background: '#FFFFFF',
  color: '#111827',
  padding: '8px 10px',
  fontSize: '0.82rem',
  fontWeight: 700,
}

function buttonStyle(background: string): React.CSSProperties {
  return {
    border: 'none',
    borderRadius: 8,
    background,
    color: '#FFFFFF',
    padding: '9px 12px',
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  }
}
