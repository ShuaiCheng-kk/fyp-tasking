'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ManagerSidebar from '@/components/ManagerSidebar'
import { createClient } from '@/lib/supabase'
import {
  Plus, X, Trash2, Pencil, Megaphone,
  Send, Search, SquarePen, Check, Bell, MessageSquare,
  UserCog, UserRound, Crown, Globe, Pin, PinOff,
  ImagePlus, Paperclip, FileText, Download,
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
  Owner: '#FFFFFF',
  Partner: '#FFFFFF',
  Manager: '#2563EB',
  Employee: '#4B5563',
}

const ROLE_BG: Record<string, string> = {
  Owner: '#0F172A',
  Partner: '#0F172A',
  Manager: '#EFF6FF',
  Employee: '#F3F4F6',
}

const ROLE_LABEL: Record<string, string> = {
  Owner: 'Owner/Partner',
  Manager: 'Manager',
  Employee: 'Employee',
}

const ACCENT = '#2563EB'
const ACCENT_LIGHT = '#EFF6FF'

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}


function hashColor(name: string): string {
  const palette = ['#2563EB', '#8B5CF6', '#0EA5E9', '#10B981', '#EC4899', '#F97316', '#D97706', '#6366F1']
  let h = 5381
  for (let i = 0; i < name.length; i++) h = (h << 5) + h + name.charCodeAt(i)
  return palette[Math.abs(h) % palette.length]
}

function Avatar({ name, size = 36, role }: { name: string; size?: number; role?: string }) {
  const color = role ? (ROLE_COLOR[role] ?? hashColor(name)) : hashColor(name)
  const bg = role ? (ROLE_BG[role] ?? `${color}18`) : `${color}18`
  const iconSize = Math.round(size * 0.46)
  const icon = role === 'Owner' || role === 'Partner' ? <Crown size={iconSize} />
    : role === 'Manager' ? <UserCog size={iconSize} />
    : role === 'Employee' ? <UserRound size={iconSize} />
    : <UserRound size={iconSize} />
  const isDark = role === 'Owner' || role === 'Partner'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, border: isDark ? 'none' : `2px solid ${color}22`,
    }}>
      {icon}
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

