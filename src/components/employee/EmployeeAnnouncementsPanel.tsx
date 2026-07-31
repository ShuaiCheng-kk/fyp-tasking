'use client'

// Employee's read-only Announcements — now a full page tab (Communication → Announcements), so
// it mirrors the Owner/Partner/Manager Communication page's list+detail layout exactly (see
// CommunicationView.tsx's Announcements tab) instead of the old compact accordion-style Dashboard
// widget this used to be. Employee cannot post announcements (Owner/Partner/Manager-only, see
// ownerAnnouncementService.postAnnouncement) and only ever sees their own Manager's department
// announcements — never Owner/Partner's company-wide ones (those are O/P/M-internal) — so there's
// no "My Announcements" panel or post/edit/delete affordances, just a single read-only list.

import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Search } from 'lucide-react'
import RoleAvatar from '@/components/RoleAvatar'
import { EmptyState } from '@/components/panel'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'
import { DASHBOARD_SKELETON_KEYFRAMES, SkeletonLine } from '@/components/dashboard/ClockFlow'

type Announcement = {
  id: string
  user_id: string
  audience_department_id: string | null
  title: string
  content: string
  created_at: string
  updated_at?: string | null
  created_by_name?: string | null
  created_by_photo_url?: string | null
}

function formatDateWithTime(iso: string) {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString([], { month: 'short' })
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '')
  return `${day} ${month}, ${time}`
}

// Announcements only ever get `updated_at` set by an edit (never on insert), so its presence
// means "this was edited" — same rule CommunicationView's own timestamp uses.
function formatAnnouncementTimestamp(ann: Announcement) {
  if (ann.updated_at) return `Edited ${formatDateWithTime(ann.updated_at)}`
  return formatDateWithTime(ann.created_at)
}

export default function EmployeeAnnouncementsPanel({ companyId, internalUserId, departmentId, onUnreadCount }: {
  companyId: string
  internalUserId: string
  departmentId: string
  // Same live-reporting pattern as EmployeeChatbox's onUnreadCount — driven off this component's
  // own announcements/readIds state so the Communication page's Announcements tab dot clears the
  // instant a card is clicked here, not on the next realtime table-invalidation tick.
  onUnreadCount?: (count: number) => void
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchAnnouncements = useCallback(() => {
    if (!companyId || !departmentId) return
    const params = new URLSearchParams({ company_id: companyId, role: 'employee', audience_department_id: departmentId })
    fetch(`/api/inbox/announcements?${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setAnnouncements(d.announcements ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [companyId, departmentId])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])
  useResourceInvalidation(['communication'], fetchAnnouncements)

  useEffect(() => {
    if (!internalUserId || !companyId) return
    fetch(`/api/inbox/announcements/read?user_id=${internalUserId}&company_id=${companyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setReadIds(new Set(d.readIds ?? [])) })
      .catch(() => {})
  }, [internalUserId, companyId])

  useEffect(() => {
    onUnreadCount?.(announcements.filter(a => a.user_id !== internalUserId && !readIds.has(a.id)).length)
  }, [announcements, readIds, internalUserId, onUnreadCount])

  const filtered = search
    ? announcements.filter(a =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.content.toLowerCase().includes(search.toLowerCase()) ||
        (a.created_by_name ?? '').toLowerCase().includes(search.toLowerCase()))
    : announcements

  const selected = announcements.find(a => a.id === selectedId) ?? null

  const selectAnnouncement = (ann: Announcement) => {
    setSelectedId(ann.id)
    if (readIds.has(ann.id)) return
    setReadIds(prev => new Set(prev).add(ann.id))
    fetch('/api/inbox/announcements/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: internalUserId, announcement_ids: [ann.id] }),
    }).catch(() => {})
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '400px minmax(0, 1fr)', gap: 12, flex: 1, minHeight: 0 }}>
      {/* Left: list — same card/header structure as Manager's CommunicationView Announcements
          tab (confirmed 2026-07-31: matches Chat tab's header exactly, per Manager's own
          "My Announcements"/"From Others" cards, rather than an approximated height match). */}
      <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Megaphone size={15} style={{ color: '#F97316' }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Announcements</span>
        </div>
        <div style={{ padding: '10px 12px 0', flexShrink: 0 }}>
          <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0 13px' }}>
            <Search size={15} color="#94A3B8" style={{ flexShrink: 0 }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#0F172A', fontWeight: 500 }}
            />
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '14px 10px 10px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <style>{DASHBOARD_SKELETON_KEYFRAMES}</style>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ border: '1px solid #F3F4F6', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SkeletonLine width="40%" height={10} />
                  <SkeletonLine width="70%" height={12} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Megaphone size={24} strokeWidth={1.5} />} message={search ? 'No matching announcements' : 'No announcements yet'} />
          ) : filtered.map((ann, i) => {
            const unread = !readIds.has(ann.id)
            const isSelected = selectedId === ann.id
            return (
              <div
                key={ann.id}
                onClick={() => selectAnnouncement(ann)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 18px',
                  background: isSelected ? '#FFF7ED' : '#FFFFFF',
                  border: isSelected ? '1.5px solid rgba(249,115,22,0.35)' : '1.5px solid #EDF2F7',
                  borderRadius: 12, cursor: 'pointer', width: '100%', marginBottom: 8, boxSizing: 'border-box',
                  boxShadow: isSelected ? '0 6px 18px rgba(249,115,22,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(15,23,42,0.09)' } }}
                onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)' } }}
              >
                {/* No department badge here — every announcement Employee can see is already
                    scoped to their own single department server-side, so it would just repeat
                    the same label on every card. "Posted by" is what's actually useful per card
                    (confirmed 2026-07-31). */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#475569', background: '#F1F5F9', borderRadius: 999, padding: '4px 10px' }}>
                    Posted by {ann.created_by_name ?? 'Manager'}
                  </span>
                  <span style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 500, flexShrink: 0 }}>{formatAnnouncementTimestamp(ann)}</span>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {unread && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />}
                  <span style={{ fontWeight: unread ? 800 : 600, fontSize: 15, lineHeight: '18px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {ann.title}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: detail */}
      <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {selected ? (
          <>
            <div style={{ flexShrink: 0, background: '#FFFFFF', borderBottom: '1px solid #EDF2F7', padding: '16px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <RoleAvatar role="Manager" size={44} photoUrl={selected.created_by_photo_url ?? null} />
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: 0, minWidth: 0, color: '#0F172A', fontSize: 19, lineHeight: 1.2, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.title}</h2>
                  <div style={{ color: '#9CA3AF', fontSize: 13, fontWeight: 500, marginTop: 4 }}>
                    Posted by <span style={{ color: '#334155', fontWeight: 700 }}>{selected.created_by_name ?? 'Manager'}</span> at {formatAnnouncementTimestamp(selected)}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 28 }}>
              <article style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '28px 32px', boxShadow: '0 4px 20px rgba(15,23,42,0.05)' }}>
                <p style={{ margin: 0, color: '#334155', fontSize: 14.5, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{selected.content}</p>
              </article>
            </div>
          </>
        ) : (
          <EmptyState variant="iconBox" fill icon={<Megaphone size={24} strokeWidth={1.5} />} message="Select an announcement to read" />
        )}
      </div>
    </div>
  )
}
