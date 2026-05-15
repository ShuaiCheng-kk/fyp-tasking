'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Pencil, Trash2, X, ChevronDown, Check, Copy } from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'

// ─── Types ────────────────────────────────────────────────────────────────────

type Department = {
  id: string
  name: string
  company_id: string
  created_at: string
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

// ─── Modal Overlay ────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '520px' }}>
        {children}
      </div>
    </div>
  )
}

function ModalBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      padding: '32px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
    }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>{title}</h2>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: '4px', borderRadius: '6px' }}
      >
        <X size={18} />
      </button>
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{
      background: '#FEF2F2',
      border: '1px solid #FECACA',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '0.875rem',
      color: '#DC2626',
      marginTop: '12px',
      lineHeight: 1.5,
    }}>
      {message}
    </div>
  )
}

// ─── Invite code display box ──────────────────────────────────────────────────

function CodeBox({ code, loading }: { code: string; loading: boolean }) {
  return (
    <div style={{
      background: '#F8F9FA',
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      padding: '24px',
      textAlign: 'center',
      minHeight: '84px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {loading ? (
        <Spinner size={24} dark />
      ) : code ? (
        <span style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontWeight: 700,
          fontSize: '2rem',
          letterSpacing: '0.15em',
          color: '#1C1C1E',
        }}>
          {code}
        </span>
      ) : (
        <span style={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Select a department to generate a code</span>
      )}
    </div>
  )
}

// ─── Code action buttons (Copy Link) ─────────────────────────────────────────

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fyp-tasking.vercel.app'

