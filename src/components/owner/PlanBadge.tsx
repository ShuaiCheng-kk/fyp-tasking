'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { X, Star, Check, Trash2, CreditCard } from 'lucide-react'
import { ownerStep5 } from '@/app/(auth)/get-started/content'

const fH = 'var(--font-heading)';
const fB = 'var(--font-body)';

const planKeyframes = `
  @keyframes planOverlayIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes planModalIn   { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
`

function Spinner({ size = 14, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.18)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface SubDetails {
  plan: string
  plan_started_at: string | null
  plan_next_billing_at: string | null
  plan_cancel_at: string | null
  stripe_subscription_id: string | null
}

// ── Style tokens — exact match to Member Profile modal in team/page.tsx ──────

const labelSt: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.875rem',
  color: '#374151', marginBottom: 4,
}

const valueSt: React.CSSProperties = {
  fontSize: '0.9375rem', color: '#111827', margin: 0,
  fontFamily: "'Inter', system-ui, sans-serif",
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: 8, fontSize: '0.9375rem', fontFamily: "'Inter', system-ui, sans-serif",
  fontWeight: 400, color: '#111827', outline: 'none',
  boxSizing: 'border-box', background: '#FFFFFF',
}

const GREEN_GRADIENT = 'linear-gradient(135deg, #10B981, #14B8A6)'
const ORANGE_GRADIENT = 'linear-gradient(135deg, #F97316, #EA580C)'

// ─────────────────────────────────────────────────────────────────────────────

