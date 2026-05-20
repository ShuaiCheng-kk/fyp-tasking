'use client'

import { useState, useEffect, useCallback } from 'react'
import OwnerSidebar from '@/components/OwnerSidebar'
import { createClient } from '@/lib/supabase'
import { Plus, X, Trash2, Pencil } from 'lucide-react'

const ACCENT = '#F97316'
const ACCENT_LIGHT = '#FFF7ED'

type Announcement = {
  id: string
  from_user_id: string
  company_id: string
  department_id: string | null
  title: string
  content: string
  created_at: string
  created_by_name?: string | null
}

type Department = { id: string; name: string }

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

export default function OwnerAnnouncementsPage() {
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [internalUserId, setInternalUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState('')
  const [userDeptId, setUserDeptId] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [unreadMessages, setUnreadMessages] = useState(0)

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null)
  // Per-announcement read tracking
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const [showModal, setShowModal] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annDeptId, setAnnDeptId] = useState<string | 'company-wide'>('company-wide')
  const [posting, setPosting] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editAudience, setEditAudience] = useState<string | 'company-wide'>('company-wide')
  const [editDeptId, setEditDeptId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${uid}`)
    setAuthUserId(uid)
    setCompanyId(cid)
    if (uid) {
      fetch(`/api/user/me?user_id=${uid}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setInternalUserId(d.user.id)
            setUserRole(d.user.role ?? '')
            setUserDeptId(d.user.department_id ?? null)
            // Load per-user read IDs once we have both IDs
            if (cid) setReadIds(loadReadIds(cid, d.user.id))
          }
        })
    }
  }, [])

  useEffect(() => {
    if (!companyId) return
    fetch(`/api/company/departments?company_id=${companyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setDepartments(d.departments ?? []) })
      .catch(() => {})
  }, [companyId])

  const fetchUnreadMsgCount = useCallback(() => {
    if (!internalUserId || !companyId) return
    fetch(`/api/inbox/unread-count?user_id=${internalUserId}&company_id=${companyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUnreadMessages(d.unread_messages ?? 0) })
  }, [internalUserId, companyId])

  const fetchAnnouncements = useCallback(() => {
    if (!companyId || !userRole) return
    const params = new URLSearchParams({ company_id: companyId, role: userRole })
    if (userDeptId) params.set('department_id', userDeptId)
    fetch(`/api/inbox/announcements?${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setAnnouncements(d.announcements ?? []) })
  }, [companyId, userRole, userDeptId])

  useEffect(() => {
    if (!internalUserId || !companyId || !userRole) return
    fetchAnnouncements()
    fetchUnreadMsgCount()
  }, [internalUserId, companyId, userRole, fetchAnnouncements, fetchUnreadMsgCount])

  useEffect(() => {
    if (!companyId) return
    const channel = supabase
      .channel('owner-announcements-page')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'announcements',
        filter: `company_id=eq.${companyId}`,
      }, () => { fetchAnnouncements() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId, userRole, userDeptId])

  function handleSelectAnn(ann: Announcement) {
    setSelectedAnn(ann)
    if (!companyId || !internalUserId) return
    const next = new Set(readIds)
    next.add(ann.id)
    setReadIds(next)
    saveReadIds(companyId, internalUserId, next)
  }

  const unreadCount = announcements.filter(a => !readIds.has(a.id)).length

  async function handlePost() {
    if (!internalUserId || !companyId) return
    setPosting(true)
    try {
      const res = await fetch('/api/inbox/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_user_id: internalUserId,
          company_id: companyId,
          department_id: annDeptId === 'company-wide' ? null : annDeptId,
          title: annTitle,
          content: annContent,
          user_role: userRole,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAnnouncements(prev => [data.announcement, ...prev])
        setShowModal(false)
        setAnnTitle('')
        setAnnContent('')
        setAnnDeptId('company-wide')
      }
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(announcementId: string) {
    if (!internalUserId) return
    setDeleting(true)
    try {
      const res = await fetch('/api/inbox/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement_id: announcementId, requesting_user_id: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setAnnouncements(prev => prev.filter(a => a.id !== announcementId))
      if (selectedAnn?.id === announcementId) setSelectedAnn(null)
      setDeleteConfirmId(null)
    } catch {}
    finally { setDeleting(false) }
  }

  function handleOpenEdit(ann: Announcement) {
    setEditTitle(ann.title)
    setEditContent(ann.content)
    if (ann.department_id) {
      setEditAudience('specific-dept')
      setEditDeptId(ann.department_id)
    } else {
      setEditAudience('company-wide')
      setEditDeptId(null)
    }
    setEditError(null)
    setShowEditModal(true)
  }

  async function handleSaveEdit() {
    if (!selectedAnn || !internalUserId) return
    setSaving(true)
    setEditError(null)
    try {
      const deptId = editAudience === 'specific-dept' ? editDeptId : null
      const res = await fetch('/api/inbox/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcement_id: selectedAnn.id,
          requesting_user_id: internalUserId,
          title: editTitle,
          content: editContent,
          department_id: deptId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed to save')
      setShowEditModal(false)
      fetchAnnouncements()
      setSelectedAnn(prev => prev ? { ...prev, title: editTitle, content: editContent, department_id: deptId } : prev)
    } catch (err: any) {
      setEditError(err.message ?? 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const canPostCompanyWide = ['owner', 'partner'].includes(userRole?.toLowerCase())

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar unreadMessages={unreadMessages} unreadAnnouncements={unreadCount} />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 32px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>Announcements</h1>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: announcements list */}
          <div style={{ width: '33%', minWidth: 260, maxWidth: 360, background: '#FFFFFF', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Announcements</span>
              <button
                onClick={() => setShowModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus size={13} /> New
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {announcements.length === 0 ? (
                <div style={{ padding: 24, color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>No announcements yet</div>
              ) : announcements.map(ann => {
                const unread = !readIds.has(ann.id)
                return (
                  <button
                    key={ann.id}
                    onClick={() => handleSelectAnn(ann)}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 5, padding: '13px 16px',
                      background: selectedAnn?.id === ann.id ? ACCENT_LIGHT : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                      borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unread && <div style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, flexShrink: 0 }} />}
                      <span style={{ fontWeight: unread ? 700 : 500, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {ann.title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{formatTime(ann.created_at)}</span>
                      <span style={{ fontSize: '0.7rem', background: ann.department_id ? '#EFF6FF' : '#F3F4F6', color: ann.department_id ? '#3B82F6' : '#6B7280', padding: '1px 6px', borderRadius: 4 }}>
                        {ann.department_id ? (departments.find(d => d.id === ann.department_id)?.name ?? 'Dept') : 'Company-wide'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ann.content.slice(0, 60)}{ann.content.length > 60 ? '…' : ''}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: announcement detail */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F9FAFB' }}>
            {selectedAnn ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
                <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', maxWidth: 720 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1.25rem', color: '#111827', margin: 0, lineHeight: 1.3 }}>{selectedAnn.title}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                      <span style={{ fontSize: '0.75rem', background: selectedAnn.department_id ? '#EFF6FF' : '#F3F4F6', color: selectedAnn.department_id ? '#3B82F6' : '#6B7280', padding: '3px 10px', borderRadius: 5, fontWeight: 600 }}>
                        {selectedAnn.department_id ? (departments.find(d => d.id === selectedAnn.department_id)?.name ?? 'Department') : 'Company-wide'}
                      </span>
                      {selectedAnn.from_user_id === internalUserId && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(selectedAnn)}
                            title="Edit announcement"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', color: '#374151', fontSize: '0.8rem', fontWeight: 500 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(selectedAnn.id)}
                            title="Delete announcement"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'none', border: '1px solid #FECACA', borderRadius: 6, cursor: 'pointer', color: '#DC2626', fontSize: '0.8rem', fontWeight: 500 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#9CA3AF', marginBottom: 4 }}>
                    {new Date(selectedAnn.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  {selectedAnn.created_by_name && (
                    <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: 20 }}>
                      Posted by {selectedAnn.created_by_name}
                    </div>
                  )}
                  {!selectedAnn.created_by_name && <div style={{ marginBottom: 20 }} />}
                  <p style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{selectedAnn.content}</p>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', gap: 8 }}>
                <div style={{ fontSize: '2rem' }}>📢</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Select an announcement to read</div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: '0 0 8px' }}>Delete Announcement</h3>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 20px', lineHeight: 1.55 }}>
              Are you sure you want to delete this announcement? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                style={{ flex: 1, padding: '9px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', color: '#6B7280', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleting}
                style={{ flex: 1, padding: '9px', background: '#DC2626', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.65 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Announcement Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>Edit Announcement</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Title *</label>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Announcement title"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Content *</label>
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  placeholder="Write your announcement..."
                  rows={5}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Audience</label>
                <select
                  value={editAudience}
                  onChange={e => {
                    setEditAudience(e.target.value)
                    if (e.target.value === 'company-wide') setEditDeptId(null)
                    else if (departments.length > 0) setEditDeptId(departments[0].id)
                  }}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: '#fff' }}
                >
                  <option value="company-wide">Company-wide</option>
                  <option value="specific-dept">Specific Department</option>
                </select>
              </div>
              {editAudience === 'specific-dept' && (
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Department</label>
                  <select
                    value={editDeptId ?? ''}
                    onChange={e => setEditDeptId(e.target.value)}
                    disabled={departments.length === 0}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: '#fff', opacity: departments.length === 0 ? 0.6 : 1 }}
                  >
                    {departments.length === 0
                      ? <option value="">No departments available</option>
                      : departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                    }
                  </select>
                </div>
              )}
              {editError && (
                <div style={{ fontSize: '0.8125rem', color: '#DC2626', background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>
                  {editError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                  style={{ flex: 1, padding: '9px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', color: '#6B7280', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editTitle.trim() || !editContent.trim()}
                  style={{ flex: 1, padding: '9px', background: ACCENT, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', color: '#fff', cursor: saving || !editTitle.trim() || !editContent.trim() ? 'not-allowed' : 'pointer', opacity: saving || !editTitle.trim() || !editContent.trim() ? 0.6 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Announcement Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>New Announcement</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Title *</label>
                <input
                  value={annTitle}
                  onChange={e => setAnnTitle(e.target.value)}
                  placeholder="Announcement title"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Content *</label>
                <textarea
                  value={annContent}
                  onChange={e => setAnnContent(e.target.value)}
                  placeholder="Write your announcement..."
                  rows={5}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Audience</label>
                <select
                  value={annDeptId}
                  onChange={e => setAnnDeptId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: '#fff' }}
                >
                  {canPostCompanyWide && <option value="company-wide">Company-wide</option>}
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <button
                onClick={handlePost}
                disabled={posting || !annTitle.trim() || !annContent.trim()}
                style={{ padding: '10px 0', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', opacity: posting || !annTitle.trim() || !annContent.trim() ? 0.6 : 1 }}
              >
                {posting ? 'Posting...' : 'Post Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
