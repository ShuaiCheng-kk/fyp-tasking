'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Building2, Users, X, AlertTriangle, CheckCircle, ChevronRight, ChevronDown, ChevronUp, ChevronLeft } from 'lucide-react'
import UserAdminSidebar from '@/components/UserAdminSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { UACompany, UACompanyDetail, UAUser } from '@/types/UserAdmin'

const SIDEBAR_WIDTH = 64

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:        '#27272A',
  surface:   '#FFFFFF',
  surfaceHi: '#F1F5F9',
  border:    '#E2E8F0',
  borderMid: '#CBD5E1',
  accent:    '#1E293B',
  accentBg:  '#F1F5F9',
  accentMid: '#94A3B8',
  text1:     '#0F172A',
  text2:     '#475569',
  text3:     '#94A3B8',
  danger:    '#EF4444',
  dangerBg:  '#FEF2F2',
  dangerMid: '#FECACA',
  success:   '#10B981',
  successBg: '#F0FDF4',
  successMid:'#BBF7D0',
}

type Tab = 'companies' | 'users'

const CAL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function CalendarRangePicker({ from, to, onChange }: {
  from: string; to: string
  onChange: (from: string, to: string) => void
}) {
  const today = new Date()
  const [view, setView] = useState(() => {
    const d = from ? new Date(from) : today
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [hovered, setHovered] = useState<string | null>(null)
  const [picker, setPicker] = useState<'day' | 'month' | 'year'>('day')

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay()
  const toISO = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const prevMonth = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })
  const nextMonth = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })

  // Derive intent from props: no from → set from; from but no to → set to; both set → reset and set new from
  const handleDayClick = (iso: string) => {
    if (!from || (from && to)) {
      onChange(iso, '')
    } else {
      if (iso < from) onChange(iso, from)
      else if (iso === from) onChange('', '')
      else onChange(from, iso)
    }
  }

  const total = daysInMonth(view.year, view.month)
  const startOffset = firstDayOfMonth(view.year, view.month)
  const monthLabel = new Date(view.year, view.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const yearBase = Math.floor(view.year / 12) * 12

  return (
    <div style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button
          onClick={picker === 'day' ? prevMonth : picker === 'month' ? () => setView(v => ({ ...v, year: v.year - 1 })) : () => setView(v => ({ ...v, year: v.year - 12 }))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#6B7280', display: 'flex' }}
        ><ChevronLeft size={14} /></button>
        <button
          onClick={() => setPicker(p => p === 'day' ? 'month' : p === 'month' ? 'year' : 'day')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#111827', padding: '2px 6px', borderRadius: 4 }}
        >
          {picker === 'day' ? monthLabel : picker === 'month' ? view.year : `${yearBase} – ${yearBase + 11}`}
        </button>
        <button
          onClick={picker === 'day' ? nextMonth : picker === 'month' ? () => setView(v => ({ ...v, year: v.year + 1 })) : () => setView(v => ({ ...v, year: v.year + 12 }))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#6B7280', display: 'flex' }}
        ><ChevronRight size={14} /></button>
      </div>

      {picker === 'month' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 6 }}>
          {CAL_MONTHS.map((m, i) => (
            <button key={m} onClick={() => { setView(v => ({ ...v, month: i })); setPicker('day') }}
              style={{ padding: '6px 4px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                background: view.month === i ? '#111827' : '#F3F4F6', color: view.month === i ? '#fff' : '#111827' }}>
              {m}
            </button>
          ))}
        </div>
      )}

      {picker === 'year' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 6 }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const y = yearBase + i
            return (
              <button key={y} onClick={() => { setView(v => ({ ...v, year: y })); setPicker('month') }}
                style={{ padding: '6px 4px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                  background: view.year === y ? '#111827' : '#F3F4F6', color: view.year === y ? '#fff' : '#111827' }}>
                {y}
              </button>
            )
          })}
        </div>
      )}

      {picker === 'day' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.62rem', fontWeight: 700, color: '#9CA3AF', padding: '2px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: total }).map((_, i) => {
            const day = i + 1
            const iso = toISO(view.year, view.month, day)
            const isFrom = iso === from
            const isTo = iso === to
            const isSelected = isFrom || isTo
            const isInRange = from && to && iso > from && iso < to
            const isHovered = hovered === iso
            const isHoverRange = from && !to && hovered && iso > from && iso < hovered
            return (
              <div key={day}
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => setHovered(iso)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  textAlign: 'center', padding: '4px 0', fontSize: '0.72rem',
                  fontWeight: isSelected ? 700 : 400,
                  borderRadius: isSelected ? 99 : (isInRange || isHoverRange) ? 0 : 4,
                  background: isSelected ? '#111827' : (isInRange || isHoverRange) ? '#F3F4F6' : isHovered ? '#F3F4F6' : 'transparent',
                  color: isSelected ? '#fff' : '#111827',
                  cursor: 'pointer',
                }}
              >{day}</div>
            )
          })}
        </div>
      </>}

      {(from || to) && (
        <button onClick={() => onChange('', '')}
          style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#9CA3AF', padding: 0 }}>
          Clear dates
        </button>
      )}
    </div>
  )
}

