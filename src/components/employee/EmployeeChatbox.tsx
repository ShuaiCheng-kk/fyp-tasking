'use client'

// Employee Dashboard's Messages widget — same "Chatbox" design as Owner/Partner/Manager's
// Communication page (src/components/communication/CommunicationView.tsx Chat tab): a
// conversation list (search, compose, pin, delete, unread badge) beside a multi-panel chat area
// that supports up to 4 conversations open side by side via drag-and-drop. Built as its own
// component (not a shared extraction out of CommunicationView) since that component is deeply
// interleaved with the Announcements tab and Owner/Partner/Manager-wide compose search — Employee
// only ever messages its own Manager, department colleagues, and today's supervised Casual
// Workers (/api/employee/contacts), so this keeps CommunicationView completely untouched.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  FileText, ImagePlus, MessageSquare, Paperclip, Pin, PinOff, Search, Send, SquarePen, X, Trash2,
} from 'lucide-react'
import RoleAvatar from '@/components/RoleAvatar'
import Spinner from '@/components/Spinner'
import { ModalOverlay, ModalBox, ModalHeader, modalLabelStyle, modalDestructiveButtonStyle } from '@/components/modal'
import { EmptyState } from '@/components/panel'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'
import { DASHBOARD_SKELETON_KEYFRAMES, SkeletonLine } from '@/components/dashboard/ClockFlow'

type Contact = { id: string; full_name: string; role: string; email_address: string; profile_photo_url: string | null }

type Conversation = {
  partnerId: string
  partnerName: string
  partnerRole: string
  partnerPhotoUrl?: string | null
  lastMessage: string
  lastTime: string
  unreadCount: number
  partnerDeleted?: boolean
}

type Message = {
  id: string
  from_user_id: string
  to_user_id: string
  content: string
  created_at: string
  is_read: boolean
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '')
  return `${day} ${month}, ${time}`
}

type Props = {
  companyId: string
  internalUserId: string
  // Reports the total unread-message count live, straight off the same `conversations` state
  // this component already keeps in sync (fetched on mount, refetched on realtime 'communication'
  // invalidation, and refetched right after opening a panel marks it read) — driving the
  // Communication page's Chat tab dot off a second independent fetch would lag one tick behind
  // whatever the user just did inside this component (open a panel, receive a message).
  onUnreadCount?: (count: number) => void
  // Once clocked out of every shift today, sending messages locks too — same rule as the Tasks
  // page and Shifts page's My Requests once clocked out (2026-08-02). Reading existing
  // conversations still works; only composing is blocked.
  readOnly?: boolean
}

