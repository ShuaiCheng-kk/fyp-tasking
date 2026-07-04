'use client'

import { useState, useEffect } from 'react'
import {
  Building2, Users,
  TrendingUp, CalendarDays, Briefcase, BarChart2,
  Download, Mail, X,
} from 'lucide-react'
import UserAdminSidebar from '@/components/UserAdminSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { UAReportStats } from '@/types/UserAdmin'

const SIDEBAR_WIDTH = 64

const T = {
  bg:        '#27272A',
  surface:   '#FFFFFF',
  surfaceHi: '#F1F5F9',
  border:    '#E2E8F0',
  text1:     '#0F172A',
  text2:     '#475569',
  text3:     '#94A3B8',
  danger:    '#DC2626',
  dangerBg:  '#FEF2F2',
  dangerMid: '#FECACA',
  success:   '#16A34A',
  successBg: '#F0FDF4',
  successMid:'#BBF7D0',
  blue:      '#2563EB',
  blueBg:    '#EFF6FF',
  violet:    '#7C3AED',
  violetBg:  '#F5F3FF',
  amber:     '#D97706',
  amberBg:   '#FFFBEB',
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const todayDate = new Date()
const yesterday = new Date(todayDate)
yesterday.setDate(todayDate.getDate() - 1)
const weekStart = new Date(yesterday)
weekStart.setDate(yesterday.getDate() - 6)
const TODAY = isoDate(todayDate)
const DEFAULT_FROM = isoDate(weekStart)

type ReportTab = 'company' | 'user'

const ROLE_ORDER = ['Owner', 'Partner', 'Manager', 'Employee', 'Casual Worker', 'Marketing Admin', 'User Admin']
const ROLE_COLORS: Record<string, string> = {
  'Owner':          '#111827',
  'Partner':        '#374151',
  'Manager':        '#2563EB',
  'Employee':       '#16A34A',
  'Casual Worker':  '#D97706',
  'Marketing Admin':'#7C3AED',
  'User Admin':     '#DC2626',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color, colorBg }: {
  label: string; value: number | string; sub?: string
  icon: React.ReactNode; color: string; colorBg: string
}) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: '18px 20px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 11, background: colorBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: '1.65rem', fontWeight: 800, color: T.text1, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: T.text3, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

