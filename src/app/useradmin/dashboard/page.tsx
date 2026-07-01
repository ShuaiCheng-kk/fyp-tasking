'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Building2, Users, X, AlertTriangle, CheckCircle, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import UserAdminSidebar from '@/components/UserAdminSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { UACompany, UACompanyDetail, UAUser } from '@/types/UserAdmin'

const SIDEBAR_WIDTH = 64

type Tab = 'companies' | 'users'

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
    fetch('/api/useradmin/companies').then(r => r.json()).then(d => setTotalCompanyCount(d.companies?.length ?? 0))
    fetch('/api/useradmin/users').then(r => r.json()).then(d => setTotalUserCount(d.users?.length ?? 0))
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

  const [userFilterOpen, setUserFilterOpen] = useState<Record<string, boolean>>({ company: true, role: true, status: true, date: true })
  const [compFilterOpen, setCompFilterOpen] = useState<Record<string, boolean>>({ plan: true, industry: true, status: true, date: true })
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
      setSuspendModal(null)
      setSuspendReason('')
      if (suspendModal.type === 'company') {
        fetchCompanies(compSearch)
        if (detailCompany?.id === suspendModal.id) openDetail(suspendModal.id)
      } else {
        fetchUsers(userSearch)
      }
    } finally {
      setSuspending(false)
    }
  }

  const doUnsuspend = async (type: 'company' | 'user', id: string, name: string) => {
    const action = type === 'company' ? 'unsuspend_company' : 'unsuspend_user'
    const body = type === 'company' ? { action, company_id: id } : { action, user_id: id }
    const res = await fetch('/api/useradmin/suspend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { showToast(data.error ?? 'Failed'); return }
    showToast(`${name} unsuspended`)
    if (type === 'company') {
      fetchCompanies(compSearch)
      if (detailCompany?.id === id) openDetail(id)
    } else {
      fetchUsers(userSearch)
    }
  }

  const CARD: React.CSSProperties = {
    background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }

  const BADGE = (suspended: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    background: suspended ? '#FEF2F2' : '#F0FDF4',
    color: suspended ? '#DC2626' : '#16A34A',
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>
      <UserAdminSidebar />

      <div style={{ marginLeft: SIDEBAR_WIDTH, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, flexShrink: 0 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.15rem', color: '#111827', margin: 0 }}>User Admin</h1>
          {userId && <OwnerUserBadge userId={userId} companyId="" />}
        </div>

        <div style={{ padding: '32px', flex: 1 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: '#F3F4F6', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {(['companies', 'users'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
                  fontSize: '0.875rem', transition: 'all 0.15s',
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? '#F97316' : '#6B7280',
                  boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {t === 'companies' ? <Building2 size={15} /> : <Users size={15} />}
                {t === 'companies' ? 'Companies' : 'Users'}
              </button>
            ))}
          </div>

          {tab === 'companies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Full-width search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '11px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <Search size={17} color="#9CA3AF" style={{ flexShrink: 0 }} />
                <input
                  value={compSearch}
                  onChange={e => setCompSearch(e.target.value)}
                  placeholder="Search by company name…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9375rem', color: '#111827', flex: 1 }}
                />
                {compSearch && <button onClick={() => setCompSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}><X size={16} /></button>}
              </div>

              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                {/* Table */}
                <div style={{ ...CARD, flex: 1, minWidth: 0 }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center' }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, flex: 1 }}>
                      All Companies
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                      {displayedCompanies.length} of {totalCompanyCount} companies
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          {['Company', 'Plan', 'Industry', 'Status', 'Created', ''].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 12, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {compLoading ? (
                          <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</td></tr>
                        ) : displayedCompanies.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No companies found</td></tr>
                        ) : displayedCompanies.map(c => (
                          <tr key={c.id} style={{ borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#FFFBF7')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{c.name}</td>
                            <td style={{ padding: '12px 16px', color: '#374151' }}>{c.plan}</td>
                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>{c.industry ?? '—'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={BADGE(c.is_suspended)}>{c.is_suspended ? 'Suspended' : 'Active'}</span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <button
                                onClick={() => openDetail(c.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: '#F97316', fontWeight: 600, fontSize: 12 }}
                              >
                                Details <ChevronRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Filter panel — right side */}
                <div style={{ ...CARD, width: 220, flexShrink: 0, padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filters</span>
                    {hasCompFilters && <button onClick={clearCompFilters} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#F97316', fontWeight: 600 }}>Clear all</button>}
                  </div>

                  {/* Plan */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12, marginBottom: 0 }}>
                    <button onClick={() => toggleCompSection('plan')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontWeight: 600, fontSize: '0.85rem', color: '#F97316' }}>
                      Plan {planFilters.length > 0 && <span style={{ background: '#F97316', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{planFilters.length}</span>}
                      {compFilterOpen.plan ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                    </button>
                    {compFilterOpen.plan && ALL_PLANS.map(plan => (
                      <label key={plan} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={planFilters.includes(plan)} onChange={() => togglePlan(plan)} style={{ width: 15, height: 15, accentColor: '#F97316', cursor: 'pointer' }} />
                        <span style={{ fontSize: '0.8rem', color: '#374151' }}>{plan}</span>
                      </label>
                    ))}
                  </div>

                  {/* Industry */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                    <button onClick={() => toggleCompSection('industry')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontWeight: 600, fontSize: '0.85rem', color: '#F97316' }}>
                      Industry {industryFilters.length > 0 && <span style={{ background: '#F97316', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{industryFilters.length}</span>}
                      {compFilterOpen.industry ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                    </button>
                    {compFilterOpen.industry && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 10px', marginBottom: 8 }}>
                          <Search size={12} color="#9CA3AF" style={{ flexShrink: 0 }} />
                          <input value={industrySearch} onChange={e => setIndustrySearch(e.target.value)} placeholder="Search industry…" style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.78rem', color: '#111827', flex: 1, minWidth: 0 }} />
                          {industrySearch && <button onClick={() => setIndustrySearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}><X size={11} /></button>}
                        </div>
                        {allIndustryNames.length === 0 ? (
                          <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>No industries</span>
                        ) : (
                          <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 4 }}>
                            {allIndustryNames.filter(n => n.toLowerCase().includes(industrySearch.toLowerCase())).map(ind => (
                              <label key={ind} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                                <input type="checkbox" checked={industryFilters.includes(ind)} onChange={() => toggleIndustry(ind)} style={{ width: 15, height: 15, accentColor: '#F97316', cursor: 'pointer', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.8rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ind}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Status */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                    <button onClick={() => toggleCompSection('status')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontWeight: 600, fontSize: '0.85rem', color: '#F97316' }}>
                      Status {compStatusFilters.length > 0 && <span style={{ background: '#F97316', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{compStatusFilters.length}</span>}
                      {compFilterOpen.status ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                    </button>
                    {compFilterOpen.status && [{ label: 'Active', value: 'active' }, { label: 'Suspended', value: 'suspended' }].map(({ label, value }) => (
                      <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={compStatusFilters.includes(value)} onChange={() => toggleCompStatus(value)} style={{ width: 15, height: 15, accentColor: '#F97316', cursor: 'pointer' }} />
                        <span style={{ fontSize: '0.8rem', color: '#374151' }}>{label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Date created */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                    <button onClick={() => toggleCompSection('date')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontWeight: 600, fontSize: '0.85rem', color: '#F97316' }}>
                      Date Created {(compDateFrom || compDateTo) && <span style={{ background: '#F97316', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>●</span>}
                      {compFilterOpen.date ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                    </button>
                    {compFilterOpen.date && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 4 }}>From</div>
                          <input type="date" value={compDateFrom} onChange={e => setCompDateFrom(e.target.value)} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 10px', fontSize: '0.8rem', color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 4 }}>To</div>
                          <input type="date" value={compDateTo} onChange={e => setCompDateTo(e.target.value)} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 10px', fontSize: '0.8rem', color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        {(compDateFrom || compDateTo) && <button onClick={() => { setCompDateFrom(''); setCompDateTo('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9CA3AF', textAlign: 'left', padding: 0 }}>Clear dates</button>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Full-width search bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '11px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <Search size={17} color="#9CA3AF" style={{ flexShrink: 0 }} />
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9375rem', color: '#111827', flex: 1 }}
                />
                {userSearch && <button onClick={() => setUserSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}><X size={16} /></button>}
              </div>

              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              {/* Table */}
              <div style={{ ...CARD, flex: 1, minWidth: 0 }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center' }}>
                  <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, flex: 1 }}>
                    All Users
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                    {displayedUsers.length} of {totalUserCount} users
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        {['Name', 'Email', 'Role', 'Company', 'Status', 'Joined', ''].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 12, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {userLoading ? (
                        <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</td></tr>
                      ) : displayedUsers.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No users found</td></tr>
                      ) : displayedUsers.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#FFFBF7')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{u.full_name}</td>
                          <td style={{ padding: '12px 16px', color: '#374151' }}>{u.email_address}</td>
                          <td style={{ padding: '12px 16px', color: '#6B7280' }}>{u.role}</td>
                          <td style={{ padding: '12px 16px', color: '#6B7280' }}>{u.company_name ?? '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={BADGE(u.is_suspended)}>{u.is_suspended ? 'Suspended' : 'Active'}</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#6B7280' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {u.is_suspended ? (
                              <button
                                onClick={() => doUnsuspend('user', u.id, u.full_name)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, cursor: 'pointer', color: '#16A34A', fontWeight: 600, fontSize: 12, padding: '4px 10px' }}
                              >
                                <CheckCircle size={13} /> Reinstate
                              </button>
                            ) : (
                              <button
                                onClick={() => setSuspendModal({ type: 'user', id: u.id, name: u.full_name })}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, cursor: 'pointer', color: '#DC2626', fontWeight: 600, fontSize: 12, padding: '4px 10px' }}
                              >
                                <AlertTriangle size={13} /> Suspend
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Filter panel — right side */}
              <div style={{ ...CARD, width: 220, flexShrink: 0, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filters</span>
                  {hasUserFilters && <button onClick={clearUserFilters} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#F97316', fontWeight: 600 }}>Clear all</button>}
                </div>

                {/* Company */}
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                  <button onClick={() => toggleUserSection('company')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontWeight: 600, fontSize: '0.85rem', color: '#F97316' }}>
                    Company {companyNameFilters.length > 0 && <span style={{ background: '#F97316', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{companyNameFilters.length}</span>}
                    {userFilterOpen.company ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                  </button>
                  {userFilterOpen.company && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 10px', marginBottom: 8 }}>
                        <Search size={12} color="#9CA3AF" style={{ flexShrink: 0 }} />
                        <input value={companySearch} onChange={e => setCompanySearch(e.target.value)} placeholder="Search company…" style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.78rem', color: '#111827', flex: 1, minWidth: 0 }} />
                        {companySearch && <button onClick={() => setCompanySearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}><X size={11} /></button>}
                      </div>
                      {allCompanyNames.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>No companies</span>
                      ) : (
                        <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 4 }}>
                          {allCompanyNames.filter(n => n.toLowerCase().includes(companySearch.toLowerCase())).map(name => (
                            <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                              <input type="checkbox" checked={companyNameFilters.includes(name)} onChange={() => toggleCompanyName(name)} style={{ width: 15, height: 15, accentColor: '#F97316', cursor: 'pointer', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.8rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Role */}
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                  <button onClick={() => toggleUserSection('role')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontWeight: 600, fontSize: '0.85rem', color: '#F97316' }}>
                    Role {roleFilters.length > 0 && <span style={{ background: '#F97316', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{roleFilters.length}</span>}
                    {userFilterOpen.role ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                  </button>
                  {userFilterOpen.role && ALL_ROLES.map(role => (
                    <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={roleFilters.includes(role)} onChange={() => toggleRole(role)} style={{ width: 15, height: 15, accentColor: '#F97316', cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.8rem', color: '#374151' }}>{role}</span>
                    </label>
                  ))}
                </div>

                {/* Status */}
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                  <button onClick={() => toggleUserSection('status')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontWeight: 600, fontSize: '0.85rem', color: '#F97316' }}>
                    Status {statusFilters.length > 0 && <span style={{ background: '#F97316', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{statusFilters.length}</span>}
                    {userFilterOpen.status ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                  </button>
                  {userFilterOpen.status && [{ label: 'Active', value: 'active' }, { label: 'Suspended', value: 'suspended' }].map(({ label, value }) => (
                    <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={statusFilters.includes(value)} onChange={() => toggleStatus(value)} style={{ width: 15, height: 15, accentColor: '#F97316', cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.8rem', color: '#374151' }}>{label}</span>
                    </label>
                  ))}
                </div>

                {/* Date joined */}
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                  <button onClick={() => toggleUserSection('date')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontWeight: 600, fontSize: '0.85rem', color: '#F97316' }}>
                    Date Joined {(userDateFrom || userDateTo) && <span style={{ background: '#F97316', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>●</span>}
                    {userFilterOpen.date ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                  </button>
                  {userFilterOpen.date && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 4 }}>From</div>
                        <input type="date" value={userDateFrom} onChange={e => setUserDateFrom(e.target.value)} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 10px', fontSize: '0.8rem', color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 4 }}>To</div>
                        <input type="date" value={userDateTo} onChange={e => setUserDateTo(e.target.value)} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 10px', fontSize: '0.8rem', color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      {(userDateFrom || userDateTo) && <button onClick={() => { setUserDateFrom(''); setUserDateTo('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9CA3AF', textAlign: 'left', padding: 0 }}>Clear dates</button>}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Company Detail Modal */}
      {detailOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setDetailOpen(false); setDetailCompany(null) }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 540, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.1rem', color: '#111827', margin: 0 }}>Company Details</h2>
              <button onClick={() => { setDetailOpen(false); setDetailCompany(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
            ) : detailCompany ? (
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: '1.25rem', color: '#111827', margin: '0 0 4px' }}>{detailCompany.name}</h3>
                    {detailCompany.description && <p style={{ color: '#6B7280', margin: 0, fontSize: '0.875rem' }}>{detailCompany.description}</p>}
                  </div>
                  <span style={BADGE(detailCompany.is_suspended)}>{detailCompany.is_suspended ? 'Suspended' : 'Active'}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 20 }}>
                  {[
                    ['Plan', detailCompany.plan],
                    ['Members', String(detailCompany.member_count)],
                    ['Industry', detailCompany.industry ?? '—'],
                    ['Size', detailCompany.size ?? '—'],
                    ['Location', detailCompany.location ?? '—'],
                    ['Website', detailCompany.website ?? '—'],
                    ['Owner', detailCompany.owner_name ?? '—'],
                    ['Owner Email', detailCompany.owner_email ?? '—'],
                    ['Created', new Date(detailCompany.created_at).toLocaleDateString()],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {detailCompany.is_suspended && detailCompany.suspended_reason && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginBottom: 2 }}>Suspension Reason</div>
                    <div style={{ fontSize: '0.875rem', color: '#B91C1C' }}>{detailCompany.suspended_reason}</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
                  <button onClick={() => { setDetailOpen(false); setDetailCompany(null) }}
                    style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 600, fontSize: '0.875rem' }}>
                    Close
                  </button>
                  {detailCompany.is_suspended ? (
                    <button
                      onClick={() => doUnsuspend('company', detailCompany.id, detailCompany.name)}
                      style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#16A34A', cursor: 'pointer', color: '#fff', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={15} /> Reinstate Company
                    </button>
                  ) : (
                    <button
                      onClick={() => { setSuspendModal({ type: 'company', id: detailCompany.id, name: detailCompany.name }) }}
                      style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', cursor: 'pointer', color: '#fff', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={15} /> Suspend Company
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setSuspendModal(null); setSuspendReason('') }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#DC2626', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} /> Suspend {suspendModal.type === 'company' ? 'Company' : 'User'}
              </h2>
              <button onClick={() => { setSuspendModal(null); setSuspendReason('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ color: '#374151', fontSize: '0.875rem', margin: '0 0 16px' }}>
                You are about to suspend <strong>{suspendModal.name}</strong>. Please provide a reason.
              </p>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#374151', marginBottom: 6 }}>Reason *</label>
              <textarea
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                rows={3}
                placeholder="Enter suspension reason…"
                style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px 12px', fontSize: '0.875rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={() => { setSuspendModal(null); setSuspendReason('') }}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 600, fontSize: '0.875rem' }}>
                  Cancel
                </button>
                <button
                  onClick={doSuspend}
                  disabled={!suspendReason.trim() || suspending}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: suspendReason.trim() ? '#DC2626' : '#E5E7EB', cursor: suspendReason.trim() ? 'pointer' : 'not-allowed', color: suspendReason.trim() ? '#fff' : '#9CA3AF', fontWeight: 600, fontSize: '0.875rem' }}>
                  {suspending ? 'Suspending…' : 'Confirm Suspend'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#111827', color: '#fff', borderRadius: 10, padding: '12px 20px', fontSize: '0.875rem', fontWeight: 500, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