export default function EmployeeChatbox({ companyId, internalUserId, onUnreadCount, readOnly = false }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null)
  const [deleteConvConfirmId, setDeleteConvConfirmId] = useState<string | null>(null)

  // Multi-panel chat state (up to 4 panels), mirrors CommunicationView's Chatbox exactly.
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([])
  const [panelMessages, setPanelMessages] = useState<Record<string, Message[]>>({})
  const [panelInputs, setPanelInputs] = useState<Record<string, string>>({})
  const [panelSending, setPanelSending] = useState<Record<string, boolean>>({})
  const [panelAttachFiles, setPanelAttachFiles] = useState<Record<string, File[]>>({})
  const [panelAttachPreviews, setPanelAttachPreviews] = useState<Record<string, (string | null)[]>>({})
  const [panelUploading, setPanelUploading] = useState<Record<string, boolean>>({})
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [draggingPanel, setDraggingPanel] = useState<string | null>(null)
  const panelPhotoRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const panelFileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const panelEndRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const panelContainerRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const panelPrevRects = useRef<Record<string, DOMRect>>({})

  const [composeOpen, setComposeOpen] = useState(false)
  const [composeSearch, setComposeSearch] = useState('')

  const fetchContacts = useCallback(() => {
    if (!internalUserId) return
    fetch(`/api/employee/contacts?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setContacts(d.contacts ?? []) })
      .catch(() => {})
  }, [internalUserId])

  useEffect(() => { fetchContacts() }, [fetchContacts])
  // Re-fetch when a department reassignment (UC31) changes who this Employee can message —
  // without this the contact list stayed stale until a manual page refresh (BUG-046).
  useResourceInvalidation(['team'], fetchContacts)

  const [conversationsLoading, setConversationsLoading] = useState(true)
  const lastConvLoadedAtRef = useRef(0)
  const fetchConversations = useCallback((keepPlaceholderId?: string) => {
    if (!internalUserId) return
    lastConvLoadedAtRef.current = Date.now()
    fetch(`/api/inbox/messages?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        const fetched = (d.conversations ?? []) as Conversation[]
        setConversations(prev => {
          const fetchedIds = new Set(fetched.map(c => c.partnerId))
          const placeholder = keepPlaceholderId && !fetchedIds.has(keepPlaceholderId)
            ? prev.find(c => c.partnerId === keepPlaceholderId)
            : undefined
          return placeholder ? [placeholder, ...fetched] : fetched
        })
      })
      .finally(() => setConversationsLoading(false))
  }, [internalUserId])

  useEffect(() => {
    if (!internalUserId) return
    fetchConversations()
    try {
      const raw = localStorage.getItem(`pinned_convs_${internalUserId}`)
      if (raw) setPinnedIds(new Set(JSON.parse(raw)))
    } catch {}
  }, [internalUserId, fetchConversations])

  useResourceInvalidation(['communication'], () => {
    // Skip the realtime echo of a message this same tab just sent (same fix as BUG-060).
    if (Date.now() - lastConvLoadedAtRef.current < 1500) return
    fetchConversations()
  })

  useEffect(() => {
    onUnreadCount?.(conversations.reduce((sum, c) => sum + c.unreadCount, 0))
  }, [conversations, onUnreadCount])

  useEffect(() => {
    const q = search.toLowerCase()
    const base = q ? conversations.filter(c => c.partnerName.toLowerCase().includes(q)) : conversations
    const sorted = [...base].sort((a, b) => {
      const aPin = pinnedIds.has(a.partnerId) ? 0 : 1
      const bPin = pinnedIds.has(b.partnerId) ? 0 : 1
      if (aPin !== bPin) return aPin - bPin
      // Unread floats to the top, newest-first within each group — same rule as
      // CommunicationView's Chatbox/Announcements lists (2026-08-01).
      const aUnread = a.unreadCount > 0 ? 0 : 1
      const bUnread = b.unreadCount > 0 ? 0 : 1
      if (aUnread !== bUnread) return aUnread - bUnread
      return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
    })
    setFilteredConversations(sorted)
  }, [search, conversations, pinnedIds])

  function fetchPanelMessages(partnerId: string) {
    if (!internalUserId) return
    fetch(`/api/inbox/messages/${partnerId}?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        setPanelMessages(prev => ({ ...prev, [partnerId]: d.messages ?? [] }))
        fetch(`/api/inbox/messages/${partnerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: internalUserId }),
        }).then(() => fetchConversations(partnerId)).catch(() => {})
      })
  }

  useEffect(() => {
    for (const pid of openPanelIds) panelEndRefs.current[pid]?.scrollIntoView({ behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMessages])

  // FLIP: after panels reorder (swap), slide each one from its previous screen position into its
  // new one instead of snapping instantly.
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
      el.getBoundingClientRect()
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)'
        el.style.transform = ''
      })
    }
    panelPrevRects.current = {}
  }, [openPanelIds])

  useEffect(() => {
    if (!internalUserId) return
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const channel = supabase
      .channel('employee-dashboard-chatbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user_id=eq.${internalUserId}` }, payload => {
        const newMsg = payload.new as Message
        setPanelMessages(prev => {
          if (prev[newMsg.from_user_id] === undefined) return prev
          fetch(`/api/inbox/messages/${newMsg.from_user_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: internalUserId }),
          }).catch(() => {})
          return { ...prev, [newMsg.from_user_id]: [...prev[newMsg.from_user_id], newMsg] }
        })
        fetchConversations()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [internalUserId, fetchConversations])

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

  function openPanelSolo(partnerId: string) {
    if (openPanelIds.length === 1 && openPanelIds[0] === partnerId) return
    replaceOpenPanels(partnerId)
  }

  function openPanel(partnerId: string) {
    setOpenPanelIds(prev => {
      if (prev.includes(partnerId)) return prev
      return prev.length >= 4 ? [...prev.slice(1), partnerId] : [...prev, partnerId]
    })
    if (!panelMessages[partnerId]) fetchPanelMessages(partnerId)
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

  function handleClosePanel(partnerId: string) {
    const conv = conversations.find(c => c.partnerId === partnerId)
    if (conv && conv.lastMessage === '') setConversations(prev => prev.filter(c => c.partnerId !== partnerId))
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
        localStorage.setItem(`pinned_convs_${internalUserId}`, JSON.stringify([...next]))
        return next
      })
    } catch {
    } finally {
      setDeletingConvId(null)
      setDeleteConvConfirmId(null)
    }
  }

  function swapPanels(idA: string, idB: string) {
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
    if (readOnly) return
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
    } finally {
      setPanelSending(prev => ({ ...prev, [partnerId]: false }))
    }
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
    if (readOnly) return
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
        if (msgData.success) setPanelMessages(prev => ({ ...prev, [partnerId]: [...(prev[partnerId] ?? []), msgData.message] }))
      }
      fetchConversations()
    } catch {
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

  function selectComposeRecipient(member: Contact) {
    setComposeOpen(false)
    replaceOpenPanels(member.id)
    setConversations(prev => {
      if (prev.some(c => c.partnerId === member.id)) return prev
      const placeholder: Conversation = {
        partnerId: member.id, partnerName: member.full_name, partnerRole: member.role,
        partnerPhotoUrl: member.profile_photo_url,
        lastMessage: '', lastTime: new Date().toISOString(), unreadCount: 0,
      }
      return [placeholder, ...prev]
    })
    if (!panelMessages[member.id]) fetchPanelMessages(member.id)
  }

  const filteredMembers = composeSearch
    ? contacts.filter(m => m.full_name.toLowerCase().includes(composeSearch.toLowerCase()))
    : contacts
  const communicationReady = Boolean(internalUserId && companyId)

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '400px minmax(0, 1fr)', gap: 12, overflow: 'hidden' }}>
      {/* Left: conversations — own card, same structure/spacing as Manager's CommunicationView
          Chat tab (src/components/communication/CommunicationView.tsx) so the two only differ in
          which actions are available, never in layout/sizing (confirmed 2026-07-31: this used to
          be nested one level deeper inside a single outer "Chatbox" card with its own
          padding+overflowY:auto wrapper, which both narrowed the list column to 300px vs Manager's
          400px and broke the height chain down to the message panel, cutting off content that
          Manager's page showed in full for the exact same conversation). */}
      <div style={{ alignSelf: 'start', maxHeight: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MessageSquare size={15} style={{ color: '#F97316' }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Chatbox</span>
        </div>
        <div style={{ padding: '10px 12px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, height: 36, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0 13px' }}>
            <Search size={15} color="#94A3B8" style={{ flexShrink: 0 }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#0F172A', fontWeight: 500 }}
            />
          </div>
          <button onClick={() => { setComposeOpen(true); setComposeSearch('') }} disabled={!communicationReady} title="New message"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: communicationReady ? '#F97316' : '#E5E7EB', border: 'none', borderRadius: 10, color: communicationReady ? '#fff' : '#9CA3AF', cursor: communicationReady ? 'pointer' : 'not-allowed', flexShrink: 0 }}
          >
            <SquarePen size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '14px 10px 10px' }}>
          {conversationsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <style>{DASHBOARD_SKELETON_KEYFRAMES}</style>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px' }}>
                  <SkeletonLine width={34} height={34} radius={999} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <SkeletonLine width="55%" height={12} />
                    <SkeletonLine width="80%" height={10} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ height: 180, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
              <MessageSquare size={26} strokeWidth={1.5} />
              {search ? 'No results' : 'No conversations yet'}
            </div>
          ) : filteredConversations.map(conv => {
            const active = openPanelIds.includes(conv.partnerId)
            const isPinned = pinnedIds.has(conv.partnerId)
            const fileMatch = conv.lastMessage.match(/^\[file:(.+?)\]/)
            const isImagePreview = conv.lastMessage.startsWith('[image:]')
            const previewText = isImagePreview ? 'Photo' : fileMatch ? fileMatch[1] : conv.lastMessage
            return (
              <div
                key={conv.partnerId}
                draggable
                onDragStart={e => { e.dataTransfer.setData('listPartnerId', conv.partnerId) }}
                title="Drag onto an open conversation to view side by side"
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 12, padding: '18px 54px 18px 14px',
                  background: active ? '#FFF7ED' : '#FFFFFF',
                  border: active ? '1.5px solid rgba(249,115,22,0.35)' : '1.5px solid #EDF2F7',
                  borderRadius: 12, cursor: 'grab', textAlign: 'left', width: '100%', marginBottom: 14, boxSizing: 'border-box',
                  boxShadow: active ? '0 6px 18px rgba(249,115,22,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <button onClick={() => openPanelSolo(conv.partnerId)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                  <RoleAvatar role={conv.partnerRole} size={44} photoUrl={conv.partnerPhotoUrl ?? null} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <span style={{ fontWeight: conv.unreadCount > 0 ? 800 : 600, fontSize: 13.5, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.partnerName}
                        </span>
                        {isPinned && <Pin size={12} strokeWidth={2.5} style={{ color: '#F97316', flexShrink: 0 }} />}
                        {conv.partnerDeleted && <span style={{ background: '#F1F5F9', color: '#6B7280', fontSize: 10, padding: '1px 6px', borderRadius: 999, flexShrink: 0, fontWeight: 700 }}>removed</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
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
                <span style={{ position: 'absolute', top: 16, right: 12, fontSize: 11.5, color: '#9CA3AF', fontWeight: 500 }}>{formatTime(conv.lastTime)}</span>
                <button
                  onClick={() => setDeleteConvConfirmId(conv.partnerId)}
                  title="Delete conversation"
                  disabled={deletingConvId === conv.partnerId}
                  style={{ position: 'absolute', bottom: 16, right: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#DC2626', transition: 'color 0.15s' }}
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

      {/* Right: multi-panel chat area — no padding here (matches Manager/Owner's Chatbox); every
          open panel (solo or multi) always gets its own outer floating card, same as Manager's,
          with the header/messages/input sub-cards centered at 92% width inside it. */}
      <div style={{ minWidth: 0, minHeight: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {openPanelIds.length === 0 ? (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const draggedListId = e.dataTransfer.getData('listPartnerId')
              if (draggedListId) openPanel(draggedListId)
            }}
            style={{ flex: 1, display: 'flex', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <EmptyState
              variant="iconBox"
              fill
              icon={<MessageSquare size={24} strokeWidth={1.5} />}
              message="Select a conversation to start chatting"
              subtitle="Drag a conversation onto an open one to view up to 4 side by side"
            />
          </div>
        ) : (
          <div style={{
            flex: 1, minHeight: 0,
            display: 'grid',
            gridTemplateColumns: openPanelIds.length === 1 ? '1fr' : '1fr 1fr',
            gridTemplateRows: openPanelIds.length <= 2 ? '1fr' : '1fr 1fr',
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
              const spanStyle: React.CSSProperties = openPanelIds.length === 3 && idx === 0 ? { gridRow: '1 / 3' } : {}

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
                  {/* Panel header */}
                  <div
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('panelId', partnerId); setDraggingPanel(partnerId) }}
                    onDragEnd={() => setDraggingPanel(null)}
                    style={{ width: '92%', margin: '12px auto 0', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, cursor: openPanelIds.length > 1 ? 'grab' : 'default', userSelect: 'none' }}
                    title={openPanelIds.length > 1 ? 'Drag to swap panels' : undefined}
                  >
                    <RoleAvatar role={conv.partnerRole} size={38} photoUrl={conv.partnerPhotoUrl ?? null} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 15.5, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.partnerName}</span>
                        {conv.partnerDeleted && <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 10, padding: '2px 6px', borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>removed</span>}
                        {isPinned && <Pin size={11} strokeWidth={2.5} style={{ color: '#F97316', flexShrink: 0 }} />}
                      </div>
                    </div>
                    <button
                      onClick={() => togglePin(partnerId)}
                      title={isPinned ? 'Unpin' : 'Pin'}
                      style={{ flexShrink: 0, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF7ED', border: isPinned ? '1.5px solid rgba(249,115,22,0.45)' : '1.5px solid rgba(249,115,22,0.25)', borderRadius: 9, cursor: 'pointer', color: '#F97316', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#FFEDD5'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.55)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#FFF7ED'; e.currentTarget.style.borderColor = isPinned ? 'rgba(249,115,22,0.45)' : 'rgba(249,115,22,0.25)' }}
                    >
                      {isPinned ? <PinOff size={15} strokeWidth={2.5} /> : <Pin size={15} strokeWidth={2.5} />}
                    </button>
                    <button
                      onClick={() => setDeleteConvConfirmId(partnerId)}
                      title="Delete conversation"
                      disabled={deletingConvId === partnerId}
                      style={{ flexShrink: 0, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', border: '1.5px solid rgba(220,38,38,0.3)', borderRadius: 9, cursor: 'pointer', color: '#DC2626', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#B91C1C'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.45)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)' }}
                    >
                      {deletingConvId === partnerId ? <Spinner size={13} /> : <Trash2 size={15} strokeWidth={2.5} />}
                    </button>
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

                  {/* Messages */}
                  <div style={{ flex: 1, minHeight: 0, width: '92%', margin: '10px auto', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {msgs.length === 0 && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                          <RoleAvatar role={conv.partnerRole} size={64} photoUrl={conv.partnerPhotoUrl ?? null} />
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
                          <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
                            {isImage && imgUrl ? (
                              <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 3 }}>
                                <a href={imgUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: isMine ? '13px 13px 3px 13px' : '13px 13px 13px 3px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                                  <img src={imgUrl} alt="attachment" style={{ display: 'block', maxWidth: '100%', maxHeight: 180, objectFit: 'cover' }} />
                                </a>
                                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{formatTime(msg.created_at)}</span>
                              </div>
                            ) : isFile && fileUrl ? (
                              <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={fileName ?? true} style={{ maxWidth: '70%', padding: '8px 11px', borderRadius: isMine ? '13px 13px 3px 13px' : '13px 13px 13px 3px', background: isMine ? '#FFEDD5' : '#FFFFFF', border: isMine ? '1px solid #FED7AA' : '1px solid #EDF2F7', boxShadow: '0 1px 4px rgba(15,23,42,0.04)', textDecoration: 'none', display: 'block' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={14} color="#3B82F6" /></div>
                                  <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</p>
                                </div>
                                <div style={{ fontSize: 11, marginTop: 8, color: '#94A3B8', fontWeight: 500, textAlign: isMine ? 'right' : 'left' }}>{formatTime(msg.created_at)}</div>
                              </a>
                            ) : (
                              <div style={{ maxWidth: '70%', padding: '8px 11px', borderRadius: isMine ? '13px 13px 3px 13px' : '13px 13px 13px 3px', background: isMine ? '#FFEDD5' : '#FFFFFF', border: isMine ? '1px solid #FED7AA' : '1px solid #EDF2F7', color: '#0F172A', fontSize: 15, fontWeight: 500, lineHeight: 1.5, boxShadow: '0 1px 4px rgba(15,23,42,0.04)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
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

                  {/* Attachments + input */}
                  <div style={{ width: '92%', margin: '0 auto 12px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, flexShrink: 0, overflow: 'hidden' }}>
                    {attachFiles.length > 0 && (
                      <div style={{ padding: '10px 12px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {attachFiles.map((file, i) => (
                          <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 9, padding: '5px 9px', maxWidth: '100%' }}>
                            {attachPreviews[i] ? (
                              <img src={attachPreviews[i]!} alt="preview" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 30, height: 30, borderRadius: 7, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={14} color="#3B82F6" /></div>
                            )}
                            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{file.name}</p>
                            <button onClick={() => removePanelAttachment(partnerId, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'flex', flexShrink: 0 }}><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
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
                      {!conv.partnerDeleted && !readOnly && (
                        <button onClick={() => panelPhotoRefs.current[partnerId]?.click()} title="Send photo"
                          style={{ flexShrink: 0, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF7ED', border: '1.5px solid rgba(249,115,22,0.25)', borderRadius: 10, cursor: 'pointer', color: '#F97316', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#FFEDD5'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.45)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#FFF7ED'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.25)' }}>
                          <ImagePlus size={18} strokeWidth={2} />
                        </button>
                      )}
                      {!conv.partnerDeleted && !readOnly && (
                        <button onClick={() => panelFileRefs.current[partnerId]?.click()} title="Send file"
                          style={{ flexShrink: 0, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EFF6FF', border: '1.5px solid rgba(59,130,246,0.25)', borderRadius: 10, cursor: 'pointer', color: '#3B82F6', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.45)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)' }}>
                          <Paperclip size={17} strokeWidth={2} />
                        </button>
                      )}
                      <input
                        value={input}
                        onChange={e => setPanelInputs(p => ({ ...p, [partnerId]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !conv.partnerDeleted && !readOnly) { e.preventDefault(); if (attachFiles.length > 0) void uploadAndSendPanelAttachment(partnerId); else void handleSendMessage(partnerId) } }}
                        placeholder={conv.partnerDeleted ? 'Account removed' : readOnly ? "You've clocked out — messaging is locked" : 'Type a message…'}
                        disabled={conv.partnerDeleted || readOnly}
                        style={{ flex: 1, minWidth: 0, height: 42, padding: '0 14px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 14, fontWeight: 500, outline: 'none', background: (conv.partnerDeleted || readOnly) ? '#F8FAFC' : '#FFFFFF', color: (conv.partnerDeleted || readOnly) ? '#94A3B8' : '#0F172A', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                      />
                      {!conv.partnerDeleted && !readOnly && (
                        <button
                          onClick={() => { if (attachFiles.length > 0) void uploadAndSendPanelAttachment(partnerId); else void handleSendMessage(partnerId) }}
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

      {composeOpen && (
        <ModalOverlay onClose={() => setComposeOpen(false)} maxWidth="420px">
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
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: 'none', border: '1px solid transparent', borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  >
                    <RoleAvatar role={m.role} size={34} photoUrl={m.profile_photo_url} />
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

      {deleteConvConfirmId && (
        <ModalOverlay onClose={() => setDeleteConvConfirmId(null)} maxWidth="400px">
          <ModalBox>
            <ModalHeader title="Delete Conversation" icon={<Trash2 size={15} color="#fff" strokeWidth={2.5} />} iconBg="linear-gradient(135deg, #EF4444, #DC2626)" onClose={() => setDeleteConvConfirmId(null)} />
            <div style={{ padding: '20px 24px 0' }}>
              <p style={{ fontSize: '0.9375rem', color: '#374151', margin: 0, lineHeight: 1.6 }}>
                This permanently deletes every message in this conversation for both you and the other person — not just from your own view. This cannot be undone.
              </p>
            </div>
            <div style={{ padding: '20px 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConvConfirmId(null)} disabled={deletingConvId === deleteConvConfirmId}
                style={{ padding: '7px 16px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => deleteConversation(deleteConvConfirmId)} disabled={deletingConvId === deleteConvConfirmId} style={modalDestructiveButtonStyle(deletingConvId === deleteConvConfirmId)}>
                {deletingConvId === deleteConvConfirmId ? <Spinner size={13} /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}
    </div>
  )
}