export default function ManagerCommunicationPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'announcements' | 'invites'>('chat')

  const [internalUserId, setInternalUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [managerName, setManagerName] = useState('')
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
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  // Multi-panel chat state (up to 4 panels)
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([])
  const [panelMessages, setPanelMessages] = useState<Record<string, Message[]>>({})
  const [panelInputs, setPanelInputs] = useState<Record<string, string>>({})
  const [panelSending, setPanelSending] = useState<Record<string, boolean>>({})
  const [panelAttachFile, setPanelAttachFile] = useState<Record<string, File | null>>({})
  const [panelAttachPreview, setPanelAttachPreview] = useState<Record<string, string | null>>({})
  const [panelUploading, setPanelUploading] = useState<Record<string, boolean>>({})
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [draggingPanel, setDraggingPanel] = useState<string | null>(null)
  const panelPhotoRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const panelFileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const panelEndRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [conversationsFetched, setConversationsFetched] = useState(false)
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

  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('partner_id')
    const pre = params.get('prefill') ?? ''
    if (pid) {
      setPendingPartnerId(pid)
      setPendingPrefill(pre)
      setActiveTab('chat')
    }
  }, [])

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${uid}`)
    setCompanyId(cid)
    if (uid) {
      fetch(`/api/user/me?user_id=${uid}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setInternalUserId(d.user.id)
            setManagerName(d.user.full_name ?? '')
            setUserRole(d.user.role ?? '')
            setUserDeptId(d.user.department_id ?? null)
            if (cid) {
              fetch(`/api/inbox/announcements/read?user_id=${d.user.id}&company_id=${cid}`)
                .then(r => r.json())
                .then(rd => { if (rd.success) setReadIds(new Set(rd.readIds)) })
                .catch(() => {})
            }
          }
        })
    }
  }, [])

  useEffect(() => {
    if (!companyId) return
    const uid = localStorage.getItem('tasking_user_id') ?? ''
    Promise.all([
      fetch(`/api/company/departments?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/company/current?user_id=${uid}&company_id=${companyId}`).then(r => r.json()),
    ]).then(([deptData, compData]) => {
      if (deptData.success) setDepartments(deptData.departments ?? [])
      if (compData.success && compData.company?.name) setCompanyName(compData.company.name)
    }).catch(() => {})
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
    if (!internalUserId || !companyId || announcements.length === 0) return
    const unreadIds = announcements.filter(a => !readIds.has(a.id)).map(a => a.id)
    if (unreadIds.length === 0) return
    const next = new Set(readIds)
    unreadIds.forEach(id => next.add(id))
    setReadIds(next)
    fetch('/api/inbox/announcements/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: internalUserId, announcement_ids: unreadIds }),
    }).catch(() => {})
  }, [announcements, companyId, internalUserId])

  useEffect(() => {
    if (!companyId) return
    const channel = supabase
      .channel('manager-comm-announcements')
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
    try {
      const raw = localStorage.getItem(`pinned_convs_${internalUserId}`)
      if (raw) setPinnedIds(new Set(JSON.parse(raw)))
    } catch {}
  }, [internalUserId, fetchConversations, fetchUnreadCount])

  useEffect(() => {
    if (!pendingPartnerId || !internalUserId || !conversationsFetched || !companyId) return
    const pid = pendingPartnerId
    const pre = pendingPrefill
    setPendingPartnerId(null)
    setPendingPrefill('')
    window.history.replaceState({}, '', '/manager/communication')

    const found = conversations.find(c => c.partnerId === pid)
    if (found) {
      openPanel(found.partnerId)
      if (pre) setPanelInputs(prev => ({ ...prev, [found.partnerId]: pre }))
      return
    }

    const allPromise = fetch(`/api/team/members?company_id=${companyId}`).then(r => r.json())
    const deptPromise = userDeptId
      ? fetch(`/api/team/members?company_id=${companyId}&department_id=${userDeptId}`).then(r => r.json())
      : Promise.resolve({ success: true, members: [] })

    Promise.all([allPromise, deptPromise]).then(([allData, deptData]) => {
      if (!allData.success) return
      const allMembers = allData.members as CompanyMember[]
      const deptMembers = (deptData.success ? deptData.members : []) as CompanyMember[]
      const seniorOrPeer = allMembers.filter(m =>
        (m.role === 'Owner' || m.role === 'Partner' || m.role === 'Manager') &&
        m.id !== internalUserId
      )
      const deptEmployees = deptMembers.filter(m => m.role === 'Employee')
      const seen = new Set<string>()
      const eligible: CompanyMember[] = []
      for (const member of [...seniorOrPeer, ...deptEmployees]) {
        if (!seen.has(member.id)) {
          seen.add(member.id)
          eligible.push(member)
        }
      }
      setCompanyMembers(eligible)
      const partner = eligible.find(member => member.id === pid)
      if (partner) {
        setSelectedRecipient(partner)
        setComposeText(pre)
        setComposeOpen(true)
        setComposeSearch('')
        setComposeError('')
      }
    })
  }, [pendingPartnerId, conversations, internalUserId, conversationsFetched, companyId, pendingPrefill, userDeptId])

  useEffect(() => {
    if (!internalUserId) return
    fetchInvites()
  }, [internalUserId, fetchInvites])

  useEffect(() => {
    const q = search.toLowerCase()
    const base = q ? conversations.filter(c => c.partnerName.toLowerCase().includes(q)) : conversations
    const sorted = [...base].sort((a, b) => {
      const aPin = pinnedIds.has(a.partnerId) ? 0 : 1
      const bPin = pinnedIds.has(b.partnerId) ? 0 : 1
      return aPin - bPin
    })
    setFilteredConversations(sorted)
  }, [search, conversations, pinnedIds])

  function fetchPanelMessages(partnerId: string) {
    if (!internalUserId) return
    fetch(`/api/inbox/messages/${partnerId}?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPanelMessages(prev => ({ ...prev, [partnerId]: d.messages ?? [] }))
          // Mark messages from this conversation as read in DB
          fetch(`/api/inbox/messages/${partnerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: internalUserId }),
          }).then(() => { fetchUnreadCount(); fetchConversations() }).catch(() => {})
        }
      })
  }

  useEffect(() => {
    for (const pid of openPanelIds) {
      panelEndRefs.current[pid]?.scrollIntoView({ behavior: 'smooth' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMessages])

  useEffect(() => {
    if (!internalUserId) return
    const channel = supabase
      .channel('manager-comm-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user_id=eq.${internalUserId}` },
        (payload) => {
          const newMsg = payload.new as Message
          setPanelMessages(prev => {
            if (prev[newMsg.from_user_id] !== undefined) {
              // Panel is open for this conversation — mark as read immediately
              fetch(`/api/inbox/messages/${newMsg.from_user_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: internalUserId }),
              }).catch(() => {})
              return { ...prev, [newMsg.from_user_id]: [...prev[newMsg.from_user_id], newMsg] }
            }
            return prev
          })
          fetchConversations()
          fetchUnreadCount()
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [internalUserId])

  function handleSelectAnn(ann: Announcement) {
    setSelectedAnn(ann)
    if (!internalUserId) return
    if (readIds.has(ann.id)) return
    const next = new Set(readIds)
    next.add(ann.id)
    setReadIds(next)
    fetch('/api/inbox/announcements/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: internalUserId, announcement_ids: [ann.id] }),
    }).catch(() => {})
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
      const deptId = userDeptId ?? null
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

    // Fetch all company members + department members, then filter:
    // Manager can message: Owner/Partner (any dept), other Managers, Employees in own dept only
    const allPromise = fetch(`/api/team/members?company_id=${companyId}`).then(r => r.json())
    const deptPromise = userDeptId
      ? fetch(`/api/team/members?company_id=${companyId}&department_id=${userDeptId}`).then(r => r.json())
      : Promise.resolve({ success: true, members: [] })

    Promise.all([allPromise, deptPromise]).then(([allData, deptData]) => {
      if (!allData.success) return
      const allMembers = allData.members as CompanyMember[]
      const deptMembers = (deptData.success ? deptData.members : []) as CompanyMember[]

      // Owners/Partners/Managers from the whole company
      const seniorOrPeer = allMembers.filter(m =>
        (m.role === 'Owner' || m.role === 'Partner' || m.role === 'Manager') &&
        m.id !== internalUserId
      )
      // Employees only from own department
      const deptEmployees = deptMembers.filter(m => m.role === 'Employee')

      // Merge and deduplicate by id
      const seen = new Set<string>()
      const eligible: CompanyMember[] = []
      for (const m of [...seniorOrPeer, ...deptEmployees]) {
        if (!seen.has(m.id)) { seen.add(m.id); eligible.push(m) }
      }
      setCompanyMembers(eligible)
    })
  }, [companyId, internalUserId, userDeptId])

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
        if (selectedRecipient) openPanel(selectedRecipient.id)
      }
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setComposeSending(false) }
  }

  // ── Panel management ──────────────────────────────────────────────────────────

  function openPanel(partnerId: string) {
    setOpenPanelIds(prev => {
      if (prev.includes(partnerId)) return prev
      const next = prev.length >= 4 ? [...prev.slice(1), partnerId] : [...prev, partnerId]
      return next
    })
    if (!panelMessages[partnerId]) {
      fetchPanelMessages(partnerId)
    }
  }

  function closePanel(partnerId: string) {
    setOpenPanelIds(prev => prev.filter(id => id !== partnerId))
    setPanelMessages(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelInputs(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelSending(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelAttachFile(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelAttachPreview(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelUploading(prev => { const n = { ...prev }; delete n[partnerId]; return n })
  }

  function swapPanels(idA: string, idB: string) {
    setOpenPanelIds(prev => {
      const next = [...prev]
      const iA = next.indexOf(idA)
      const iB = next.indexOf(idB)
      if (iA === -1 || iB === -1) return prev
      ;[next[iA], next[iB]] = [next[iB], next[iA]]
      return next
    })
  }

  async function handleSendMessage(partnerId: string) {
    const conv = conversations.find(c => c.partnerId === partnerId)
    const content = (panelInputs[partnerId] ?? '').trim()
    if (!content || !conv || !internalUserId || !companyId) return
    setPanelSending(prev => ({ ...prev, [partnerId]: true }))
    const optimistic: Message = {
      id: `tmp-${Date.now()}`, from_user_id: internalUserId, to_user_id: partnerId,
      content, created_at: new Date().toISOString(), is_read: false,
    }
    setPanelMessages(prev => ({ ...prev, [partnerId]: [...(prev[partnerId] ?? []), optimistic] }))
    setPanelInputs(prev => ({ ...prev, [partnerId]: '' }))
    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: internalUserId, to_user_id: partnerId, company_id: companyId, content }),
      })
      const data = await res.json()
      if (data.success) {
        setPanelMessages(prev => ({
          ...prev,
          [partnerId]: (prev[partnerId] ?? []).map(m => m.id === optimistic.id ? data.message : m),
        }))
        fetchConversations()
      }
    } finally { setPanelSending(prev => ({ ...prev, [partnerId]: false })) }
  }

  function pickPanelAttachment(partnerId: string, file: File) {
    setPanelAttachFile(prev => ({ ...prev, [partnerId]: file }))
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPanelAttachPreview(prev => ({ ...prev, [partnerId]: e.target?.result as string }))
      reader.readAsDataURL(file)
    } else {
      setPanelAttachPreview(prev => ({ ...prev, [partnerId]: null }))
    }
  }

  function clearPanelAttachment(partnerId: string) {
    setPanelAttachFile(prev => ({ ...prev, [partnerId]: null }))
    setPanelAttachPreview(prev => ({ ...prev, [partnerId]: null }))
    const photoEl = panelPhotoRefs.current[partnerId]
    const fileEl = panelFileRefs.current[partnerId]
    if (photoEl) photoEl.value = ''
    if (fileEl) fileEl.value = ''
  }

  async function uploadAndSendPanelAttachment(partnerId: string) {
    const file = panelAttachFile[partnerId]
    const conv = conversations.find(c => c.partnerId === partnerId)
    if (!file || !conv || !internalUserId || !companyId) return
    setPanelUploading(prev => ({ ...prev, [partnerId]: true }))
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('company_id', companyId)
      const upRes = await fetch('/api/inbox/upload', { method: 'POST', body: form })
      const upData = await upRes.json()
      if (!upData.success) throw new Error(upData.error ?? 'Upload failed')
      const isImage = file.type.startsWith('image/')
      const prefix = isImage ? '[image:]' : `[file:${upData.name}]`
      const content = `${prefix}${upData.url}`
      const msgRes = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: internalUserId, to_user_id: partnerId, company_id: companyId, content }),
      })
      const msgData = await msgRes.json()
      if (msgData.success) {
        setPanelMessages(prev => ({ ...prev, [partnerId]: [...(prev[partnerId] ?? []), msgData.message] }))
        fetchConversations()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setPanelUploading(prev => ({ ...prev, [partnerId]: false }))
      clearPanelAttachment(partnerId)
    }
  }

  function togglePin(partnerId: string) {
    if (!internalUserId) return
    setPinnedIds(prev => {
      const next = new Set(prev)
      if (next.has(partnerId)) next.delete(partnerId)
      else next.add(partnerId)
      localStorage.setItem(`pinned_convs_${internalUserId}`, JSON.stringify([...next]))
      return next
    })
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
    <div style={{ display: 'flex', height: '100vh', background: '#F7F8FA', color: '#0F172A', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
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
        .mgr-ann-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          animation: fadeSlideUp 0.28s ease both;
        }
        .mgr-ann-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(15,23,42,0.09) !important;
        }
        .mgr-conv-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          animation: fadeSlideUp 0.28s ease both;
        }
        .mgr-conv-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(15,23,42,0.09) !important;
        }
        .mgr-msg-bubble {
          animation: msgPop 0.2s ease both;
        }
        .mgr-tab-btn {
          transition: all 0.13s ease;
        }
        .mgr-tab-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .mgr-action-btn {
          transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
        }
        .mgr-action-btn:hover {
          background: #1D4ED8 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(37,99,235,0.30);
        }
        .mgr-input:focus {
          border-color: ${ACCENT} !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.10) !important;
        }
        .mgr-textarea:focus {
          border-color: ${ACCENT} !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.10) !important;
        }
      `}</style>

      <ManagerSidebar unreadMessages={unreadMessages} unreadAnnouncements={unreadAnnCount} />

      <main style={{ marginLeft: '64px', flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Communication
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {managerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#1E3A5F', color: '#FFFFFF', flexShrink: 0 }}>
                  <UserCog size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{managerName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Single content card */}
        <div style={{ padding: '0 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

            {/* Card top bar: tabs + action button */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {([
                  { key: 'chat',          label: 'Chat',          icon: <MessageSquare size={13} />, badge: unreadMessages  },
                  { key: 'announcements', label: 'Announcements', icon: <Megaphone size={13} />,     badge: unreadAnnCount  },
                  { key: 'invites',       label: 'Invites',       icon: <Bell size={13} />,           badge: invites.length },
                ] as const).map(tab => {
                  const active = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className="mgr-tab-btn"
                      style={{
                        padding: '5px 13px', borderRadius: '99px', cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.8rem',
                        background: active ? '#1E3A5F' : 'transparent',
                        border: active ? '2px solid #1E3A5F' : '1.5px solid #E5E7EB',
                        color: active ? '#FFFFFF' : '#374151',
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                      }}
                    >
                      {tab.icon}
                      {tab.label}
                      {tab.badge > 0 && (
                        <span style={{
                          minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999,
                          background: ACCENT,
                          color: '#fff', fontSize: 10, fontWeight: 900,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <div style={{ flexShrink: 0 }}>
                {activeTab === 'chat' && (
                  <button onClick={openCompose} disabled={!communicationReady}
                    className={communicationReady ? 'mgr-action-btn' : ''}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: communicationReady ? ACCENT : '#E5E7EB', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: communicationReady ? '#fff' : '#9CA3AF', cursor: communicationReady ? 'pointer' : 'not-allowed', height: 38 }}
                  >
                    <SquarePen size={13} strokeWidth={2.5} /> New Message
                  </button>
                )}
                {activeTab === 'announcements' && (
                  <button onClick={() => { setShowNewAnnModal(true); if (userDeptId) setAnnDeptId(userDeptId) }}
                    className="mgr-action-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: ACCENT, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#fff', cursor: 'pointer', height: 38 }}
                  >
                    <Plus size={13} strokeWidth={2.5} /> Post Announcement
                  </button>
                )}
              </div>
            </div>

            {/* Main communication panel */}
            <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* ── Chat tab ── */}
              {activeTab === 'chat' && (
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 12, overflow: 'hidden', padding: 12 }}>

                  {/* Left: conversations */}
                  <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 12px 10px', flexShrink: 0 }}>
                      <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 7, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '0 10px' }}>
                        <Search size={13} color="#94A3B8" />
                        <input
                          value={search} onChange={e => setSearch(e.target.value)}
                          placeholder="Search conversations..."
                          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: '#0F172A', fontWeight: 500 }}
                        />
                      </div>
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 10px 10px' }}>
                      {filteredConversations.length === 0 ? (
                        <div style={{ height: 180, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
                          <MessageSquare size={26} strokeWidth={1.5} />
                          {search ? 'No results' : 'No conversations yet'}
                        </div>
                      ) : filteredConversations.map((conv, i) => {
                        const active = openPanelIds.includes(conv.partnerId)
                        const isPinned = pinnedIds.has(conv.partnerId)
                        const previewText = conv.lastMessage.startsWith('[image:]') ? '📷 Photo'
                          : conv.lastMessage.match(/^\[file:(.+?)\]/) ? `📎 ${conv.lastMessage.match(/^\[file:(.+?)\]/)![1]}`
                          : conv.lastMessage
                        return (
                          <button
                            key={conv.partnerId}
                            onClick={() => openPanel(conv.partnerId)}
                            className="mgr-conv-card"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
                              background: active ? ACCENT_LIGHT : 'transparent',
                              border: 'none',
                              borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 2,
                              borderLeft: active ? `3px solid ${ACCENT}` : '3px solid transparent',
                              animationDelay: `${i * 0.04}s`,
                            }}
                          >
                            <Avatar name={conv.partnerName} size={40} role={conv.partnerRole} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                                  <span style={{ fontWeight: conv.unreadCount > 0 ? 800 : 600, fontSize: 13, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {conv.partnerName}
                                  </span>
                                  {isPinned && (
                                    <Pin size={10} strokeWidth={2.5} style={{ color: ACCENT, flexShrink: 0 }} />
                                  )}
                                  {conv.partnerDeleted && (
                                    <span style={{ background: '#F1F5F9', color: '#6B7280', fontSize: 10, padding: '1px 6px', borderRadius: 999, flexShrink: 0, fontWeight: 700 }}>removed</span>
                                  )}
                                </div>
                                <span style={{ fontSize: 10.5, color: '#9CA3AF', flexShrink: 0, fontWeight: 500 }}>{formatTime(conv.lastTime)}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <span style={{ fontSize: 12, color: conv.unreadCount > 0 ? '#374151' : '#9CA3AF', fontWeight: conv.unreadCount > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  {previewText}
                                </span>
                                {conv.unreadCount > 0 && (
                                  <div style={{ minWidth: 18, height: 18, borderRadius: 999, background: ACCENT, color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>
                                    {conv.unreadCount}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Right: multi-panel chat area */}
                  <div style={{ minWidth: 0, minHeight: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {openPanelIds.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                          <div style={{ width: 56, height: 56, borderRadius: 18, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: ACCENT }}>
                            <MessageSquare size={24} strokeWidth={1.5} />
                          </div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#374151' }}>Select a conversation to start chatting</p>
                          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>You can open up to 4 conversations side by side</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        flex: 1, minHeight: 0,
                        display: 'grid',
                        gridTemplateColumns: openPanelIds.length === 1 ? '1fr'
                          : openPanelIds.length === 2 ? '1fr 1fr'
                          : openPanelIds.length === 3 ? '1fr 1fr'
                          : '1fr 1fr',
                        gridTemplateRows: openPanelIds.length <= 2 ? '1fr'
                          : openPanelIds.length === 3 ? '1fr 1fr'
                          : '1fr 1fr',
                        gap: 8,
                      }}>
                        {openPanelIds.map((partnerId, idx) => {
                          const conv = conversations.find(c => c.partnerId === partnerId)
                          if (!conv) return null
                          const msgs = panelMessages[partnerId] ?? []
                          const input = panelInputs[partnerId] ?? ''
                          const sending = panelSending[partnerId] ?? false
                          const attachFile = panelAttachFile[partnerId] ?? null
                          const attachPreview = panelAttachPreview[partnerId] ?? null
                          const uploading = panelUploading[partnerId] ?? false
                          const isPinned = pinnedIds.has(partnerId)
                          const spanStyle: React.CSSProperties = openPanelIds.length === 3 && idx === 0
                            ? { gridRow: '1 / 3' } : {}

                          return (
                            <div
                              key={partnerId}
                              style={{
                                ...spanStyle,
                                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                                background: '#FFFFFF', borderRadius: 14,
                                border: dragOver === partnerId ? `2px dashed ${ACCENT}` : '1px solid #E5E7EB',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                transition: 'border-color 0.15s',
                              }}
                              onDragOver={e => { e.preventDefault(); setDragOver(partnerId) }}
                              onDragLeave={() => setDragOver(null)}
                              onDrop={e => {
                                e.preventDefault()
                                setDragOver(null)
                                const draggedId = e.dataTransfer.getData('panelId')
                                if (draggedId && draggedId !== partnerId) swapPanels(draggedId, partnerId)
                                setDraggingPanel(null)
                              }}
                            >
                              {/* Panel header */}
                              <div
                                draggable
                                onDragStart={e => { e.dataTransfer.setData('panelId', partnerId); setDraggingPanel(partnerId) }}
                                onDragEnd={() => setDraggingPanel(null)}
                                style={{ padding: '10px 14px 0', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: openPanelIds.length > 1 ? 'grab' : 'default', userSelect: 'none' }}
                                title={openPanelIds.length > 1 ? 'Drag to swap panels' : undefined}
                              >
                                <Avatar name={conv.partnerName} size={30} role={conv.partnerRole} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontWeight: 800, fontSize: 13, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.partnerName}</span>
                                    {conv.partnerDeleted && <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 9, padding: '1px 5px', borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>removed</span>}
                                    {isPinned && <Pin size={9} strokeWidth={2.5} style={{ color: ACCENT, flexShrink: 0 }} />}
                                  </div>
                                </div>
                                {/* Pin button */}
                                <button
                                  onClick={() => togglePin(partnerId)}
                                  title={isPinned ? 'Unpin' : 'Pin'}
                                  style={{ flexShrink: 0, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isPinned ? ACCENT_LIGHT : '#F8FAFC', border: isPinned ? `1.5px solid rgba(37,99,235,0.35)` : '1.5px solid #E2E8F0', borderRadius: 7, cursor: 'pointer', color: isPinned ? ACCENT : '#94A3B8', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { if (!isPinned) { e.currentTarget.style.background = ACCENT_LIGHT; e.currentTarget.style.color = ACCENT } }}
                                  onMouseLeave={e => { if (!isPinned) { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#94A3B8' } }}
                                >
                                  {isPinned ? <PinOff size={11} strokeWidth={2.5} /> : <Pin size={11} strokeWidth={2.5} />}
                                </button>
                                {/* Close button */}
                                <button
                                  onClick={() => closePanel(partnerId)}
                                  title="Close"
                                  style={{ flexShrink: 0, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 7, cursor: 'pointer', color: '#94A3B8', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = '#E2E8F0' }}
                                >
                                  <X size={11} strokeWidth={2.5} />
                                </button>
                              </div>
                              {/* Divider */}
                              <div style={{ height: 1, background: '#1E3A5F', margin: '8px 0 0', flexShrink: 0 }} />

                              {/* Messages */}
                              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                                {msgs.map(msg => {
                                  const isMine = msg.from_user_id === internalUserId
                                  const isImage = msg.content.startsWith('[image:]')
                                  const fileMatch = msg.content.match(/^\[file:(.+?)\](.+)$/)
                                  const isFile = Boolean(fileMatch)
                                  const imgUrl = isImage ? msg.content.slice('[image:]'.length) : null
                                  const fileName = fileMatch?.[1] ?? null
                                  const fileUrl = fileMatch?.[2] ?? null
                                  return (
                                    <div key={msg.id} className="mgr-msg-bubble" style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
                                      {!isMine && <Avatar name={conv.partnerName} size={22} role={conv.partnerRole} />}
                                      {isImage && imgUrl ? (
                                        <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 3 }}>
                                          <a href={imgUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: isMine ? '12px 12px 3px 12px' : '12px 12px 12px 3px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                                            <img src={imgUrl} alt="attachment" style={{ display: 'block', maxWidth: '100%', maxHeight: 180, objectFit: 'cover' }} />
                                          </a>
                                          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{formatTime(msg.created_at)}</span>
                                        </div>
                                      ) : isFile && fileUrl ? (
                                        <div style={{ maxWidth: '70%', padding: '8px 11px', borderRadius: isMine ? '13px 13px 3px 13px' : '13px 13px 13px 3px', background: isMine ? ACCENT_LIGHT : '#FFFFFF', border: isMine ? `1px solid ${ACCENT}33` : '1px solid #EDF2F7', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                            <div style={{ width: 30, height: 30, borderRadius: 8, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={14} color={ACCENT} /></div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                              <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</p>
                                              <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={fileName ?? true} style={{ fontSize: 10.5, color: ACCENT, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2, marginTop: 1, textDecoration: 'none' }}><Download size={9} /> Download</a>
                                            </div>
                                          </div>
                                          <div style={{ fontSize: 10, marginTop: 4, color: '#94A3B8', fontWeight: 600, textAlign: isMine ? 'right' : 'left' }}>{formatTime(msg.created_at)}</div>
                                        </div>
                                      ) : (
                                        <div style={{ maxWidth: '70%', padding: '8px 11px', borderRadius: isMine ? '13px 13px 3px 13px' : '13px 13px 13px 3px', background: isMine ? ACCENT_LIGHT : '#FFFFFF', border: isMine ? `1px solid ${ACCENT}33` : '1px solid #EDF2F7', color: '#0F172A', fontSize: 12.5, fontWeight: 500, lineHeight: 1.5, boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                                          {msg.content}
                                          <div style={{ fontSize: 10, marginTop: 3, color: '#94A3B8', fontWeight: 600, textAlign: isMine ? 'right' : 'left' }}>{formatTime(msg.created_at)}</div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                                <div ref={el => { panelEndRefs.current[partnerId] = el }} />
                              </div>

                              {/* Attachment preview */}
                              {attachFile && (
                                <div style={{ padding: '6px 14px 0', background: '#FFFFFF', flexShrink: 0 }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 9, padding: '5px 9px', maxWidth: '100%' }}>
                                    {attachPreview ? (
                                      <img src={attachPreview} alt="preview" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                                    ) : (
                                      <div style={{ width: 30, height: 30, borderRadius: 7, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={14} color={ACCENT} /></div>
                                    )}
                                    <div style={{ minWidth: 0 }}>
                                      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{attachFile.name}</p>
                                      <p style={{ margin: '1px 0 0', fontSize: 10.5, color: '#94A3B8', fontWeight: 500 }}>{(attachFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <button onClick={() => clearPanelAttachment(partnerId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'flex', flexShrink: 0 }}><X size={12} /></button>
                                  </div>
                                </div>
                              )}

                              {/* Divider above input */}
                              <div style={{ height: 1, background: '#1E3A5F', flexShrink: 0 }} />

                              {/* Input bar */}
                              <div style={{ padding: '8px 12px', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <input type="file" accept="image/*" style={{ display: 'none' }}
                                  ref={el => { panelPhotoRefs.current[partnerId] = el }}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) pickPanelAttachment(partnerId, f) }}
                                />
                                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" style={{ display: 'none' }}
                                  ref={el => { panelFileRefs.current[partnerId] = el }}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) pickPanelAttachment(partnerId, f) }}
                                />
                                {!conv.partnerDeleted && (
                                  <button onClick={() => panelPhotoRefs.current[partnerId]?.click()} title="Send photo"
                                    style={{ flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 9, cursor: 'pointer', color: '#64748B', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = ACCENT_LIGHT; e.currentTarget.style.borderColor = `rgba(37,99,235,0.35)`; e.currentTarget.style.color = ACCENT }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B' }}>
                                    <ImagePlus size={14} strokeWidth={2} />
                                  </button>
                                )}
                                {!conv.partnerDeleted && (
                                  <button onClick={() => panelFileRefs.current[partnerId]?.click()} title="Send file"
                                    style={{ flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 9, cursor: 'pointer', color: '#64748B', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = ACCENT_LIGHT; e.currentTarget.style.borderColor = `rgba(37,99,235,0.35)`; e.currentTarget.style.color = ACCENT }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B' }}>
                                    <Paperclip size={13} strokeWidth={2} />
                                  </button>
                                )}
                                <input
                                  value={input}
                                  onChange={e => setPanelInputs(p => ({ ...p, [partnerId]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !conv.partnerDeleted) { e.preventDefault(); if (attachFile) uploadAndSendPanelAttachment(partnerId); else handleSendMessage(partnerId) } }}
                                  placeholder={conv.partnerDeleted ? "Account removed" : 'Type a message…'}
                                  disabled={conv.partnerDeleted}
                                  className="mgr-input"
                                  style={{ flex: 1, height: 34, padding: '0 11px', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 12.5, fontWeight: 500, outline: 'none', background: conv.partnerDeleted ? '#F8FAFC' : '#FFFFFF', color: conv.partnerDeleted ? '#94A3B8' : '#0F172A', cursor: conv.partnerDeleted ? 'not-allowed' : undefined, transition: 'border-color 0.15s, box-shadow 0.15s' }}
                                />
                                {!conv.partnerDeleted && (
                                  <button
                                    onClick={() => { if (attachFile) uploadAndSendPanelAttachment(partnerId); else handleSendMessage(partnerId) }}
                                    disabled={sending || uploading || (!input.trim() && !attachFile)}
                                    style={{ height: 34, padding: '0 12px', background: (sending || uploading || (!input.trim() && !attachFile)) ? '#E5E7EB' : ACCENT, color: (sending || uploading || (!input.trim() && !attachFile)) ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 9, cursor: (sending || uploading || (!input.trim() && !attachFile)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 12, transition: 'background 0.15s', flexShrink: 0 }}
                                  >
                                    {(sending || uploading) ? <Spinner size={12} light /> : <Send size={12} />} Send
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Announcements tab ── */}
              {activeTab === 'announcements' && (
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 12, overflow: 'hidden', padding: 12 }}>

                  {/* Left: list */}
                  <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px 0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                            className="mgr-ann-card"
                            style={{
                              display: 'flex', flexDirection: 'column', gap: 6, padding: 12,
                              background: selected ? ACCENT_LIGHT : '#FFFFFF',
                              border: selected ? `1.5px solid rgba(37,99,235,0.35)` : '1.5px solid #EDF2F7',
                              borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 8,
                              boxShadow: selected ? `0 6px 18px rgba(37,99,235,0.08)` : '0 1px 3px rgba(0,0,0,0.03)',
                              animationDelay: `${i * 0.04}s`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 7, height: 7, borderRadius: 999, background: unread ? ACCENT : '#CBD5E1', flexShrink: 0 }} />
                              <span style={{ fontWeight: unread ? 800 : 600, fontSize: 13, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {ann.title}
                              </span>
                              <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}>{formatTime(ann.created_at)}</span>
                            </div>
                            <div style={{ paddingLeft: 14 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 3, background: deptName ? ACCENT_LIGHT : '#F1F5F9', color: deptName ? ACCENT : '#64748B' }}>
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
                  <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    {selectedAnn ? (
                      <>
                        <div style={{ flexShrink: 0, background: '#FFFFFF', borderBottom: '1px solid #EDF2F7', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: ACCENT_LIGHT, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Megaphone size={18} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <h2 style={{ margin: 0, color: '#0F172A', fontSize: 19, lineHeight: 1.2, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedAnn.title}</h2>
                              <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 12, fontWeight: 600 }}>
                                {selectedAnn.created_by_name ?? 'Manager'} · {new Date(selectedAnn.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ height: 28, padding: '0 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, background: selectedAnn.department_id ? ACCENT_LIGHT : '#F1F5F9', color: selectedAnn.department_id ? ACCENT : '#64748B' }}>
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
                          <article style={{ maxWidth: 760, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '28px 32px', boxShadow: '0 4px 20px rgba(15,23,42,0.05)' }}>
                            <p style={{ margin: 0, color: '#334155', fontSize: 14.5, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{selectedAnn.content}</p>
                          </article>
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#FFFFFF' }}>
                        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                          <div style={{ width: 56, height: 56, borderRadius: 18, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: ACCENT }}>
                            <Megaphone size={24} strokeWidth={1.5} />
                          </div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Select an announcement to read</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Invites tab ── */}
              {activeTab === 'invites' && (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24, background: '#FFFFFF' }}>
                  {inviteLoading ? (
                    <div style={{ padding: 48, textAlign: 'center' }}><Spinner size={18} /></div>
                  ) : invites.length === 0 ? (
                    <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 10 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 18, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
                        <Bell size={24} strokeWidth={1.5} />
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>No pending invitations</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                      {invites.map((invite, i) => (
                        <div key={invite.id} className="mgr-ann-card" style={{ padding: 18, background: '#FFFFFF', border: '1.5px solid #EDF2F7', borderRadius: 14, animationDelay: `${i * 0.05}s` }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: ACCENT_LIGHT, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Bell size={16} />
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: 13, color: '#0F172A', fontWeight: 700, lineHeight: 1.45 }}>
                                <span style={{ color: '#374151' }}>{invite.sender_name}</span> invited you to join <span style={{ color: '#0F172A' }}>{invite.company_name}</span>
                              </p>
                              <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>
                                As <span style={{ color: ACCENT, fontWeight: 700 }}>{invite.role}</span> · {formatTime(invite.created_at)}
                              </p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleAcceptInvite(invite)} disabled={inviteActing === invite.id}
                              style={{ flex: 1, height: 34, background: '#10B981', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: inviteActing === invite.id ? 'not-allowed' : 'pointer', opacity: inviteActing === invite.id ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                            >
                              {inviteActing === invite.id ? <Spinner size={12} light /> : <Check size={13} />} Accept
                            </button>
                            <button onClick={() => handleDeclineInvite(invite)} disabled={inviteActing === invite.id}
                              style={{ flex: 1, height: 34, background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: inviteActing === invite.id ? 'not-allowed' : 'pointer', opacity: inviteActing === invite.id ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                            >
                              <X size={13} /> Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Toast flash */}
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

      {/* Delete Confirmation Modal */}
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
              Are you sure you want to delete this announcement?
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

      {/* Edit Announcement Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 500, maxWidth: '92vw', boxShadow: '0 24px 70px rgba(0,0,0,0.18)', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: ACCENT_LIGHT, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pencil size={15} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', margin: 0 }}>Edit Announcement</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Announcement title" className="mgr-input" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Content</label>
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Write your announcement..." rows={5} className="mgr-textarea" style={textareaStyle} />
              </div>
              <div>
                <label style={labelStyle}>Audience</label>
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: '#64748B', cursor: 'default', userSelect: 'none' }}>
                  {departments.find(d => d.id === userDeptId)?.name ?? 'My Department'}
                </div>
              </div>
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

      {/* New Announcement Modal */}
      {showNewAnnModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 500, maxWidth: '92vw', boxShadow: '0 24px 70px rgba(0,0,0,0.18)', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: ACCENT_LIGHT, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={16} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', margin: 0 }}>New Announcement</h3>
              </div>
              <button onClick={() => setShowNewAnnModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Announcement title" className="mgr-input" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Content</label>
                <textarea data-testid="announcement-content" value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Write your announcement here..." rows={5} className="mgr-textarea" style={textareaStyle} />
              </div>
              <div>
                <label style={labelStyle}>Audience</label>
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: '#64748B', cursor: 'default', userSelect: 'none' }}>
                  {departments.find(d => d.id === userDeptId)?.name ?? 'My Department'}
                </div>
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

      {/* Compose Message Modal */}
      {composeOpen && (
        <div onClick={() => { if (!composeSending) setComposeOpen(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 480, background: '#fff', borderRadius: 18, boxShadow: '0 24px 70px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: ACCENT_LIGHT, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: ACCENT_LIGHT, border: `1.5px solid rgba(37,99,235,0.3)`, borderRadius: 11 }}>
                    <Avatar name={selectedRecipient.full_name} size={34} role={selectedRecipient.role} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', margin: 0 }}>{selectedRecipient.full_name}</p>
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
                    className="mgr-textarea"
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
  flex: 1, height: 40, background: '#2563EB', border: 'none', borderRadius: 10,
  fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer', transition: 'opacity 0.15s',
}