function CodeActions({ code, loading, copied, onCopy }: {
  code: string
  loading: boolean
  copied: boolean
  onCopy: () => void
}) {
  const disabled = !code || loading
  return (
    <button
      onClick={onCopy}
      disabled={disabled}
      style={{
        width: '100%',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        background: copied ? '#059669' : '#F97316',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '10px',
        fontWeight: 600,
        fontSize: '0.9375rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background 0.2s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled && !copied) e.currentTarget.style.background = '#EA6C0A' }}
      onMouseLeave={(e) => { if (!disabled && !copied) e.currentTarget.style.background = '#F97316' }}
    >
      {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Link</>}
    </button>
  )
}


// ─── Shared modal input style ─────────────────────────────────────────────────

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E5E7EB',
  borderRadius: '8px',
  fontSize: '0.9375rem',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#FFFFFF',
}

const modalLabelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: '#374151',
  marginBottom: '8px',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const router = useRouter()

  // Auth / company IDs read once on mount
  const [userId, setUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyStatus, setCompanyStatus] = useState<'loading' | 'found' | 'not-found'>('loading')

  // Top-bar data
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Departments
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptSearch, setDeptSearch] = useState('')

  // Department CRUD modal state
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState<Department | null>(null)
  const [deleteModal, setDeleteModal] = useState<Department | null>(null)
  const [deptFormName, setDeptFormName] = useState('')
  const [deptLoading, setDeptLoading] = useState(false)
  const [deptError, setDeptError] = useState('')

  // ── Close all modals ───────────────────────────────────────────────────────

  const closeAll = useCallback(() => {
    setAddModal(false)
    setEditModal(null)
    setDeleteModal(null)
  }, [])

  // ── Escape key ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeAll])

  // ── Click outside company dropdown ─────────────────────────────────────────

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Mount: read localStorage, fetch data ───────────────────────────────────

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id') || ''
    const cid = localStorage.getItem('tasking_company_id') || ''
    setUserId(uid)
    if (uid) fetchAllCompanies(uid)

    if (cid) {
      setCompanyId(cid)
      setCompanyStatus('found')
      fetchDepts(cid)
    } else if (uid) {
      fetchCompanyByOwner(uid)
    } else {
      setCompanyStatus('not-found')
    }
  }, [])

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchAllCompanies = async (uid: string) => {
    try {
      const res = await fetch(`/api/company/my-companies?owner_id=${uid}`)
      const data = await res.json()
      if (data.success) setCompanies(data.companies)
    } catch {}
  }

  const fetchCompanyByOwner = async (uid: string) => {
    try {
      const res = await fetch(`/api/company/by-owner?owner_id=${uid}`)
      const data = await res.json()
      if (data.success && data.company?.id) {
        const cid = data.company.id
        localStorage.setItem('tasking_company_id', cid)
        setCompanyId(cid)
        setCompanyStatus('found')
        fetchDepts(cid)
      } else {
        setCompanyStatus('not-found')
      }
    } catch {
      setCompanyStatus('not-found')
    }
  }

  const fetchDepts = async (cid: string) => {
    try {
      const res = await fetch(`/api/company/departments?company_id=${cid}`)
      const data = await res.json()
      if (data.success) setDepartments(data.departments)
    } catch {}
  }

  // ── Invite code generation ─────────────────────────────────────────────────

  const generateCode = async (role: 'Manager' | 'Employee' | 'Owner', deptId?: string) => {
    const cid = localStorage.getItem('tasking_company_id') || ''
    const uid = localStorage.getItem('tasking_user_id') || ''
    setInviteLoading(true)
    setInviteCode('')
    try {
      const res = await fetch('/api/invitation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: cid,
          department_id: deptId || null,
          role,
          generated_by: uid,
        }),
      })
      const data = await res.json()
      if (data.success) setInviteCode(data.code)
    } finally {
      setInviteLoading(false)
    }
  }

  // ── Open invite modals ─────────────────────────────────────────────────────

  const openManagerModal = () => {
    setCopied(false)
    setInviteCode('')
    setSelectedDeptId('')
    setInviteModal('manager')
  }

  const handleManagerDeptSelect = (deptId: string) => {
    setSelectedDeptId(deptId)
    setCopied(false)
    setInviteCode('')
  }

  const openEmployeeModal = () => {
    setCopied(false)
    setInviteCode('')
    setSelectedDeptId('')
    setInviteModal('employee')
  }

  const openOwnerModal = () => {
    setCopied(false)
    setInviteCode('')
    setInviteModal('owner')
  }

  const handleEmployeeDeptSelect = (deptId: string) => {
    setSelectedDeptId(deptId)
    setCopied(false)
    setInviteCode('')
  }

  const copyLink = (role: 'Owner' | 'Manager' | 'Employee') => {
    if (!inviteCode) return
    const roleLabel = role === 'Owner' ? 'Owner' : role
    const message = `Join ${ownerName}'s company as ${roleLabel} in Tasking with invitation code: ${inviteCode}\nGet started here: ${appUrl}/get-started`
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Sign out ───────────────────────────────────────────────────────────────

  const handleSignOut = () => {
    localStorage.removeItem('tasking_user_id')
    localStorage.removeItem('tasking_company_id')
    localStorage.removeItem('tasking_active_session')
    fetch('/api/auth/signout', { method: 'POST' })
    window.location.href = '/signout'
  }


  // ── Department CRUD ────────────────────────────────────────────────────────

  const handleAddDept = async () => {
    if (!deptFormName.trim()) return
    const cid = localStorage.getItem('tasking_company_id') || ''
    setDeptLoading(true)
    setDeptError('')
    try {
      const res = await fetch('/api/company/create-department', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deptFormName.trim(), company_id: cid }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setAddModal(false)
      setDeptFormName('')
      fetchDepts(cid)
    } catch (err) {
      setDeptError(err instanceof Error ? err.message : 'Failed to add department')
    } finally {
      setDeptLoading(false)
    }
  }

  const handleEditDept = async () => {
    if (!deptFormName.trim() || !editModal) return
    const cid = localStorage.getItem('tasking_company_id') || ''
    setDeptLoading(true)
    setDeptError('')
    try {
      const res = await fetch('/api/company/update-department', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: editModal.id, name: deptFormName.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setEditModal(null)
      setDeptFormName('')
      fetchDepts(cid)
    } catch (err) {
      setDeptError(err instanceof Error ? err.message : 'Failed to update department')
    } finally {
      setDeptLoading(false)
    }
  }

  const handleDeleteDept = async () => {
    if (!deleteModal) return
    const cid = localStorage.getItem('tasking_company_id') || ''
    setDeptLoading(true)
    setDeptError('')
    try {
      const res = await fetch('/api/company/delete-department', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: deleteModal.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setDeleteModal(null)
      fetchDepts(cid)
    } catch (err) {
      setDeptError(err instanceof Error ? err.message : 'Failed to delete department')
    } finally {
      setDeptLoading(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredDepts = departments.filter((d) =>
    d.name.toLowerCase().includes(deptSearch.toLowerCase()),
  )

  // ── Action button styles ───────────────────────────────────────────────────

  const primaryBtn = (loading: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px',
    background: '#111827',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.9375rem',
    color: '#FFFFFF',
    cursor: loading ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    opacity: loading ? 0.65 : 1,
  })

  const ghostBtn: React.CSSProperties = {
    flex: 1,
    padding: '10px',
    background: 'none',
    border: '1.5px solid #E5E7EB',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.9375rem',
    color: '#6B7280',
    cursor: 'pointer',
  }

  const dangerBtn = (loading: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px',
    background: '#EF4444',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.9375rem',
    color: '#FFFFFF',
    cursor: loading ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    opacity: loading ? 0.65 : 1,
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  const currentCompany = companies.find((c) => c.id === companyId) ?? companies[0]

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar />

      {/* ── MAIN ───────────────────────────────────────────────────────────── */}
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{
          padding: '18px 32px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          {companies.length > 1 ? (
            <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontWeight: 700, fontSize: '1.1875rem', color: '#111827',
                  userSelect: 'none',
                }}
              >
                {currentCompany ? `${currentCompany.name} Overview` : 'Overview'}
                <ChevronDown
                  size={16}
                  strokeWidth={2.5}
                  style={{ color: '#6B7280', transition: 'transform 0.15s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>
              {dropdownOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '6px',
                  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: '200px', zIndex: 50, overflow: 'hidden',
                }}>
                  {companies.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        localStorage.setItem('tasking_company_id', c.id)
                        setDropdownOpen(false)
                        window.location.reload()
                      }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px',
                        background: c.id === companyId ? '#FFF7ED' : 'none',
                        border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                        color: c.id === companyId ? '#EA580C' : '#374151',
                        fontWeight: c.id === companyId ? 600 : 400, transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { if (c.id !== companyId) e.currentTarget.style.background = '#F3F4F6' }}
                      onMouseLeave={(e) => { if (c.id !== companyId) e.currentTarget.style.background = 'none' }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>
              {currentCompany ? `${currentCompany.name} Overview` : 'Overview'}
            </h1>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px', flex: 1 }}>

          {/* ── Company setup incomplete banner ────────────────────────────── */}
          {companyStatus === 'not-found' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              background: '#FEF3C7',
              border: '1px solid #FCD34D',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: '28px',
            }}>
              <span style={{ fontSize: '0.9375rem', color: '#92400E', fontWeight: 500 }}>
                Company setup incomplete. Please complete your company profile.
              </span>
              <button
                onClick={() => router.push('/get-started')}
                style={{
                  flexShrink: 0,
                  padding: '7px 14px',
                  background: '#F97316',
                  border: 'none',
                  borderRadius: '7px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Complete Setup
              </button>
            </div>
          )}

          {/* ── Section: Departments ─────────────────────────────────────── */}
          <div>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>Departments</h2>
              <button
                onClick={() => { setAddModal(true); setDeptFormName(''); setDeptError('') }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 13px',
                  background: 'transparent',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'border-color 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#9CA3AF')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
              >
                <Plus size={14} strokeWidth={2.5} />
                Add Department
              </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '18px', maxWidth: '320px' }}>
              <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              <input
                placeholder="Search departments..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '34px',
                  paddingRight: '12px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  color: '#374151',
                  background: '#FFFFFF',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Cards */}
            {filteredDepts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '56px 0', color: '#9CA3AF', fontSize: '0.9375rem' }}>
                {deptSearch ? 'No departments match your search.' : 'No departments yet. Add your first one.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                {filteredDepts.map((dept) => (
                  <div
                    key={dept.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      padding: '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{dept.name}</p>
                      <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '4px 0 0' }}>No managers yet</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Edit */}
                      <button
                        onClick={() => { setEditModal(dept); setDeptFormName(dept.name); setDeptError('') }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 10px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '7px',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          color: '#6B7280',
                          fontWeight: 500,
                          transition: 'border-color 0.1s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#9CA3AF')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                      >
                        <Pencil size={12} strokeWidth={2} />
                        Edit
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => { setDeleteModal(dept); setDeptError('') }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 10px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '7px',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          color: '#EF4444',
                          fontWeight: 500,
                        }}
                      >
                        <Trash2 size={12} strokeWidth={2} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ══════════════ MODALS ══════════════ */}

      {/* ── Invite Partner ────────────────────────────────────────────────── */}
      {inviteModal === 'owner' && (
        <ModalOverlay onClose={() => setInviteModal(null)}>
          <ModalBox>
            <ModalHeader title="Invite Partner" onClose={() => setInviteModal(null)} />
            <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
              Share this code with someone you want to give full access to.
            </p>
            {inviteCode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <CodeBox code={inviteCode} loading={inviteLoading} />
                <CodeActions code={inviteCode} loading={inviteLoading} copied={copied} onCopy={() => copyLink('Owner')} />
                <p style={{ fontSize: '13px', color: '#F97316', textAlign: 'center', margin: 0 }}>
                  This person will have full access to your company.
                </p>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
                  This code expires in 7 days.
                </p>
              </div>
            ) : (
              <button
                onClick={() => generateCode('Owner')}
                disabled={inviteLoading}
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0',
                  background: '#F97316',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: inviteLoading ? 'not-allowed' : 'pointer',
                  opacity: inviteLoading ? 0.45 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {inviteLoading && <Spinner size={14} />}
                Generate Code
              </button>
            )}
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Invite Manager ────────────────────────────────────────────────── */}
      {inviteModal === 'manager' && (
        <ModalOverlay onClose={() => setInviteModal(null)}>
          <ModalBox>
            <ModalHeader title="Invite Manager" onClose={() => setInviteModal(null)} />
            <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
              Select a department and share the code with your new Manager.
            </p>
            {departments.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', margin: '16px 0' }}>
                No departments found. Please add a department first.
              </p>
            ) : (
              <>
                <label style={modalLabelStyle}>Department</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => handleManagerDeptSelect(e.target.value)}
                    style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select a department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </>
            )}
            {inviteCode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <CodeBox code={inviteCode} loading={inviteLoading} />
                <CodeActions code={inviteCode} loading={inviteLoading} copied={copied} onCopy={() => copyLink('Manager')} />
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
                  This code expires in 7 days.
                </p>
              </div>
            ) : (
              <button
                onClick={() => { if (selectedDeptId) generateCode('Manager', selectedDeptId) }}
                disabled={!selectedDeptId || inviteLoading || departments.length === 0}
                style={{
                  marginTop: '20px',
                  width: '100%',
                  height: '48px',
                  padding: '0',
                  background: '#F97316',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: (!selectedDeptId || departments.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (!selectedDeptId || departments.length === 0) ? 0.45 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {inviteLoading && <Spinner size={14} />}
                Generate Code
              </button>
            )}
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Invite Employee ───────────────────────────────────────────────── */}
      {inviteModal === 'employee' && (
        <ModalOverlay onClose={() => setInviteModal(null)}>
          <ModalBox>
            <ModalHeader title="Invite Employee" onClose={() => setInviteModal(null)} />
            <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
              Select a department and share the code with your new employee.
            </p>
            {departments.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', margin: '16px 0' }}>
                No departments found. Please add a department first.
              </p>
            ) : (
              <>
                <label style={modalLabelStyle}>Department</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => handleEmployeeDeptSelect(e.target.value)}
                    style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select a department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </>
            )}
            {inviteCode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <CodeBox code={inviteCode} loading={inviteLoading} />
                <CodeActions code={inviteCode} loading={inviteLoading} copied={copied} onCopy={() => copyLink('Employee')} />
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
                  This code expires in 7 days.
                </p>
              </div>
            ) : (
              <button
                onClick={() => { if (selectedDeptId) generateCode('Employee', selectedDeptId) }}
                disabled={!selectedDeptId || inviteLoading || departments.length === 0}
                style={{
                  marginTop: '20px',
                  width: '100%',
                  height: '48px',
                  padding: '0',
                  background: '#F97316',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: (!selectedDeptId || departments.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (!selectedDeptId || departments.length === 0) ? 0.45 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {inviteLoading && <Spinner size={14} />}
                Generate Code
              </button>
            )}
          </ModalBox>
        </ModalOverlay>
      )}


      {/* ── Add Department ────────────────────────────────────────────────── */}
      {addModal && (
        <ModalOverlay onClose={() => setAddModal(false)}>
          <ModalBox>
            <ModalHeader title="Add Department" onClose={() => setAddModal(false)} />
            <label style={modalLabelStyle}>Department Name</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Operations"
              value={deptFormName}
              onChange={(e) => setDeptFormName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddDept() }}
              style={modalInputStyle}
            />
            <InlineError message={deptError} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={ghostBtn} onClick={() => setAddModal(false)}>Cancel</button>
              <button style={primaryBtn(deptLoading)} onClick={handleAddDept} disabled={deptLoading}>
                {deptLoading && <Spinner size={14} />}
                Add Department
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Edit Department ───────────────────────────────────────────────── */}
      {editModal && (
        <ModalOverlay onClose={() => setEditModal(null)}>
          <ModalBox>
            <ModalHeader title="Edit Department" onClose={() => setEditModal(null)} />
            <label style={modalLabelStyle}>Department Name</label>
            <input
              autoFocus
              type="text"
              value={deptFormName}
              onChange={(e) => setDeptFormName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEditDept() }}
              style={modalInputStyle}
            />
            <InlineError message={deptError} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={ghostBtn} onClick={() => setEditModal(null)}>Cancel</button>
              <button style={primaryBtn(deptLoading)} onClick={handleEditDept} disabled={deptLoading}>
                {deptLoading && <Spinner size={14} />}
                Save Changes
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Delete Department ─────────────────────────────────────────────── */}
      {deleteModal && (
        <ModalOverlay onClose={() => setDeleteModal(null)}>
          <ModalBox>
            <ModalHeader title="Delete Department" onClose={() => setDeleteModal(null)} />
            <p style={{ fontSize: '0.9375rem', color: '#374151', margin: 0, lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>{deleteModal.name}</strong>? This cannot be undone.
            </p>
            <InlineError message={deptError} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button style={ghostBtn} onClick={() => setDeleteModal(null)}>Cancel</button>
              <button style={dangerBtn(deptLoading)} onClick={handleDeleteDept} disabled={deptLoading}>
                {deptLoading && <Spinner size={14} />}
                Delete
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

    </div>
  )
}
