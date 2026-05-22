'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import EmployeeSidebar from '@/components/EmployeeSidebar'
import { createClient } from '@/lib/supabase'
import { Send, Search, SquarePen, X, MessageSquare } from 'lucide-react'

const GREEN = '#16A34A'
const GREEN_LIGHT = '#DCFCE7'
const GREEN_BORDER = '#BBF7D0'

const ROLE_COLOR: Record<string, string> = {
  Manager: '#2563EB',
  Employee: '#16A34A',
}

type Contact = {
  id: string
  full_name: string
  role: string
  email_address: string
}

type Conversation = {
  partnerId: string
  partnerName: string
  partnerRole: string
  lastMessage: string
  lastTime: string
  unreadCount: number
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

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function Avatar({ name, size = 36, color = GREEN }: { name: string; size?: number; color?: string }) {
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

export default function EmployeeInboxPage() {
  const [internalUserId, setInternalUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [unreadMessages, setUnreadMessages] = useState(0)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [search, setSearch] = useState('')
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  const [composeOpen, setComposeOpen] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [composeSearch, setComposeSearch] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState<Contact | null>(null)
  const [composeText, setComposeText] = useState('')
  const [composeSending, setComposeSending] = useState(false)
  const [composeError, setComposeError] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${uid}`)
    setCompanyId(cid)
    if (!uid) return
    fetch(`/api/user/me?user_id=${uid}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user?.id) {
          setInternalUserId(d.user.id)
          setUserName(d.user.full_name ?? '')
        }
      })
      .catch(() => {})
  }, [])

  const fetchUnreadCount = useCallback(() => {
    if (!internalUserId) return
    fetch(`/api/inbox/unread-count?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUnreadMessages(d.unread_messages ?? 0) })
  }, [internalUserId])

  const fetchConversations = useCallback(() => {
    if (!internalUserId) return
    fetch(`/api/inbox/messages?user_id=${internalUserId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setConversations(d.conversations ?? []) })
  }, [internalUserId])

  useEffect(() => {
    if (!internalUserId) return
    fetchConversations()
    fetchUnreadCount()
  }, [internalUserId, fetchConversations, fetchUnreadCount])

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
      .channel('employee-inbox-messages')
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

  function openCompose() {
    if (!internalUserId) return
    const uid = localStorage.getItem('tasking_user_id')
    setComposeOpen(true)
    setSelectedRecipient(null)
    setComposeText('')
    setComposeSearch('')
    setComposeError('')
    fetch(`/api/employee/contacts?user_id=${uid}`)
      .then(r => r.json())
      .then(d => { if (d.success) setContacts(d.contacts ?? []) })
      .catch(() => {})
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

  const filteredContacts = composeSearch
    ? contacts.filter(c => c.full_name.toLowerCase().includes(composeSearch.toLowerCase()))
    : contacts

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F0FDF4', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <EmployeeSidebar unreadMessages={unreadMessages} />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 32px', background: GREEN, borderBottom: '1px solid #15803D', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#FFFFFF', margin: 0 }}>Inbox</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userName && <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>{userName}</span>}
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }}>Employee</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: conversation list */}
          <div style={{ width: '33%', minWidth: 260, maxWidth: 360, background: '#FFFFFF', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6' }}>
              <button
                onClick={openCompose}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '8px 14px', background: GREEN, border: 'none', borderRadius: 8,
                  color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
                onMouseLeave={e => (e.currentTarget.style.background = GREEN)}
              >
                <SquarePen size={14} strokeWidth={2.5} />
                New Message
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
                    background: selectedConv?.partnerId === conv.partnerId ? GREEN_LIGHT : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                    borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s',
                  }}
                >
                  <Avatar name={conv.partnerName} size={38} color={ROLE_COLOR[conv.partnerRole] ?? GREEN} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: conv.unreadCount > 0 ? 700 : 500, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.partnerName}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#9CA3AF', flexShrink: 0, marginLeft: 6 }}>{formatTime(conv.lastTime)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                      {conv.partnerRole && <span style={{ fontSize: '0.7rem', color: GREEN, fontWeight: 500 }}>{conv.partnerRole}</span>}
                      {conv.partnerRole && <span style={{ fontSize: '0.7rem', color: '#D1D5DB' }}>·</span>}
                      <span style={{ fontSize: '0.8125rem', color: conv.unreadCount > 0 ? '#111827' : '#9CA3AF', fontWeight: conv.unreadCount > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {conv.lastMessage}
                      </span>
                      {conv.unreadCount > 0 && <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F9FAFB' }}>
            {selectedConv ? (
              <>
                <div style={{ padding: '14px 24px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <Avatar name={selectedConv.partnerName} size={36} color={ROLE_COLOR[selectedConv.partnerRole] ?? GREEN} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{selectedConv.partnerName}</div>
                    {selectedConv.partnerRole && <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{selectedConv.partnerRole}</div>}
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
                          background: isMine ? GREEN : '#FFFFFF',
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
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                    placeholder="Type a message..."
                    style={{ flex: 1, padding: '9px 14px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '0.875rem', outline: 'none' }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMsg || !msgInput.trim()}
                    style={{ padding: '9px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.875rem', opacity: sendingMsg || !msgInput.trim() ? 0.6 : 1 }}
                  >
                    <Send size={15} /> Send
                  </button>
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
      </main>

      {/* Compose Modal */}
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
              <button
                onClick={() => setComposeOpen(false)}
                disabled={composeSending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</p>
                {selectedRecipient ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: GREEN_LIGHT, border: `1.5px solid ${GREEN_BORDER}`, borderRadius: 10 }}>
                    <Avatar name={selectedRecipient.full_name} size={32} color={ROLE_COLOR[selectedRecipient.role] ?? GREEN} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0 }}>{selectedRecipient.full_name}</p>
                      <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: 0 }}>{selectedRecipient.role}</p>
                    </div>
                    <button
                      onClick={() => setSelectedRecipient(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 2 }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 9, padding: '8px 12px', marginBottom: 8 }}>
                      <Search size={14} color="#9CA3AF" />
                      <input
                        autoFocus
                        value={composeSearch}
                        onChange={e => setComposeSearch(e.target.value)}
                        placeholder="Search people…"
                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', color: '#374151' }}
                      />
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {filteredContacts.length === 0 ? (
                        <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', padding: '12px 0', margin: 0 }}>No people found</p>
                      ) : filteredContacts.map(c => {
                        const roleColor = ROLE_COLOR[c.role] ?? GREEN
                        return (
                          <button
                            key={c.id}
                            onClick={() => setSelectedRecipient(c)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 10px', background: 'none', border: '1px solid transparent',
                              borderRadius: 9, cursor: 'pointer', textAlign: 'left', width: '100%',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#E5E7EB' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
                          >
                            <Avatar name={c.full_name} size={34} color={roleColor} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name}</p>
                              <p style={{ fontSize: '0.75rem', margin: 0, color: roleColor, fontWeight: 500 }}>{c.role}</p>
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
                  <textarea
                    autoFocus
                    value={composeText}
                    onChange={e => setComposeText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && composeText.trim()) {
                        e.preventDefault()
                        handleComposeSend()
                      }
                    }}
                    placeholder="Type your message…"
                    rows={4}
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
              <button
                onClick={() => setComposeOpen(false)}
                disabled={composeSending}
                style={{ flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 9, fontWeight: 600, fontSize: '0.9rem', color: '#6B7280', cursor: composeSending ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleComposeSend}
                disabled={composeSending || !selectedRecipient || !composeText.trim()}
                style={{
                  flex: 1, padding: '10px', background: GREEN, border: 'none', borderRadius: 9,
                  fontWeight: 600, fontSize: '0.9rem', color: '#fff',
                  cursor: (composeSending || !selectedRecipient || !composeText.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  opacity: (composeSending || !selectedRecipient || !composeText.trim()) ? 0.55 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {composeSending
                  ? <svg className="animate-spin" width={15} height={15} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none"/><path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>
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