export default function OwnerPlanBadge({ plan, currentCompanyId }: { plan: string; currentCompanyId: string }) {
  const isPro = plan === 'Paid' || plan === 'Pro'

  const [open, setOpen] = useState(false)
  const [subDetails, setSubDetails] = useState<SubDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const fetchDetails = useCallback(async () => {
    if (!currentCompanyId) return
    setLoadingDetails(true); setError('')
    try {
      const res = await fetch(`/api/stripe/subscription?companyId=${currentCompanyId}`)
      const data = await res.json()
      if (data.success) setSubDetails(data.data)
    } catch {}
    finally { setLoadingDetails(false) }
  }, [currentCompanyId])

  const handleOpen = () => { setOpen(true); setError(''); fetchDetails() }
  const handleClose = () => { setOpen(false); setError('') }

  const handleUpgradeToPro = async () => {
    setActionLoading(true); setError('')
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')
      const res = await fetch('/api/stripe/upgrade-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: currentCompanyId, userId: session.user.id, email: session.user.email }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setActionLoading(false)
    }
  }

  const handleCancelPro = async () => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: currentCompanyId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      await fetchDetails()
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setToast('Plan cancelled. You still have access until end of billing period.')
      toastTimerRef.current = setTimeout(() => setToast(''), 4000)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to cancel subscription') }
    finally { setActionLoading(false) }
  }

  const handleResumePro = async () => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/stripe/resume-subscription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: currentCompanyId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      await fetchDetails()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to resume subscription') }
    finally { setActionLoading(false) }
  }

  const effectivePlan = subDetails?.plan ?? plan
  const effectiveIsPro = effectivePlan === 'Paid' || effectivePlan === 'Pro'
  const isCancelling = effectiveIsPro && !!subDetails?.plan_cancel_at

  const toastPortal = toast && mounted ? createPortal(
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10001, background: '#FFFFFF', border: '1px solid #E5E7EB',
      borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
      animation: 'fadeSlideUpToast 0.22s ease',
    }}>
      <style>{planKeyframes}</style>
      <Check size={15} style={{ color: '#10B981', flexShrink: 0 }} />
      {toast}
    </div>,
    document.body
  ) : null

  const modal = open && mounted ? createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'planOverlayIn 0.18s ease-out',
      }}
    >
      <style>{planKeyframes}</style>
      <div style={{ width: 'min(900px, calc(100% - 32px))' }}>
        {/* ModalBox — exact same as team/page.tsx */}
        <div style={{
          background: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
          maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
          animation: 'planModalIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '24px 28px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: ORANGE_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CreditCard size={17} color="#fff" strokeWidth={2} />
              </div>
              <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>
                Subscription Plan
              </h2>
            </div>
            <button
              onClick={handleClose}
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Body — same two-card design as Get Started Step 5 ── */}
          {loadingDetails ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
              <Spinner size={22} dark />
            </div>
          ) : (
            <div style={{ padding: '24px 32px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

              {/* Free plan */}
              <div style={{
                background: '#FFFFFF',
                border: !effectiveIsPro ? '2px solid #F97316' : '1.5px solid #F0E8D8',
                borderRadius: 18,
                padding: '28px 26px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}>
                <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.125rem', color: '#1C1917', marginBottom: 10 }}>
                  Free
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                  <span style={{ fontFamily: fH, fontWeight: 800, fontSize: '2.25rem', color: '#1C1917' }}>
                    {ownerStep5.freePlan.price}
                  </span>
                  <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#78716C' }}>
                    {ownerStep5.freePlan.priceSub}
                  </span>
                </div>
                <p style={{ fontFamily: fB, fontWeight: 600, fontSize: '0.8125rem', color: '#9CA3AF', marginBottom: 10 }}>
                  {ownerStep5.freePlan.featuresIntro}
                </p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, marginBottom: 24, padding: 0 }}>
                  {ownerStep5.freePlan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Check size={15} color="#9CA3AF" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#374151' }}>{f}</span>
                    </li>
                  ))}
                </ul>
                {!effectiveIsPro && (
                  <div style={{
                    width: '100%', padding: '13px', textAlign: 'center',
                    background: '#FFF7ED', border: '1.5px solid #F97316', borderRadius: 10,
                    fontFamily: fB, fontWeight: 700, fontSize: '0.9375rem', color: '#F97316',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <Check size={16} strokeWidth={2.5} />
                    Your current plan
                  </div>
                )}
              </div>

              {/* Pro plan */}
              <div style={{
                background: '#FFFFFF',
                border: effectiveIsPro ? '2px solid #F97316' : '1.5px solid #F0E8D8',
                borderRadius: 18,
                padding: '28px 26px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: effectiveIsPro ? '0 8px 24px rgba(249,115,22,0.12)' : 'none',
              }}>
                <span style={{
                  position: 'absolute', top: 18, right: 18,
                  background: '#F97316', color: '#FFFFFF',
                  fontFamily: fB, fontSize: '0.75rem', fontWeight: 700,
                  padding: '3px 10px', borderRadius: 100,
                }}>
                  {ownerStep5.proPlan.badge}
                </span>
                <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.125rem', color: '#1C1917', marginBottom: 10 }}>
                  Pro
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                  <span style={{ fontFamily: fH, fontWeight: 800, fontSize: '2.25rem', color: '#F97316' }}>
                    {ownerStep5.proPlan.price}
                  </span>
                  <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#78716C' }}>
                    {ownerStep5.proPlan.priceSub}
                  </span>
                </div>

                {effectiveIsPro ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, marginBottom: 24 }}>
                    <div>
                      <label style={labelSt}>Billing amount</label>
                      <p style={valueSt}>{ownerStep5.proPlan.price} {ownerStep5.proPlan.priceSub}</p>
                    </div>
                    <div>
                      <label style={labelSt}>Member since</label>
                      <p style={valueSt}>{fmt(subDetails?.plan_started_at ?? null)}</p>
                    </div>
                    <div>
                      <label style={labelSt}>
                        {isCancelling ? 'Pro access ends' : 'Next payment'}
                      </label>
                      <p style={valueSt}>
                        {fmt(isCancelling ? subDetails?.plan_cancel_at ?? null : subDetails?.plan_next_billing_at ?? null)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ fontFamily: fB, fontWeight: 600, fontSize: '0.8125rem', color: '#9CA3AF', marginBottom: 10 }}>
                      {ownerStep5.proPlan.featuresIntro}
                    </p>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, marginBottom: 24, padding: 0 }}>
                      {ownerStep5.proPlan.features.map((f) => (
                        <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <Check size={15} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#374151' }}>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {!effectiveIsPro ? (
                  <button
                    type="button"
                    onClick={handleUpgradeToPro}
                    disabled={actionLoading}
                    className="btn-press"
                    style={{
                      width: '100%', padding: '13px', background: actionLoading ? '#FDA060' : ORANGE_GRADIENT,
                      border: 'none', borderRadius: 10, fontFamily: fB, fontWeight: 700, fontSize: '0.9375rem',
                      color: '#FFFFFF', cursor: actionLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: actionLoading ? 0.7 : 1,
                    }}
                  >
                    {actionLoading ? <Spinner size={14} /> : <Star size={14} fill="#fff" />}
                    Subscribe to Pro
                  </button>
                ) : isCancelling ? (
                  <button
                    type="button"
                    onClick={handleResumePro}
                    disabled={actionLoading}
                    className="btn-press"
                    style={{
                      width: '100%', padding: '13px', background: actionLoading ? '#FDA060' : ORANGE_GRADIENT,
                      border: 'none', borderRadius: 10, fontFamily: fB, fontWeight: 700, fontSize: '0.9375rem',
                      color: '#FFFFFF', cursor: actionLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: actionLoading ? 0.7 : 1,
                    }}
                  >
                    {actionLoading ? <Spinner size={14} /> : <Check size={14} />}
                    Resume Pro Plan
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{
                      width: '100%', padding: '13px', textAlign: 'center',
                      background: '#FFF7ED', border: '1.5px solid #F97316', borderRadius: 10,
                      fontFamily: fB, fontWeight: 700, fontSize: '0.9375rem', color: '#F97316',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <Check size={16} strokeWidth={2.5} />
                      Your current plan
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelPro}
                      disabled={actionLoading}
                      style={{
                        width: '100%', padding: '9px', background: 'transparent', border: 'none',
                        fontFamily: fB, fontWeight: 600, fontSize: '0.8125rem', color: '#DC2626',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: actionLoading ? 0.6 : 1,
                      }}
                    >
                      {actionLoading ? <Spinner size={13} dark /> : <Trash2 size={13} />}
                      Cancel Plan
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div style={{ margin: '16px 28px 24px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>
              {error}
            </div>
          )}
          {!error && <div style={{ paddingBottom: 28 }} />}

        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      {toastPortal}
      <button
        type="button"
        aria-label={`${isPro ? 'Pro' : 'Free'} plan — Manage my plan`}
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
          borderRadius: 999, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          background: isPro ? GREEN_GRADIENT : '#FFFFFF',
          color: isPro ? '#fff' : '#4B5563',
          border: isPro ? 'none' : '1.5px solid #E5E7EB',
          boxShadow: isPro ? '0 1px 4px rgba(16,185,129,0.3)' : 'none',
          transition: 'box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          if (!isPro) e.currentTarget.style.borderColor = '#F97316'
          e.currentTarget.style.boxShadow = isPro ? '0 8px 18px rgba(16,185,129,0.28)' : '0 2px 8px rgba(249,115,22,0.15)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none'
          if (!isPro) e.currentTarget.style.borderColor = '#E5E7EB'
          e.currentTarget.style.boxShadow = isPro ? '0 1px 4px rgba(16,185,129,0.3)' : 'none'
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 999, background: isPro ? 'rgba(255,255,255,0.7)' : '#9CA3AF', flexShrink: 0 }} />
        {isPro ? 'Pro Plan' : 'Free Plan'}
      </button>
      {modal}
    </>
  )
}
