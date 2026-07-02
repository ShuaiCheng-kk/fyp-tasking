'use client'

import { useState, useEffect } from 'react'
import {
  Building2, Users, ShieldOff, ShieldCheck,
  TrendingUp, CalendarDays, Briefcase, BarChart2,
  RefreshCw, Download,
} from 'lucide-react'
import UserAdminSidebar from '@/components/UserAdminSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { UAReportStats } from '@/types/UserAdmin'

const SIDEBAR_WIDTH = 64

const T = {
  bg:        '#F8F9FA',
  surface:   '#FFFFFF',
  surfaceHi: '#F3F4F6',
  border:    '#E5E7EB',
  text1:     '#111827',
  text2:     '#6B7280',
  text3:     '#9CA3AF',
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

type ReportTab = 'overview' | 'company' | 'user'

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
  const [tab, setTab] = useState<ReportTab>('overview')
  const [stats, setStats] = useState<UAReportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [refreshed, setRefreshed] = useState<Date | null>(null)

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
  const topIndustries = stats ? Object.entries(stats.industryBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 8) : []
  const sizeOrder = ['1–10', '11–50', '51–200', '201–500', '500+']
  const sizeEntries = stats
    ? sizeOrder.filter(s => stats.companySizeBreakdown[s]).map(s => [s, stats.companySizeBreakdown[s]] as [string, number])
        .concat(Object.entries(stats.companySizeBreakdown).filter(([k]) => !sizeOrder.includes(k)))
    : []
  const industryColors = ['#111827','#374151','#4B5563','#6B7280','#2563EB','#16A34A','#D97706','#7C3AED']

  const TABS: { key: ReportTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'company', label: 'Company Analytics' },
    { key: 'user', label: 'User Analytics' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <UserAdminSidebar />
      <div style={{ marginLeft: SIDEBAR_WIDTH, flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{ padding: '28px 32px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontWeight: 800, fontSize: '1.75rem', color: T.text1, margin: 0, letterSpacing: '-0.025em' }}>Report</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {userId && <OwnerUserBadge userId={userId} companyId="" />}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 32px', display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}`, marginTop: 18 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.88rem',
              color: tab === t.key ? T.text1 : T.text3,
              borderBottom: tab === t.key ? `2px solid ${T.text1}` : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 10 }}>
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
              {/* ── Overview tab ── */}
              {tab === 'overview' && (
                <>
                  {/* Stat cards — 4 per row, 2 rows */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
                    <StatCard label="Total Companies" value={stats.totalCompanies} icon={<Building2 size={18} />} color={T.text1} colorBg={T.surfaceHi} />
                    <StatCard label="Total Users" value={stats.totalUsers} icon={<Users size={18} />} color={T.blue} colorBg={T.blueBg} />
                    <StatCard label="Active Companies" value={stats.activeCompanies} sub={`${stats.totalCompanies > 0 ? Math.round(stats.activeCompanies / stats.totalCompanies * 100) : 0}% of total`} icon={<Building2 size={18} />} color={T.success} colorBg={T.successBg} />
                    <StatCard label="Active Users" value={stats.activeUsers} sub={`${stats.totalUsers > 0 ? Math.round(stats.activeUsers / stats.totalUsers * 100) : 0}% of total`} icon={<Users size={18} />} color={T.success} colorBg={T.successBg} />
                    <StatCard label="Suspended Companies" value={stats.suspendedCompanies} icon={<ShieldOff size={18} />} color={T.danger} colorBg={T.dangerBg} />
                    <StatCard label="Suspended Users" value={stats.suspendedUsers} icon={<ShieldCheck size={18} />} color={T.amber} colorBg={T.amberBg} />
                    <StatCard label="New Companies (7d)" value={stats.newCompaniesLast7Days} sub={`${stats.newCompaniesLast30Days} in last 30 days`} icon={<CalendarDays size={18} />} color={T.violet} colorBg={T.violetBg} />
                    <StatCard label="New Users (7d)" value={stats.newUsersLast7Days} sub={`${stats.newUsersLast30Days} in last 30 days`} icon={<TrendingUp size={18} />} color={T.violet} colorBg={T.violetBg} />
                  </div>

                  {/* Growth chart — full width */}
                  <SectionCard title="Growth — Last 6 Months" icon={<TrendingUp size={14} />} style={{ marginBottom: 14 }}>
                    <GrowthChart data={stats.growthByMonth} />
                  </SectionCard>

                  {/* 3-column breakdown grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'start' }}>
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
                      {topIndustries.length > 0
                        ? topIndustries.map(([ind, count], i) => <BarRow key={ind} label={ind} value={count} total={totalByIndustry} color={industryColors[i % industryColors.length]} />)
                        : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                    <SectionCard title="Users by Role" icon={<Users size={14} />} style={{ gridColumn: '1 / -1' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 32px' }}>
                        {ROLE_ORDER.filter(r => stats.roleBreakdown[r]).map(role => (
                          <BarRow key={role} label={role} value={stats.roleBreakdown[role]} total={totalByRole} color={ROLE_COLORS[role] ?? T.text2} />
                        ))}
                        {totalByRole === 0 && <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                      </div>
                    </SectionCard>
                  </div>
                </>
              )}

              {/* ── Company Analytics tab ── */}
              {tab === 'company' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionCard title="Suspension Summary" icon={<ShieldOff size={14} />}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      {[
                        { label: 'Total Companies', value: stats.totalCompanies, color: T.text1, bg: T.surfaceHi },
                        { label: 'Active', value: stats.activeCompanies, color: T.success, bg: T.successBg },
                        { label: 'Suspended', value: stats.suspendedCompanies, color: T.danger, bg: T.dangerBg },
                      ].map(({ label, value, color, bg }) => (
                        <div key={label} style={{ background: bg, borderRadius: 10, padding: '14px 18px' }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
                          <div style={{ fontSize: '0.78rem', color: T.text2, marginTop: 2 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
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
                      {topIndustries.length > 0
                        ? topIndustries.map(([ind, count], i) => <BarRow key={ind} label={ind} value={count} total={totalByIndustry} color={industryColors[i % industryColors.length]} />)
                        : <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                    </SectionCard>
                  </div>
                </div>
              )}

              {/* ── User Analytics tab ── */}
              {tab === 'user' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <SectionCard title="Users by Role" icon={<Users size={14} />}>
                    {ROLE_ORDER.filter(r => stats.roleBreakdown[r]).map(role => (
                      <BarRow key={role} label={role} value={stats.roleBreakdown[role]} total={totalByRole} color={ROLE_COLORS[role] ?? T.text2} />
                    ))}
                    {totalByRole === 0 && <div style={{ fontSize: '0.82rem', color: T.text3 }}>No data</div>}
                  </SectionCard>
                  <SectionCard title="Suspension Summary" icon={<ShieldCheck size={14} />}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { label: 'Total Users', value: stats.totalUsers, color: T.text1, bg: T.surfaceHi },
                        { label: 'Active Users', value: stats.activeUsers, color: T.success, bg: T.successBg },
                        { label: 'Suspended Users', value: stats.suspendedUsers, color: T.danger, bg: T.dangerBg },
                      ].map(({ label, value, color, bg }) => (
                        <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.82rem', color: T.text2, fontWeight: 500 }}>{label}</span>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                  <SectionCard title="Growth — Last 6 Months" icon={<TrendingUp size={14} />} style={{ gridColumn: '1 / -1' }}>
                    <GrowthChart data={stats.growthByMonth} />
                  </SectionCard>
                  <SectionCard title="New Registrations" icon={<CalendarDays size={14} />} style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                      {[
                        { label: 'New Users (7d)', value: stats.newUsersLast7Days },
                        { label: 'New Users (30d)', value: stats.newUsersLast30Days },
                        { label: 'New Companies (7d)', value: stats.newCompaniesLast7Days },
                        { label: 'New Companies (30d)', value: stats.newCompaniesLast30Days },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ background: T.surfaceHi, borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: T.text1 }}>{value}</div>
                          <div style={{ fontSize: '0.75rem', color: T.text2, marginTop: 2 }}>{label}</div>
                        </div>
                      ))}
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
