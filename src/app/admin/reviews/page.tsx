'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import StarRating from '@/components/feedback/StarRating'
import Toast from '@/components/Toast'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { Trash2 } from 'lucide-react'
import { Review } from '@/types/Review'

const ORANGE = '#F97316'
const TEXT = '#1C1917'
const BORDER = '#E2E8F0'
const MUTED = '#94A3B8'

type Filter = 'pending' | 'approved'

export default function AdminReviewsPage() {
  useAuthGuard()
  const [adminUserId, setAdminUserId] = useState('')
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef<Record<Filter, HTMLButtonElement | null>>({ pending: null, approved: null })
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, opacity: 0 })

  useEffect(() => {
    const authUid = localStorage.getItem('tasking_user_id')
    if (authUid) setAdminUserId(authUid)
  }, [])

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/marketingadmin/reviews')
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setReviews(data.reviews ?? [])
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadReviews() }, [loadReviews])

  const showNotice = (msg: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setNotice(msg)
    noticeTimerRef.current = setTimeout(() => setNotice(''), 3000)
  }

  const showError = (msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    setError(msg)
    errorTimerRef.current = setTimeout(() => setError(''), 4000)
  }

  const setApproval = async (review_id: string, approved: boolean) => {
    setBusyId(review_id)
    setError('')
    try {
      const res = await fetch('/api/marketingadmin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id, approved }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setReviews(prev => prev.map(r => (r.id === review_id ? data.review : r)))
      showNotice(approved ? 'Review approved' : 'Review unapproved')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update review')
    } finally {
      setBusyId('')
    }
  }

  const deleteReview = async (review_id: string) => {
    if (!window.confirm('Delete this review permanently? This cannot be undone.')) return
    setBusyId(review_id)
    setError('')
    try {
      const res = await fetch(`/api/marketingadmin/reviews?id=${encodeURIComponent(review_id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setReviews(prev => prev.filter(r => r.id !== review_id))
      showNotice('Review deleted')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete review')
    } finally {
      setBusyId('')
    }
  }

  const visibleReviews = reviews.filter(r => (filter === 'pending' ? !r.approved : r.approved))

  const pendingCount = reviews.filter(r => !r.approved).length

  useLayoutEffect(() => {
    const container = tabBarRef.current
    const activeButton = tabButtonRefs.current[filter]
    if (!container || !activeButton) return
    const containerRect = container.getBoundingClientRect()
    const activeRect = activeButton.getBoundingClientRect()
    setTabIndicator({ left: activeRect.left - containerRect.left, width: activeRect.width, opacity: 1 })
  }, [filter, pendingCount])

  return (
    <main style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F1F5F9' }}>
      <style>{`
        @keyframes adminFadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .admin-review-card {
          animation: adminFadeSlideUp 0.28s ease both;
        }
      `}</style>
      <AdminSidebar />
      <div style={{ marginLeft: '64px', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Page header — matches Owner's Communication page exactly */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Reviews
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {adminUserId && <OwnerUserBadge userId={adminUserId} companyId="" />}
          </div>
        </div>

        {/* Tab switcher row — floating pill capsule with animated indicator, matches Communication/Shifts/Tasks pages */}
        <div style={{ padding: '0 28px 16px', flexShrink: 0 }}>
          <div
            ref={tabBarRef}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: 4,
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 999,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              position: 'relative',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 4,
                left: tabIndicator.left,
                width: tabIndicator.width,
                height: 'calc(100% - 8px)',
                borderRadius: 999,
                background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
                boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
                opacity: tabIndicator.opacity,
                transform: tabIndicator.opacity ? 'translateY(0)' : 'translateY(4px)',
                transition: 'left 0.24s cubic-bezier(0.22, 1, 0.36, 1), width 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                pointerEvents: 'none',
              }}
            />
            {([
              { key: 'pending' as const, label: 'Pending', badge: pendingCount },
              { key: 'approved' as const, label: 'Approved', badge: 0 },
            ]).map(tab => {
              const active = filter === tab.key
              return (
                <button
                  key={tab.key}
                  ref={el => { tabButtonRefs.current[tab.key] = el }}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    height: 36,
                    padding: '0 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'transparent',
                    color: active ? '#FFFFFF' : '#64748B',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'color 0.18s ease, transform 0.18s ease',
                    transform: active ? 'translateY(-0.5px)' : 'translateY(0)',
                  }}
                >
                  {tab.label}
                  {tab.badge > 0 && (
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#EF4444', flexShrink: 0, border: active ? '1.5px solid #111827' : '1.5px solid #fff' }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '0 28px 28px', flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div style={{ maxWidth: 760 }}>

          {loading ? (
            <p style={{ color: MUTED, fontSize: 13 }}>Loading…</p>
          ) : visibleReviews.length === 0 ? (
            <div key={filter} className="admin-review-card" style={{ background: '#FFFFFF', border: `1px dashed ${BORDER}`, borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
              <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
                {filter === 'pending' ? 'No reviews waiting for review.' : 'Nothing to show here yet.'}
              </p>
            </div>
          ) : (
            <div key={filter} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {visibleReviews.map((review, i) => (
                <div key={review.id} className="admin-review-card" style={{ animationDelay: `${i * 0.04}s`, background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: 8 }}>
                        <StarRating value={review.rating} readOnly size={15} />
                      </div>
                      <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.6, color: TEXT }}>
                        "{review.review}"
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {review.approved ? (
                        <button
                          type="button"
                          disabled={busyId === review.id}
                          onClick={() => setApproval(review.id, false)}
                          style={{ ...actionBtnStyle, color: '#C2410C', borderColor: '#FDBA74' }}
                        >
                          Unapprove
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === review.id}
                          onClick={() => setApproval(review.id, true)}
                          style={{ ...actionBtnStyle, color: '#047857', borderColor: '#86EFAC' }}
                        >
                          Approve
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === review.id}
                        onClick={() => deleteReview(review.id)}
                        aria-label="Delete review"
                        style={{ ...actionBtnStyle, color: '#B91C1C', borderColor: '#FECACA', padding: '7px 10px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
                      {review.name || 'Anonymous'}
                      {review.email ? `, ${review.email}` : ''}
                    </p>
                    <span style={{ fontSize: 13, color: MUTED }}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
      <Toast message={notice} />
      <Toast message={error} variant="error" />
    </main>
  )
}

const actionBtnStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1.5px solid',
  borderRadius: 8,
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
}
