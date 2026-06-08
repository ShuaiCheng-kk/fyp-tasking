'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import { createClient } from '@/lib/supabase'
import {
  Plus, X, Trash2, Pencil, Megaphone,
  Send, Search, SquarePen, Check, Bell, MessageSquare, Crown,
  Users, Globe,
} from 'lucide-react'

// ─── Shared types ─────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  Owner: '#8B5CF6',
  Partner: '#8B5CF6',
  Manager: '#3B82F6',
  Employee: '#10B981',
}

const ROLE_BG: Record<string, string> = {
  Owner: '#F5F3FF',
  Partner: '#F5F3FF',
  Manager: '#EFF6FF',
  Employee: '#ECFDF5',
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

function hashColor(name: string): string {
  const palette = ['#F97316', '#8B5CF6', '#3B82F6', '#10B981', '#EC4899', '#0EA5E9', '#D97706', '#6366F1']
  let h = 5381
  for (let i = 0; i < name.length; i++) h = (h << 5) + h + name.charCodeAt(i)
  return palette[Math.abs(h) % palette.length]
}

function Avatar({ name, size = 36, role }: { name: string; size?: number; role?: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const color = role ? (ROLE_COLOR[role] ?? hashColor(name)) : hashColor(name)
  const bg = role ? (ROLE_BG[role] ?? `${color}18`) : `${color}18`
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      color, fontWeight: 800, fontSize: size * 0.36,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, letterSpacing: '-0.5px', border: `2px solid ${color}22`,
    }}>
      {initials}
    </div>
  )
}

