'use client'

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { createClient } from '@/lib/supabase'
import { ModalOverlay, ModalBox, ModalHeader, modalInputStyle, modalLabelStyle, modalErrorBoxStyle, modalGhostButtonStyle, modalPrimaryButtonStyle, modalDestructiveButtonStyle } from '@/components/modal'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import DepartmentBadge from '@/components/DepartmentBadge'
import { setDeptColorOverrides } from '@/lib/deptColor'
import {
  Plus, X, Trash2, Pencil, Megaphone,
  Send, Search, SquarePen, Check, Bell, MessageSquare, Crown,
  Users, Globe, UserCog, UserRound, Pin, PinOff,
  ImagePlus, Paperclip, FileText, Download, ChevronDown,
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
  updated_at?: string | null
  created_by_name?: string | null
  created_by_photo_url?: string | null
  poster_role?: string | null
  poster_department_id?: string | null
  poster_department_name?: string | null
}

type CompanyMember = { id: string; full_name: string; role: string; profile_photo_url?: string | null }

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


// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  Owner: '#FFFFFF',
  Partner: '#FFFFFF',
  Manager: '#EA580C',
  Employee: '#4B5563',
}

const ROLE_BG: Record<string, string> = {
  Owner: '#0F172A',
  Partner: '#0F172A',
  Manager: '#FFF7ED',
  Employee: '#F3F4F6',
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
  if (diff < 60000) return 'Just Now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Like formatTime, but once it falls back to a plain date it also appends the
// post time — used where the exact time an announcement went out matters.
function formatDateWithTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'Just Now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff < 86400000) return time
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString([], { month: 'short' })
  return `${day} ${month}, ${time}`
}

