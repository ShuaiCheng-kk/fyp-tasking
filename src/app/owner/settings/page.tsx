'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'

const INDUSTRIES = ['Retail', 'F&B', 'Logistics', 'Event Management']
const SIZES = ['1-10', '11-50', '51-200', '200+']

// ─── Types ────────────────────────────────────────────────────────────────────

type Company = {
  id: string
  name: string
  description: string | null
  owner_id: string
  plan: 'Free' | 'Paid'
  location: string | null
  industry: string | null
  size: string | null
  logo_url: string | null
  website: string | null
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

// ─── Modal primitives ─────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 100,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '540px' }}>
        {children}
      </div>
    </div>
  )
}

function ModalBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', maxHeight: '90vh', overflowY: 'auto' }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: '4px', borderRadius: '6px' }}>
        <X size={18} />
      </button>
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginTop: '12px', lineHeight: 1.5 }}>
      {message}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: '8px', fontSize: '0.9375rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '6px',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [userIdError, setUserIdError] = useState('')
  const [userRole, setUserRole] = useState('')

  // Edit modal
  const [editTarget, setEditTarget] = useState<Company | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editIndustry, setEditIndustry] = useState('')
  const [editSize, setEditSize] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Leave company modal
  const [leaveTarget, setLeaveTarget] = useState<Company | null>(null)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [leaveCompanyCount, setLeaveCompanyCount] = useState<number | null>(null)
  const [leaveCountLoading, setLeaveCountLoading] = useState(false)

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [addLocation, setAddLocation] = useState('')
  const [addIndustry, setAddIndustry] = useState('')
  const [addSize, setAddSize] = useState('')
  const [addDepts, setAddDepts] = useState([''])
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  // Active tab
  const [activeTab, setActiveTab] = useState<'company' | 'subscription'>(
    searchParams.get('tab') === 'subscription' ? 'subscription' : 'company'
  )

  // Removal overlay (Change 4)
  const [removalOverlay, setRemovalOverlay] = useState<{ companyName: string } | null>(null)

  // Account deleted overlay (shown after Leave Company when no remaining companies)
  const [accountRemovedOverlay, setAccountRemovedOverlay] = useState(false)

  // Plan tab
  const [planModalTarget, setPlanModalTarget] = useState<Company | null>(null)
  const [planModalType, setPlanModalType] = useState<'upgrade' | 'downgrade' | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [memberCountLoading, setMemberCountLoading] = useState(false)
  const [planChangeLoading, setPlanChangeLoading] = useState(false)
  const [planChangeError, setPlanChangeError] = useState('')

  useEffect(() => {
    const resolve = async () => {
      if (accountRemovedOverlay) return
      let uid = localStorage.getItem('tasking_user_id')
      if (!uid) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          uid = session.user.id
          localStorage.setItem('tasking_user_id', uid)
        }
      }
      if (!uid) {
        router.replace('/signin')
        return
      }
      setUserId(uid)
      const role = localStorage.getItem('tasking_user_role') || ''
      setUserRole(role)
      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (meData.success) {
        setInternalUserId(meData.user.id)
      }
      fetchCompanies(uid)
    }
    void resolve()
  }, [router])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/company/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: deleteTarget.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setDeleteTarget(null)
      fetchCompanies(userId)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete company')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleLeave = async () => {
    if (!leaveTarget) return
    setLeaveLoading(true)
    setLeaveError('')
    try {
      const res = await fetch('/api/user/leave-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: internalUserId, company_id: leaveTarget.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)

      if (data.accountDeleted) {
        setLeaveTarget(null)
        setAccountRemovedOverlay(true)
      } else {
        // Remove the left company from localStorage
        localStorage.removeItem(`tasking_company_id_${userId}`)
        localStorage.removeItem(`tasking_last_company_name_${leaveTarget.id}`)

        // Fetch remaining companies and switch to the first one
        const companiesRes = await fetch(`/api/company/my-companies?owner_id=${userId}`)
        const companiesData = await companiesRes.json()
        if (companiesData.success && companiesData.companies.length > 0) {
          const next = companiesData.companies[0]
          localStorage.setItem(`tasking_company_id_${userId}`, next.id)
          localStorage.setItem(`tasking_last_company_name_${next.id}`, next.name)
        }

        setLeaveTarget(null)
        router.replace('/owner/dashboard')
      }
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Failed to leave company')
    } finally {
      setLeaveLoading(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setEditTarget(null); setAddOpen(false); setDeleteTarget(null); setPlanModalTarget(null); setLeaveTarget(null); setLeaveCompanyCount(null) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const fetchCompanies = async (uid: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/company/my-companies?owner_id=${uid}`)
      const data = await res.json()
      if (data.success) {
        const startsWithDigit = (s: string) => /^\d/.test(s)
        const sorted = [...data.companies].sort((a: Company, b: Company) => {
          const aNum = startsWithDigit(a.name)
          const bNum = startsWithDigit(b.name)
          if (aNum !== bNum) return aNum ? 1 : -1
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        })
        setCompanies(sorted)

        // Change 3 & 4: detect if current active company was removed
        const storedCid = localStorage.getItem(`tasking_company_id_${uid}`)
        if (storedCid && sorted.length > 0 && !sorted.some((c: Company) => c.id === storedCid)) {
          const removedName = localStorage.getItem(`tasking_last_company_name_${storedCid}`) || 'your previous company'
          const next = sorted[0]
          localStorage.setItem(`tasking_company_id_${uid}`, next.id)
          localStorage.setItem(`tasking_last_company_name_${next.id}`, next.name)
          setRemovalOverlay({ companyName: removedName })
          setTimeout(() => {
            setRemovalOverlay(null)
          }, 3000)
        } else if (sorted.length > 0 && sorted[0]) {
          // Keep last company name cached for future removal detection
          sorted.forEach((c: Company) => {
            localStorage.setItem(`tasking_last_company_name_${c.id}`, c.name)
          })
        }
      }
    } catch {}
    finally { setLoading(false) }
  }

  // ── Edit company ───────────────────────────────────────────────────────────

  const openEdit = (c: Company) => {
    setEditTarget(c)
    setEditName(c.name)
    setEditDesc(c.description ?? '')
    setEditLocation(c.location ?? '')
    setEditIndustry(c.industry ?? '')
    setEditSize(c.size ?? '')
    setEditError('')
  }

  const handleEdit = async () => {
    if (!editTarget || !editName.trim()) return
    if (!editLocation.trim()) { setEditError('Location is required.'); return }
    if (!editIndustry.trim()) { setEditError('Industry is required.'); return }
    if (!editSize) { setEditError('Please select a company size.'); return }
    setEditLoading(true)
    setEditError('')
    try {
      const res = await fetch('/api/company/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: editTarget.id,
          name: editName,
          description: editDesc,
          location: editLocation,
          industry: editIndustry,
          size: editSize,
          website: null,
          logo_url: null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setEditTarget(null)
      fetchCompanies(userId)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update company')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Add company ────────────────────────────────────────────────────────────

  const openAdd = () => {
    setAddName(''); setAddDesc(''); setAddLocation(''); setAddIndustry(''); setAddSize('')
    setAddDepts(['']); setAddError(''); setAddOpen(true)
  }

  const handleAdd = async () => {
    if (!addName.trim()) { setAddError('Company name is required.'); return }
    if (!addLocation.trim()) { setAddError('Location is required.'); return }
    if (!addIndustry.trim()) { setAddError('Industry is required.'); return }
    if (!addSize) { setAddError('Please select a company size.'); return }
    setAddLoading(true)
    setAddError('')
    try {
      const res = await fetch('/api/company/create-additional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: userId,
          name: addName,
          description: addDesc || null,
          location: addLocation,
          industry: addIndustry,
          size: addSize,
          website: null,
          logo_url: null,
          departments: addDepts.filter((d) => d.trim()),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      if (userId) localStorage.setItem(`tasking_company_id_${userId}`, data.company.id)
      setAddOpen(false)
      fetchCompanies(userId)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create company')
    } finally {
      setAddLoading(false)
    }
  }

  const openLeave = async (c: Company) => {
    setLeaveError('')
    setLeaveCompanyCount(null)
    setLeaveTarget(c)
    setLeaveCountLoading(true)
    try {
      const res = await fetch(`/api/company/my-companies?owner_id=${userId}`)
      const data = await res.json()
      if (data.success) setLeaveCompanyCount(data.companies.length)
    } catch {}
    finally { setLeaveCountLoading(false) }
  }

  // ── Plan tab helpers ───────────────────────────────────────────────────────

  const isOwnerOfAny = companies.some((c) => c.owner_id === internalUserId)

  const openPlanModal = async (c: Company, type: 'upgrade' | 'downgrade') => {
    setPlanModalTarget(c)
    setPlanModalType(type)
    setPlanChangeError('')
    setMemberCount(0)
    if (type === 'upgrade') {
      setMemberCountLoading(true)
      try {
        const res = await fetch(`/api/team/member-count?owner_id=${userId}`)
        const data = await res.json()
        if (data.success) setMemberCount(data.count)
      } catch {}
      finally { setMemberCountLoading(false) }
    }
  }

  const handlePlanChange = async () => {
    if (!planModalTarget || !planModalType) return
    const newPlan: Company['plan'] = planModalType === 'upgrade' ? 'Paid' : 'Free'
    setPlanChangeLoading(true)
    setPlanChangeError('')
    try {
      const res = await fetch('/api/company/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: planModalTarget.id, plan: newPlan }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setPlanModalTarget(null)
      setPlanModalType(null)
      fetchCompanies(userId)
    } catch (err) {
      setPlanChangeError(err instanceof Error ? err.message : 'Failed to update plan')
    } finally {
      setPlanChangeLoading(false)
    }
  }

  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', background: '#111827', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
    cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '7px', opacity: disabled ? 0.65 : 1,
  })

  const ghostBtn: React.CSSProperties = {
    flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB',
    borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: 'pointer',
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{
          padding: '18px 32px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>Settings</h1>
        </div>

        {/* Body: vertical tab layout */}
        {userRole !== 'Manager' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left tab list */}
          <div style={{ width: '200px', borderRight: '1px solid #E5E7EB', background: '#FFFFFF', padding: '20px 12px', flexShrink: 0 }}>
            <button
              onClick={() => setActiveTab('company')}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px',
                background: activeTab === 'company' ? '#FFF7ED' : 'none',
                color: activeTab === 'company' ? '#EA580C' : '#374151',
                fontWeight: activeTab === 'company' ? 600 : 400,
                fontSize: '0.9rem', border: 'none', cursor: 'pointer',
              }}
            >
              My Company
            </button>
            {userRole === 'Owner' && (
              <button
                onClick={() => setActiveTab('subscription')}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px',
                  background: activeTab === 'subscription' ? '#FFF7ED' : 'none',
                  color: activeTab === 'subscription' ? '#EA580C' : '#374151',
                  fontWeight: activeTab === 'subscription' ? 600 : 400,
                  fontSize: '0.9rem', border: 'none', cursor: 'pointer', marginTop: '2px',
                }}
              >
                Subscription
              </button>
            )}
          </div>

          {/* Right content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
            {activeTab !== 'subscription' ? (
            <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>My Companies</h2>
            </div>

            {userIdError ? (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '14px 16px', fontSize: '0.9rem', color: '#DC2626' }}>
                {userIdError}
              </div>
            ) : loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
                <Spinner size={24} dark />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                  {companies.map((c) => {
                    const isOwner = c.owner_id === internalUserId
                    const initial = c.name.charAt(0).toUpperCase()
                    return (
                    <div key={c.id} style={{
                      background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px',
                      padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: '10px', background: '#F3F4F6',
                          border: '1px solid #E5E7EB', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '1rem', color: '#9CA3AF',
                        }}>
                          {initial}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{c.name}</p>
                          {c.industry && (
                            <span style={{
                              background: '#F97316', color: '#FFFFFF',
                              fontSize: '12px', fontWeight: 600,
                              padding: '2px 10px', borderRadius: '20px',
                              display: 'inline-block', flexShrink: 0,
                            }}>
                              {c.industry}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Bottom-right action buttons */}
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        {userRole === 'Partner' ? (
                          <button
                            onClick={() => openLeave(c)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '5px',
                              padding: '7px 12px', border: '1px solid #FECACA', borderRadius: '7px',
                              background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#EF4444', fontWeight: 500,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#FCA5A5')}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#FECACA')}
                          >
                            <Trash2 size={12} strokeWidth={2} />
                            Leave Company
                          </button>
                        ) : (
                          <>
                            {isOwner && (
                              <button
                                onClick={() => openEdit(c)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '5px',
                                  padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: '7px',
                                  background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151', fontWeight: 500,
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#9CA3AF')}
                                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                              >
                                <Pencil size={12} strokeWidth={2} />
                                Edit
                              </button>
                            )}
                            {isOwner && (
                              <div title={companies.filter((x) => x.owner_id === internalUserId).length <= 1 ? 'You must have at least one company' : undefined}>
                                <button
                                  onClick={() => { if (companies.filter((x) => x.owner_id === internalUserId).length > 1) { setDeleteTarget(c); setDeleteError('') } }}
                                  disabled={companies.filter((x) => x.owner_id === internalUserId).length <= 1}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: '7px',
                                    background: 'none', cursor: companies.filter((x) => x.owner_id === internalUserId).length <= 1 ? 'not-allowed' : 'pointer',
                                    fontSize: '0.8125rem', color: companies.filter((x) => x.owner_id === internalUserId).length <= 1 ? '#D1D5DB' : '#EF4444', fontWeight: 500,
                                    opacity: companies.filter((x) => x.owner_id === internalUserId).length <= 1 ? 0.5 : 1,
                                  }}
                                  onMouseEnter={(e) => { if (companies.filter((x) => x.owner_id === internalUserId).length > 1) e.currentTarget.style.borderColor = '#FCA5A5' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                                >
                                  <Trash2 size={12} strokeWidth={2} />
                                  Delete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    )
                  })}
                </div>

                {/* Add New Company — only for Owner role */}
                {userRole === 'Owner' && (
                <button
                  onClick={openAdd}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 16px', background: 'transparent',
                    border: '1.5px solid #F97316', borderRadius: '9px',
                    fontWeight: 600, fontSize: '0.875rem', color: '#F97316', cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FFF7ED')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Add New Company
                </button>
                )}
              </>
            )}
            </>
            ) : (
            <>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>Subscription</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {companies.filter((c) => c.owner_id === internalUserId).map((c) => {
                const isPro = c.plan === 'Paid'
                return (
                  <div key={c.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <p style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>{c.name}</p>
                      <span style={{
                        padding: '3px 10px', borderRadius: '99px', fontSize: '0.78rem', fontWeight: 600,
                        background: isPro ? '#EDE9FE' : '#F3F4F6',
                        color: isPro ? '#7C3AED' : '#6B7280',
                      }}>
                        {isPro ? 'Pro' : 'Free'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.5 }}>
                      {isPro
                        ? 'All features including advanced analytics and priority support'
                        : 'Basic features for small teams'}
                    </p>
                    {isPro ? (
                      <button
                        onClick={() => openPlanModal(c, 'downgrade')}
                        style={{
                          padding: '8px 16px', background: 'none', border: '1.5px solid #E5E7EB',
                          borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', color: '#6B7280',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#9CA3AF')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                      >
                        Downgrade to Free
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push(`/pricing?upgrade=1&company_id=${c.id}`)}
                        style={{
                          padding: '8px 16px', background: '#111827', border: 'none',
                          borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', color: '#FFFFFF',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#1F2937')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#111827')}
                      >
                        Upgrade to Pro — $6/user/month
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            </>
            )}
          </div>
        </div>
        )}
      </main>

      {/* ── Edit Company Modal ─────────────────────────────────────────────── */}
      {editTarget && (
        <ModalOverlay onClose={() => setEditTarget(null)}>
          <ModalBox>
            <ModalHeader title="Edit Company" onClose={() => setEditTarget(null)} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Company Name <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Company Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Location <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Singapore, Orchard Road"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Industry <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Retail, Logistics, Healthcare"
                  value={editIndustry}
                  onChange={(e) => setEditIndustry(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Number of Staff <span style={{ color: '#EF4444' }}>*</span></label>
                <select value={editSize} onChange={(e) => setEditSize(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
                  <option value="">Select staff count...</option>
                  {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <InlineError message={editError} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={ghostBtn} onClick={() => setEditTarget(null)}>Cancel</button>
              <button style={primaryBtn(editLoading)} onClick={handleEdit} disabled={editLoading}>
                {editLoading && <Spinner size={14} />}
                Save Changes
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Delete Company Confirmation Modal ─────────────────────────────── */}
      {deleteTarget && (
        <ModalOverlay onClose={() => setDeleteTarget(null)}>
          <ModalBox>
            <ModalHeader title="Delete Company" onClose={() => setDeleteTarget(null)} />

            <p style={{ fontSize: '0.9375rem', color: '#374151', marginBottom: '4px', lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?{' '}
              This cannot be undone.
            </p>

            <InlineError message={deleteError} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={ghostBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  flex: 1, padding: '10px', background: '#EF4444', border: 'none', borderRadius: '8px',
                  fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
                  cursor: deleteLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '7px', opacity: deleteLoading ? 0.65 : 1,
                }}
              >
                {deleteLoading && <Spinner size={14} />}
                Delete Company
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Leave Company Confirmation Modal ──────────────────────────────── */}
      {leaveTarget && (
        <ModalOverlay onClose={() => { setLeaveTarget(null); setLeaveCompanyCount(null) }}>
          <ModalBox>
            <ModalHeader title="Leave Company" onClose={() => { setLeaveTarget(null); setLeaveCompanyCount(null) }} />

            {leaveCountLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                <Spinner size={20} dark />
              </div>
            ) : leaveCompanyCount === 1 ? (
              <p style={{ fontSize: '0.9375rem', color: '#374151', marginBottom: '4px', lineHeight: 1.6 }}>
                Are you sure you want to leave <strong>{leaveTarget.name}</strong>?{' '}
                Since this is your only company, your account will be permanently deleted and you will be signed out.{' '}
                This cannot be undone.
              </p>
            ) : (
              <p style={{ fontSize: '0.9375rem', color: '#374151', marginBottom: '4px', lineHeight: 1.6 }}>
                Are you sure you want to leave <strong>{leaveTarget.name}</strong>?{' '}
                You will lose access to this company. Your account will not be deleted.
              </p>
            )}

            <InlineError message={leaveError} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={ghostBtn} onClick={() => { setLeaveTarget(null); setLeaveCompanyCount(null) }}>Cancel</button>
              <button
                onClick={handleLeave}
                disabled={leaveLoading || leaveCountLoading}
                style={{
                  flex: 1, padding: '10px',
                  background: leaveCompanyCount === 1 ? '#EF4444' : 'none',
                  border: leaveCompanyCount === 1 ? 'none' : '1.5px solid #EF4444',
                  borderRadius: '8px',
                  fontWeight: 600, fontSize: '0.9375rem',
                  color: leaveCompanyCount === 1 ? '#FFFFFF' : '#EF4444',
                  cursor: (leaveLoading || leaveCountLoading) ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '7px',
                  opacity: (leaveLoading || leaveCountLoading) ? 0.65 : 1,
                }}
              >
                {leaveLoading && <Spinner size={14} dark={leaveCompanyCount !== 1} />}
                Leave Company
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Plan Change Confirmation Modal ────────────────────────────────── */}
      {planModalTarget && planModalType && (
        <ModalOverlay onClose={() => { setPlanModalTarget(null); setPlanModalType(null) }}>
          <ModalBox>
            <ModalHeader
              title={planModalType === 'upgrade' ? 'Upgrade to Pro?' : 'Downgrade to Free?'}
              onClose={() => { setPlanModalTarget(null); setPlanModalType(null) }}
            />
            {planModalType === 'upgrade' ? (
              <div style={{ fontSize: '0.9375rem', color: '#374151', margin: '0 0 4px', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 12px' }}>
                  All your companies will be upgraded to Pro.
                </p>
                {memberCountLoading
                  ? <span style={{ color: '#9CA3AF' }}>Calculating cost…</span>
                  : (
                    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '14px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: '#6B7280' }}>Users</span>
                        <span style={{ fontWeight: 600 }}>{memberCount}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ color: '#6B7280' }}>Price per user</span>
                        <span style={{ fontWeight: 600 }}>$6 / month</span>
                      </div>
                      <div style={{ borderTop: '1px solid #FED7AA', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>Total</span>
                        <span style={{ fontWeight: 700, color: '#F97316', fontSize: '1rem' }}>${6 * memberCount}/month</span>
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <p style={{ fontSize: '0.9375rem', color: '#374151', margin: '0 0 4px', lineHeight: 1.6 }}>
                All your companies and their members will be downgraded to Free.
              </p>
            )}
            <InlineError message={planChangeError} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={ghostBtn} onClick={() => { setPlanModalTarget(null); setPlanModalType(null) }}>Cancel</button>
              <button
                style={primaryBtn(planChangeLoading)}
                onClick={handlePlanChange}
                disabled={planChangeLoading}
              >
                {planChangeLoading && <Spinner size={14} />}
                {planModalType === 'upgrade' ? 'Confirm Upgrade' : 'Confirm Downgrade'}
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Add Company Modal ──────────────────────────────────────────────── */}
      {addOpen && (
        <ModalOverlay onClose={() => setAddOpen(false)}>
          <ModalBox>
            <ModalHeader title="Add New Company" onClose={() => setAddOpen(false)} />

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Company Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input
                autoFocus
                type="text"
                placeholder="e.g. Acme Corp"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Company Description</label>
              <textarea
                placeholder="What does this company do?"
                value={addDesc}
                onChange={(e) => setAddDesc(e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Location <span style={{ color: '#EF4444' }}>*</span></label>
              <input
                type="text"
                placeholder="e.g. Singapore, Orchard Road"
                value={addLocation}
                onChange={(e) => setAddLocation(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Industry <span style={{ color: '#EF4444' }}>*</span></label>
              <input
                type="text"
                placeholder="e.g. Retail, Logistics, Healthcare"
                value={addIndustry}
                onChange={(e) => setAddIndustry(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Number of Staff <span style={{ color: '#EF4444' }}>*</span></label>
              <select value={addSize} onChange={(e) => setAddSize(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
                <option value="">Select staff count...</option>
                {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Departments */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Departments</label>
              {addDepts.map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder={`Department ${i + 1}`}
                    value={d}
                    onChange={(e) => {
                      const next = [...addDepts]
                      next[i] = e.target.value
                      setAddDepts(next)
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {addDepts.length > 1 && (
                    <button
                      onClick={() => setAddDepts(addDepts.filter((_, j) => j !== i))}
                      style={{ padding: '0 10px', border: '1.5px solid #E5E7EB', borderRadius: '8px', background: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setAddDepts([...addDepts, ''])}
                style={{ fontSize: '0.8125rem', color: '#F97316', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                + Add another
              </button>
            </div>

            <InlineError message={addError} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={ghostBtn} onClick={() => setAddOpen(false)}>Cancel</button>
              <button style={primaryBtn(addLoading)} onClick={handleAdd} disabled={addLoading}>
                {addLoading && <Spinner size={14} />}
                Create Company
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Account Removed overlay (shown after Leave Company with no remaining companies) ── */}
      {accountRemovedOverlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', padding: '40px 48px',
            boxShadow: '0 8px 48px rgba(0,0,0,0.18)', maxWidth: '460px', textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="9" stroke="#EF4444" strokeWidth="2" />
              </svg>
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: '0 0 12px' }}>
              Your account has been removed
            </h2>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 24px' }}>
              You have left your last company. Your account has been permanently deleted.
            </p>
            <button
              onClick={async () => {
                const supabase = createBrowserClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                )
                localStorage.clear()
                await supabase.auth.signOut()
                router.replace('/')
              }}
              style={{
                padding: '10px 28px', background: '#111827', border: 'none', borderRadius: '8px',
                fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF', cursor: 'pointer',
              }}
            >
              Exit
            </button>
          </div>
        </div>
      )}

      {/* ── Change 4: Removal overlay ─────────────────────────────────────── */}
      {removalOverlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', padding: '40px 48px',
            boxShadow: '0 8px 48px rgba(0,0,0,0.18)', maxWidth: '460px', textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="9" stroke="#EF4444" strokeWidth="2" />
              </svg>
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: '0 0 12px' }}>
              You have been removed
            </h2>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 20px' }}>
              You have been removed from <strong style={{ color: '#111827' }}>{removalOverlay.companyName}</strong> by the Owner.
              Switching you to your other company…
            </p>
            <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: '#F97316', borderRadius: 2,
                animation: 'removal-progress 3s linear forwards',
              }} />
            </div>
            <style>{`@keyframes removal-progress { from { width: 0% } to { width: 100% } }`}</style>
          </div>
        </div>
      )}
    </div>
  )
}
