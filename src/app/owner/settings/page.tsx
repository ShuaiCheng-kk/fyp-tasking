'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Pencil } from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'

// ─── Types ────────────────────────────────────────────────────────────────────

type Company = {
  id: string
  name: string
  description: string | null
  plan: 'Free' | 'Paid'
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
  const [userId, setUserId] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  // Edit modal
  const [editTarget, setEditTarget] = useState<Company | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [addDepts, setAddDepts] = useState([''])
  const [addPlan, setAddPlan] = useState<'Free' | 'Paid'>('Free')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id') || ''
    setUserId(uid)
    if (uid) fetchCompanies(uid)
    else setLoading(false)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setEditTarget(null); setAddOpen(false) }
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
        const sorted = [...data.companies].sort((a: Company, b: Company) => {
          if (a.plan !== b.plan) return a.plan === 'Paid' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        setCompanies(sorted)
      }
    } catch {}
    finally { setLoading(false) }
  }

  // ── Edit company ───────────────────────────────────────────────────────────

  const openEdit = (c: Company) => {
    setEditTarget(c)
    setEditName(c.name)
    setEditDesc(c.description ?? '')
    setEditError('')
  }

  const handleEdit = async () => {
    if (!editTarget || !editName.trim()) return
    setEditLoading(true)
    setEditError('')
    try {
      const res = await fetch('/api/company/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: editTarget.id, name: editName, description: editDesc }),
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
    setAddName(''); setAddDesc(''); setAddDepts(['']); setAddPlan('Free'); setAddError(''); setAddOpen(true)
  }

  const handleAdd = async () => {
    if (!addName.trim()) { setAddError('Company name is required.'); return }
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
          departments: addDepts.filter((d) => d.trim()),
          plan: addPlan,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      localStorage.setItem('tasking_company_id', data.company.id)
      setAddOpen(false)
      fetchCompanies(userId)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create company')
    } finally {
      setAddLoading(false)
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
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left tab list */}
          <div style={{ width: '200px', borderRight: '1px solid #E5E7EB', background: '#FFFFFF', padding: '20px 12px', flexShrink: 0 }}>
            <button
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px',
                background: '#FFF7ED', color: '#EA580C', fontWeight: 600, fontSize: '0.9rem',
                border: 'none', cursor: 'pointer',
              }}
            >
              My Company
            </button>
          </div>

          {/* Right content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>My Companies</h2>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
                <Spinner size={24} dark />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                  {companies.map((c) => (
                    <div key={c.id} style={{
                      background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px',
                      padding: '20px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <p style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>{c.name}</p>
                          <span style={{
                            padding: '2px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600,
                            background: c.plan === 'Paid' ? '#EDE9FE' : '#F3F4F6',
                            color: c.plan === 'Paid' ? '#7C3AED' : '#6B7280',
                          }}>
                            {c.plan === 'Paid' ? 'Pro' : 'Free'}
                          </span>
                        </div>
                        {c.description && (
                          <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>{c.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => openEdit(c)}
                        style={{
                          flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: '7px',
                          background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151', fontWeight: 500,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#9CA3AF')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                      >
                        <Pencil size={12} strokeWidth={2} />
                        Edit
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add New Company */}
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
              </>
            )}
          </div>
        </div>
      </main>

      {/* ── Edit Company Modal ─────────────────────────────────────────────── */}
      {editTarget && (
        <ModalOverlay onClose={() => setEditTarget(null)}>
          <ModalBox>
            <ModalHeader title="Edit Company" onClose={() => setEditTarget(null)} />

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Company Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleEdit() }}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '4px' }}>
              <label style={labelStyle}>Company Description</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
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

            {/* Plan */}
            <div style={{ marginBottom: '4px' }}>
              <label style={labelStyle}>Plan</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['Free', 'Paid'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setAddPlan(p)}
                    style={{
                      flex: 1, padding: '9px', border: `2px solid ${addPlan === p ? '#F97316' : '#E5E7EB'}`,
                      borderRadius: '8px', background: addPlan === p ? '#FFF7ED' : '#FFFFFF',
                      color: addPlan === p ? '#EA580C' : '#6B7280', fontWeight: addPlan === p ? 600 : 400,
                      fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    {p === 'Paid' ? 'Pro' : 'Free'}
                  </button>
                ))}
              </div>
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
    </div>
  )
}