function SectionCard({ title, icon, children, style }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', ...style }}>
      <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: T.text2 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: T.text1 }}>{title}</span>
      </div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  )
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: '0.8rem', color: T.text1, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: '0.8rem', color: T.text2 }}>{value} <span style={{ color: T.text3 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 5, background: T.surfaceHi, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function GrowthChart({ data, series = ['companies', 'users'] }: {
  data: { month: string; companies: number; users: number }[]
  series?: ('companies' | 'users')[]
}) {
  const showCompanies = series.includes('companies')
  const showUsers = series.includes('users')
  const maxVal = Math.max(...data.flatMap(d => [showCompanies ? d.companies : 0, showUsers ? d.users : 0]), 1)
  const H = 120
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, overflow: 'hidden' }}>
        {data.map(d => (
          <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: H }}>
              {showCompanies && <div title={`Companies: ${d.companies}`} style={{ flex: 1, height: `${(d.companies / maxVal) * H}px`, background: '#374151', borderRadius: '3px 3px 0 0', minHeight: d.companies > 0 ? 4 : 0, transition: 'height 0.5s' }} />}
              {showUsers && <div title={`Users: ${d.users}`} style={{ flex: 1, height: `${(d.users / maxVal) * H}px`, background: '#D1D5DB', borderRadius: '3px 3px 0 0', minHeight: d.users > 0 ? 4 : 0, transition: 'height 0.5s' }} />}
            </div>
            <div style={{ fontSize: '0.65rem', color: T.text3, fontWeight: 500, marginTop: 6, whiteSpace: 'nowrap' }}>{d.month}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
        {[['#374151', 'Companies', showCompanies], ['#D1D5DB', 'Users', showUsers]].filter(([, , show]) => show).map(([c, l]) => (
          <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: c as string }} />
            <span style={{ fontSize: '0.72rem', color: T.text2 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DonutChart({ segments, size = 140, strokeWidth = 20 }: {
  segments: { label: string; value: number; color: string }[]
  size?: number
  strokeWidth?: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  const visibleSegments = segments.filter(s => s.value > 0)
  const hoveredSeg = hovered != null ? visibleSegments[hovered] : null
  const hoveredPct = hoveredSeg && total > 0 ? Math.round((hoveredSeg.value / total) * 100) : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {total === 0 ? (
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={T.surfaceHi} strokeWidth={strokeWidth} />
          ) : visibleSegments.map((seg, i) => {
            const pct = seg.value / total
            const dash = pct * circumference
            const el = (
              <circle
                key={seg.label}
                cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={seg.color} strokeWidth={hovered === i ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                opacity={hovered == null || hovered === i ? 1 : 0.35}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ transition: 'stroke-dasharray 0.6s ease, opacity 0.15s ease, stroke-width 0.15s ease', cursor: 'pointer' }}
              />
            )
            offset += dash
            return el
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {hoveredSeg ? (
            <>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: hoveredSeg.color, lineHeight: 1 }}>{hoveredSeg.value}</span>
              <span style={{ fontSize: '0.65rem', color: T.text2, fontWeight: 600, marginTop: 2, textAlign: 'center', maxWidth: size * 0.7 }}>{hoveredSeg.label}</span>
              <span style={{ fontSize: '0.6rem', color: T.text3, marginTop: 1 }}>{hoveredPct}%</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: T.text1, lineHeight: 1 }}>{total}</span>
              <span style={{ fontSize: '0.65rem', color: T.text3, fontWeight: 600, marginTop: 2 }}>Total</span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map(seg => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0
          const idx = visibleSegments.indexOf(seg)
          const active = hovered != null && hovered === idx
          return (
            <div key={seg.label}
              onMouseEnter={() => idx >= 0 && setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: idx >= 0 ? 'pointer' : 'default', opacity: hovered == null || active ? 1 : 0.45, transition: 'opacity 0.15s ease' }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', color: T.text1, fontWeight: active ? 700 : 500 }}>{seg.label}</span>
              <span style={{ fontSize: '0.78rem', color: T.text3 }}>{seg.value} ({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UserAdminReports() {
  const [tab, setTab] = useState<ReportTab>('company')
  const [stats, setStats] = useState<UAReportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [refreshed, setRefreshed] = useState<Date | null>(null)
  const [showAllIndustries, setShowAllIndustries] = useState(false)
  const [showAllSizes, setShowAllSizes] = useState(false)
  const [showAllCompanies, setShowAllCompanies] = useState(false)
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM)
  const [dateTo, setDateTo] = useState(TODAY)

  useEffect(() => {
    const id = localStorage.getItem('tasking_user_id')
    if (id) setUserId(id)
  }, [])

  const fetchStats = async (from = dateFrom, to = dateTo) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/useradmin/reports?${params}`)
      const data = await res.json()
      setStats(data)
      setRefreshed(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats(DEFAULT_FROM, TODAY) }, [])

  const handleExportCsv = () => {
    if (!stats) return
    const rows: (string | number)[][] = [
      ['Metric', 'Value'],
      ['Date Range', `${dateFrom} to ${dateTo}`],
      ['Total Companies', stats.totalCompanies],
      ['Active Companies', stats.activeCompanies],
      ['Suspended Companies', stats.suspendedCompanies],
      ['New Companies (Range)', stats.newCompaniesInRange],
      ['Total Users', stats.totalUsers],
      ['Active Users', stats.activeUsers],
      ['Suspended Users', stats.suspendedUsers],
      ['New Users (Range)', stats.newUsersInRange],
      ['Avg Users Per Company', stats.avgUsersPerCompany],
      ['Pending Invitations', stats.pendingInvitationCount],
      ['Invitations Used', stats.invitationFunnel.used],
      ['Invitations Expired', stats.invitationFunnel.expired],
      ['Users With Company', stats.usersWithCompany],
      ['Users Without Company', stats.usersWithoutCompany],
      ['Users at Free-Plan Companies', stats.usersByCompanyPlan.free],
      ['Users at Paid-Plan Companies', stats.usersByCompanyPlan.paid],
      [],
      ['Plan', 'Count'],
      ...Object.entries(stats.planBreakdown),
      [],
      ['Industry', 'Count'],
      ...Object.entries(stats.industryBreakdown),
      [],
      ['Company Size', 'Count'],
      ...Object.entries(stats.companySizeBreakdown),
      [],
      ['Role', 'Count'],
      ...Object.entries(stats.roleBreakdown),
      [],
      ['Top Company', 'Members'],
      ...stats.topCompaniesByMemberCount.map(({ name, count }) => [name, count]),
    ]
    const csv = rows.map(row => row.map(cell => {
      const s = String(cell ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `useradmin-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalByRole = stats ? Object.values(stats.roleBreakdown).reduce((a, b) => a + b, 0) : 0
  const totalByIndustry = stats ? Object.values(stats.industryBreakdown).reduce((a, b) => a + b, 0) : 0
  const totalBySize = stats ? Object.values(stats.companySizeBreakdown).reduce((a, b) => a + b, 0) : 0
  const allIndustries = stats ? Object.entries(stats.industryBreakdown).sort((a, b) => b[1] - a[1]) : []
  const industryRows: [string, number][] = allIndustries.length > 5
    ? [...allIndustries.slice(0, 5), ['Others', allIndustries.slice(5).reduce((s, [, n]) => s + n, 0)] as [string, number]]
    : allIndustries
  const sizeOrder = ['1–10', '11–50', '51–200', '201–500', '500+']
  const allSizes: [string, number][] = stats
    ? sizeOrder.filter(s => stats.companySizeBreakdown[s]).map(s => [s, stats.companySizeBreakdown[s]] as [string, number])
        .concat(Object.entries(stats.companySizeBreakdown).filter(([k]) => !sizeOrder.includes(k)))
    : []
  const sizeEntries: [string, number][] = allSizes.length > 5
    ? [...allSizes.slice(0, 5), ['Others', allSizes.slice(5).reduce((s, [, n]) => s + n, 0)] as [string, number]]
    : allSizes
  const industryColors = ['#111827','#374151','#4B5563','#6B7280','#2563EB','#16A34A','#D97706','#7C3AED']

  const TABS: { key: ReportTab; label: string }[] = [
    { key: 'company', label: 'Company Analytics' },
    { key: 'user', label: 'User Analytics' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <UserAdminSidebar />
      <div style={{ marginLeft: SIDEBAR_WIDTH, flex: 1, minWidth: 0, background: 'transparent' }}>

        {/* Header */}
        <div style={{ padding: '24px 32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontWeight: 800, fontSize: '1.75rem', color: '#F1F5F9', margin: 0, letterSpacing: '-0.025em' }}>Report</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {userId && <OwnerUserBadge userId={userId} companyId="" />}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 32px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: 10, boxShadow: '0 2px 8px rgba(15,23,42,0.2)', padding: 3, display: 'inline-flex' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '8px 18px', border: 'none', cursor: 'pointer',
                borderRadius: 8, fontWeight: 600, fontSize: '0.88rem',
                background: tab === t.key ? T.surfaceHi : 'transparent',
                color: tab === t.key ? T.text1 : T.text3,
                transition: 'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ padding: '20px 32px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input type="date" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text1, fontSize: '0.82rem', fontWeight: 600 }} />
          <span style={{ color: T.text3, fontSize: '0.82rem' }}>to</span>
          <input type="date" value={dateTo} min={dateFrom} max={TODAY} onChange={e => setDateTo(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text1, fontSize: '0.82rem', fontWeight: 600 }} />
          <button
            onClick={() => fetchStats()} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.text1, color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            <TrendingUp size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Apply
          </button>
          <button
            onClick={handleExportCsv} disabled={!stats}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', background: '#F97316', color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: stats ? 'pointer' : 'not-allowed', opacity: stats ? 1 : 0.6 }}
          >
            <Download size={13} />
            Export CSV
          </button>
          {refreshed && (
            <span style={{ fontSize: '0.75rem', color: T.text3, marginLeft: 4 }}>
              Updated {refreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '0 32px 32px' }}>
          {loading && !stats ? (
            <div style={{ textAlign: 'center', padding: 80, color: T.text3, fontSize: '0.9rem' }}>Loading report data…</div>
          ) : !stats ? (
            <div style={{ textAlign: 'center', padding: 80, color: T.danger, fontSize: '0.9rem' }}>Failed to load report data.</div>
          ) : (
            <>
              {/* ── Company Analytics tab ── */}
              {tab === 'company' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    <StatCard label="New Companies (Range)" value={stats.newCompaniesInRange} sub={`${dateFrom} to ${dateTo}`} icon={<CalendarDays size={18} />} color={T.violet} colorBg={T.violetBg} />
                    <StatCard label="Avg Users / Company" value={stats.avgUsersPerCompany} icon={<Users size={18} />} color={T.blue} colorBg={T.blueBg} />
                    <StatCard label="Pending Invitations" value={stats.pendingInvitationCount} icon={<Mail size={18} />} color={T.amber} colorBg={T.amberBg} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    <SectionCard title="Company Health" icon={<Building2 size={14} />}>
                      <DonutChart segments={[
                        { label: 'Active',    value: stats.activeCompanies,    color: T.success },
                        { label: 'Suspended', value: stats.suspendedCompanies, color: T.danger },
                      ]} size={110} strokeWidth={16} />
                    </SectionCard>
                    <SectionCard title="Plan Breakdown" icon={<BarChart2 size={14} />}>
                      {Object.keys(stats.planBreakdown).length > 0 ? (
                        <DonutChart segments={
                          Object.entries(stats.planBreakdown).map(([plan, count]) => ({
                            label: plan, value: count, color: plan === 'Paid' ? T.success : T.text3,
                          }))
                        } size={110} strokeWidth={16} />
                      ) : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                    <SectionCard title="Invitation Funnel" icon={<Mail size={14} />}>
                      <DonutChart segments={[
                        { label: 'Used',    value: stats.invitationFunnel.used,    color: T.success },
                        { label: 'Pending', value: stats.invitationFunnel.pending, color: T.amber },
                        { label: 'Expired', value: stats.invitationFunnel.expired, color: T.danger },
                      ]} size={110} strokeWidth={16} />
                    </SectionCard>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    <SectionCard title="Companies by Size" icon={<Building2 size={14} />}>
                      {sizeEntries.length > 0
                        ? <>
                            {sizeEntries.map(([size, count]) => <BarRow key={size} label={size} value={count} total={totalBySize} color="#374151" />)}
                            {allSizes.length > 5 && (
                              <button onClick={() => setShowAllSizes(true)} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: T.blue, fontWeight: 600, padding: 0 }}>
                                {`Show all ${allSizes.length}`}
                              </button>
                            )}
                          </>
                        : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                    <SectionCard title="Companies by Industry" icon={<Briefcase size={14} />}>
                      {industryRows.length > 0
                        ? <>
                            {industryRows.map(([ind, count], i) => <BarRow key={ind} label={ind} value={count} total={totalByIndustry} color={ind === 'Others' ? T.text3 : industryColors[i % industryColors.length]} />)}
                            {allIndustries.length > 5 && (
                              <button onClick={() => setShowAllIndustries(true)} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: T.blue, fontWeight: 600, padding: 0 }}>
                                {`Show all ${allIndustries.length}`}
                              </button>
                            )}
                          </>
                        : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                    <SectionCard title="Top Companies by Member Count" icon={<Users size={14} />}>
                      {stats.topCompaniesByMemberCount.length > 0 ? (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {stats.topCompaniesByMemberCount.slice(0, 5).map(({ name, count }, i) => (
                              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 22, height: 22, borderRadius: 6, background: T.surfaceHi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: T.text2, flexShrink: 0 }}>{i + 1}</div>
                                <span style={{ flex: 1, fontSize: '0.84rem', color: T.text1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: T.text1 }}>{count}</span>
                              </div>
                            ))}
                          </div>
                          {stats.topCompaniesByMemberCount.length > 5 && (
                            <button onClick={() => setShowAllCompanies(true)} style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: T.blue, fontWeight: 600, padding: 0 }}>
                              {`Show all ${stats.topCompaniesByMemberCount.length}`}
                            </button>
                          )}
                        </>
                      ) : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                    <SectionCard title="Growth — Last 6 Months" icon={<TrendingUp size={14} />}>
                      <GrowthChart data={stats.growthByMonth} />
                    </SectionCard>
                  </div>
                </div>
              )}

              {/* ── User Analytics tab ── */}
              {tab === 'user' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    <StatCard label="New Users (Range)" value={stats.newUsersInRange} sub={`${dateFrom} to ${dateTo}`} icon={<CalendarDays size={18} />} color={T.violet} colorBg={T.violetBg} />
                    <StatCard label="Avg Users / Company" value={stats.avgUsersPerCompany} icon={<Users size={18} />} color={T.blue} colorBg={T.blueBg} />
                    <StatCard label="Unassigned Users" value={stats.usersWithoutCompany} sub="No company yet" icon={<Mail size={18} />} color={T.amber} colorBg={T.amberBg} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    <SectionCard title="User Health" icon={<Users size={14} />}>
                      <DonutChart segments={[
                        { label: 'Active',    value: stats.activeUsers,    color: T.success },
                        { label: 'Suspended', value: stats.suspendedUsers, color: T.danger },
                      ]} size={110} strokeWidth={16} />
                    </SectionCard>
                    <SectionCard title="Users by Role" icon={<Users size={14} />}>
                      {totalByRole > 0 ? (
                        <DonutChart segments={
                          ROLE_ORDER.filter(r => stats.roleBreakdown[r]).map(role => ({
                            label: role, value: stats.roleBreakdown[role], color: ROLE_COLORS[role] ?? T.text2,
                          }))
                        } size={110} strokeWidth={16} />
                      ) : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                    <SectionCard title="Users by Company Plan" icon={<BarChart2 size={14} />}>
                      {(stats.usersByCompanyPlan.free + stats.usersByCompanyPlan.paid) > 0 ? (
                        <DonutChart segments={[
                          { label: 'Free', value: stats.usersByCompanyPlan.free, color: T.text3 },
                          { label: 'Paid', value: stats.usersByCompanyPlan.paid, color: T.success },
                        ]} size={110} strokeWidth={16} />
                      ) : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                    <SectionCard title="New User Signups — Last 6 Months" icon={<TrendingUp size={14} />}>
                      <GrowthChart data={stats.growthByMonth} series={['users']} />
                    </SectionCard>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAllCompanies && stats && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShowAllCompanies(false)}>
          <div style={{ background: T.surface, borderRadius: 14, maxWidth: 460, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', border: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: T.text1, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} /> All Companies by Member Count
              </h2>
              <button onClick={() => setShowAllCompanies(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.topCompaniesByMemberCount.map(({ name, count }, i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: T.surfaceHi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: T.text2, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ flex: 1, fontSize: '0.88rem', color: T.text1, fontWeight: 500 }}>{name}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: T.text1 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAllIndustries && stats && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShowAllIndustries(false)}>
          <div style={{ background: T.surface, borderRadius: 14, maxWidth: 460, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', border: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: T.text1, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Briefcase size={16} /> All Companies by Industry
              </h2>
              <button onClick={() => setShowAllIndustries(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allIndustries.map(([ind, count]) => (
                <div key={ind} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: '0.88rem', color: T.text1, fontWeight: 500 }}>{ind}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: T.text1 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAllSizes && stats && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShowAllSizes(false)}>
          <div style={{ background: T.surface, borderRadius: 14, maxWidth: 460, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', border: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: T.text1, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} /> All Companies by Size
              </h2>
              <button onClick={() => setShowAllSizes(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allSizes.map(([size, count]) => (
                <div key={size} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: '0.88rem', color: T.text1, fontWeight: 500 }}>{size}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: T.text1 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
