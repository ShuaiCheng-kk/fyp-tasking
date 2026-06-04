'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import OwnerSidebar from '@/components/OwnerSidebar'
import { createClient } from '@/lib/supabase'
import {
  Plus, X, Trash2, Pencil, Megaphone,
  Send, Search, SquarePen, Check, Bell, MessageSquare,
} from 'lucide-react'

const ACCENT = '#F97316'
const ACCENT_LIGHT = '#FFF7ED'

// ─── Shared types ────────────────────────────────────────────────────────────

type Department = { id: string; name: string }

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

type CompanyMember = { id: string; full_name: string; role: string }

type Conversation = {
  partnerId: string
  partnerName: string
  partnerRole: string
  lastMessage: string
  lastTime: string
  unreadCount: number
  partnerDeleted?: boolean
  companyId?: string | null
  companyName?: string | null
}

type Message = {
  id: string
  from_user_id: string
  to_user_id: string
  content: string
  created_at: string
  is_read: boolean
}

type InboxInvite = {
  id: string
  role: string
  created_at: string
  sender_name: string
  company_name: string
}

type InviteFlash = { id: string; message: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  Owner: '#8B5CF6',
  Manager: '#3B82F6',
  Employee: '#10B981',
}

const ROLE_LABEL: Record<string, string> = {
  Owner: 'Partner',
  Manager: 'Manager',
  Employee: 'Employee',
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

function Avatar({ name, size = 36, color = ACCENT }: { name: string; size?: number; color?: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color + '22',
      color, fontWeight: 700, fontSize: size * 0.38, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OwnerCommunicationPage() {
  const [activeTab, setActiveTab] = useState<'announcements' | 'messages'>('announcements')

  // Shared auth state
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [internalUserId, setInternalUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState('')
  const [userDeptId, setUserDeptId] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [unreadMessages, setUnreadMessages] = useState(0)

  // ── Announcements state ──
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const [showNewAnnModal, setShowNewAnnModal] = useState(false)
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

  // ── Messages state ──
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [search, setSearch] = useState('')
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  const [msgSubTab, setMsgSubTab] = useState<'messages' | 'invites'>('messages')
  const [invites, setInvites] = useState<InboxInvite[]>([])
  const [inviteFlashes, setInviteFlashes] = useState<InviteFlash[]>([])
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteActing, setInviteActing] = useState<string | null>(null)

  const [composeOpen, setComposeOpen] = useState(false)
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([])
  const [composeSearch, setComposeSearch] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState<CompanyMember | null>(null)
  const [composeText, setComposeText] = useState('')
  const [composeSending, setComposeSending] = useState(false)
  const [composeError, setComposeError] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // ── Auth init ──
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
            if (cid) setReadIds(loadReadIds(cid, d.user.id))
          }
        })
    }
  }, [])

  // ── Departments ──
  useEffect(() => {
    if (!companyId) return
    fetch(`/api/company/departments?company_id=${companyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setDepartments(d.departments ?? []) })
      .catch(() => {})
  }, [companyId])

  // ── Unread message count ──
  const fetchUnreadCount = useCallback(() => {
    if (!internalUserId || !companyId) return
    fetch(`/api/inbox/unread-count?user_id=${internalUserId}&company_id=${companyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUnreadMessages(d.unread_messages ?? 0) })
  }, [internalUserId, companyId])

  // ── Announcements fetch ──
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
    fetchUnreadCount()
  }, [internalUserId, companyId, userRole, fetchAnnouncements, fetchUnreadCount])

  // ── Announcements realtime ──
  useEffect(() => {
    if (!companyId) return
    const channel = supabase
      .channel('owner-comm-announcements')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'announcements',
        filter: `company_id=eq.${companyId}`,
      }, () => fetchAnnouncements())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId, userRole, userDeptId])

  // ── Conversations ──
  const fetchConversations = useCallback(() => {
    if (!internalUserId) return
    fetch(`/api/inbox/messages?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setConversations(d.conversations ?? []) })
  }, [internalUserId])

  const fetchInvites = useCallback(() => {
    if (!internalUserId) return
    setInviteLoading(true)
    fetch(`/api/inbox/invites?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setInvites(d.invites ?? []) })
      .finally(() => setInviteLoading(false))
  }, [internalUserId])

  useEffect(() => {
    if (!internalUserId) return
    fetchConversations()
    fetchUnreadCount()
  }, [internalUserId, fetchConversations, fetchUnreadCount])

  useEffect(() => {
    if (!internalUserId) return
    fetchInvites()
  }, [internalUserId, fetchInvites])

  useEffect(() => {
    const q = search.toLowerCase()
    setFilteredConversations(q ? conversations.filter(c => c.partnerName.toLowerCase().includes(q)) : conversations)
  }, [search, conversations])

  useEffect(() => {
    if (!selectedConv || !internalUserId) return
    fetch(`/api/inbox/messages/${selectedConv.partnerId}?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setMessages(d.messages ?? [])
          fetchUnreadCount()
          fetchConversations()
        }
      })
  }, [selectedConv, internalUserId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Messages realtime ──
  useEffect(() => {
    if (!internalUserId) return
    const channel = supabase
      .channel('owner-comm-messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `to_user_id=eq.${internalUserId}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        if (selectedConv && newMsg.from_user_id === selectedConv.partnerId) {
          setMessages(prev => [...prev, newMsg])
        }
        fetchConversations()
        fetchUnreadCount()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [internalUserId, selectedConv])

  // ── Announcement actions ──
  function handleSelectAnn(ann: Announcement) {
    setSelectedAnn(ann)
    if (!companyId || !internalUserId) return
    const next = new Set(readIds)
    next.add(ann.id)
    setReadIds(next)
    saveReadIds(companyId, internalUserId, next)
  }

  const unreadAnnCount = announcements.filter(a => !readIds.has(a.id)).length

  async function handlePostAnnouncement() {
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
        setShowNewAnnModal(false)
        setAnnTitle('')
        setAnnContent('')
        setAnnDeptId('company-wide')
      }
    } finally {
      setPosting(false)
    }
  }

  async function handleDeleteAnnouncement(announcementId: string) {
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

  // ── Message actions ──
  const openCompose = useCallback(() => {
    if (!companyId || !internalUserId) return
    setComposeOpen(true)
    setSelectedRecipient(null)
    setComposeText('')
    setComposeSearch('')
    setComposeError('')
    fetch(`/api/team/members?company_id=${companyId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const eligible = (d.members as CompanyMember[]).filter(
            m => m.role !== 'Casual Worker' && m.id !== internalUserId
          )
          setCompanyMembers(eligible)
        }
      })
  }, [companyId, internalUserId])

  async function handleAcceptInvite(invite: InboxInvite) {
    if (!internalUserId) return
    setInviteActing(invite.id)
    try {
      const res = await fetch('/api/inbox/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbox_id: invite.id, user_id: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed to accept')
      setInvites(prev => prev.filter(i => i.id !== invite.id))
      const flash: InviteFlash = { id: invite.id, message: `You have joined ${invite.company_name}` }
      setInviteFlashes(prev => [...prev, flash])
      setTimeout(() => setInviteFlashes(prev => prev.filter(f => f.id !== flash.id)), 4000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setInviteActing(null)
    }
  }

  async function handleDeclineInvite(invite: InboxInvite) {
    setInviteActing(invite.id)
    try {
      const res = await fetch('/api/inbox/invites/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbox_id: invite.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed to decline')
      setInvites(prev => prev.filter(i => i.id !== invite.id))
      const flash: InviteFlash = { id: invite.id, message: 'Invitation declined' }
      setInviteFlashes(prev => [...prev, flash])
      setTimeout(() => setInviteFlashes(prev => prev.filter(f => f.id !== flash.id)), 3000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setInviteActing(null)
    }
  }

  async function handleComposeSend() {
    if (!selectedRecipient || !composeText.trim() || !internalUserId || !companyId) return
    setComposeSending(true)
    setComposeError('')
    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_user_id: internalUserId,
          to_user_id: selectedRecipient.id,
          company_id: companyId,
          content: composeText.trim(),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed to send')
      setComposeOpen(false)
      const convRes = await fetch(`/api/inbox/messages?user_id=${internalUserId}`)
      const convData = await convRes.json()
      if (convData.success) {
        setConversations(convData.conversations ?? [])
        const found = (convData.conversations as Conversation[]).find(c => c.partnerId === selectedRecipient.id)
        if (found) setSelectedConv(found)
      }
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setComposeSending(false)
    }
  }

  async function handleSendMessage() {
    if (!msgInput.trim() || !selectedConv || !internalUserId || !companyId) return
    setSendingMsg(true)
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      from_user_id: internalUserId,
      to_user_id: selectedConv.partnerId,
      content: msgInput.trim(),
      created_at: new Date().toISOString(),
      is_read: false,
    }
    setMessages(prev => [...prev, optimistic])
    const content = msgInput.trim()
    setMsgInput('')
    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_user_id: internalUserId,
          to_user_id: selectedConv.partnerId,
          company_id: companyId,
          content,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMessages(prev => prev.map(m => m.id === optimistic.id ? data.message : m))
        fetchConversations()
      }
    } finally {
      setSendingMsg(false)
    }
  }

  const filteredMembers = composeSearch
    ? companyMembers.filter(m => m.full_name.toLowerCase().includes(composeSearch.toLowerCase()))
    : companyMembers

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar unreadMessages={unreadMessages} unreadAnnouncements={unreadAnnCount} />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Page header + top-level tabs */}
        <div style={{ padding: '18px 32px 0', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: '0 0 14px' }}>Communication</h1>
          <div style={{ display: 'flex', gap: 0 }}>
            {(['announcements', 'messages'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '9px 22px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? `2.5px solid ${ACCENT}` : '2.5px solid transparent',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab ? 700 : 500,
                  fontSize: '0.9rem',
                  color: activeTab === tab ? ACCENT : '#6B7280',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color 0.12s',
                }}
              >
                {tab === 'announcements' ? <Megaphone size={15} /> : <MessageSquare size={15} />}
                {tab === 'announcements' ? 'Announcements' : 'Messages'}
                {tab === 'announcements' && unreadAnnCount > 0 && (
                  <span style={{ background: ACCENT, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadAnnCount}
                  </span>
                )}
                {tab === 'messages' && unreadMessages > 0 && (
                  <span style={{ background: ACCENT, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadMessages}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Announcements tab ── */}
        {activeTab === 'announcements' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left: list */}
            <div style={{ width: '33%', minWidth: 260, maxWidth: 360, background: '#FFFFFF', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '13px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Announcements</span>
                <button
                  onClick={() => setShowNewAnnModal(true)}
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
                        {ann.created_by_name && (
                          <span style={{ fontSize: '12px', color: '#6B7280', whiteSpace: 'nowrap', flexShrink: 0 }}>{ann.created_by_name}</span>
                        )}
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

            {/* Right: detail */}
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
                      <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: 20 }}>Posted by {selectedAnn.created_by_name}</div>
                    )}
                    {!selectedAnn.created_by_name && <div style={{ marginBottom: 20 }} />}
                    <p style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{selectedAnn.content}</p>
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
        )}

        {/* ── Messages tab ── */}
        {activeTab === 'messages' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left: conversation list */}
            <div style={{ width: '33%', minWidth: 260, maxWidth: 360, background: '#FFFFFF', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              {/* Sub-tabs: Messages / Invitations */}
              <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
                <button
                  onClick={() => setMsgSubTab('messages')}
                  style={{
                    flex: 1, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer',
                    fontWeight: msgSubTab === 'messages' ? 700 : 500, fontSize: '0.875rem',
                    color: msgSubTab === 'messages' ? ACCENT : '#6B7280',
                    borderBottom: msgSubTab === 'messages' ? `2px solid ${ACCENT}` : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <SquarePen size={14} /> Messages
                </button>
                <button
                  onClick={() => setMsgSubTab('invites')}
                  style={{
                    flex: 1, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer',
                    fontWeight: msgSubTab === 'invites' ? 700 : 500, fontSize: '0.875rem',
                    color: msgSubTab === 'invites' ? ACCENT : '#6B7280',
                    borderBottom: msgSubTab === 'invites' ? `2px solid ${ACCENT}` : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    position: 'relative',
                  }}
                >
                  <Bell size={14} /> Invitations
                  {invites.length > 0 && (
                    <span style={{
                      position: 'absolute', top: 6, right: 18,
                      background: ACCENT, color: '#fff', borderRadius: '50%',
                      width: 16, height: 16, fontSize: '0.65rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{invites.length}</span>
                  )}
                </button>
              </div>

              {msgSubTab === 'messages' ? (
                <>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6' }}>
                    <button
                      onClick={openCompose}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                        padding: '8px 14px', background: ACCENT, border: 'none', borderRadius: 8,
                        color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#EA6C0A')}
                      onMouseLeave={e => (e.currentTarget.style.background = ACCENT)}
                    >
                      <SquarePen size={14} strokeWidth={2.5} /> New Message
                    </button>
                  </div>

                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 12px' }}>
                      <Search size={14} color="#9CA3AF" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search conversations..."
                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', color: '#374151' }}
                      />
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {filteredConversations.length === 0 ? (
                      <div style={{ padding: 24, color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                        {search ? 'No results' : 'No conversations yet'}
                      </div>
                    ) : filteredConversations.map(conv => (
                      <button
                        key={conv.partnerId}
                        onClick={() => setSelectedConv(conv)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px',
                          background: selectedConv?.partnerId === conv.partnerId ? ACCENT_LIGHT : 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                          borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s',
                        }}
                      >
                        <Avatar name={conv.partnerName} size={38} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                              <span style={{ fontWeight: conv.unreadCount > 0 ? 700 : 500, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {conv.partnerName}
                              </span>
                              {conv.partnerDeleted && (
                                <span style={{ background: '#F3F4F6', color: '#6B7280', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  Account removed
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#9CA3AF', flexShrink: 0, marginLeft: 6 }}>{formatTime(conv.lastTime)}</span>
                          </div>
                          {(conv.companyName || conv.partnerRole) && (
                            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {[conv.companyName, conv.partnerRole].filter(Boolean).join(' · ')}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <span style={{ fontSize: '0.8125rem', color: conv.unreadCount > 0 ? '#111827' : '#9CA3AF', fontWeight: conv.unreadCount > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {conv.lastMessage}
                            </span>
                            {conv.unreadCount > 0 && (
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, flexShrink: 0 }} />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                /* Invites list */
                <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
                  {inviteLoading ? (
                    <div style={{ padding: 24, color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>Loading…</div>
                  ) : invites.length === 0 ? (
                    <div style={{ padding: 24, color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>No pending invitations</div>
                  ) : invites.map(invite => (
                    <div
                      key={invite.id}
                      style={{ margin: '8px 12px', padding: '14px 16px', background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 12 }}
                    >
                      <p style={{ margin: '0 0 4px', fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>
                        <strong>{invite.sender_name}</strong> invited you to join{' '}
                        <strong>{invite.company_name}</strong> as{' '}
                        <span style={{ color: ACCENT }}>{invite.role}</span>
                      </p>
                      <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: '#9CA3AF' }}>{formatTime(invite.created_at)}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleAcceptInvite(invite)}
                          disabled={inviteActing === invite.id}
                          style={{ flex: 1, padding: '7px 0', background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', cursor: inviteActing === invite.id ? 'not-allowed' : 'pointer', opacity: inviteActing === invite.id ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        >
                          <Check size={13} /> Accept
                        </button>
                        <button
                          onClick={() => handleDeclineInvite(invite)}
                          disabled={inviteActing === invite.id}
                          style={{ flex: 1, padding: '7px 0', background: '#fff', color: '#6B7280', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', cursor: inviteActing === invite.id ? 'not-allowed' : 'pointer', opacity: inviteActing === invite.id ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        >
                          <X size={13} /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: chat view (hidden on invites sub-tab) */}
            <div style={{ flex: 1, display: msgSubTab === 'invites' ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F9FAFB' }}>
              {selectedConv ? (
                <>
                  <div style={{ padding: '14px 24px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <Avatar name={selectedConv.partnerName} size={36} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{selectedConv.partnerName}</span>
                        {selectedConv.partnerDeleted && (
                          <span style={{ background: '#F3F4F6', color: '#6B7280', fontSize: '11px', padding: '2px 8px', borderRadius: '20px' }}>Account removed</span>
                        )}
                      </div>
                      {selectedConv.partnerRole && (
                        <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{selectedConv.partnerRole}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {messages.map(msg => {
                      const isMine = msg.from_user_id === internalUserId
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '68%', padding: '9px 14px',
                            borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: isMine ? ACCENT : '#FFFFFF',
                            color: isMine ? '#fff' : '#111827',
                            fontSize: '0.875rem', boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          }}>
                            {msg.content}
                            <div style={{ fontSize: '0.7rem', marginTop: 4, opacity: 0.7, textAlign: 'right' }}>
                              {formatTime(msg.created_at)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  <div style={{ padding: '12px 24px', background: '#FFFFFF', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 10, flexShrink: 0 }}>
                    <input
                      value={msgInput}
                      onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !selectedConv.partnerDeleted) { e.preventDefault(); handleSendMessage() } }}
                      placeholder={selectedConv.partnerDeleted ? "This user's account no longer exists." : 'Type a message...'}
                      disabled={selectedConv.partnerDeleted}
                      style={{ flex: 1, padding: '9px 14px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: selectedConv.partnerDeleted ? '#F9FAFB' : undefined, color: selectedConv.partnerDeleted ? '#9CA3AF' : undefined, cursor: selectedConv.partnerDeleted ? 'not-allowed' : undefined }}
                    />
                    {!selectedConv.partnerDeleted && (
                      <button
                        onClick={handleSendMessage}
                        disabled={sendingMsg || !msgInput.trim()}
                        style={{ padding: '9px 18px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.875rem', opacity: sendingMsg || !msgInput.trim() ? 0.6 : 1 }}
                      >
                        <Send size={15} /> Send
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', gap: 8 }}>
                  <MessageSquare size={32} strokeWidth={1.5} />
                  <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Select a conversation to start messaging</div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Invite flash toasts */}
      {inviteFlashes.length > 0 && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 200 }}>
          {inviteFlashes.map(f => (
            <div key={f.id} style={{ background: '#111827', color: '#fff', padding: '12px 18px', borderRadius: 10, fontSize: '0.875rem', fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={14} color="#10B981" />
              {f.message}
            </div>
          ))}
        </div>
      )}

      {/* Delete Announcement Confirmation */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: '0 0 8px' }}>Delete Announcement</h3>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 20px', lineHeight: 1.55 }}>
              Are you sure you want to delete this announcement? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirmId(null)} disabled={deleting} style={{ flex: 1, padding: '9px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', color: '#6B7280', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDeleteAnnouncement(deleteConfirmId)} disabled={deleting} style={{ flex: 1, padding: '9px', background: '#DC2626', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.65 : 1 }}>
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
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Title *</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Announcement title" style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Content *</label>
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Write your announcement..." rows={5} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Audience</label>
                <select value={editAudience} onChange={e => { setEditAudience(e.target.value); if (e.target.value === 'company-wide') setEditDeptId(null); else if (departments.length > 0) setEditDeptId(departments[0].id) }} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: '#fff' }}>
                  <option value="company-wide">Company-wide</option>
                  <option value="specific-dept">Specific Department</option>
                </select>
              </div>
              {editAudience === 'specific-dept' && (
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Department</label>
                  <select value={editDeptId ?? ''} onChange={e => setEditDeptId(e.target.value)} disabled={departments.length === 0} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: '#fff', opacity: departments.length === 0 ? 0.6 : 1 }}>
                    {departments.length === 0 ? <option value="">No departments available</option> : departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              {editError && <div style={{ fontSize: '0.8125rem', color: '#DC2626', background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{editError}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowEditModal(false)} disabled={saving} style={{ flex: 1, padding: '9px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', color: '#6B7280', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving || !editTitle.trim() || !editContent.trim()} style={{ flex: 1, padding: '9px', background: ACCENT, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', color: '#fff', cursor: saving || !editTitle.trim() || !editContent.trim() ? 'not-allowed' : 'pointer', opacity: saving || !editTitle.trim() || !editContent.trim() ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Announcement Modal */}
      {showNewAnnModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>New Announcement</h3>
              <button onClick={() => setShowNewAnnModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Title *</label>
                <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Announcement title" style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Content *</label>
                <textarea value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Write your announcement..." rows={5} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Audience</label>
                <select value={annDeptId} onChange={e => setAnnDeptId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: '#fff' }}>
                  {canPostCompanyWide && <option value="company-wide">Company-wide</option>}
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <button onClick={handlePostAnnouncement} disabled={posting || !annTitle.trim() || !annContent.trim()} style={{ padding: '10px 0', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', opacity: posting || !annTitle.trim() || !annContent.trim() ? 0.6 : 1 }}>
                {posting ? 'Posting...' : 'Post Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose Message Modal */}
      {composeOpen && (
        <div
          onClick={() => { if (!composeSending) setComposeOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 460, background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>New Message</h2>
              <button onClick={() => setComposeOpen(false)} disabled={composeSending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</p>
                {selectedRecipient ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: ACCENT_LIGHT, border: `1.5px solid ${ACCENT}33`, borderRadius: 10 }}>
                    <Avatar name={selectedRecipient.full_name} size={32} color={ROLE_COLOR[selectedRecipient.role] ?? ACCENT} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0 }}>{selectedRecipient.full_name}</p>
                      <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: 0 }}>{ROLE_LABEL[selectedRecipient.role] ?? selectedRecipient.role}</p>
                    </div>
                    <button onClick={() => setSelectedRecipient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 2 }}><X size={15} /></button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 9, padding: '8px 12px', marginBottom: 8 }}>
                      <Search size={14} color="#9CA3AF" />
                      <input autoFocus value={composeSearch} onChange={e => setComposeSearch(e.target.value)} placeholder="Search people…" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', color: '#374151' }} />
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {filteredMembers.length === 0 ? (
                        <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', padding: '12px 0', margin: 0 }}>No people found</p>
                      ) : filteredMembers.map(m => {
                        const roleColor = ROLE_COLOR[m.role] ?? '#9CA3AF'
                        return (
                          <button key={m.id} onClick={() => setSelectedRecipient(m)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: 'none', border: '1px solid transparent', borderRadius: 9, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.1s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#E5E7EB' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
                          >
                            <Avatar name={m.full_name} size={34} color={roleColor} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</p>
                              <p style={{ fontSize: '0.75rem', margin: 0, color: roleColor, fontWeight: 500 }}>{ROLE_LABEL[m.role] ?? m.role}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {selectedRecipient && (
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#374151', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Message</p>
                  <textarea autoFocus value={composeText} onChange={e => setComposeText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && composeText.trim()) { e.preventDefault(); handleComposeSend() } }}
                    placeholder="Type your message…" rows={4}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 9, fontSize: '0.9375rem', color: '#111827', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                </div>
              )}

              {composeError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>
                  {composeError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 24px', borderTop: '1px solid #F3F4F6' }}>
              <button onClick={() => setComposeOpen(false)} disabled={composeSending} style={{ flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 9, fontWeight: 600, fontSize: '0.9rem', color: '#6B7280', cursor: composeSending ? 'not-allowed' : 'pointer' }}>Cancel</button>
              <button onClick={handleComposeSend} disabled={composeSending || !selectedRecipient || !composeText.trim()}
                style={{ flex: 1, padding: '10px', background: ACCENT, border: 'none', borderRadius: 9, fontWeight: 600, fontSize: '0.9rem', color: '#fff', cursor: (composeSending || !selectedRecipient || !composeText.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: (composeSending || !selectedRecipient || !composeText.trim()) ? 0.55 : 1, transition: 'opacity 0.15s' }}
              >
                {composeSending
                  ? <svg className="animate-spin" width={15} height={15} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
                  : <Send size={14} />
                }
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