export default function UserAdminDashboard() {
  const [tab, setTab] = useState<Tab>('companies')
  const [userId, setUserId] = useState<string | null>(null)

  const [companies, setCompanies] = useState<UACompany[]>([])
  const [compSearch, setCompSearch] = useState('')
  const [compLoading, setCompLoading] = useState(false)
  const [planFilters, setPlanFilters] = useState<string[]>([])
  const [compStatusFilters, setCompStatusFilters] = useState<string[]>([])
  const [industryFilters, setIndustryFilters] = useState<string[]>([])
  const [industrySearch, setIndustrySearch] = useState('')
  const [compDateFrom, setCompDateFrom] = useState('')
  const [compDateTo, setCompDateTo] = useState('')

  const ALL_PLANS = ['Free', 'Paid']

  const [users, setUsers] = useState<UAUser[]>([])
  const [totalUserCount, setTotalUserCount] = useState(0)
  const [totalCompanyCount, setTotalCompanyCount] = useState(0)
  const [userSearch, setUserSearch] = useState('')
  const [userLoading, setUserLoading] = useState(false)
  const [roleFilters, setRoleFilters] = useState<string[]>([])
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [companyNameFilters, setCompanyNameFilters] = useState<string[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [userDateFrom, setUserDateFrom] = useState('')
  const [userDateTo, setUserDateTo] = useState('')

  const ALL_ROLES = ['Owner', 'Partner', 'Manager', 'Employee', 'Casual Worker', 'Marketing Admin', 'User Admin']

  const [detailCompany, setDetailCompany] = useState<UACompanyDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const [suspendModal, setSuspendModal] = useState<{ type: 'company' | 'user'; id: string; name: string } | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspending, setSuspending] = useState(false)

  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('tasking_user_id')
    if (id) setUserId(id)
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchCompanies = useCallback(async (search?: string) => {
    setCompLoading(true)
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await fetch(`/api/useradmin/companies${q}`)
      const data = await res.json()
      setCompanies(data.companies ?? [])
    } finally {
      setCompLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async (search?: string, roles?: string[], statuses?: string[]) => {
    setUserLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      roles?.forEach(r => params.append('role', r))
      statuses?.forEach(s => params.append('status', s))
      const q = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/useradmin/users${q}`)
      const data = await res.json()
      setUsers(data.users ?? [])
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])
  useEffect(() => { fetchUsers() }, [fetchUsers])

  useEffect(() => {
    fetch('/api/useradmin/companies').then(r => r.json()).then(d => {
      setTotalCompanyCount((d.companies ?? []).length)
    })
    fetch('/api/useradmin/users').then(r => r.json()).then(d => {
      setTotalUserCount((d.users ?? []).length)
    })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchCompanies(compSearch), 300)
    return () => clearTimeout(t)
  }, [compSearch, fetchCompanies])

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(userSearch, roleFilters, statusFilters), 300)
    return () => clearTimeout(t)
  }, [userSearch, roleFilters, statusFilters, fetchUsers])

  const toggleRole = (role: string) =>
    setRoleFilters(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
  const toggleStatus = (s: string) =>
    setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const [userFilterOpen, setUserFilterOpen] = useState<Record<string, boolean>>({ company: true, role: true, status: true, date: false })
  const [compFilterOpen, setCompFilterOpen] = useState<Record<string, boolean>>({ plan: true, industry: true, status: true, date: false })
  const toggleUserSection = (k: string) => setUserFilterOpen(p => ({ ...p, [k]: !p[k] }))
  const toggleCompSection = (k: string) => setCompFilterOpen(p => ({ ...p, [k]: !p[k] }))

  const toggleCompanyName = (name: string) =>
    setCompanyNameFilters(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])
  const clearUserFilters = () => { setRoleFilters([]); setStatusFilters([]); setUserSearch(''); setCompanyNameFilters([]); setUserDateFrom(''); setUserDateTo('') }
  const hasUserFilters = roleFilters.length > 0 || statusFilters.length > 0 || userSearch.length > 0 || companyNameFilters.length > 0 || userDateFrom || userDateTo

  const allCompanyNames = [...new Set(users.map(u => u.company_name).filter(Boolean) as string[])].sort()

  const displayedUsers = users.filter(u => {
    if (companyNameFilters.length > 0 && (!u.company_name || !companyNameFilters.includes(u.company_name))) return false
    if (userDateFrom && new Date(u.created_at) < new Date(userDateFrom)) return false
    if (userDateTo && new Date(u.created_at) > new Date(userDateTo + 'T23:59:59')) return false
    return true
  })

  const togglePlan = (plan: string) =>
    setPlanFilters(prev => prev.includes(plan) ? prev.filter(p => p !== plan) : [...prev, plan])
  const toggleCompStatus = (s: string) =>
    setCompStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  const toggleIndustry = (ind: string) =>
    setIndustryFilters(prev => prev.includes(ind) ? prev.filter(x => x !== ind) : [...prev, ind])
  const clearCompFilters = () => { setPlanFilters([]); setCompStatusFilters([]); setIndustryFilters([]); setIndustrySearch(''); setCompSearch(''); setCompDateFrom(''); setCompDateTo('') }
  const hasCompFilters = planFilters.length > 0 || compStatusFilters.length > 0 || industryFilters.length > 0 || compSearch.length > 0 || compDateFrom || compDateTo

  const allIndustryNames = [...new Set(companies.map(c => c.industry).filter(Boolean) as string[])].sort()

  const displayedCompanies = companies.filter(c => {
    if (planFilters.length > 0 && !planFilters.includes(c.plan)) return false
    if (industryFilters.length > 0 && !industryFilters.includes(c.industry ?? '')) return false
    if (compStatusFilters.length === 1) {
      if (compStatusFilters[0] === 'suspended' && !c.is_suspended) return false
      if (compStatusFilters[0] === 'active' && c.is_suspended) return false
    }
    if (compDateFrom && new Date(c.created_at) < new Date(compDateFrom)) return false
    if (compDateTo && new Date(c.created_at) > new Date(compDateTo + 'T23:59:59')) return false
    return true
  })

  const openDetail = async (companyId: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/useradmin/companies/${companyId}`)
      const data = await res.json()
      setDetailCompany(data.company ?? null)
    } finally {
      setDetailLoading(false)
    }
  }

  const doSuspend = async () => {
    if (!suspendModal || !suspendReason.trim()) return
    setSuspending(true)
    try {
      const action = suspendModal.type === 'company' ? 'suspend_company' : 'suspend_user'
      const body = suspendModal.type === 'company'
        ? { action, company_id: suspendModal.id, reason: suspendReason }
        : { action, user_id: suspendModal.id, reason: suspendReason }
      const res = await fetch('/api/useradmin/suspend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { showToast(data.error ?? 'Failed'); return }
      showToast(`${suspendModal.name} suspended`)
      setSuspendModal(null); setSuspendReason('')
      if (suspendModal.type === 'company') {
        fetchCompanies(compSearch)
        if (detailCompany?.id === suspendModal.id) openDetail(suspendModal.id)
      } else { fetchUsers(userSearch) }
    } finally { setSuspending(false) }
  }

  const doUnsuspend = async (type: 'company' | 'user', id: string, name: string) => {
    const action = type === 'company' ? 'unsuspend_company' : 'unsuspend_user'
    const body = type === 'company' ? { action, company_id: id } : { action, user_id: id }
    const res = await fetch('/api/useradmin/suspend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { showToast(data.error ?? 'Failed'); return }
    showToast(`${name} reinstated`)
    if (type === 'company') { fetchCompanies(compSearch); if (detailCompany?.id === id) openDetail(id) }
    else { fetchUsers(userSearch) }
  }

  // ── Sub-components ─────────────────────────────────────────────────────────

  const StatusDot = ({ suspended }: { suspended: boolean }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em',
      background: suspended ? T.dangerBg : T.successBg,
      color: suspended ? '#DC2626' : '#16A34A',
      border: `1px solid ${suspended ? T.dangerMid : T.successMid}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: suspended ? T.danger : T.success, display: 'inline-block' }} />
      {suspended ? 'Suspended' : 'Active'}
    </span>
  )

  const FilterSection = ({ label, count, pill, open, onToggle, children }: { label: string; count?: number; pill?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) => (
    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 2 }}>
      <button onClick={onToggle} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', gap: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ fontWeight: 600, fontSize: '0.78rem', color: T.text2, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{label}</span>
          {!!count && <span style={{ background: T.accent, color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{count}</span>}
          {open ? <ChevronUp size={13} color={T.text3} /> : <ChevronDown size={13} color={T.text3} />}
        </span>
        {pill && <span style={{ display: 'block' }}>{pill}</span>}
      </button>
      {open && <div style={{ paddingBottom: 4 }}>{children}</div>}
    </div>
  )

  const CheckRow = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, cursor: 'pointer', padding: '3px 6px', borderRadius: 6, background: checked ? T.surfaceHi : 'transparent', transition: 'background 0.1s' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 13, height: 13, accentColor: T.accent, cursor: 'pointer', flexShrink: 0 }} />
      <span style={{ fontSize: '0.78rem', color: checked ? T.text1 : T.text2, fontWeight: checked ? 600 : 400 }}>{label}</span>
    </label>
  )

  const DateRangePill = ({ from, to }: { from: string; to: string }) =>
    (from || to) ? (
      <span style={{ fontSize: 10, fontWeight: 500, color: T.text2, background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 4, padding: '1px 6px', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {from ? new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '…'} – {to ? new Date(to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '…'}
      </span>
    ) : null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <UserAdminSidebar />

      <div style={{ marginLeft: SIDEBAR_WIDTH, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'transparent' }}>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          {/* Page heading */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
              </div>
              <h1 style={{ fontWeight: 800, fontSize: '1.75rem', color: '#F1F5F9', margin: 0, letterSpacing: '-0.025em', lineHeight: 1.1 }}>Dashboard</h1>
            </div>
            {userId && <OwnerUserBadge userId={userId} companyId="" />}
          </div>

          {/* Toggle */}
          <div style={{ display: 'inline-flex', background: '#FFFFFF', borderRadius: 10, padding: 3, marginBottom: 20 }}>
            {(['companies', 'users'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', border: 'none', cursor: 'pointer',
                borderRadius: 8, fontWeight: 600, fontSize: '0.875rem',
                background: tab === t ? T.surface : 'transparent',
                color: tab === t ? T.text1 : T.text3,
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: 'none',
                transition: 'all 0.15s',
              }}>
                {t === 'companies' ? <Building2 size={14} /> : <Users size={14} />}
                {t === 'companies' ? 'Companies' : 'Users'}
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                  background: tab === t ? T.surfaceHi : 'transparent',
                  color: tab === t ? T.text2 : T.text3,
                }}>
                  {t === 'companies' ? totalCompanyCount : totalUserCount}
                </span>
              </button>
            ))}
          </div>

          {/* ── Companies tab ─────────────────────────────────────────────── */}
          {tab === 'companies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Search size={15} color={T.text3} style={{ flexShrink: 0 }} />
                <input value={compSearch} onChange={e => setCompSearch(e.target.value)} placeholder="Search companies…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', color: T.text1, flex: 1 }} />
                {compSearch && <button onClick={() => setCompSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, padding: 0, display: 'flex' }}><X size={14} /></button>}
              </div>

              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                {/* Table */}
                <div style={{ flex: 1, minWidth: 0, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', background: '#FAFBFC' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: T.text1, flex: 1 }}>All Companies</span>
                    <span style={{ fontSize: '0.75rem', color: T.text3, fontVariantNumeric: 'tabular-nums' }}>
                      {displayedCompanies.length} / {totalCompanyCount}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#FAFBFC' }}>
                          {['Company', 'Plan', 'Industry', 'Status', 'Created', ''].map(h => (
                            <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontWeight: 600, color: T.text3, fontSize: 11, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {compLoading ? (
                          <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: T.text3 }}>Loading…</td></tr>
                        ) : displayedCompanies.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: T.text3 }}>No companies found</td></tr>
                        ) : displayedCompanies.map((c, i) => (
                          <tr key={c.id} style={{ borderBottom: `1px solid ${i === displayedCompanies.length - 1 ? 'transparent' : T.border}`, transition: 'background 0.1s', cursor: 'default' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <td style={{ padding: '11px 16px', fontWeight: 600, color: T.text1 }}>{c.name}</td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: c.plan === 'Paid' ? '#F0FDF4' : T.surfaceHi, color: c.plan === 'Paid' ? '#16A34A' : T.text3, border: `1px solid ${c.plan === 'Paid' ? '#BBF7D0' : T.border}` }}>{c.plan}</span>
                            </td>
                            <td style={{ padding: '11px 16px', color: T.text2, fontSize: '0.82rem' }}>{c.industry ?? '—'}</td>
                            <td style={{ padding: '11px 16px' }}><StatusDot suspended={c.is_suspended} /></td>
                            <td style={{ padding: '11px 16px', color: T.text3, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td style={{ padding: '11px 16px' }}>
                              <button onClick={() => openDetail(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 3, background: T.accentBg, border: `1px solid ${T.accentMid}`, borderRadius: 6, cursor: 'pointer', color: T.accent, fontWeight: 600, fontSize: 11.5, padding: '4px 10px' }}>
                                View <ChevronRight size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Filter panel */}
                <div style={{ width: 210, flexShrink: 0, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '14px 14px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.7rem', color: T.text3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filters</span>
                    {hasCompFilters && <button onClick={clearCompFilters} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T.accent, fontWeight: 600 }}>Clear all</button>}
                  </div>

                  <FilterSection label="Plan" count={planFilters.length} open={compFilterOpen.plan} onToggle={() => toggleCompSection('plan')}>
                    {ALL_PLANS.map(plan => <CheckRow key={plan} label={plan} checked={planFilters.includes(plan)} onChange={() => togglePlan(plan)} />)}
                  </FilterSection>

                  <FilterSection label="Industry" count={industryFilters.length} open={compFilterOpen.industry} onToggle={() => toggleCompSection('industry')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 8px', marginBottom: 7 }}>
                      <Search size={11} color={T.text3} style={{ flexShrink: 0 }} />
                      <input value={industrySearch} onChange={e => setIndustrySearch(e.target.value)} placeholder="Search…" style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.75rem', color: T.text1, flex: 1, minWidth: 0 }} />
                      {industrySearch && <button onClick={() => setIndustrySearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, padding: 0, display: 'flex' }}><X size={10} /></button>}
                    </div>
                    {allIndustryNames.length === 0 ? (
                      <span style={{ fontSize: '0.73rem', color: T.text3 }}>No industries</span>
                    ) : (
                      <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                        {allIndustryNames.filter(n => n.toLowerCase().includes(industrySearch.toLowerCase())).map(ind =>
                          <CheckRow key={ind} label={ind} checked={industryFilters.includes(ind)} onChange={() => toggleIndustry(ind)} />
                        )}
                      </div>
                    )}
                  </FilterSection>

                  <FilterSection label="Status" count={compStatusFilters.length} open={compFilterOpen.status} onToggle={() => toggleCompSection('status')}>
                    {[{ label: 'Active', value: 'active' }, { label: 'Suspended', value: 'suspended' }].map(({ label, value }) =>
                      <CheckRow key={value} label={label} checked={compStatusFilters.includes(value)} onChange={() => toggleCompStatus(value)} />
                    )}
                  </FilterSection>

                  <FilterSection label="Date Created" pill={<DateRangePill from={compDateFrom} to={compDateTo} />} open={compFilterOpen.date} onToggle={() => toggleCompSection('date')}>
                    <CalendarRangePicker from={compDateFrom} to={compDateTo} onChange={(f, t) => { setCompDateFrom(f); setCompDateTo(t) }} />
                  </FilterSection>
                </div>
              </div>
            </div>
          )}

          {/* ── Users tab ─────────────────────────────────────────────────── */}
          {tab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Search size={15} color={T.text3} style={{ flexShrink: 0 }} />
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or email…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', color: T.text1, flex: 1 }} />
                {userSearch && <button onClick={() => setUserSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, padding: 0, display: 'flex' }}><X size={14} /></button>}
              </div>

              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                {/* Table */}
                <div style={{ flex: 1, minWidth: 0, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', background: '#FAFBFC' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: T.text1, flex: 1 }}>All Users</span>
                    <span style={{ fontSize: '0.75rem', color: T.text3, fontVariantNumeric: 'tabular-nums' }}>
                      {displayedUsers.length} / {totalUserCount}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#FAFBFC' }}>
                          {['Name', 'Email', 'Role', 'Company', 'Status', 'Joined', ''].map(h => (
                            <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontWeight: 600, color: T.text3, fontSize: 11, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {userLoading ? (
                          <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: T.text3 }}>Loading…</td></tr>
                        ) : displayedUsers.length === 0 ? (
                          <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: T.text3 }}>No users found</td></tr>
                        ) : displayedUsers.map((u, i) => (
                          <tr key={u.id} style={{ borderBottom: `1px solid ${i === displayedUsers.length - 1 ? 'transparent' : T.border}`, transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <td style={{ padding: '11px 16px', fontWeight: 600, color: T.text1 }}>{u.full_name}</td>
                            <td style={{ padding: '11px 16px', color: T.text2, fontSize: '0.82rem' }}>{u.email_address}</td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: T.surfaceHi, color: T.text1, border: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>{u.role}</span>
                            </td>
                            <td style={{ padding: '11px 16px', color: T.text2, fontSize: '0.82rem' }}>{u.company_name ?? '—'}</td>
                            <td style={{ padding: '11px 16px' }}><StatusDot suspended={u.is_suspended} /></td>
                            <td style={{ padding: '11px 16px', color: T.text3, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td style={{ padding: '11px 16px' }}>
                              {u.is_suspended ? (
                                <button onClick={() => doUnsuspend('user', u.id, u.full_name)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: T.successBg, border: `1px solid ${T.successMid}`, borderRadius: 6, cursor: 'pointer', color: T.success, fontWeight: 600, fontSize: 11.5, padding: '4px 10px' }}>
                                  <CheckCircle size={12} /> Reinstate
                                </button>
                              ) : (
                                <button onClick={() => setSuspendModal({ type: 'user', id: u.id, name: u.full_name })}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: T.dangerBg, border: `1px solid ${T.dangerMid}`, borderRadius: 6, cursor: 'pointer', color: T.danger, fontWeight: 600, fontSize: 11.5, padding: '4px 10px' }}>
                                  <AlertTriangle size={12} /> Suspend
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Filter panel */}
                <div style={{ width: 210, flexShrink: 0, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '14px 14px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.7rem', color: T.text3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filters</span>
                    {hasUserFilters && <button onClick={clearUserFilters} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T.accent, fontWeight: 600 }}>Clear all</button>}
                  </div>

                  <FilterSection label="Company" count={companyNameFilters.length} open={userFilterOpen.company} onToggle={() => toggleUserSection('company')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 8px', marginBottom: 7 }}>
                      <Search size={11} color={T.text3} style={{ flexShrink: 0 }} />
                      <input value={companySearch} onChange={e => setCompanySearch(e.target.value)} placeholder="Search…" style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.75rem', color: T.text1, flex: 1, minWidth: 0 }} />
                      {companySearch && <button onClick={() => setCompanySearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, padding: 0, display: 'flex' }}><X size={10} /></button>}
                    </div>
                    {allCompanyNames.length === 0 ? (
                      <span style={{ fontSize: '0.73rem', color: T.text3 }}>No companies</span>
                    ) : (
                      <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                        {allCompanyNames.filter(n => n.toLowerCase().includes(companySearch.toLowerCase())).map(name =>
                          <CheckRow key={name} label={name} checked={companyNameFilters.includes(name)} onChange={() => toggleCompanyName(name)} />
                        )}
                      </div>
                    )}
                  </FilterSection>

                  <FilterSection label="Role" count={roleFilters.length} open={userFilterOpen.role} onToggle={() => toggleUserSection('role')}>
                    {ALL_ROLES.map(role => <CheckRow key={role} label={role} checked={roleFilters.includes(role)} onChange={() => toggleRole(role)} />)}
                  </FilterSection>

                  <FilterSection label="Status" count={statusFilters.length} open={userFilterOpen.status} onToggle={() => toggleUserSection('status')}>
                    {[{ label: 'Active', value: 'active' }, { label: 'Suspended', value: 'suspended' }].map(({ label, value }) =>
                      <CheckRow key={value} label={label} checked={statusFilters.includes(value)} onChange={() => toggleStatus(value)} />
                    )}
                  </FilterSection>

                  <FilterSection label="Date Joined" pill={<DateRangePill from={userDateFrom} to={userDateTo} />} open={userFilterOpen.date} onToggle={() => toggleUserSection('date')}>
                    <CalendarRangePicker from={userDateFrom} to={userDateTo} onChange={(f, t) => { setUserDateFrom(f); setUserDateTo(t) }} />
                  </FilterSection>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Company Detail Modal */}
      {detailOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setDetailOpen(false); setDetailCompany(null) }}>
          <div style={{ background: T.surface, borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', border: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${T.border}`, background: '#FAFBFC' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Company Record</div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: T.text1, margin: 0 }}>Company Details</h2>
              </div>
              <button onClick={() => { setDetailOpen(false); setDetailCompany(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, padding: 4 }}><X size={18} /></button>
            </div>

            {detailLoading ? (
              <div style={{ padding: 48, textAlign: 'center', color: T.text3 }}>Loading…</div>
            ) : detailCompany ? (
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: '1.2rem', color: T.text1, margin: '0 0 4px' }}>{detailCompany.name}</h3>
                    {detailCompany.description && <p style={{ color: T.text2, margin: 0, fontSize: '0.85rem' }}>{detailCompany.description}</p>}
                  </div>
                  <StatusDot suspended={detailCompany.is_suspended} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: 20, background: T.bg, borderRadius: 10, padding: 16 }}>
                  {[
                    ['Plan', detailCompany.plan],
                    ['Members', String(detailCompany.member_count)],
                    ['Industry', detailCompany.industry ?? '—'],
                    ['Size', detailCompany.size ?? '—'],
                    ['Location', detailCompany.location ?? '—'],
                    ['Website', detailCompany.website ?? '—'],
                    ['Owner', detailCompany.owner_name ?? '—'],
                    ['Owner Email', detailCompany.owner_email ?? '—'],
                    ['Created', new Date(detailCompany.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: '0.85rem', color: T.text1, fontWeight: 500 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {detailCompany.is_suspended && detailCompany.suspended_reason && (
                  <div style={{ background: T.dangerBg, border: `1px solid ${T.dangerMid}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.danger, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suspension Reason</div>
                    <div style={{ fontSize: '0.85rem', color: '#B91C1C' }}>{detailCompany.suspended_reason}</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                  <button onClick={() => { setDetailOpen(false); setDetailCompany(null) }}
                    style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, cursor: 'pointer', color: T.text2, fontWeight: 600, fontSize: '0.85rem' }}>
                    Close
                  </button>
                  {detailCompany.is_suspended ? (
                    <button onClick={() => doUnsuspend('company', detailCompany.id, detailCompany.name)}
                      style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: T.success, cursor: 'pointer', color: '#fff', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={14} /> Reinstate Company
                    </button>
                  ) : (
                    <button onClick={() => setSuspendModal({ type: 'company', id: detailCompany.id, name: detailCompany.name })}
                      style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: T.danger, cursor: 'pointer', color: '#fff', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} /> Suspend Company
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {suspendModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setSuspendModal(null); setSuspendReason('') }}>
          <div style={{ background: T.surface, borderRadius: 14, maxWidth: 420, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', border: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: `1px solid ${T.border}` }}>
              <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: T.danger, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} /> Suspend {suspendModal.type === 'company' ? 'Company' : 'User'}
              </h2>
              <button onClick={() => { setSuspendModal(null); setSuspendReason('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ padding: 22 }}>
              <p style={{ color: T.text2, fontSize: '0.875rem', margin: '0 0 16px' }}>
                You are about to suspend <strong style={{ color: T.text1 }}>{suspendModal.name}</strong>. Please provide a reason.
              </p>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: T.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Reason *</label>
              <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} rows={3} placeholder="Enter suspension reason…"
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontSize: '0.875rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: T.surface, color: T.text1 }} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={() => { setSuspendModal(null); setSuspendReason('') }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, cursor: 'pointer', color: T.text2, fontWeight: 600, fontSize: '0.85rem' }}>
                  Cancel
                </button>
                <button onClick={doSuspend} disabled={!suspendReason.trim() || suspending}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: suspendReason.trim() ? T.danger : T.border, cursor: suspendReason.trim() ? 'pointer' : 'not-allowed', color: suspendReason.trim() ? '#fff' : T.text3, fontWeight: 600, fontSize: '0.85rem' }}>
                  {suspending ? 'Suspending…' : 'Confirm Suspend'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: T.text1, color: '#fff', borderRadius: 9, padding: '11px 18px', fontSize: '0.85rem', fontWeight: 500, zIndex: 100, boxShadow: '0 4px 24px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accentMid, display: 'inline-block' }} />
          {toast}
        </div>
      )}
    </div>
  )
}
