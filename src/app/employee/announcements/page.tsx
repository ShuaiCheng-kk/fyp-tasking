'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EmployeeSidebar from '@/components/EmployeeSidebar'
import { Megaphone } from 'lucide-react'

const GREEN = '#16A34A'
const GREEN_LIGHT = '#DCFCE7'

type Announcement = {
  id: string
  title: string
  content: string
  created_at: string
  created_by_name: string | null
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function getReadIdsKey(companyId: string, userId: string) {
  return `ann_read_ids_${companyId}_${userId}`
}

function loadReadIds(companyId: string, userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(getReadIdsKey(companyId, userId))
    if (raw) return new Set(JSON.parse(raw))
  } catch {}
  return new Set()
}

function saveReadIds(companyId: string, userId: string, ids: Set<string>) {
  localStorage.setItem(getReadIdsKey(companyId, userId), JSON.stringify([...ids]))
}

export default function EmployeeAnnouncementsPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selected, setSelected] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [internalUserId, setInternalUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const userId = localStorage.getItem('tasking_user_id')
      if (!userId) { router.replace('/signin'); return }

      const meRes = await fetch(`/api/user/me?user_id=${userId}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }
      setUserName(meData.user.full_name ?? '')

      const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${userId}`)
      const iid: string = meData.user.id
      setCompanyId(cid)
      setInternalUserId(iid)

      // Load persisted read set
      const ids = cid ? loadReadIds(cid, iid) : new Set<string>()
      setReadIds(ids)

      const res = await fetch(`/api/employee/announcements?user_id=${userId}`)
      const data = await res.json()
      if (!cancelled && data.success) {
        setAnnouncements(data.announcements ?? [])
      }
      if (!cancelled) setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  function handleSelect(ann: Announcement) {
    setSelected(ann)
    if (!companyId || !internalUserId) return
    const next = new Set(readIds)
    next.add(ann.id)
    setReadIds(next)
    saveReadIds(companyId, internalUserId, next)
  }

  const unreadCount = announcements.filter(a => !readIds.has(a.id)).length

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F0FDF4', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <EmployeeSidebar unreadAnnouncements={unreadCount} />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '18px 32px',
          background: GREEN,
          borderBottom: '1px solid #15803D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#FFFFFF', margin: 0 }}>Announcements</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userName && <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>{userName}</span>}
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }}>
              Employee
            </span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: list */}
          <div style={{ width: '33%', minWidth: 260, maxWidth: 360, background: '#FFFFFF', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Department Announcements
              </span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ padding: 24, color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>Loading…</div>
              ) : announcements.length === 0 ? (
                <div style={{ padding: 24, color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>No announcements yet</div>
              ) : announcements.map(ann => {
                const unread = !readIds.has(ann.id)
                return (
                <button
                  key={ann.id}
                  onClick={() => handleSelect(ann)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 5, padding: '13px 16px',
                    background: selected?.id === ann.id ? GREEN_LIGHT : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                    borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (selected?.id !== ann.id) e.currentTarget.style.background = '#F0FDF4' }}
                  onMouseLeave={e => { if (selected?.id !== ann.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {unread && <div style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />}
                    <span style={{ fontWeight: unread ? 700 : 600, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {ann.title}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{formatTime(ann.created_at)}</span>
                  {ann.created_by_name && (
                    <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>By {ann.created_by_name}</span>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ann.content.slice(0, 60)}{ann.content.length > 60 ? '…' : ''}
                  </div>
                </button>
              )})}
            </div>
          </div>

          {/* Right: detail */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F9FAFB' }}>
            {selected ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
                <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', maxWidth: 720 }}>
                  <h2 style={{ fontWeight: 700, fontSize: '1.25rem', color: '#111827', margin: '0 0 8px', lineHeight: 1.3 }}>{selected.title}</h2>
                  <div style={{ fontSize: '0.8125rem', color: '#9CA3AF', marginBottom: selected.created_by_name ? 4 : 20 }}>
                    {new Date(selected.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  {selected.created_by_name && (
                    <div style={{ fontSize: '0.8125rem', color: '#6B7280', marginBottom: 20 }}>
                      Posted by {selected.created_by_name}
                    </div>
                  )}
                  <p style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                    {selected.content}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', gap: 8 }}>
                <Megaphone size={32} strokeWidth={1.5} />
                <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Select an announcement to read</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
