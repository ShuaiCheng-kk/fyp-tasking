'use client'

import { useState, useEffect } from 'react'
import {
  Building2, Users, ShieldOff, ShieldCheck,
  TrendingUp, CalendarDays, Briefcase, BarChart2,
  RefreshCw, Download, Mail,
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

function GrowthChart({ data }: { data: { month: string; companies: number; users: number }[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.companies, d.users]), 1)
  const H = 120
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, overflow: 'hidden' }}>
        {data.map(d => (
          <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: H }}>
              <div title={`Companies: ${d.companies}`} style={{ flex: 1, height: `${(d.companies / maxVal) * H}px`, background: '#374151', borderRadius: '3px 3px 0 0', minHeight: d.companies > 0 ? 4 : 0, transition: 'height 0.5s' }} />
              <div title={`Users: ${d.users}`} style={{ flex: 1, height: `${(d.users / maxVal) * H}px`, background: '#D1D5DB', borderRadius: '3px 3px 0 0', minHeight: d.users > 0 ? 4 : 0, transition: 'height 0.5s' }} />
            </div>
            <div style={{ fontSize: '0.65rem', color: T.text3, fontWeight: 500, marginTop: 6, whiteSpace: 'nowrap' }}>{d.month}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
        {[['#374151', 'Companies'], ['#D1D5DB', 'Users']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: c }} />
            <span style={{ fontSize: '0.72rem', color: T.text2 }}>{l}</span>
          </div>
        ))}
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
  const [showAllCompanies, setShowAllCompanies] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('tasking_user_id')
    if (id) setUserId(id)
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/useradmin/reports')
      const data = await res.json()
      setStats(data)
      setRefreshed(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  const totalByRole = stats ? Object.values(stats.roleBreakdown).reduce((a, b) => a + b, 0) : 0
  const totalByIndustry = stats ? Object.values(stats.industryBreakdown).reduce((a, b) => a + b, 0) : 0
  const totalBySize = stats ? Object.values(stats.companySizeBreakdown).reduce((a, b) => a + b, 0) : 0
  const allIndustries = stats ? Object.entries(stats.industryBreakdown).sort((a, b) => b[1] - a[1]) : []
  const industryRows: [string, number][] = showAllIndustries
    ? allIndustries
    : allIndustries.length > 5
      ? [...allIndustries.slice(0, 5), ['Others', allIndustries.slice(5).reduce((s, [, n]) => s + n, 0)] as [string, number]]
      : allIndustries
  const sizeOrder = ['1–10', '11–50', '51–200', '201–500', '500+']
  const sizeEntries = stats
    ? sizeOrder.filter(s => stats.companySizeBreakdown[s]).map(s => [s, stats.companySizeBreakdown[s]] as [string, number])
        .concat(Object.entries(stats.companySizeBreakdown).filter(([k]) => !sizeOrder.includes(k)))
    : []
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
        <div style={{ padding: '20px 32px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={fetchStats} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.text1, color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text1, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
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
                    <StatCard label="Total Companies" value={stats.totalCompanies} icon={<Building2 size={18} />} color={T.text1} colorBg={T.surfaceHi} />
                    <StatCard label="Active Companies" value={stats.activeCompanies} sub={`${stats.totalCompanies > 0 ? Math.round(stats.activeCompanies / stats.totalCompanies * 100) : 0}% of total`} icon={<Building2 size={18} />} color={T.success} colorBg={T.successBg} />
                    <StatCard label="Suspended Companies" value={stats.suspendedCompanies} icon={<ShieldOff size={18} />} color={T.danger} colorBg={T.dangerBg} />
                    <StatCard label="New Companies (30d)" value={stats.newCompaniesLast30Days} icon={<CalendarDays size={18} />} color={T.violet} colorBg={T.violetBg} />
                    <StatCard label="Avg Users / Company" value={stats.avgUsersPerCompany} icon={<Users size={18} />} color={T.blue} colorBg={T.blueBg} />
                    <StatCard label="Pending Invitations" value={stats.pendingInvitationCount} icon={<Mail size={18} />} color={T.amber} colorBg={T.amberBg} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    <SectionCard title="Plan Breakdown" icon={<BarChart2 size={14} />}>
                      {Object.entries(stats.planBreakdown).map(([plan, count]) => (
                        <BarRow key={plan} label={plan} value={count} total={stats.totalCompanies} color={plan === 'Paid' ? T.success : T.text3} />
                      ))}
                      {Object.keys(stats.planBreakdown).length === 0 && <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                    <SectionCard title="Companies by Size" icon={<Building2 size={14} />}>
                      {sizeEntries.length > 0
                        ? sizeEntries.map(([size, count]) => <BarRow key={size} label={size} value={count} total={totalBySize} color="#374151" />)
                        : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                    <SectionCard title="Companies by Industry" icon={<Briefcase size={14} />}>
                      {industryRows.length > 0
                        ? <>
                            {industryRows.map(([ind, count], i) => <BarRow key={ind} label={ind} value={count} total={totalByIndustry} color={ind === 'Others' ? T.text3 : industryColors[i % industryColors.length]} />)}
                            {allIndustries.length > 5 && (
                              <button onClick={() => setShowAllIndustries(v => !v)} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: T.blue, fontWeight: 600, padding: 0 }}>
                                {showAllIndustries ? 'Show less' : `Show all ${allIndustries.length}`}
                              </button>
                            )}
                          </>
                        : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <SectionCard title="Top Companies by Member Count" icon={<Users size={14} />}>
                      {stats.topCompaniesByMemberCount.length > 0 ? (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(showAllCompanies ? stats.topCompaniesByMemberCount : stats.topCompaniesByMemberCount.slice(0, 5)).map(({ name, count }, i) => (
                              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 22, height: 22, borderRadius: 6, background: T.surfaceHi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: T.text2, flexShrink: 0 }}>{i + 1}</div>
                                <span style={{ flex: 1, fontSize: '0.84rem', color: T.text1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: T.text1 }}>{count}</span>
                              </div>
                            ))}
                          </div>
                          {stats.topCompaniesByMemberCount.length > 5 && (
                            <button onClick={() => setShowAllCompanies(v => !v)} style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: T.blue, fontWeight: 600, padding: 0 }}>
                              {showAllCompanies ? 'Show less' : `Show all ${stats.topCompaniesByMemberCount.length}`}
                            </button>
                          )}
                        </>
                      ) : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
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
                    <StatCard label="Total Users" value={stats.totalUsers} icon={<Users size={18} />} color={T.blue} colorBg={T.blueBg} />
                    <StatCard label="Active Users" value={stats.activeUsers} sub={`${stats.totalUsers > 0 ? Math.round(stats.activeUsers / stats.totalUsers * 100) : 0}% of total`} icon={<Users size={18} />} color={T.success} colorBg={T.successBg} />
                    <StatCard label="Suspended Users" value={stats.suspendedUsers} icon={<ShieldCheck size={18} />} color={T.amber} colorBg={T.amberBg} />
                    <StatCard label="New Users (7d)" value={stats.newUsersLast7Days} icon={<TrendingUp size={18} />} color={T.violet} colorBg={T.violetBg} />
                    <StatCard label="New Users (30d)" value={stats.newUsersLast30Days} icon={<CalendarDays size={18} />} color={T.violet} colorBg={T.violetBg} />
                  </div>
                  <SectionCard title="Users by Role" icon={<Users size={14} />}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 32px' }}>
                      {ROLE_ORDER.filter(r => stats.roleBreakdown[r]).map(role => (
                        <BarRow key={role} label={role} value={stats.roleBreakdown[role]} total={totalByRole} color={ROLE_COLORS[role] ?? T.text2} />
                      ))}
                      {totalByRole === 0 && <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </div>
                  </SectionCard>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