function Spinner({ size = 15, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={light ? 'rgba(255,255,255,0.35)' : 'rgba(17,24,39,0.15)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={light ? 'white' : '#111827'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerCommunicationPage() {
  const [activeTab, setActiveTab] = useState<'announcements' | 'messages'>('announcements')

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

  const [pendingPartnerId, setPendingPartnerId] = useState<string | null>(null)
  const [pendingPrefill, setPendingPrefill] = useState('')
  const [conversationsFetched, setConversationsFetched] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

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

  const fetchUnreadCount = useCallback(() => {
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
    fetchUnreadCount()
  }, [internalUserId, companyId, userRole, fetchAnnouncements, fetchUnreadCount])

  useEffect(() => {
    if (!companyId) return
    const channel = supabase
      .channel('owner-comm-announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements', filter: `company_id=eq.${companyId}` },
        () => fetchAnnouncements())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId, userRole, userDeptId])

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

  useEffect(() => {
    if (!pendingPartnerId || !internalUserId || !conversationsFetched || !companyId) return
    const pid = pendingPartnerId
    const pre = pendingPrefill
    setPendingPartnerId(null)
    setPendingPrefill('')
    window.history.replaceState({}, '', '/owner/communication')
    const found = conversations.find(c => c.partnerId === pid)
    if (found) {
      setSelectedConv(found)
      if (pre) setMsgInput(pre)
    } else {
      fetch(`/api/team/members?company_id=${companyId}`)
        .then(r => r.json())
        .then(d => {
          if (!d.success) return
          const eligible = (d.members as CompanyMember[]).filter(m => m.role !== 'Casual Worker' && m.id !== internalUserId)
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

  useEffect(() => {
    if (!internalUserId) return
    const channel = supabase
      .channel('owner-comm-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user_id=eq.${internalUserId}` },
        (payload) => {
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
          from_user_id: internalUserId, company_id: companyId,
          department_id: annDeptId === 'company-wide' ? null : annDeptId,
          title: annTitle, content: annContent, user_role: userRole,
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
    } finally { setPosting(false) }
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
    } catch { fetchAnnouncements() }
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
          announcement_id: selectedAnn.id, requesting_user_id: internalUserId,
          title: editTitle, content: editContent, department_id: deptId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed to save')
      setShowEditModal(false)
      fetchAnnouncements()
      setSelectedAnn(prev => prev ? { ...prev, title: editTitle, content: editContent, department_id: deptId } : prev)
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'An error occurred')
    } finally { setSaving(false) }
  }

  const canPostCompanyWide = ['owner', 'partner'].includes(userRole?.toLowerCase())
  const communicationReady = Boolean(internalUserId && companyId)

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
          setCompanyMembers((d.members as CompanyMember[]).filter(m => m.role !== 'Casual Worker' && m.id !== internalUserId))
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
    } finally { setInviteActing(null) }
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
    } finally { setInviteActing(null) }
  }

  async function handleComposeSend() {
    if (!selectedRecipient || !composeText.trim() || !internalUserId || !companyId) return
    setComposeSending(true)
    setComposeError('')
    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: internalUserId, to_user_id: selectedRecipient.id, company_id: companyId, content: composeText.trim() }),
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
    } finally { setComposeSending(false) }
  }

  async function handleSendMessage() {
    if (!msgInput.trim() || !selectedConv || !internalUserId || !companyId) return
    setSendingMsg(true)
    const optimistic: Message = {
      id: `tmp-${Date.now()}`, from_user_id: internalUserId, to_user_id: selectedConv.partnerId,
      content: msgInput.trim(), created_at: new Date().toISOString(), is_read: false,
    }
    setMessages(prev => [...prev, optimistic])
    const content = msgInput.trim()
    setMsgInput('')
    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: internalUserId, to_user_id: selectedConv.partnerId, company_id: companyId, content }),
      })
      const data = await res.json()
      if (data.success) {
        setMessages(prev => prev.map(m => m.id === optimistic.id ? data.message : m))
        fetchConversations()
      }
    } finally { setSendingMsg(false) }
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
    <div style={{ display: 'flex', height: '100vh', background: '#F1F5F9', color: '#0F172A', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes msgPop {
          from { opacity: 0; transform: scale(0.92) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .comm-ann-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          animation: fadeSlideUp 0.28s ease both;
        }
        .comm-ann-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(15,23,42,0.09) !important;
        }
        .comm-conv-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          animation: fadeSlideUp 0.28s ease both;
        }
        .comm-conv-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(15,23,42,0.09) !important;
        }
        .comm-msg-bubble {
          animation: msgPop 0.2s ease both;
        }
        .comm-tab-btn {
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .comm-tab-btn:hover { transform: translateY(-1px); }
        .comm-input:focus {
          border-color: #F97316 !important;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.10) !important;
        }
        .comm-textarea:focus {
          border-color: #F97316 !important;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.10) !important;
        }
      `}</style>

      <OwnerSidebar unreadMessages={unreadMessages} unreadAnnouncements={unreadAnnCount} />

      <main style={{ marginLeft: '64px', flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 28px 24px' }}>

        {/* Page header */}
        <div style={{ paddingBottom: 16, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
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

        {/* Stats chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexShrink: 0, animation: 'fadeSlideUp 0.3s ease both 0.05s' }}>
          {[
            { icon: <Megaphone size={12} />, label: `${announcements.length} announcements`, accent: '#F97316', bg: '#FFF7ED' },
            { icon: <Bell size={12} />, label: `${unreadAnnCount} unread`, accent: '#EF4444', bg: '#FEF2F2' },
            { icon: <MessageSquare size={12} />, label: `${filteredConversations.length} conversations`, accent: '#3B82F6', bg: '#EFF6FF' },
            { icon: <Users size={12} />, label: `${invites.length} pending invites`, accent: '#10B981', bg: '#ECFDF5' },
          ].map(item => (
            <div key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 999, background: item.bg, color: item.accent, fontSize: 11, fontWeight: 700, border: `1px solid ${item.accent}22` }}>
              {item.icon}
              {item.label}
            </div>
          ))}
        </div>

        {/* Main communication panel */}
        <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)' }}>

          {/* Top-level tabs */}
          <div style={{ height: 60, padding: '0 18px', flexShrink: 0, borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {(['announcements', 'messages'] as const).map(tab => {
                const active = activeTab === tab
                const badge = tab === 'announcements' ? unreadAnnCount : unreadMessages
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="comm-tab-btn"
                    style={{
                      height: 38, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                      background: active ? '#FFF7ED' : '#F8FAFC',
                      border: active ? '1.5px solid rgba(249,115,22,0.35)' : '1.5px solid #E2E8F0',
                      color: active ? '#F97316' : '#64748B',
                      display: 'flex', alignItems: 'center', gap: 7,
                    }}
                  >
                    {tab === 'announcements' ? <Megaphone size={14} /> : <MessageSquare size={14} />}
                    {tab === 'announcements' ? 'Announcements' : 'Messages'}
                    {badge > 0 && (
                      <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#F97316', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>
              {activeTab === 'announcements' ? `${filteredAnnouncements.length} total` : `${filteredConversations.length} conversations`}
            </span>
          </div>

          {/* ── Announcements tab ── */}
          {activeTab === 'announcements' && (
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', overflow: 'hidden' }}>

              {/* Left: list */}
              <div style={{ minHeight: 0, borderRight: '1px solid #EDF2F7', display: 'flex', flexDirection: 'column', background: '#FAFBFC' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0, background: '#FFFFFF' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Inbox</p>
                    <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>All Announcements</p>
                  </div>
                  <button
                    onClick={() => setShowNewAnnModal(true)}
                    style={{ height: 34, display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <Plus size={13} /> New
                  </button>
                </div>

                <div style={{ padding: '10px 12px', borderBottom: '1px solid #EDF2F7', background: '#FFFFFF', flexShrink: 0 }}>
                  <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '0 11px' }}>
                    <Search size={13} color="#94A3B8" />
                    <input
                      value={annSearch}
                      onChange={e => setAnnSearch(e.target.value)}
                      placeholder="Search announcements..."
                      style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: '#0F172A', fontWeight: 500 }}
                    />
                  </div>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: 10 }}>
                  {filteredAnnouncements.length === 0 ? (
                    <div style={{ height: 180, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
                      <Megaphone size={26} strokeWidth={1.5} />
                      {annSearch ? 'No matching announcements' : 'No announcements yet'}
                    </div>
                  ) : filteredAnnouncements.map((ann, i) => {
                    const unread = !readIds.has(ann.id)
                    const selected = selectedAnn?.id === ann.id
                    const deptName = ann.department_id ? (departments.find(d => d.id === ann.department_id)?.name ?? 'Dept') : null
                    return (
                      <button
                        key={ann.id}
                        onClick={() => handleSelectAnn(ann)}
                        className="comm-ann-card"
                        style={{
                          display: 'flex', flexDirection: 'column', gap: 6, padding: 12,
                          background: selected ? '#FFF7ED' : '#FFFFFF',
                          border: selected ? '1.5px solid rgba(249,115,22,0.35)' : '1.5px solid #EDF2F7',
                          borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 8,
                          boxShadow: selected ? '0 6px 18px rgba(249,115,22,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                          animationDelay: `${i * 0.04}s`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 999, background: unread ? '#F97316' : '#CBD5E1', flexShrink: 0 }} />
                          <span style={{ fontWeight: unread ? 800 : 600, fontSize: 13, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {ann.title}
                          </span>
                          <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}>{formatTime(ann.created_at)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11.5, color: '#64748B', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {ann.content}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {ann.created_by_name && (
                            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{ann.created_by_name}</span>
                          )}
                          <div style={{ flex: 1 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 3, background: deptName ? '#EFF6FF' : '#F1F5F9', color: deptName ? '#2563EB' : '#64748B' }}>
                            {deptName ? null : <Globe size={9} />}
                            {deptName ?? 'Company-wide'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right: detail */}
              <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F8FAFC' }}>
                {selectedAnn ? (
                  <>
                    <div style={{ flexShrink: 0, background: '#FFFFFF', borderBottom: '1px solid #EDF2F7', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFF7ED', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Megaphone size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h2 style={{ margin: 0, color: '#0F172A', fontSize: 19, lineHeight: 1.2, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedAnn.title}</h2>
                          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 12, fontWeight: 600 }}>
                            {selectedAnn.created_by_name ?? 'Owner'} · {new Date(selectedAnn.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ height: 28, padding: '0 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, background: selectedAnn.department_id ? '#EFF6FF' : '#F1F5F9', color: selectedAnn.department_id ? '#2563EB' : '#64748B' }}>
                          {selectedAnn.department_id ? null : <Globe size={10} />}
                          {selectedAnn.department_id ? (departments.find(d => d.id === selectedAnn.department_id)?.name ?? 'Department') : 'Company-wide'}
                        </span>
                        {selectedAnn.from_user_id === internalUserId && (
                          <>
                            <button onClick={() => handleOpenEdit(selectedAnn)} title="Edit"
                              style={{ width: 34, height: 34, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            ><Pencil size={14} /></button>
                            <button onClick={() => setDeleteConfirmId(selectedAnn.id)} title="Delete"
                              style={{ width: 34, height: 34, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            ><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 28 }}>
                      <article style={{ maxWidth: 760, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '28px 32px', boxShadow: '0 4px 20px rgba(15,23,42,0.05)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #F97316, #FB923C)' }} />
                        <p style={{ margin: 0, color: '#334155', fontSize: 14.5, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{selectedAnn.content}</p>
                      </article>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 18, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#F97316' }}>
                        <Megaphone size={24} strokeWidth={1.5} />
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Select an announcement to read</p>
                      <p style={{ margin: '5px 0 0', fontWeight: 500, fontSize: 12, color: '#CBD5E1' }}>Click any item in the list</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Messages tab ── */}
          {activeTab === 'messages' && (
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', overflow: 'hidden' }}>

              {/* Left: conversations */}
              <div style={{ minHeight: 0, borderRight: '1px solid #EDF2F7', display: 'flex', flexDirection: 'column', background: '#FAFBFC' }}>
                <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid #EDF2F7', background: '#FFFFFF', flexShrink: 0 }}>
                  {/* Sub-tabs */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {(['messages', 'invites'] as const).map(sub => (
                      <button key={sub} onClick={() => setMsgSubTab(sub)}
                        className="comm-tab-btn"
                        style={{
                          flex: 1, height: 34, borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 12,
                          background: msgSubTab === sub ? '#FFF7ED' : '#F8FAFC',
                          border: msgSubTab === sub ? '1.5px solid rgba(249,115,22,0.35)' : '1.5px solid #E2E8F0',
                          color: msgSubTab === sub ? '#F97316' : '#64748B',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        }}
                      >
                        {sub === 'messages' ? <MessageSquare size={12} /> : <Bell size={12} />}
                        {sub === 'messages' ? 'Chats' : `Invites${invites.length > 0 ? ` (${invites.length})` : ''}`}
                      </button>
                    ))}
                  </div>

                  {msgSubTab === 'messages' && (
                    <>
                      <button
                        onClick={openCompose}
                        data-testid="new-message-btn"
                        disabled={!communicationReady}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: 36, background: '#F97316', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 12, cursor: communicationReady ? 'pointer' : 'not-allowed', justifyContent: 'center', opacity: communicationReady ? 1 : 0.6, marginBottom: 8 }}
                      >
                        <SquarePen size={13} strokeWidth={2.5} /> New Message
                      </button>
                      <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 7, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '0 10px' }}>
                        <Search size={13} color="#94A3B8" />
                        <input
                          value={search} onChange={e => setSearch(e.target.value)}
                          placeholder="Search conversations..."
                          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: '#0F172A', fontWeight: 500 }}
                        />
                      </div>
                    </>
                  )}
                </div>

                {msgSubTab === 'messages' ? (
                  <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: 10 }}>
                    {filteredConversations.length === 0 ? (
                      <div style={{ height: 180, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
                        <MessageSquare size={26} strokeWidth={1.5} />
                        {search ? 'No results' : 'No conversations yet'}
                      </div>
                    ) : filteredConversations.map((conv, i) => {
                      const active = selectedConv?.partnerId === conv.partnerId
                      const roleColor = ROLE_COLOR[conv.partnerRole] ?? '#9CA3AF'
                      return (
                        <button
                          key={conv.partnerId}
                          onClick={() => setSelectedConv(conv)}
                          className="comm-conv-card"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: 11,
                            background: active ? '#FFF7ED' : '#FFFFFF',
                            border: active ? '1.5px solid rgba(249,115,22,0.35)' : '1.5px solid #EDF2F7',
                            borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 8,
                            boxShadow: active ? '0 6px 18px rgba(249,115,22,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                            animationDelay: `${i * 0.04}s`,
                          }}
                        >
                          <Avatar name={conv.partnerName} size={38} role={conv.partnerRole} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                                <span style={{ fontWeight: conv.unreadCount > 0 ? 800 : 600, fontSize: 13, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {conv.partnerName}
                                </span>
                                {conv.partnerDeleted && (
                                  <span style={{ background: '#F1F5F9', color: '#6B7280', fontSize: 10, padding: '1px 6px', borderRadius: 999, flexShrink: 0, fontWeight: 700 }}>removed</span>
                                )}
                              </div>
                              <span style={{ fontSize: 10.5, color: '#9CA3AF', flexShrink: 0, fontWeight: 600 }}>{formatTime(conv.lastTime)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: roleColor, background: `${roleColor}14`, padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>
                                {conv.partnerRole}
                              </span>
                              {conv.companyName && <span style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 500 }}>{conv.companyName}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                              <span style={{ fontSize: 12, color: conv.unreadCount > 0 ? '#0F172A' : '#94A3B8', fontWeight: conv.unreadCount > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {conv.lastMessage}
                              </span>
                              {conv.unreadCount > 0 && (
                                <div style={{ minWidth: 18, height: 18, borderRadius: 999, background: '#F97316', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>
                                  {conv.unreadCount}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: 10 }}>
                    {inviteLoading ? (
                      <div style={{ padding: 24, textAlign: 'center' }}><Spinner size={16} /></div>
                    ) : invites.length === 0 ? (
                      <div style={{ height: 160, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
                        <Bell size={24} strokeWidth={1.5} />
                        No pending invitations
                      </div>
                    ) : invites.map((invite, i) => (
                      <div key={invite.id} className="comm-ann-card" style={{ margin: '0 0 8px', padding: '14px', background: '#FFFFFF', border: '1.5px solid #EDF2F7', borderRadius: 12, animationDelay: `${i * 0.05}s` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FFF7ED', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Bell size={15} />
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: 12.5, color: '#0F172A', fontWeight: 700, lineHeight: 1.45 }}>
                              <span style={{ color: '#374151' }}>{invite.sender_name}</span> invited you to join{' '}
                              <span style={{ color: '#0F172A' }}>{invite.company_name}</span>
                            </p>
                            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                              As <span style={{ color: '#F97316', fontWeight: 700 }}>{invite.role}</span> · {formatTime(invite.created_at)}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleAcceptInvite(invite)} disabled={inviteActing === invite.id}
                            style={{ flex: 1, height: 32, background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: inviteActing === invite.id ? 'not-allowed' : 'pointer', opacity: inviteActing === invite.id ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          >
                            {inviteActing === invite.id ? <Spinner size={11} light /> : <Check size={12} />} Accept
                          </button>
                          <button onClick={() => handleDeclineInvite(invite)} disabled={inviteActing === invite.id}
                            style={{ flex: 1, height: 32, background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: inviteActing === invite.id ? 'not-allowed' : 'pointer', opacity: inviteActing === invite.id ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          >
                            <X size={12} /> Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: chat */}
              <div style={{ minWidth: 0, minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F8FAFC' }}>
                {msgSubTab === 'invites' ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 18, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#F97316' }}>
                        <Bell size={24} strokeWidth={1.5} />
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Review invitations from the list</p>
                    </div>
                  </div>
                ) : selectedConv ? (
                  <>
                    {/* Chat header */}
                    <div style={{ padding: '14px 22px', background: '#FFFFFF', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                      <Avatar name={selectedConv.partnerName} size={40} role={selectedConv.partnerRole} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>{selectedConv.partnerName}</span>
                          {selectedConv.partnerDeleted && (
                            <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>Account removed</span>
                          )}
                        </div>
                        {selectedConv.partnerRole && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLOR[selectedConv.partnerRole] ?? '#64748B', background: `${ROLE_COLOR[selectedConv.partnerRole] ?? '#64748B'}14`, padding: '1px 7px', borderRadius: 999 }}>
                              {selectedConv.partnerRole}
                            </span>
                            {selectedConv.companyName && <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{selectedConv.companyName}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {messages.map(msg => {
                        const isMine = msg.from_user_id === internalUserId
                        return (
                          <div key={msg.id} className="comm-msg-bubble" style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 7 }}>
                            {!isMine && <Avatar name={selectedConv.partnerName} size={26} role={selectedConv.partnerRole} />}
                            <div style={{
                              maxWidth: '66%', padding: '9px 13px',
                              borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              background: isMine ? '#DBEAFE' : '#FFFFFF',
                              border: isMine ? '1px solid #BFDBFE' : '1px solid #EDF2F7',
                              color: '#0F172A', fontSize: 13, fontWeight: 500, lineHeight: 1.5,
                              boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                            }}>
                              {msg.content}
                              <div style={{ fontSize: 10.5, marginTop: 4, color: '#94A3B8', fontWeight: 600, textAlign: isMine ? 'right' : 'left' }}>
                                {formatTime(msg.created_at)}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{ padding: '12px 20px', background: '#FFFFFF', borderTop: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <input
                        value={msgInput}
                        onChange={e => setMsgInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !selectedConv.partnerDeleted) { e.preventDefault(); handleSendMessage() } }}
                        placeholder={selectedConv.partnerDeleted ? "This user's account no longer exists." : 'Type a message…'}
                        disabled={selectedConv.partnerDeleted}
                        className="comm-input"
                        style={{ flex: 1, height: 40, padding: '0 14px', border: '1.5px solid #E2E8F0', borderRadius: 11, fontSize: 13, fontWeight: 500, outline: 'none', background: selectedConv.partnerDeleted ? '#F8FAFC' : '#FFFFFF', color: selectedConv.partnerDeleted ? '#94A3B8' : '#0F172A', transition: 'border-color 0.15s, box-shadow 0.15s', cursor: selectedConv.partnerDeleted ? 'not-allowed' : undefined }}
                      />
                      {!selectedConv.partnerDeleted && (
                        <button
                          onClick={handleSendMessage}
                          disabled={sendingMsg || !msgInput.trim()}
                          style={{ height: 40, padding: '0 16px', background: sendingMsg || !msgInput.trim() ? '#E5E7EB' : '#F97316', color: sendingMsg || !msgInput.trim() ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 11, cursor: sendingMsg || !msgInput.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, transition: 'background 0.15s' }}
                        >
                          {sendingMsg ? <Spinner size={13} light /> : <Send size={13} />} Send
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 18, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#3B82F6' }}>
                        <MessageSquare size={24} strokeWidth={1.5} />
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Select a conversation to start messaging</p>
                      <p style={{ margin: '5px 0 0', fontWeight: 500, fontSize: 12, color: '#CBD5E1' }}>Or compose a new message</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── Toast flash ── */}
      {inviteFlashes.length > 0 && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 200 }}>
          {inviteFlashes.map(f => (
            <div key={f.id} style={{ background: '#111827', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeSlideUp 0.25s ease both' }}>
              <Check size={13} color="#10B981" />
              {f.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'fadeSlideUp 0.2s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={17} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', margin: 0 }}>Delete Announcement</h3>
            </div>
            <p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 20px', lineHeight: 1.6 }}>
              Are you sure you want to delete this announcement? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirmId(null)} disabled={deleting}
                style={{ flex: 1, height: 38, background: 'none', border: '1.5px solid #E2E8F0', borderRadius: 9, fontWeight: 700, fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleDeleteAnnouncement(deleteConfirmId)} disabled={deleting}
                style={{ flex: 1, height: 38, background: '#DC2626', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {deleting ? <><Spinner size={12} light /> Deleting…</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Announcement Modal ── */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 500, maxWidth: '92vw', boxShadow: '0 24px 70px rgba(0,0,0,0.18)', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#FFF7ED', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pencil size={15} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', margin: 0 }}>Edit Announcement</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Announcement title" className="comm-input" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Content *</label>
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Write your announcement..." rows={5} className="comm-textarea" style={textareaStyle} />
              </div>
              <div>
                <label style={labelStyle}>Audience</label>
                <select value={editAudience} onChange={e => { setEditAudience(e.target.value); if (e.target.value === 'company-wide') setEditDeptId(null); else if (departments.length > 0) setEditDeptId(departments[0].id) }} className="comm-input" style={inputStyle}>
                  <option value="company-wide">Company-wide</option>
                  <option value="specific-dept">Specific Department</option>
                </select>
              </div>
              {editAudience === 'specific-dept' && (
                <div>
                  <label style={labelStyle}>Department</label>
                  <select value={editDeptId ?? ''} onChange={e => setEditDeptId(e.target.value)} disabled={departments.length === 0} className="comm-input" style={{ ...inputStyle, opacity: departments.length === 0 ? 0.6 : 1 }}>
                    {departments.length === 0 ? <option value="">No departments available</option> : departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              {editError && <div style={{ fontSize: 12.5, color: '#DC2626', background: '#FEF2F2', padding: '9px 12px', borderRadius: 8, fontWeight: 600 }}>{editError}</div>}
            </div>
            <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10 }}>
              <button onClick={() => setShowEditModal(false)} disabled={saving} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving || !editTitle.trim() || !editContent.trim()} style={{ ...primaryBtnStyle, opacity: saving || !editTitle.trim() || !editContent.trim() ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {saving ? <><Spinner size={13} light /> Saving…</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Announcement Modal ── */}
      {showNewAnnModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 500, maxWidth: '92vw', boxShadow: '0 24px 70px rgba(0,0,0,0.18)', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#FFF7ED', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={16} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', margin: 0 }}>New Announcement</h3>
              </div>
              <button onClick={() => setShowNewAnnModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Announcement title" className="comm-input" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Content *</label>
                <textarea data-testid="announcement-content" value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Write your announcement here..." rows={5} className="comm-textarea" style={textareaStyle} />
              </div>
              <div>
                <label style={labelStyle}>Audience</label>
                <select value={annDeptId} onChange={e => setAnnDeptId(e.target.value)} className="comm-input" style={inputStyle}>
                  {canPostCompanyWide && <option value="company-wide">Company-wide</option>}
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: '0 24px 20px' }}>
              <button onClick={handlePostAnnouncement} disabled={!communicationReady || posting || !annTitle.trim() || !annContent.trim()}
                style={{ ...primaryBtnStyle, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: !communicationReady || posting || !annTitle.trim() || !annContent.trim() ? 0.55 : 1 }}>
                {posting ? <><Spinner size={14} light /> Posting…</> : <><Megaphone size={14} /> Post Announcement</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compose Message Modal ── */}
      {composeOpen && (
        <div onClick={() => { if (!composeSending) setComposeOpen(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 480, background: '#fff', borderRadius: 18, boxShadow: '0 24px 70px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SquarePen size={15} />
                </div>
                <h2 style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', margin: 0 }}>New Message</h2>
              </div>
              <button onClick={() => setComposeOpen(false)} disabled={composeSending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}><X size={18} /></button>
            </div>

            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
              <div>
                <p style={labelStyle}>To</p>
                {selectedRecipient ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: '#FFF7ED', border: '1.5px solid rgba(249,115,22,0.3)', borderRadius: 11 }}>
                    <Avatar name={selectedRecipient.full_name} size={34} role={selectedRecipient.role} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', margin: 0 }}>{selectedRecipient.full_name}</p>
                      <p style={{ fontSize: 11.5, color: ROLE_COLOR[selectedRecipient.role] ?? '#94A3B8', margin: 0, fontWeight: 600 }}>{ROLE_LABEL[selectedRecipient.role] ?? selectedRecipient.role}</p>
                    </div>
                    <button onClick={() => setSelectedRecipient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 2 }}><X size={15} /></button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
                      <Search size={13} color="#9CA3AF" />
                      <input autoFocus value={composeSearch} onChange={e => setComposeSearch(e.target.value)} placeholder="Search people…" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#374151', fontWeight: 500 }} />
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {filteredMembers.length === 0 ? (
                        <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '14px 0', margin: 0, fontWeight: 500 }}>No people found</p>
                      ) : filteredMembers.map(m => (
                        <button key={m.id} onClick={() => setSelectedRecipient(m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: 'none', border: '1px solid transparent', borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.12s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
                        >
                          <Avatar name={m.full_name} size={34} role={m.role} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</p>
                            <p style={{ fontSize: 11.5, margin: 0, color: ROLE_COLOR[m.role] ?? '#9CA3AF', fontWeight: 600 }}>{ROLE_LABEL[m.role] ?? m.role}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {selectedRecipient && (
                <div>
                  <p style={labelStyle}>Message</p>
                  <textarea autoFocus value={composeText} onChange={e => setComposeText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && composeText.trim()) { e.preventDefault(); handleComposeSend() } }}
                    placeholder="Type your message…" rows={4}
                    className="comm-textarea"
                    style={textareaStyle}
                  />
                </div>
              )}

              {composeError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, padding: '10px 14px', fontSize: 12.5, color: '#DC2626', fontWeight: 600 }}>
                  {composeError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 24px', borderTop: '1px solid #F0F4F8' }}>
              <button onClick={() => setComposeOpen(false)} disabled={composeSending} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleComposeSend} disabled={composeSending || !selectedRecipient || !composeText.trim()}
                style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: (composeSending || !selectedRecipient || !composeText.trim()) ? 0.5 : 1 }}
              >
                {composeSending ? <><Spinner size={13} light /> Sending…</> : <><Send size={13} /> Send</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared form styles ────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: '#374151',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 9,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#FAFBFC',
  color: '#0F172A', fontWeight: 500, transition: 'border-color 0.15s, box-shadow 0.15s',
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 9,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical',
  fontFamily: 'inherit', lineHeight: 1.55, background: '#FAFBFC', color: '#0F172A',
  fontWeight: 500, transition: 'border-color 0.15s, box-shadow 0.15s',
}

const cancelBtnStyle: React.CSSProperties = {
  flex: 1, height: 40, background: 'none', border: '1.5px solid #E2E8F0', borderRadius: 10,
  fontWeight: 700, fontSize: 13, color: '#64748B', cursor: 'pointer',
}

const primaryBtnStyle: React.CSSProperties = {
  flex: 1, height: 40, background: '#F97316', border: 'none', borderRadius: 10,
  fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer', transition: 'opacity 0.15s',
}