// Announcements only ever get `updated_at` set by an edit (never on insert),
// so its presence means "this was edited" — show that instead of the post time.
function formatAnnouncementTimestamp(ann: { created_at: string; updated_at?: string | null }) {
  if (ann.updated_at) return `Edited ${formatDateWithTime(ann.updated_at)}`
  return formatDateWithTime(ann.created_at)
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

function Avatar({ name, size = 36, role, photoUrl }: { name: string; size?: number; role?: string; photoUrl?: string | null }) {
  if (photoUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        flexShrink: 0,
      }}>
        <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
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

// ─── Custom Dropdown Field ────────────────────────────────────────────────────

function DropdownField({ value, options, onChange, placeholder, disabled = false }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const selected = options.find(o => o.value === value)
  const canOpen = !disabled && options.length > 0

  const handleOpen = () => {
    if (!canOpen) return
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const DROPDOWN_H = Math.min(options.length * 37 + 8, 208)
      const fitsBelow = r.bottom + DROPDOWN_H + 4 <= window.innerHeight
      setPos({ top: fitsBelow ? r.bottom + 4 : r.top - DROPDOWN_H - 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" disabled={disabled}
        onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', border: `1.5px solid ${open ? '#F97316' : '#E2E8F0'}`, borderRadius: 9,
          background: disabled ? '#F9FAFB' : '#FFFFFF', cursor: canOpen ? 'pointer' : 'default',
          fontSize: 13, color: selected ? '#0F172A' : '#9CA3AF',
          fontWeight: selected ? 500 : 400, outline: 'none', boxSizing: 'border-box' as const,
          transition: 'border-color 0.15s',
          boxShadow: open ? '0 0 0 3px rgba(249,115,22,0.10)' : 'none',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronDown size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={dropdownRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 9999, maxHeight: 208, overflowY: 'auto',
          padding: '4px 0',
        }}>
          {options.map(opt => {
            const isSel = opt.value === value
            return (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left',
                  border: 'none', background: isSel ? '#FFF7ED' : 'transparent',
                  color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400,
                  fontSize: 13, cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >{opt.label}</button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerCommunicationPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'announcements' | 'invites'>('chat')
  const commTabBarRef = useRef<HTMLDivElement>(null)
  const commTabButtonRefs = useRef<Record<'chat' | 'announcements' | 'invites', HTMLButtonElement | null>>({ chat: null, announcements: null, invites: null })
  const [commTabIndicator, setCommTabIndicator] = useState({ left: 0, width: 0, opacity: 0 })

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
  const [unreadAnnCountState, setUnreadAnnCountState] = useState(0)

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [annSearch, setAnnSearch] = useState('')
  const [othersSearch, setOthersSearch] = useState('')
  const [othersDeptFilter, setOthersDeptFilter] = useState<string>('all')
  const [othersDeptFilterOpen, setOthersDeptFilterOpen] = useState(false)
  const othersDeptFilterRef = useRef<HTMLDivElement>(null)

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
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null)

  // Multi-panel chat state (up to 4 panels)
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([])
  const [panelMessages, setPanelMessages] = useState<Record<string, Message[]>>({})
  const [panelInputs, setPanelInputs] = useState<Record<string, string>>({})
  const [panelSending, setPanelSending] = useState<Record<string, boolean>>({})
  const [panelAttachFiles, setPanelAttachFiles] = useState<Record<string, File[]>>({})
  const [panelAttachPreviews, setPanelAttachPreviews] = useState<Record<string, (string | null)[]>>({})
  const [panelUploading, setPanelUploading] = useState<Record<string, boolean>>({})
  const [dragOver, setDragOver] = useState<string | null>(null) // panelId being dragged over
  const [draggingPanel, setDraggingPanel] = useState<string | null>(null)
  const panelPhotoRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const panelFileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const panelEndRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const panelContainerRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const panelPrevRects = useRef<Record<string, DOMRect>>({})

  const [msgSubTab, setMsgSubTab] = useState<'messages' | 'invites'>('messages')
  // kept for backward compat (pendingPartnerId flow)
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [invites, setInvites] = useState<InboxInvite[]>([])
  const [successToast, setSuccessToast] = useState('')
  const [errorToast, setErrorToast] = useState('')
  const successToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteActing, setInviteActing] = useState<string | null>(null)

  const [composeOpen, setComposeOpen] = useState(false)
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([])
  const [composeSearch, setComposeSearch] = useState('')

  const [pendingPartnerId, setPendingPartnerId] = useState<string | null>(null)
  const [pendingPrefill, setPendingPrefill] = useState('')
  const [conversationsFetched, setConversationsFetched] = useState(false)

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
      .then(d => { if (d.success) { setDepartments(d.departments ?? []); setDeptColorOverrides(d.departments ?? []) } })
      .catch(() => {})
    const uid = localStorage.getItem('tasking_user_id')
    if (uid) {
      fetch(`/api/company/current?user_id=${uid}&company_id=${companyId}`)
        .then(r => r.json())
        .then(d => { if (d.success) setCurrentPlan(d.company?.plan ?? 'Free') })
        .catch(() => {})
    }
  }, [companyId])

  useEffect(() => {
    if (!othersDeptFilterOpen) return
    const handler = (e: MouseEvent) => { if (!othersDeptFilterRef.current?.contains(e.target as Node)) setOthersDeptFilterOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [othersDeptFilterOpen])

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

  // `keepPlaceholderId`: when refreshing after opening a brand-new conversation
  // (zero messages yet), the server's list won't include that partner — keep
  // whatever local placeholder entry already exists for them so the open panel
  // doesn't lose its `conv` lookup and disappear.
  const fetchConversations = useCallback((keepPlaceholderId?: string) => {
    if (!internalUserId) return
    fetch(`/api/inbox/messages?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const fetched = (d.conversations ?? []) as Conversation[]
          setConversations(prev => {
            const fetchedIds = new Set(fetched.map(c => c.partnerId))
            const placeholder = keepPlaceholderId && !fetchedIds.has(keepPlaceholderId)
              ? prev.find(c => c.partnerId === keepPlaceholderId)
              : undefined
            return placeholder ? [placeholder, ...fetched] : fetched
          })
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
    // Load pinned conversations from localStorage
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
    window.history.replaceState({}, '', '/owner/communication')
    const found = conversations.find(c => c.partnerId === pid)
    if (found) {
      openPanel(found.partnerId)
      if (pre) setPanelInputs(p => ({ ...p, [found.partnerId]: pre }))
    } else {
      fetch(`/api/team/members?company_id=${companyId}`)
        .then(r => r.json())
        .then(d => {
          if (!d.success) return
          const eligible = (d.members as CompanyMember[]).filter(m => m.role !== 'Casual Worker' && m.id !== internalUserId)
          setCompanyMembers(eligible)
          const partner = eligible.find(m => m.id === pid)
          if (partner) {
            selectComposeRecipient(partner)
            if (pre) setPanelInputs(p => ({ ...p, [partner.id]: pre }))
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
    const base = q ? conversations.filter(c => c.partnerName.toLowerCase().includes(q)) : conversations
    const sorted = [...base].sort((a, b) => {
      const aPin = pinnedIds.has(a.partnerId) ? 0 : 1
      const bPin = pinnedIds.has(b.partnerId) ? 0 : 1
      return aPin - bPin
    })
    setFilteredConversations(sorted)
  }, [search, conversations, pinnedIds])

  // Fetch messages when a panel is opened
  function fetchPanelMessages(partnerId: string) {
    if (!internalUserId) return
    fetch(`/api/inbox/messages/${partnerId}?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPanelMessages(prev => ({ ...prev, [partnerId]: d.messages ?? [] }))
          fetch(`/api/inbox/messages/${partnerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: internalUserId }),
          }).then(() => { fetchUnreadCount(); fetchConversations(partnerId) }).catch(() => {})
        }
      })
  }

  // Scroll panel to bottom when messages arrive
  useEffect(() => {
    for (const pid of openPanelIds) {
      panelEndRefs.current[pid]?.scrollIntoView({ behavior: 'smooth' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMessages])

  // FLIP: after panels reorder (swap), slide each one from its previous
  // screen position into its new one instead of snapping instantly.
  useLayoutEffect(() => {
    const prevRects = panelPrevRects.current
    if (Object.keys(prevRects).length === 0) return
    for (const id of openPanelIds) {
      const el = panelContainerRefs.current[id]
      const prev = prevRects[id]
      if (!el || !prev) continue
      const next = el.getBoundingClientRect()
      const dx = prev.left - next.left
      const dy = prev.top - next.top
      if (!dx && !dy) continue
      el.style.transition = 'none'
      el.style.transform = `translate(${dx}px, ${dy}px)`
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.getBoundingClientRect() // force reflow before releasing the transition
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)'
        el.style.transform = ''
      })
    }
    panelPrevRects.current = {}
  }, [openPanelIds])

  useEffect(() => {
    if (!internalUserId) return
    const channel = supabase
      .channel('owner-comm-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user_id=eq.${internalUserId}` },
        (payload) => {
          const newMsg = payload.new as Message
          // Append to any open panel that matches the sender
          setPanelMessages(prev => {
            if (prev[newMsg.from_user_id] !== undefined) {
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
    if (!companyId || !internalUserId) return
    const next = new Set(readIds)
    next.add(ann.id)
    setReadIds(next)
    saveReadIds(companyId, internalUserId, next)
  }

  const unreadAnnCount = announcements.filter(a => !readIds.has(a.id)).length

  useEffect(() => { setUnreadAnnCountState(unreadAnnCount) }, [unreadAnnCount])

  useLayoutEffect(() => {
    const container = commTabBarRef.current
    const activeButton = commTabButtonRefs.current[activeTab]
    if (!container || !activeButton) return
    const containerRect = container.getBoundingClientRect()
    const activeRect = activeButton.getBoundingClientRect()
    setCommTabIndicator({ left: activeRect.left - containerRect.left, width: activeRect.width, opacity: 1 })
  }, [activeTab, unreadMessages, unreadAnnCountState])

  function showSuccessToast(message: string) {
    if (successToastTimerRef.current) clearTimeout(successToastTimerRef.current)
    setSuccessToast(message)
    successToastTimerRef.current = setTimeout(() => setSuccessToast(''), 3000)
  }

  function showErrorToast(message: string) {
    if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current)
    setErrorToast(message)
    errorToastTimerRef.current = setTimeout(() => setErrorToast(''), 3000)
  }

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
        showSuccessToast('Announcement posted')
      } else {
        showErrorToast(data.error ?? 'Failed to post announcement')
      }
    } catch {
      showErrorToast('Failed to post announcement')
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
      showSuccessToast('Announcement deleted')
    } catch (err) {
      fetchAnnouncements()
      showErrorToast(err instanceof Error ? err.message : 'Failed to delete announcement')
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
          announcement_id: selectedAnn.id, requesting_user_id: internalUserId,
          title: editTitle, content: editContent, department_id: deptId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed to save')
      setShowEditModal(false)
      fetchAnnouncements()
      setSelectedAnn(prev => prev ? { ...prev, title: editTitle, content: editContent, department_id: deptId, updated_at: new Date().toISOString() } : prev)
      showSuccessToast('Announcement updated')
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'An error occurred')
    } finally { setSaving(false) }
  }

  const canPostCompanyWide = ['owner', 'partner'].includes(userRole?.toLowerCase())
  const communicationReady = Boolean(internalUserId && companyId)

  const openCompose = useCallback(() => {
    if (!companyId || !internalUserId) return
    setComposeOpen(true)
    setComposeSearch('')
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
      showSuccessToast(`You have joined ${invite.company_name}`)
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Something went wrong')
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
      showSuccessToast('Invitation declined')
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setInviteActing(null) }
  }

  // Picking a recipient opens the chat panel immediately — no separate "type then Send"
  // step, since the recipient may just want to send a photo/file rather than text.
  function selectComposeRecipient(member: CompanyMember) {
    setComposeOpen(false)
    replaceOpenPanels(member.id)
    setConversations(prev => {
      if (prev.some(c => c.partnerId === member.id)) return prev
      const placeholder: Conversation = {
        partnerId: member.id,
        partnerName: member.full_name,
        partnerRole: member.role,
        lastMessage: '',
        lastTime: new Date().toISOString(),
        unreadCount: 0,
      }
      return [placeholder, ...prev]
    })
    if (!panelMessages[member.id]) fetchPanelMessages(member.id)
  }

  // ── Panel management ──────────────────────────────────────────────────────────

  // Replace whatever panels were open with just `keepId`, in one atomic update —
  // no intermediate frame where the old panel and the new one are both/neither present.
  function replaceOpenPanels(keepId: string) {
    const closedIds = openPanelIds.filter(id => id !== keepId)
    if (closedIds.length > 0) {
      setPanelMessages(prev => { const n = { ...prev }; closedIds.forEach(id => delete n[id]); return n })
      setPanelInputs(prev => { const n = { ...prev }; closedIds.forEach(id => delete n[id]); return n })
      setPanelSending(prev => { const n = { ...prev }; closedIds.forEach(id => delete n[id]); return n })
      setPanelAttachFiles(prev => { const n = { ...prev }; closedIds.forEach(id => delete n[id]); return n })
      setPanelAttachPreviews(prev => { const n = { ...prev }; closedIds.forEach(id => delete n[id]); return n })
      setPanelUploading(prev => { const n = { ...prev }; closedIds.forEach(id => delete n[id]); return n })
    }
    setOpenPanelIds([keepId])
    if (!panelMessages[keepId]) fetchPanelMessages(keepId)
  }

  // Clicking a conversation always shows it full-screen (replaces whatever's open).
  // Side-by-side split is only triggered by explicitly dragging a conversation
  // onto an already-open panel — see the drop handlers below.
  function openPanelSolo(partnerId: string) {
    if (openPanelIds.length === 1 && openPanelIds[0] === partnerId) return
    replaceOpenPanels(partnerId)
  }

  // Appends `partnerId` alongside whatever panels are already open (up to 4) —
  // used only by the drag-to-split interaction, never by a plain click.
  function openPanel(partnerId: string) {
    setOpenPanelIds(prev => {
      if (prev.includes(partnerId)) return prev // already open
      const next = prev.length >= 4 ? [...prev.slice(1), partnerId] : [...prev, partnerId]
      return next
    })
    // Fetch messages if not loaded yet
    if (!panelMessages[partnerId]) {
      fetchPanelMessages(partnerId)
    }
  }

  function closePanel(partnerId: string) {
    setOpenPanelIds(prev => prev.filter(id => id !== partnerId))
    setPanelMessages(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelInputs(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelSending(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelAttachFiles(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelAttachPreviews(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelUploading(prev => { const n = { ...prev }; delete n[partnerId]; return n })
  }

  // Closing the "X" button: if this conversation never had a message sent
  // (a compose placeholder that was never used), drop it from the sidebar
  // too — it was never a real conversation, just local scaffolding.
  function handleClosePanel(partnerId: string) {
    const conv = conversations.find(c => c.partnerId === partnerId)
    if (conv && conv.lastMessage === '') {
      setConversations(prev => prev.filter(c => c.partnerId !== partnerId))
    }
    closePanel(partnerId)
  }

  async function deleteConversation(partnerId: string) {
    if (!internalUserId) return
    setDeletingConvId(partnerId)
    try {
      const res = await fetch(`/api/inbox/messages/${partnerId}?user_id=${internalUserId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed to delete conversation')
      closePanel(partnerId)
      setConversations(prev => prev.filter(c => c.partnerId !== partnerId))
      setPinnedIds(prev => {
        if (!prev.has(partnerId)) return prev
        const next = new Set(prev)
        next.delete(partnerId)
        if (internalUserId) localStorage.setItem(`pinned_convs_${internalUserId}`, JSON.stringify([...next]))
        return next
      })
      showSuccessToast('Conversation deleted')
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Failed to delete conversation')
    } finally {
      setDeletingConvId(null)
    }
  }

  function swapPanels(idA: string, idB: string) {
    // Capture pre-swap positions so the layout effect below can FLIP-animate
    // each panel sliding from its old spot into its new one.
    openPanelIds.forEach(id => {
      const el = panelContainerRefs.current[id]
      if (el) panelPrevRects.current[id] = el.getBoundingClientRect()
    })
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

  function pickPanelAttachments(partnerId: string, files: File[]) {
    setPanelAttachFiles(prev => ({ ...prev, [partnerId]: [...(prev[partnerId] ?? []), ...files] }))
    setPanelAttachPreviews(prev => ({ ...prev, [partnerId]: [...(prev[partnerId] ?? []), ...files.map(() => null)] }))
    files.forEach((file, i) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = e => {
        const dataUrl = e.target?.result as string
        setPanelAttachPreviews(prev => {
          const existing = prev[partnerId] ?? []
          const baseIndex = existing.length - files.length + i
          const next = [...existing]
          next[baseIndex] = dataUrl
          return { ...prev, [partnerId]: next }
        })
      }
      reader.readAsDataURL(file)
    })
  }

  function removePanelAttachment(partnerId: string, index: number) {
    setPanelAttachFiles(prev => ({ ...prev, [partnerId]: (prev[partnerId] ?? []).filter((_, i) => i !== index) }))
    setPanelAttachPreviews(prev => ({ ...prev, [partnerId]: (prev[partnerId] ?? []).filter((_, i) => i !== index) }))
  }

  function clearPanelAttachment(partnerId: string) {
    setPanelAttachFiles(prev => ({ ...prev, [partnerId]: [] }))
    setPanelAttachPreviews(prev => ({ ...prev, [partnerId]: [] }))
    const photoEl = panelPhotoRefs.current[partnerId]
    const fileEl = panelFileRefs.current[partnerId]
    if (photoEl) photoEl.value = ''
    if (fileEl) fileEl.value = ''
  }

  async function uploadAndSendPanelAttachment(partnerId: string) {
    const files = panelAttachFiles[partnerId] ?? []
    const conv = conversations.find(c => c.partnerId === partnerId)
    if (files.length === 0 || !conv || !internalUserId || !companyId) return
    setPanelUploading(prev => ({ ...prev, [partnerId]: true }))
    try {
      for (const file of files) {
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
        }
      }
      fetchConversations()
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Upload failed')
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

  function matchesAnnSearch(ann: Announcement, term: string) {
    return ann.title.toLowerCase().includes(term.toLowerCase()) ||
      ann.content.toLowerCase().includes(term.toLowerCase()) ||
      (ann.created_by_name ?? '').toLowerCase().includes(term.toLowerCase())
  }

  const filteredAnnouncements = annSearch
    ? announcements.filter(ann => matchesAnnSearch(ann, annSearch))
    : announcements

  const myAnnouncements = filteredAnnouncements.filter(ann => ann.from_user_id === internalUserId)

  const othersAnnouncements = announcements
    .filter(ann => ann.from_user_id !== internalUserId)
    .filter(ann => !othersSearch || matchesAnnSearch(ann, othersSearch))
    .filter(ann => othersDeptFilter === 'all' || ann.poster_department_id === othersDeptFilter)

  function renderAnnouncementCard(ann: Announcement, i: number, showAudience: boolean) {
    const unread = !readIds.has(ann.id)
    const selected = selectedAnn?.id === ann.id
    const deptName = ann.department_id ? (departments.find(d => d.id === ann.department_id)?.name ?? 'Dept') : null
    const isMine = ann.from_user_id === internalUserId
    return (
      <div
        key={ann.id}
        className="comm-ann-card"
        onClick={() => handleSelectAnn(ann)}
        style={{
          display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 18px',
          background: selected ? '#FFF7ED' : '#FFFFFF',
          border: selected ? '1.5px solid rgba(249,115,22,0.35)' : '1.5px solid #EDF2F7',
          borderRadius: 12, cursor: 'pointer', width: '100%', marginBottom: 8,
          boxShadow: selected ? '0 6px 18px rgba(249,115,22,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
          animationDelay: `${i * 0.04}s`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {showAudience
            ? <DepartmentBadge departmentId={ann.department_id} departmentName={deptName} fallbackIcon={<Globe size={9} />} />
            : <DepartmentBadge departmentId={ann.poster_department_id} departmentName={ann.poster_department_name} fallbackLabel="Owner/Partner" fallbackIcon={<Globe size={9} />} />}
          <span style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 500, flexShrink: 0 }}>{formatAnnouncementTimestamp(ann)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: unread ? 800 : 600, fontSize: 13, lineHeight: '15px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
            {ann.title}
          </span>
          {isMine && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => handleOpenEdit(ann)}
                title="Edit announcement"
                style={{ border: 'none', background: 'transparent', color: '#6B7280', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: 6 }}
                onMouseEnter={e => { e.currentTarget.style.color = '#F97316'; e.currentTarget.style.background = '#FFF7ED' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent' }}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(ann.id)}
                title="Delete announcement"
                style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: 6 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F7F8FA', color: '#0F172A' }}>
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
          transition: all 0.13s ease;
        }
        .comm-tab-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .comm-action-btn {
          transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
        }
        .comm-action-btn:hover {
          background: #EA6C0A !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(249,115,22,0.30);
        }
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

      <main style={{ marginLeft: '64px', flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Communication
            </h1>
          </div>
          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId ?? ''} />}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* Tab switcher row — floating pill capsule with animated indicator, matches Shifts/Tasks pages */}
        <div style={{ padding: '0 28px 16px', flexShrink: 0 }}>
          <div
            ref={commTabBarRef}
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
                left: commTabIndicator.left,
                width: commTabIndicator.width,
                height: 'calc(100% - 8px)',
                borderRadius: 999,
                background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
                boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
                opacity: commTabIndicator.opacity,
                transform: commTabIndicator.opacity ? 'translateY(0)' : 'translateY(4px)',
                transition: 'left 0.24s cubic-bezier(0.22, 1, 0.36, 1), width 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                pointerEvents: 'none',
              }}
            />
            {([
              { key: 'chat',          label: 'Chat',          badge: unreadMessages  },
              { key: 'announcements', label: 'Announcements', badge: unreadAnnCount  },
              // 'invites' tab hidden from UI; logic kept in place for later reuse elsewhere.
            ] as const).map(tab => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  ref={el => { commTabButtonRefs.current[tab.key] = el }}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
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

        {/* Content panel — each block (list, chat/detail area) is its own separate card;
            no shared outer card wrapping them, matching the Shifts/Team page pattern. */}
        <div style={{ padding: '0 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* Main communication panel */}
        <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ── Chat tab ── */}
          {activeTab === 'chat' && (
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: 12, overflow: 'hidden' }}>

              {/* Left: conversations — own card, sized to fit its content (not stretched full height) */}
              <div style={{ alignSelf: 'start', maxHeight: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageSquare size={15} style={{ color: '#F97316' }} />
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Chatbox</span>
                </div>
                <div style={{ padding: '10px 12px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0, height: 36, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0 13px' }}>
                    <Search size={15} color="#94A3B8" />
                    <input
                      value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search conversations..."
                      style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#0F172A', fontWeight: 500 }}
                    />
                  </div>
                  <button onClick={openCompose} disabled={!communicationReady} title="New message"
                    className={communicationReady ? 'comm-action-btn' : ''}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: communicationReady ? '#F97316' : '#E5E7EB', border: 'none', borderRadius: 10, color: communicationReady ? '#fff' : '#9CA3AF', cursor: communicationReady ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                  >
                    <SquarePen size={18} strokeWidth={2.5} />
                  </button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '14px 10px 10px' }}>
                    {filteredConversations.length === 0 ? (
                      <div style={{ height: 180, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
                        <MessageSquare size={26} strokeWidth={1.5} />
                        {search ? 'No results' : 'No conversations yet'}
                      </div>
                    ) : filteredConversations.map((conv, i) => {
                      const active = openPanelIds.includes(conv.partnerId)
                      const isPinned = pinnedIds.has(conv.partnerId)
                      // clean up preview text for attachments
                      const fileMatch = conv.lastMessage.match(/^\[file:(.+?)\]/)
                      const isImagePreview = conv.lastMessage.startsWith('[image:]')
                      const previewText = isImagePreview ? 'Photo' : fileMatch ? fileMatch[1] : conv.lastMessage
                      return (
                        <div
                          key={conv.partnerId}
                          className="comm-conv-card"
                          draggable
                          onDragStart={e => { e.dataTransfer.setData('listPartnerId', conv.partnerId) }}
                          title="Drag onto an open conversation to view side by side"
                          style={{
                            position: 'relative',
                            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 54px 12px 12px',
                            background: active ? '#FFF7ED' : '#FFFFFF',
                            border: active ? '1.5px solid rgba(249,115,22,0.35)' : '1.5px solid #EDF2F7',
                            borderRadius: 12, cursor: 'grab', textAlign: 'left', width: '100%', marginBottom: 14,
                            boxShadow: active ? '0 6px 18px rgba(249,115,22,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                            animationDelay: `${i * 0.04}s`,
                          }}
                        >
                          <button onClick={() => openPanelSolo(conv.partnerId)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                            <Avatar name={conv.partnerName} size={40} role={conv.partnerRole} photoUrl={companyMembers.find(m => m.id === conv.partnerId)?.profile_photo_url ?? null} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                                  <span style={{ fontWeight: conv.unreadCount > 0 ? 800 : 600, fontSize: 13.5, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {conv.partnerName}
                                  </span>
                                  {isPinned && (
                                    <Pin size={12} strokeWidth={2.5} style={{ color: '#F97316', flexShrink: 0 }} />
                                  )}
                                  {conv.partnerDeleted && (
                                    <span style={{ background: '#F1F5F9', color: '#6B7280', fontSize: 10, padding: '1px 6px', borderRadius: 999, flexShrink: 0, fontWeight: 700 }}>removed</span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: conv.unreadCount > 0 ? '#374151' : '#9CA3AF', fontWeight: conv.unreadCount > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  {isImagePreview ? <ImagePlus size={12} strokeWidth={2} style={{ flexShrink: 0 }} /> : fileMatch ? <FileText size={12} strokeWidth={2} style={{ flexShrink: 0 }} /> : null}
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewText}</span>
                                </span>
                                {conv.unreadCount > 0 && (
                                  <div style={{ minWidth: 20, height: 20, borderRadius: 999, background: '#F97316', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                                    {conv.unreadCount}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                          <span style={{ position: 'absolute', top: 10, right: 12, fontSize: 11.5, color: '#9CA3AF', fontWeight: 500 }}>{formatTime(conv.lastTime)}</span>
                          <button
                            onClick={() => deleteConversation(conv.partnerId)}
                            title="Delete conversation"
                            disabled={deletingConvId === conv.partnerId}
                            style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#DC2626', transition: 'color 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#B91C1C' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#DC2626' }}
                          >
                            {deletingConvId === conv.partnerId ? <Spinner size={12} /> : <Trash2 size={14} strokeWidth={2} />}
                          </button>
                        </div>
                      )
                    })}
                  </div>
              </div>

              {/* Right: multi-panel chat area */}
              <div style={{ minWidth: 0, minHeight: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {openPanelIds.length === 0 ? (
                  /* Empty state */
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault()
                      const draggedListId = e.dataTransfer.getData('listPartnerId')
                      if (draggedListId) openPanel(draggedListId)
                    }}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 18, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#F97316' }}>
                        <MessageSquare size={24} strokeWidth={1.5} />
                      </div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#374151' }}>Select a conversation to start chatting</p>
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>Drag a conversation onto an open one to view up to 4 side by side</p>
                    </div>
                  </div>
                ) : (
                  /* Panel grid — layout depends on count */
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
                      const attachFiles = panelAttachFiles[partnerId] ?? []
                      const attachPreviews = panelAttachPreviews[partnerId] ?? []
                      const uploading = panelUploading[partnerId] ?? false
                      const isPinned = pinnedIds.has(partnerId)
                      // 3-panel: slot 0 spans both rows in the left column
                      const spanStyle: React.CSSProperties = openPanelIds.length === 3 && idx === 0
                        ? { gridRow: '1 / 3' } : {}

                      return (
                        <div
                          key={partnerId}
                          ref={el => { panelContainerRefs.current[partnerId] = el }}
                          style={{
                            ...spanStyle,
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            background: '#FFFFFF', borderRadius: 14,
                            border: dragOver === partnerId ? '2px dashed #F97316' : '1px solid #E5E7EB',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                            opacity: draggingPanel === partnerId ? 0.45 : 1,
                            transform: dragOver === partnerId ? 'scale(1.015)' : 'scale(1)',
                            transition: 'border-color 0.15s, opacity 0.15s, transform 0.15s',
                          }}
                          onDragOver={e => { e.preventDefault(); setDragOver(partnerId) }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={e => {
                            e.preventDefault()
                            setDragOver(null)
                            const draggedPanelId = e.dataTransfer.getData('panelId')
                            const draggedListId = e.dataTransfer.getData('listPartnerId')
                            if (draggedPanelId && draggedPanelId !== partnerId) swapPanels(draggedPanelId, partnerId)
                            else if (draggedListId && draggedListId !== partnerId) openPanel(draggedListId)
                            setDraggingPanel(null)
                          }}
                        >
                          {/* Panel header — floating card */}
                          <div
                            draggable
                            onDragStart={e => { e.dataTransfer.setData('panelId', partnerId); setDraggingPanel(partnerId) }}
                            onDragEnd={() => setDraggingPanel(null)}
                            style={{ width: '92%', margin: '12px auto 0', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, cursor: openPanelIds.length > 1 ? 'grab' : 'default', userSelect: 'none' }}
                            title={openPanelIds.length > 1 ? 'Drag to swap panels' : undefined}
                          >
                            <Avatar name={conv.partnerName} size={38} role={conv.partnerRole} photoUrl={companyMembers.find(m => m.id === conv.partnerId)?.profile_photo_url ?? null} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 800, fontSize: 15.5, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.partnerName}</span>
                                {conv.partnerDeleted && <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 10, padding: '2px 6px', borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>removed</span>}
                                {isPinned && <Pin size={11} strokeWidth={2.5} style={{ color: '#F97316', flexShrink: 0 }} />}
                              </div>
                            </div>
                            {/* Pin button */}
                            <button
                              onClick={() => togglePin(partnerId)}
                              title={isPinned ? 'Unpin' : 'Pin'}
                              style={{ flexShrink: 0, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF7ED', border: isPinned ? '1.5px solid rgba(249,115,22,0.45)' : '1.5px solid rgba(249,115,22,0.25)', borderRadius: 9, cursor: 'pointer', color: '#F97316', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#FFEDD5'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.55)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#FFF7ED'; e.currentTarget.style.borderColor = isPinned ? 'rgba(249,115,22,0.45)' : 'rgba(249,115,22,0.25)' }}
                            >
                              {isPinned ? <PinOff size={15} strokeWidth={2.5} /> : <Pin size={15} strokeWidth={2.5} />}
                            </button>
                            {/* Delete button */}
                            <button
                              onClick={() => deleteConversation(partnerId)}
                              title="Delete conversation"
                              disabled={deletingConvId === partnerId}
                              style={{ flexShrink: 0, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', border: '1.5px solid rgba(220,38,38,0.3)', borderRadius: 9, cursor: 'pointer', color: '#DC2626', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#B91C1C'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.45)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)' }}
                            >
                              {deletingConvId === partnerId ? <Spinner size={13} /> : <Trash2 size={15} strokeWidth={2.5} />}
                            </button>
                            {/* Close button */}
                            <button
                              onClick={() => handleClosePanel(partnerId)}
                              title="Close"
                              style={{ flexShrink: 0, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 9, cursor: 'pointer', color: '#94A3B8', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = '#E2E8F0' }}
                            >
                              <X size={15} strokeWidth={2.5} />
                            </button>
                          </div>
                          {/* Messages — floating card, same width as the header/footer cards */}
                          <div style={{ flex: 1, minHeight: 0, width: '92%', margin: '10px auto', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {msgs.length === 0 && (
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                <Avatar name={conv.partnerName} size={64} role={conv.partnerRole} photoUrl={companyMembers.find(m => m.id === conv.partnerId)?.profile_photo_url ?? null} />
                                <p style={{ margin: '16px 0 0', fontWeight: 700, fontSize: 15, color: '#374151' }}>No messages yet</p>
                                <p style={{ margin: '5px 0 0', fontSize: 12.5, color: '#9CA3AF', fontWeight: 500 }}>Send a message to start chatting with {conv.partnerName}</p>
                              </div>
                            )}
                            {msgs.map(msg => {
                              const isMine = msg.from_user_id === internalUserId
                              const isImage = msg.content.startsWith('[image:]')
                              const fileMatch = msg.content.match(/^\[file:(.+?)\](.+)$/)
                              const isFile = Boolean(fileMatch)
                              const imgUrl = isImage ? msg.content.slice('[image:]'.length) : null
                              const fileName = fileMatch?.[1] ?? null
                              const fileUrl = fileMatch?.[2] ?? null
                              return (
                                <div key={msg.id} className="comm-msg-bubble" style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
                                  {!isMine && <Avatar name={conv.partnerName} size={22} role={conv.partnerRole} photoUrl={companyMembers.find(m => m.id === conv.partnerId)?.profile_photo_url ?? null} />}
                                  {isImage && imgUrl ? (
                                    <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 3 }}>
                                      <a href={imgUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: isMine ? '12px 12px 3px 12px' : '12px 12px 12px 3px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                                        <img src={imgUrl} alt="attachment" style={{ display: 'block', maxWidth: '100%', maxHeight: 180, objectFit: 'cover' }} />
                                      </a>
                                      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{formatTime(msg.created_at)}</span>
                                    </div>
                                  ) : isFile && fileUrl ? (
                                    <div style={{ maxWidth: '70%', padding: '8px 11px', borderRadius: isMine ? '13px 13px 3px 13px' : '13px 13px 13px 3px', background: isMine ? '#FFEDD5' : '#FFFFFF', border: isMine ? '1px solid #FED7AA' : '1px solid #EDF2F7', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={14} color="#3B82F6" /></div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</p>
                                          <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={fileName ?? true} style={{ fontSize: 10.5, color: '#3B82F6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2, marginTop: 1, textDecoration: 'none' }}><Download size={9} /> Download</a>
                                        </div>
                                      </div>
                                      <div style={{ fontSize: 11, marginTop: 4, color: '#94A3B8', fontWeight: 500, textAlign: isMine ? 'right' : 'left' }}>{formatTime(msg.created_at)}</div>
                                    </div>
                                  ) : (
                                    <div style={{ maxWidth: '70%', padding: '8px 11px', borderRadius: isMine ? '13px 13px 3px 13px' : '13px 13px 13px 3px', background: isMine ? '#FFEDD5' : '#FFFFFF', border: isMine ? '1px solid #FED7AA' : '1px solid #EDF2F7', color: '#0F172A', fontSize: 15, fontWeight: 500, lineHeight: 1.5, boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                                      {msg.content}
                                      <div style={{ fontSize: 11, marginTop: 8, color: '#94A3B8', fontWeight: 500, textAlign: isMine ? 'right' : 'left' }}>{formatTime(msg.created_at)}</div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                            <div ref={el => { panelEndRefs.current[partnerId] = el }} />
                          </div>
                          </div>

                          {/* Attachments + input — floating card, same width as the header card */}
                          <div style={{ width: '92%', margin: '0 auto 12px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, flexShrink: 0, overflow: 'hidden' }}>
                          {attachFiles.length > 0 && (
                            <div style={{ padding: '10px 12px 0', background: '#FFFFFF', flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {attachFiles.map((file, i) => (
                                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 9, padding: '5px 9px', maxWidth: '100%' }}>
                                  {attachPreviews[i] ? (
                                    <img src={attachPreviews[i]!} alt="preview" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                                  ) : (
                                    <div style={{ width: 30, height: 30, borderRadius: 7, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={14} color="#3B82F6" /></div>
                                  )}
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{file.name}</p>
                                    <p style={{ margin: '1px 0 0', fontSize: 10.5, color: '#94A3B8', fontWeight: 500 }}>{(file.size / 1024).toFixed(1)} KB</p>
                                  </div>
                                  <button onClick={() => removePanelAttachment(partnerId, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'flex', flexShrink: 0 }}><X size={12} /></button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Input bar */}
                          <div style={{ padding: '10px 12px', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                            {/* Hidden file inputs scoped to this panel */}
                            <input
                              type="file" accept="image/*" multiple style={{ display: 'none' }}
                              ref={el => { panelPhotoRefs.current[partnerId] = el }}
                              onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) pickPanelAttachments(partnerId, files); e.target.value = '' }}
                            />
                            <input
                              type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" multiple style={{ display: 'none' }}
                              ref={el => { panelFileRefs.current[partnerId] = el }}
                              onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) pickPanelAttachments(partnerId, files); e.target.value = '' }}
                            />
                            {!conv.partnerDeleted && (
                              <button onClick={() => panelPhotoRefs.current[partnerId]?.click()} title="Send photo"
                                style={{ flexShrink: 0, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF7ED', border: '1.5px solid rgba(249,115,22,0.25)', borderRadius: 10, cursor: 'pointer', color: '#F97316', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#FFEDD5'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.45)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#FFF7ED'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.25)' }}>
                                <ImagePlus size={18} strokeWidth={2} />
                              </button>
                            )}
                            {!conv.partnerDeleted && (
                              <button onClick={() => panelFileRefs.current[partnerId]?.click()} title="Send file"
                                style={{ flexShrink: 0, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EFF6FF', border: '1.5px solid rgba(59,130,246,0.25)', borderRadius: 10, cursor: 'pointer', color: '#3B82F6', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.45)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)' }}>
                                <Paperclip size={17} strokeWidth={2} />
                              </button>
                            )}
                            <input
                              value={input}
                              autoFocus={!conv.partnerDeleted}
                              onChange={e => setPanelInputs(p => ({ ...p, [partnerId]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !conv.partnerDeleted) { e.preventDefault(); if (attachFiles.length > 0) uploadAndSendPanelAttachment(partnerId); else handleSendMessage(partnerId) } }}
                              placeholder={conv.partnerDeleted ? "Account removed" : 'Type a message…'}
                              disabled={conv.partnerDeleted}
                              className="comm-input"
                              style={{ flex: 1, height: 42, padding: '0 14px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 14, fontWeight: 500, outline: 'none', background: conv.partnerDeleted ? '#F8FAFC' : '#FFFFFF', color: conv.partnerDeleted ? '#94A3B8' : '#0F172A', cursor: conv.partnerDeleted ? 'not-allowed' : undefined, transition: 'border-color 0.15s, box-shadow 0.15s' }}
                            />
                            {!conv.partnerDeleted && (
                              <button
                                onClick={() => { if (attachFiles.length > 0) uploadAndSendPanelAttachment(partnerId); else handleSendMessage(partnerId) }}
                                disabled={sending || uploading || (!input.trim() && attachFiles.length === 0)}
                                style={{ height: 42, padding: '0 16px', background: (sending || uploading || (!input.trim() && attachFiles.length === 0)) ? '#E5E7EB' : '#F97316', color: (sending || uploading || (!input.trim() && attachFiles.length === 0)) ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 10, cursor: (sending || uploading || (!input.trim() && attachFiles.length === 0)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, transition: 'background 0.15s', flexShrink: 0 }}
                              >
                                {(sending || uploading) ? <Spinner size={14} /> : <Send size={14} />} Send
                              </button>
                            )}
                          </div>
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
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: 12, overflow: 'hidden' }}>

              {/* Left: list — two stacked blocks, each sized to fit its content */}
              <div style={{ maxHeight: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

                {/* My Announcements */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Megaphone size={15} style={{ color: '#F97316' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>My Announcements</span>
                  </div>
                  <div style={{ padding: '10px 12px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, height: 36, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0 13px' }}>
                      <Search size={15} color="#94A3B8" style={{ flexShrink: 0 }} />
                      <input
                        value={annSearch}
                        onChange={e => setAnnSearch(e.target.value)}
                        placeholder="Search"
                        style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#0F172A', fontWeight: 500 }}
                      />
                    </div>
                    <button onClick={() => setShowNewAnnModal(true)} title="Post announcement"
                      className="comm-action-btn"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: '#F97316', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <Plus size={18} strokeWidth={2.5} />
                    </button>
                  </div>

                  <div style={{ overflowY: 'auto', maxHeight: 438, padding: '14px 10px 10px' }}>
                    {myAnnouncements.length === 0 ? (
                      <div style={{ height: 120, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
                        <Megaphone size={24} strokeWidth={1.5} />
                        {annSearch ? 'No matching announcements' : 'No announcements yet'}
                      </div>
                    ) : myAnnouncements.map((ann, i) => renderAnnouncementCard(ann, i, true))}
                  </div>
                </div>

                {/* From Others (Partners, Managers, etc.) */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users size={15} style={{ color: '#F97316' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>From Others</span>
                  </div>
                  <div style={{ padding: '10px 12px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, height: 36, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0 13px' }}>
                      <Search size={15} color="#94A3B8" style={{ flexShrink: 0 }} />
                      <input
                        value={othersSearch}
                        onChange={e => setOthersSearch(e.target.value)}
                        placeholder="Search"
                        style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#0F172A', fontWeight: 500 }}
                      />
                    </div>
                    <div ref={othersDeptFilterRef} style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setOthersDeptFilterOpen(o => !o)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, height: 36, padding: '0 12px', border: `1.5px solid ${othersDeptFilterOpen ? '#F97316' : '#E5E7EB'}`, borderRadius: 10, background: '#FFFFFF', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: othersDeptFilterOpen ? '0 0 0 3px rgba(249,115,22,0.10)' : 'none', transition: 'border-color 0.15s' }}
                      >
                        {othersDeptFilter === 'all' ? 'All Departments' : (departments.find(d => d.id === othersDeptFilter)?.name ?? 'All Departments')}
                        <ChevronDown size={12} style={{ color: '#9CA3AF', flexShrink: 0, transform: othersDeptFilterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                      </button>
                      {othersDeptFilterOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 170, background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 50, padding: '4px 0', overflow: 'hidden' }}>
                          {[{ id: 'all', name: 'All Departments' }, ...departments].map(dept => {
                            const active = othersDeptFilter === dept.id
                            return (
                              <button key={dept.id} type="button"
                                onClick={() => { setOthersDeptFilter(dept.id); setOthersDeptFilterOpen(false) }}
                                style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: active ? '#FFF7ED' : 'transparent', color: active ? '#EA580C' : '#374151', fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer' }}
                                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                              >
                                {dept.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '10px 10px 10px' }}>
                    {othersAnnouncements.length === 0 ? (
                      <div style={{ height: 120, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
                        <Megaphone size={24} strokeWidth={1.5} />
                        {othersSearch || othersDeptFilter !== 'all' ? 'No matching announcements' : 'No announcements from others yet'}
                      </div>
                    ) : othersAnnouncements.map((ann, i) => renderAnnouncementCard(ann, i, false))}
                  </div>
                </div>
              </div>

              {/* Right: detail */}
              <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                {selectedAnn ? (
                  <>
                    <div style={{ flexShrink: 0, background: '#FFFFFF', borderBottom: '1px solid #EDF2F7', padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        {selectedAnn.from_user_id !== internalUserId ? (
                          selectedAnn.created_by_photo_url ? (
                            <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                              <img src={selectedAnn.created_by_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ) : (
                            <div style={{
                              width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: selectedAnn.poster_role ? (ROLE_BG[selectedAnn.poster_role] ?? `${hashColor(selectedAnn.created_by_name ?? 'User')}18`) : `${hashColor(selectedAnn.created_by_name ?? 'User')}18`,
                              color: selectedAnn.poster_role ? (ROLE_COLOR[selectedAnn.poster_role] ?? hashColor(selectedAnn.created_by_name ?? 'User')) : hashColor(selectedAnn.created_by_name ?? 'User'),
                            }}>
                              {selectedAnn.poster_role === 'Owner' || selectedAnn.poster_role === 'Partner' ? <Crown size={18} />
                                : selectedAnn.poster_role === 'Manager' ? <UserCog size={18} />
                                : <UserRound size={18} />}
                            </div>
                          )
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFF7ED', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Megaphone size={18} />
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <h2 style={{ margin: 0, minWidth: 0, color: '#0F172A', fontSize: 19, lineHeight: 1.2, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedAnn.title}</h2>
                            <div style={{ flexShrink: 0 }}>
                              <DepartmentBadge
                                departmentId={selectedAnn.department_id}
                                departmentName={selectedAnn.department_id ? (departments.find(d => d.id === selectedAnn.department_id)?.name ?? 'Department') : null}
                                fallbackIcon={<Globe size={11} />}
                                large
                              />
                            </div>
                          </div>
                          <div style={{ color: '#9CA3AF', fontSize: 11.5, fontWeight: 500 }}>
                            {selectedAnn.from_user_id !== internalUserId ? (
                              <>Posted by <span style={{ color: '#334155', fontWeight: 700 }}>{selectedAnn.created_by_name ?? 'Unknown'}</span> at {formatAnnouncementTimestamp(selectedAnn)}</>
                            ) : (
                              formatAnnouncementTimestamp(selectedAnn)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 28 }}>
                      <article style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '28px 32px', boxShadow: '0 4px 20px rgba(15,23,42,0.05)' }}>
                        <p style={{ margin: 0, color: '#334155', fontSize: 14.5, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{selectedAnn.content}</p>
                      </article>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#FFFFFF' }}>
                    <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 18, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#F97316' }}>
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
                <div style={{ padding: 48, textAlign: 'center' }}><Spinner size={18} dark /></div>
              ) : invites.length === 0 ? (
                <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 10 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 18, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
                    <Bell size={24} strokeWidth={1.5} />
                  </div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>No pending invitations</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                  {invites.map((invite, i) => (
                    <div key={invite.id} className="comm-ann-card" style={{ padding: 18, background: '#FFFFFF', border: '1.5px solid #EDF2F7', borderRadius: 14, animationDelay: `${i * 0.05}s` }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FFF7ED', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Bell size={16} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, color: '#0F172A', fontWeight: 700, lineHeight: 1.45 }}>
                            <span style={{ color: '#374151' }}>{invite.sender_name}</span> invited you to join <span style={{ color: '#0F172A' }}>{invite.company_name}</span>
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>
                            As <span style={{ color: '#F97316', fontWeight: 700 }}>{invite.role}</span> · {formatTime(invite.created_at)}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleAcceptInvite(invite)} disabled={inviteActing === invite.id}
                          style={{ flex: 1, height: 34, background: '#10B981', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: inviteActing === invite.id ? 'not-allowed' : 'pointer', opacity: inviteActing === invite.id ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        >
                          {inviteActing === invite.id ? <Spinner size={12} /> : <Check size={13} />} Accept
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
        </div>{/* /content panel padding */}
      </main>

      <Toast message={successToast} />
      <Toast message={errorToast} variant="error" />

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmId && (
        <ModalOverlay onClose={() => setDeleteConfirmId(null)} maxWidth="400px">
          <ModalBox>
            <ModalHeader title="Delete Announcement" icon={<Trash2 size={15} color="#fff" strokeWidth={2.5} />} iconBg="linear-gradient(135deg, #EF4444, #DC2626)" onClose={() => setDeleteConfirmId(null)} />
            <div style={{ padding: '20px 24px 0' }}>
              <p style={{ fontSize: '0.9375rem', color: '#374151', margin: 0, lineHeight: 1.6 }}>
                Are you sure you want to delete this announcement?
              </p>
            </div>
            <div style={{ padding: '20px 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} disabled={deleting}
                style={{ padding: '7px 16px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleDeleteAnnouncement(deleteConfirmId)} disabled={deleting} style={modalDestructiveButtonStyle(deleting)}>
                {deleting ? <Spinner size={13} /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Edit Announcement Modal ── */}
      {showEditModal && (
        <ModalOverlay onClose={() => setShowEditModal(false)} maxWidth="500px">
          <ModalBox>
            <ModalHeader title="Edit Announcement" icon={<Pencil size={15} color="#fff" strokeWidth={2} />} onClose={() => setShowEditModal(false)} />
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={modalLabelStyle}>Title</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Announcement title" className="comm-input" style={modalInputStyle} />
              </div>
              <div>
                <label style={modalLabelStyle}>Content</label>
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Write your announcement..." rows={5} className="comm-textarea" style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }} />
              </div>
              <div>
                <label style={modalLabelStyle}>Audience</label>
                <DropdownField
                  value={editAudience === 'company-wide' ? 'company-wide' : (editDeptId ?? '')}
                  options={[
                    { value: 'company-wide', label: 'Company-wide' },
                    ...departments.map(d => ({ value: d.id, label: d.name })),
                  ]}
                  onChange={v => {
                    if (v === 'company-wide') { setEditAudience('company-wide'); setEditDeptId(null) }
                    else { setEditAudience('specific-dept'); setEditDeptId(v) }
                  }}
                  placeholder="Select audience"
                />
              </div>
            </div>
            {editError && <div style={modalErrorBoxStyle}>{editError}</div>}
            <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={modalGhostButtonStyle} onClick={() => setShowEditModal(false)}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving || !editTitle.trim() || !editContent.trim()} style={modalPrimaryButtonStyle(saving || !editTitle.trim() || !editContent.trim())}>
                {saving ? <Spinner size={13} /> : null} Save Changes
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── New Announcement Modal ── */}
      {showNewAnnModal && (
        <ModalOverlay onClose={() => setShowNewAnnModal(false)} maxWidth="500px">
          <ModalBox>
            <ModalHeader title="New Announcement" icon={<Megaphone size={15} color="#fff" strokeWidth={2} />} onClose={() => setShowNewAnnModal(false)} />
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={modalLabelStyle}>Title</label>
                <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Announcement title" className="comm-input" style={modalInputStyle} />
              </div>
              <div>
                <label style={modalLabelStyle}>Content</label>
                <textarea data-testid="announcement-content" value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Write your announcement here..." rows={5} className="comm-textarea" style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }} />
              </div>
              <div>
                <label style={modalLabelStyle}>Audience</label>
                <DropdownField
                  value={annDeptId}
                  options={[
                    ...(canPostCompanyWide ? [{ value: 'company-wide', label: 'Company-wide' }] : []),
                    ...departments.map(d => ({ value: d.id, label: d.name })),
                  ]}
                  onChange={v => setAnnDeptId(v)}
                  placeholder="Select audience"
                />
              </div>
            </div>
            <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={modalGhostButtonStyle} onClick={() => setShowNewAnnModal(false)}>Cancel</button>
              <button onClick={handlePostAnnouncement} disabled={!communicationReady || posting || !annTitle.trim() || !annContent.trim()}
                style={modalPrimaryButtonStyle(!communicationReady || posting || !annTitle.trim() || !annContent.trim())}>
                {posting ? <Spinner size={13} /> : <Megaphone size={13} />} {posting ? 'Posting…' : 'Post Announcement'}
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Compose Message Modal ── */}
      {composeOpen && (
        <ModalOverlay onClose={() => setComposeOpen(false)} maxWidth="480px">
          <ModalBox>
            <ModalHeader title="New Message" icon={<SquarePen size={15} color="#fff" strokeWidth={2} />} onClose={() => setComposeOpen(false)} />

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={modalLabelStyle}>To</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '8px 12px' }}>
                <Search size={13} color="#9CA3AF" />
                <input autoFocus value={composeSearch} onChange={e => setComposeSearch(e.target.value)} placeholder="Search people…" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#374151', fontWeight: 500 }} />
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filteredMembers.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '14px 0', margin: 0, fontWeight: 500 }}>No people found</p>
                ) : filteredMembers.map(m => (
                  <button key={m.id} onClick={() => selectComposeRecipient(m)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: 'none', border: '1px solid transparent', borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
                  >
                    <Avatar name={m.full_name} size={34} role={m.role} photoUrl={m.profile_photo_url ?? null} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}
    </div>
  )
}

