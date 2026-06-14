'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#0F172A' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
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
  stripe_subscription_id: string | null
}

export default function OwnerPlanBadge({ plan, currentCompanyId }: { plan: string; currentCompanyId: string }) {
  const isPro = plan === 'Paid' || plan === 'Pro'

  const [open, setOpen] = useState(false)
  const [subDetails, setSubDetails] = useState<SubDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const fetchDetails = useCallback(async () => {
    if (!currentCompanyId) return
    setLoadingDetails(true)
    setError('')
    try {
      const res = await fetch(`/api/stripe/subscription?companyId=${currentCompanyId}`)
      const data = await res.json()
      if (data.success) setSubDetails(data.data)
    } catch {
      // Silently fall back to prop-based plan display
    } finally {
      setLoadingDetails(false)
    }
  }, [currentCompanyId])

  const handleOpen = () => {
    setOpen(true)
    setShowCancelConfirm(false)
    setError('')
    fetchDetails()
  }

  const handleClose = () => {
    setOpen(false)
    setShowCancelConfirm(false)
    setError('')
  }

  const handleUpgradeToPro = async () => {
    setActionLoading(true)
    setError('')
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      const res = await fetch('/api/stripe/upgrade-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompanyId,
          userId: session.user.id,
          email: session.user.email,
        }),
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
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: currentCompanyId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
      setActionLoading(false)
    }
  }

  const effectivePlan = subDetails?.plan ?? plan
  const effectiveIsPro = effectivePlan === 'Paid' || effectivePlan === 'Pro'

  const modal = open && mounted ? createPortal(
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          background: '#fff', fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 24px 20px',
          background: effectiveIsPro
            ? 'linear-gradient(135deg, #10B981 0%, #14B8A6 100%)'
            : 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: effectiveIsPro ? 'rgba(255,255,255,0.7)' : '#9CA3AF', margin: '0 0 6px',
              }}>
                Current Plan
              </p>
              <p style={{ fontSize: 28, fontWeight: 800, color: effectiveIsPro ? '#fff' : '#1F2937', margin: 0, lineHeight: 1 }}>
                {effectiveIsPro ? 'Pro' : 'Free'}
              </p>
            </div>
            <button
              onClick={handleClose}
              style={{
                width: 28, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: effectiveIsPro ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
                color: effectiveIsPro ? '#fff' : '#6B7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px' }}>
          {loadingDetails ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <Spinner size={20} dark />
            </div>
          ) : effectiveIsPro ? (
            <>
              {/* Subscription info rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: 10, background: '#F9FAFB',
                }}>
                  <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Subscribed since</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                    {fmt(subDetails?.plan_started_at ?? null)}
                  </span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: 10, background: '#F9FAFB',
                }}>
                  <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Next billing date</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                    {fmt(subDetails?.plan_next_billing_at ?? null)}
                  </span>
                </div>
              </div>

              {error && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', fontSize: 12, color: '#DC2626' }}>
                  {error}
                </div>
              )}

              {!showCancelConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={actionLoading}
                  style={{
                    width: '100%', height: 38, borderRadius: 10, border: '1.5px solid #E5E7EB',
                    background: '#fff', fontSize: 13, fontWeight: 500, color: '#6B7280',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#EF4444'
                    ;(e.currentTarget as HTMLButtonElement).style.color = '#EF4444'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB'
                    ;(e.currentTarget as HTMLButtonElement).style.color = '#6B7280'
                  }}
                >
                  Cancel Pro Plan
                </button>
              ) : (
                <div style={{ borderRadius: 12, border: '1.5px solid #FCA5A5', padding: '14px', background: '#FFF5F5' }}>
                  <p style={{ fontSize: 13, color: '#7F1D1D', fontWeight: 600, margin: '0 0 4px' }}>Cancel your Pro plan?</p>
                  <p style={{ fontSize: 12, color: '#B91C1C', margin: '0 0 14px' }}>
                    You'll lose AI features and analytics immediately. This cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={actionLoading}
                      style={{
                        flex: 1, height: 34, borderRadius: 8, border: 'none',
                        background: '#F3F4F6', fontSize: 12, fontWeight: 500, color: '#6B7280', cursor: 'pointer',
                      }}
                    >
                      Keep Pro
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPro}
                      disabled={actionLoading}
                      style={{
                        flex: 1, height: 34, borderRadius: 8, border: 'none',
                        background: '#EF4444', fontSize: 12, fontWeight: 600, color: '#fff',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      {actionLoading ? <Spinner size={13} /> : 'Yes, Cancel'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Free plan — upgrade CTA */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: '#374151', fontWeight: 600, margin: '0 0 8px' }}>What you get with Pro</p>
                {[
                  'AI Candidate Recommendations',
                  'AI Job Description Generator',
                  'AI Auto-approve Timesheets',
                  'AI Anomaly Detection & Reports',
                ].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, background: 'linear-gradient(135deg, #10B981, #14B8A6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    <span style={{ fontSize: 12, color: '#374151' }}>{f}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', fontSize: 12, color: '#DC2626' }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleUpgradeToPro}
                disabled={actionLoading}
                style={{
                  width: '100%', height: 40, borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #10B981, #14B8A6)',
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                }}
              >
                {actionLoading ? <Spinner size={14} /> : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                    Subscribe to Pro
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        type="button"
        aria-label={`${isPro ? 'Pro' : 'Free'} plan — Manage my plan`}
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
          borderRadius: 999, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          background: isPro ? 'linear-gradient(135deg, #10B981, #14B8A6)' : '#F3F4F6',
          color: isPro ? '#fff' : '#4B5563',
          border: 'none',
          boxShadow: isPro ? '0 1px 4px rgba(16,185,129,0.3)' : 'none',
          transition: 'box-shadow 0.16s ease, transform 0.16s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = isPro ? '0 8px 18px rgba(16,185,129,0.28)' : '0 8px 18px rgba(15,23,42,0.10)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none'
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
