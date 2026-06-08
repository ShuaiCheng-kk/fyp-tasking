'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import { createClient } from '@/lib/supabase'
import {
  Plus, X, Trash2, Pencil, Megaphone,
  Send, Search, SquarePen, Check, Bell, MessageSquare, Crown,
} from 'lucide-react'

const ACCENT = '#F97316'
const ACCENT_LIGHT = '#FFF7ED'
const PAGE_BG = '#EEF2F7'
const PANEL = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT = '#0F172A'
const MUTED = '#64748B'
const SOFT = '#F8FAFC'

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
  const [ownerName, setOwnerName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')
  const [userRole, setUserRole] = useState('')
  const [userDeptId, setUserDeptId] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [unreadMessages, setUnreadMessages] = useState(0)

  // ── Announcements state ──
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [annSearch, setAnnSearch] = useState('')

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

  // Deep-link state: set from URL params on mount
  const [pendingPartnerId, setPendingPartnerId] = useState<string | null>(null)
  const [pendingPrefill, setPendingPrefill] = useState('')
  const [conversationsFetched, setConversationsFetched] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // ── Read deep-link params once on mount ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('partner_id')
    const pre = params.get('prefill') ?? ''
    if (pid) {
      setPendingPartnerId(pid)
      setPendingPrefill(pre)
      setActiveTab('messages')
      setMsgSubTab('messages')
    }
  }, [])

  // ── Auth init ──
  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${uid}`)
    setAuthUserId(uid)
    setCompanyId(cid)
    if (cid) {
      const stored = localStorage.getItem(`tasking_last_company_name_${cid}`)
      if (stored) setCompanyName(stored)
    }
    if (uid) {
      fetch(`/api/user/me?user_id=${uid}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setInternalUserId(d.user.id)
            setUserRole(d.user.role ?? '')
            setUserDeptId(d.user.department_id ?? null)
            if (d.user?.full_name) setOwnerName(d.user.full_name)
            if (cid) setReadIds(loadReadIds(cid, d.user.id))
          }
        })
    }
  }, [])

  // ── Departments + plan ──
  useEffect(() => {
    if (!companyId) return
    fetch(`/api/company/departments?company_id=${companyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setDepartments(d.departments ?? []) })
      .catch(() => {})
    const uid = localStorage.getItem('tasking_user_id')
    if (uid) {
      fetch(`/api/company/current?user_id=${uid}&company_id=${companyId}`)
        .then(r => r.json())
        .then(d => { if (d.success) setCurrentPlan(d.company?.plan ?? 'Free') })
        .catch(() => {})
    }
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
      .then(d => {
        if (d.success) {
          setConversations(d.conversations ?? [])
          setConversationsFetched(true)
        }
      })
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

  // ── Apply deep-link once conversations are loaded ──
  useEffect(() => {
    if (!pendingPartnerId || !internalUserId || !conversationsFetched || !companyId) return

    const pid = pendingPartnerId
    const pre = pendingPrefill

    // Clear immediately so this effect doesn't re-fire
    setPendingPartnerId(null)
    setPendingPrefill('')
    window.history.replaceState({}, '', '/owner/communication')

    const found = conversations.find(c => c.partnerId === pid)
    if (found) {
      setSelectedConv(found)
      if (pre) setMsgInput(pre)
    } else {
      // No prior conversation — open compose with recipient pre-selected
      fetch(`/api/team/members?company_id=${companyId}`)
        .then(r => r.json())
        .then(d => {
          if (!d.success) return
          const eligible = (d.members as CompanyMember[]).filter(
            m => m.role !== 'Casual Worker' && m.id !== internalUserId
          )
          setCompanyMembers(eligible)
          const partner = eligible.find(m => m.id === pid)
          if (partner) {
            setSelectedRecipient(partner)
            setComposeText(pre)
            setComposeOpen(true)
            setComposeSearch('')
            setComposeError('')
          }
        })
    }
  }, [pendingPartnerId, conversations, internalUserId, conversationsFetched, companyId, pendingPrefill])

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
      setAnnouncements(prev => prev.filter(a => a.id !== announcementId))
      setSelectedAnn(prev => prev?.id === announcementId ? null : prev)
      setDeleteConfirmId(null)
      const res = await fetch('/api/inbox/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement_id: announcementId, requesting_user_id: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
    } catch {
      fetchAnnouncements()
    }
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
  const communicationReady = Boolean(internalUserId && companyId)

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

  const filteredAnnouncements = annSearch
    ? announcements.filter(ann =>
        ann.title.toLowerCase().includes(annSearch.toLowerCase()) ||
        ann.content.toLowerCase().includes(annSearch.toLowerCase()) ||
        (ann.created_by_name ?? '').toLowerCase().includes(annSearch.toLowerCase()),
      )
    : announcements

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: PAGE_BG, color: TEXT, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <OwnerSidebar unreadMessages={unreadMessages} unreadAnnouncements={unreadAnnCount} />

      <main style={{ marginLeft: '64px', flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 28px 24px' }}>

        {/* Page header — matches Dashboard style */}
        <div style={{ padding: '0 0 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              {companyName ? `Communication for ${companyName}` : 'Communication'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {ownerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#0F172A', color: '#FFFFFF', flexShrink: 0 }}>
                  <Crown size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ownerName}</span>
              </div>
            )}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 45px rgba(15,23,42,0.06)' }}>
        {/* Top-level tabs */}
        <div style={{ height: 66, padding: '0 18px', flexShrink: 0, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['announcements', 'messages'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                height: 40,
                padding: '0 15px',
                background: activeTab === tab ? ACCENT_LIGHT : PANEL,
                border: activeTab === tab ? `1px solid ${ACCENT}55` : `1px solid ${BORDER}`,
                borderRadius: 12,
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: 13,
                color: activeTab === tab ? ACCENT : MUTED,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'transform 0.16s ease, border-color 0.16s ease, background 0.16s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {tab === 'announcements' ? <Megaphone size={14} /> : <MessageSquare size={14} />}
              {tab === 'announcements' ? 'Announcements' : 'Messages'}
              {tab === 'announcements' && unreadAnnCount > 0 && (
                <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: ACCENT, color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadAnnCount}
                </span>
              )}
              {tab === 'messages' && unreadMessages > 0 && (
                <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: ACCENT, color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadMessages}
                </span>
              )}
            </button>
          ))}
          </div>
          <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>
            {activeTab === 'announcements' ? `${announcements.length} announcements` : `${filteredConversations.length} conversations`}
          </div>
        </div>

        {/* ── Announcements tab ── */}
        {activeTab === 'announcements' && (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', overflow: 'hidden', background: SOFT }}>
            {/* Left: list */}
            <div style={{ minHeight: 0, background: PANEL, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: 16, borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inbox</div>
                  <div style={{ marginTop: 3, fontSize: 18, fontWeight: 900, color: TEXT }}>All Announcements</div>
                </div>
                <button
                  onClick={() => setShowNewAnnModal(true)}
                  style={{ height: 36, display: 'flex', alignItems: 'center', gap: 5, padding: '0 13px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
                >
                  <Plus size={14} /> New
                </button>
              </div>

              <div style={{ padding: 14, borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ height: 38, display: 'flex', alignItems: 'center', gap: 8, background: SOFT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0 12px' }}>
                  <Search size={15} color="#94A3B8" />
                  <input
                    value={annSearch}
                    onChange={e => setAnnSearch(e.target.value)}
                    placeholder="Search announcements..."
                    style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: TEXT, fontWeight: 600 }}
                  />
                </div>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: 12 }}>
                {filteredAnnouncements.length === 0 ? (
                  <div style={{ height: 180, borderRadius: 14, background: SOFT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 700 }}>
                    <Megaphone size={28} strokeWidth={1.6} />
                    {annSearch ? 'No matching announcements' : 'No announcements yet'}
                  </div>
                ) : filteredAnnouncements.map(ann => {
                  const unread = !readIds.has(ann.id)
                  const selected = selectedAnn?.id === ann.id
                  return (
                    <button
                      key={ann.id}
                      onClick={() => handleSelectAnn(ann)}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 6, padding: 14,
                        background: selected ? ACCENT_LIGHT : PANEL,
                        border: selected ? `1px solid ${ACCENT}55` : `1px solid ${BORDER}`,
                        borderRadius: 14,
                        cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 10,
                        boxShadow: selected ? '0 10px 22px rgba(249,115,22,0.10)' : '0 1px 0 rgba(15,23,42,0.02)',
                        transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(15,23,42,0.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = selected ? '0 10px 22px rgba(249,115,22,0.10)' : '0 1px 0 rgba(15,23,42,0.02)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 999, background: unread ? ACCENT : '#CBD5E1', flexShrink: 0 }} />
                        <span style={{ fontWeight: unread ? 900 : 800, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {ann.title}
                        </span>
                        {ann.from_user_id !== internalUserId && ann.created_by_name && (
                          <span style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 700 }}>{ann.created_by_name}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 800 }}>{formatTime(ann.created_at)}</span>
                        <span style={{ fontSize: 11, background: ann.department_id ? '#EFF6FF' : '#F1F5F9', color: ann.department_id ? '#2563EB' : MUTED, padding: '3px 9px', borderRadius: 999, fontWeight: 800 }}>
                          {ann.department_id ? (departments.find(d => d.id === ann.department_id)?.name ?? 'Dept') : 'Company-wide'}
                        </span>
                      </div>
                      <div style={{ display: 'none' }}>
                        {ann.content.slice(0, 60)}{ann.content.length > 60 ? '…' : ''}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right: detail */}
            <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: SOFT }}>
              {selectedAnn ? (
                <>
                  <div style={{ flexShrink: 0, background: PANEL, borderBottom: `1px solid ${BORDER}`, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 14, background: ACCENT_LIGHT, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Megaphone size={20} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: 0, color: TEXT, fontSize: 21, lineHeight: 1.2, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedAnn.title}</h2>
                        <div style={{ marginTop: 5, color: MUTED, fontSize: 12, fontWeight: 700 }}>
                          {selectedAnn.created_by_name ?? 'Owner'} / {new Date(selectedAnn.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                        <span style={{ height: 32, padding: '0 11px', borderRadius: 999, background: selectedAnn.department_id ? '#EFF6FF' : '#F1F5F9', color: selectedAnn.department_id ? '#2563EB' : MUTED, fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center' }}>
                          {selectedAnn.department_id ? (departments.find(d => d.id === selectedAnn.department_id)?.name ?? 'Department') : 'Company-wide'}
                        </span>
                        {selectedAnn.from_user_id === internalUserId && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(selectedAnn)}
                              title="Edit announcement"
                              style={{ width: 36, height: 36, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, cursor: 'pointer', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(selectedAnn.id)}
                              title="Delete announcement"
                              style={{ width: 36, height: 36, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 28 }}>
                    <article style={{ maxWidth: 760, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 30, boxShadow: '0 14px 35px rgba(15,23,42,0.06)' }}>
                      <p style={{ margin: 0, color: '#334155', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{selectedAnn.content}</p>
                    </article>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <div style={{ width: 360, minHeight: 180, borderRadius: 18, background: PANEL, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 10, boxShadow: '0 12px 30px rgba(15,23,42,0.04)' }}>
                    <Megaphone size={34} strokeWidth={1.6} />
                    <div style={{ color: MUTED, fontWeight: 800 }}>Select an announcement to read</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Messages tab ── */}
        {activeTab === 'messages' && (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', overflow: 'hidden', background: SOFT }}>
            {/* Left: conversation list */}
            <div style={{ minHeight: 0, background: PANEL, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              {/* Sub-tabs: Messages / Invitations */}
              <div style={{ padding: 16, borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => setMsgSubTab('messages')}
                  style={{
                    flex: 1, height: 38, background: msgSubTab === 'messages' ? ACCENT_LIGHT : PANEL, border: msgSubTab === 'messages' ? `1px solid ${ACCENT}55` : `1px solid ${BORDER}`, borderRadius: 10, cursor: 'pointer',
                    fontWeight: 900, fontSize: 12,
                    color: msgSubTab === 'messages' ? ACCENT : MUTED,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <MessageSquare size={14} /> Chats
                </button>
                <button
                  onClick={() => setMsgSubTab('invites')}
                  style={{
                    flex: 1, height: 38, background: msgSubTab === 'invites' ? ACCENT_LIGHT : PANEL, border: msgSubTab === 'invites' ? `1px solid ${ACCENT}55` : `1px solid ${BORDER}`, borderRadius: 10, cursor: 'pointer',
                    fontWeight: 900, fontSize: 12,
                    color: msgSubTab === 'invites' ? ACCENT : MUTED,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    position: 'relative',
                  }}
                >
                  <Bell size={14} /> Invites {invites.length > 0 ? `(${invites.length})` : ''}
                </button>
                </div>

                {msgSubTab === 'messages' && (
                  <>
                    <button
                      onClick={openCompose}
                      data-testid="new-message-btn"
                      disabled={!communicationReady}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, width: '100%', height: 38,
                        background: ACCENT, border: 'none', borderRadius: 10,
                        color: '#fff', fontWeight: 900, fontSize: 13,
                        cursor: communicationReady ? 'pointer' : 'not-allowed',
                        justifyContent: 'center', opacity: communicationReady ? 1 : 0.6,
                        marginBottom: 12,
                      }}
                    >
                      <SquarePen size={15} strokeWidth={2.5} /> New Message
                    </button>

                    <div style={{ height: 38, display: 'flex', alignItems: 'center', gap: 8, background: SOFT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0 12px' }}>
                      <Search size={15} color="#94A3B8" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search conversations..."
                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: TEXT, fontWeight: 600 }}
                      />
                    </div>
                  </>
                )}
              </div>

              {msgSubTab === 'messages' ? (
                <>
                  <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: 12 }}>
                    {filteredConversations.length === 0 ? (
                      <div style={{ height: 180, borderRadius: 14, background: SOFT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 700 }}>
                        <MessageSquare size={28} strokeWidth={1.6} />
                        {search ? 'No results' : 'No conversations yet'}
                      </div>
                    ) : filteredConversations.map(conv => (
                      <button
                        key={conv.partnerId}
                        onClick={() => setSelectedConv(conv)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 11, padding: 13,
                          background: selectedConv?.partnerId === conv.partnerId ? ACCENT_LIGHT : PANEL,
                          border: selectedConv?.partnerId === conv.partnerId ? `1px solid ${ACCENT}55` : `1px solid ${BORDER}`,
                          borderRadius: 14,
                          cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 10,
                          boxShadow: selectedConv?.partnerId === conv.partnerId ? '0 10px 22px rgba(249,115,22,0.10)' : '0 1px 0 rgba(15,23,42,0.02)',
                          transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(15,23,42,0.08)' }}
                        onMouseLeave={e => {
                          const selected = selectedConv?.partnerId === conv.partnerId
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = selected ? '0 10px 22px rgba(249,115,22,0.10)' : '0 1px 0 rgba(15,23,42,0.02)'
                        }}
                      >
                        <Avatar name={conv.partnerName} size={40} />
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
            <div style={{ minWidth: 0, minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: SOFT }}>
              {msgSubTab === 'invites' ? (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <div style={{ width: 360, minHeight: 180, borderRadius: 18, background: PANEL, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 10, boxShadow: '0 12px 30px rgba(15,23,42,0.04)' }}>
                    <Bell size={34} strokeWidth={1.6} />
                    <div style={{ color: MUTED, fontWeight: 800 }}>Review invitations from the left panel</div>
                  </div>
                </div>
              ) : selectedConv ? (
                <>
                  <div style={{ padding: '16px 24px', background: PANEL, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <Avatar name={selectedConv.partnerName} size={42} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 900, fontSize: 17, color: TEXT }}>{selectedConv.partnerName}</span>
                        {selectedConv.partnerDeleted && (
                          <span style={{ background: '#F1F5F9', color: MUTED, fontSize: 11, padding: '3px 8px', borderRadius: 999, fontWeight: 800 }}>Account removed</span>
                        )}
                      </div>
                      {selectedConv.partnerRole && (
                        <div style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{selectedConv.partnerRole}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {messages.map(msg => {
                      const isMine = msg.from_user_id === internalUserId
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '68%', padding: '9px 14px',
                            borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: isMine ? '#DBEAFE' : '#F3E8FF',
                            color: TEXT,
                            fontSize: 13, fontWeight: 600, lineHeight: 1.45, boxShadow: '0 4px 12px rgba(15,23,42,0.05)',
                          }}>
                            {msg.content}
                            <div style={{ fontSize: 11, marginTop: 5, color: MUTED, fontWeight: 700, textAlign: isMine ? 'right' : 'left' }}>
                              {formatTime(msg.created_at)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  <div style={{ padding: '14px 24px', background: PANEL, borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <input
                      value={msgInput}
                      onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !selectedConv.partnerDeleted) { e.preventDefault(); handleSendMessage() } }}
                      placeholder={selectedConv.partnerDeleted ? "This user's account no longer exists." : 'Type a message...'}
                      disabled={selectedConv.partnerDeleted}
                      style={{ flex: 1, height: 42, padding: '0 14px', border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 13, fontWeight: 600, outline: 'none', background: selectedConv.partnerDeleted ? SOFT : PANEL, color: selectedConv.partnerDeleted ? '#94A3B8' : TEXT, cursor: selectedConv.partnerDeleted ? 'not-allowed' : undefined }}
                    />
                    {!selectedConv.partnerDeleted && (
                      <button
                        onClick={handleSendMessage}
                        disabled={sendingMsg || !msgInput.trim()}
                        style={{ height: 42, padding: '0 17px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 12, cursor: sendingMsg || !msgInput.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontWeight: 900, fontSize: 13, opacity: sendingMsg || !msgInput.trim() ? 0.6 : 1 }}
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
        </section>
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
                <textarea data-testid="announcement-content" value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Write your announcement here..." rows={5} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Audience</label>
                <select value={annDeptId} onChange={e => setAnnDeptId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: '#fff' }}>
                  {canPostCompanyWide && <option value="company-wide">Company-wide</option>}
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <button onClick={handlePostAnnouncement} disabled={!communicationReady || posting || !annTitle.trim() || !annContent.trim()} style={{ padding: '10px 0', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9375rem', cursor: communicationReady ? 'pointer' : 'not-allowed', opacity: !communicationReady || posting || !annTitle.trim() || !annContent.trim() ? 0.6 : 1 }}>
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
