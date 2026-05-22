'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import PartnerSidebar from '@/components/PartnerSidebar'

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

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function PartnerSettingsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [leaveTarget, setLeaveTarget] = useState<Company | null>(null)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [leaveCompanyCount, setLeaveCompanyCount] = useState<number | null>(null)
  const [leaveCountLoading, setLeaveCountLoading] = useState(false)
  const [accountRemovedOverlay, setAccountRemovedOverlay] = useState(false)

  useEffect(() => {
    const resolve = async () => {
      if (accountRemovedOverlay) return
      let uid = localStorage.getItem('tasking_user_id')
      if (!uid) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) { uid = session.user.id; localStorage.setItem('tasking_user_id', uid) }
      }
      if (!uid) { router.replace('/signin'); return }
      setUserId(uid)
      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (meData.success) setInternalUserId(meData.user.id)
      fetchCompanies(uid)
    }
    void resolve()
  }, [router])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setLeaveTarget(null); setLeaveCompanyCount(null) } }
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
          const aNum = startsWithDigit(a.name); const bNum = startsWithDigit(b.name)
          if (aNum !== bNum) return aNum ? 1 : -1
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        })
        setCompanies(sorted)
      }
    } catch {}
    finally { setLoading(false) }
  }

  const handleLeave = async () => {
    if (!leaveTarget) return
    setLeaveLoading(true); setLeaveError('')
    try {
      const res = await fetch('/api/user/leave-company', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: internalUserId, company_id: leaveTarget.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)

      if (data.accountDeleted) {
        setLeaveTarget(null); setAccountRemovedOverlay(true)
      } else {
        localStorage.removeItem(`tasking_company_id_${userId}`)
        localStorage.removeItem(`tasking_last_company_name_${leaveTarget.id}`)
        const companiesRes = await fetch(`/api/company/my-companies?owner_id=${userId}`)
        const companiesData = await companiesRes.json()
        if (companiesData.success && companiesData.companies.length > 0) {
          const next = companiesData.companies[0]
          localStorage.setItem(`tasking_company_id_${userId}`, next.id)
        }
        setLeaveTarget(null); router.replace('/partner/dashboard')
      }
    } catch (err) { setLeaveError(err instanceof Error ? err.message : 'Failed to leave company') }
    finally { setLeaveLoading(false) }
  }

  const openLeave = async (c: Company) => {
    setLeaveError(''); setLeaveCompanyCount(null); setLeaveTarget(c); setLeaveCountLoading(true)
    try {
      const res = await fetch(`/api/company/my-companies?owner_id=${userId}`)
      const data = await res.json()
      if (data.success) setLeaveCompanyCount(data.companies.length)
    } catch {}
    finally { setLeaveCountLoading(false) }
  }

  const ghostBtn: React.CSSProperties = { flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PartnerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 32px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>Settings</h1>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>My Companies</h2>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
              <Spinner size={24} dark />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {companies.map((c) => {
                const initial = c.name.charAt(0).toUpperCase()
                return (
                  <div key={c.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#F3F4F6', border: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', color: '#9CA3AF' }}>
                        {initial}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{c.name}</p>
                        {c.industry && (
                          <span style={{ background: '#F97316', color: '#FFFFFF', fontSize: '12px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px', display: 'inline-block', flexShrink: 0 }}>
                            {c.industry}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => openLeave(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', border: '1px solid #FECACA', borderRadius: '7px', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#EF4444', fontWeight: 500 }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#FCA5A5')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#FECACA')}
                    >
                      <Trash2 size={12} strokeWidth={2} /> Leave Company
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {leaveTarget && (
        <div onClick={() => { setLeaveTarget(null); setLeaveCompanyCount(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '540px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>Leave Company</h2>
              </div>
              {leaveCountLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}><Spinner size={20} dark /></div>
              ) : leaveCompanyCount === 1 ? (
                <p style={{ fontSize: '0.9375rem', color: '#374151', marginBottom: '4px', lineHeight: 1.6 }}>
                  Are you sure you want to leave <strong>{leaveTarget.name}</strong>? Since this is your only company, your account will be permanently deleted and you will be signed out. This cannot be undone.
                </p>
              ) : (
                <p style={{ fontSize: '0.9375rem', color: '#374151', marginBottom: '4px', lineHeight: 1.6 }}>
                  Are you sure you want to leave <strong>{leaveTarget.name}</strong>? You will lose access to this company. Your account will not be deleted.
                </p>
              )}
              {leaveError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginTop: '12px', lineHeight: 1.5 }}>{leaveError}</div>}
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button style={ghostBtn} onClick={() => { setLeaveTarget(null); setLeaveCompanyCount(null) }}>Cancel</button>
                <button onClick={handleLeave} disabled={leaveLoading || leaveCountLoading} style={{ flex: 1, padding: '10px', background: leaveCompanyCount === 1 ? '#EF4444' : 'none', border: leaveCompanyCount === 1 ? 'none' : '1.5px solid #EF4444', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: leaveCompanyCount === 1 ? '#FFFFFF' : '#EF4444', cursor: (leaveLoading || leaveCountLoading) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: (leaveLoading || leaveCountLoading) ? 0.65 : 1 }}>
                  {leaveLoading && <Spinner size={14} dark={leaveCompanyCount !== 1} />} Leave Company
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {accountRemovedOverlay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '40px 48px', boxShadow: '0 8px 48px rgba(0,0,0,0.18)', maxWidth: '460px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="12" r="9" stroke="#EF4444" strokeWidth="2" /></svg>
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: '0 0 12px' }}>Your account has been removed</h2>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 24px' }}>You have left your last company. Your account has been permanently deleted.</p>
            <button onClick={async () => {
              const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
              localStorage.clear(); await supabase.auth.signOut(); router.replace('/')
            }} style={{ padding: '10px 28px', background: '#111827', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF', cursor: 'pointer' }}>Exit</button>
          </div>
        </div>
      )}
    </div>
  )
}
