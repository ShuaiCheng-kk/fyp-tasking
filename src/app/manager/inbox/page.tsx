'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ManagerSidebar from '@/components/ManagerSidebar'
import { createClient } from '@/lib/supabase'
import { Send, Search } from 'lucide-react'

const ACCENT = '#3B82F6'
const ACCENT_LIGHT = '#EFF6FF'

type Conversation = {
  partnerId: string
  partnerName: string
  partnerRole: string
  lastMessage: string
  lastTime: string
  unreadCount: number
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

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: ACCENT + '22',
      color: ACCENT, fontWeight: 700, fontSize: size * 0.38, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export default function ManagerInboxPage() {
  // auth UID — only for localStorage key lookup
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  // internal tasking user ID — used for all message from/to fields
  const [internalUserId, setInternalUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [search, setSearch] = useState('')
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${uid}`)
    setAuthUserId(uid)
    setCompanyId(cid)
    if (uid) {
      fetch(`/api/user/me?user_id=${uid}`)
        .then(r => r.json())
        .then(d => { if (d.success && d.user?.id) setInternalUserId(d.user.id) })
        .catch(() => {})
    }
  }, [])

  const fetchUnreadCount = useCallback(() => {
    if (!internalUserId || !companyId) return
    fetch(`/api/inbox/unread-count?user_id=${internalUserId}&company_id=${companyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUnreadMessages(d.unread_messages ?? 0) })
  }, [internalUserId, companyId])

  const fetchConversations = useCallback(() => {
    if (!internalUserId || !companyId) return
    fetch(`/api/inbox/messages?user_id=${internalUserId}&company_id=${companyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setConversations(d.conversations ?? []) })
  }, [internalUserId, companyId])

  useEffect(() => {
    if (!internalUserId || !companyId) return
    fetchConversations()
    fetchUnreadCount()
  }, [internalUserId, companyId, fetchConversations, fetchUnreadCount])

  useEffect(() => {
    const q = search.toLowerCase()
    setFilteredConversations(
      q ? conversations.filter(c => c.partnerName.toLowerCase().includes(q)) : conversations
    )
  }, [search, conversations])

  useEffect(() => {
    if (!selectedConv || !internalUserId || !companyId) return
    fetch(`/api/inbox/messages/${selectedConv.partnerId}?user_id=${internalUserId}&company_id=${companyId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setMessages(d.messages ?? [])
          fetchUnreadCount()
          fetchConversations()
        }
      })
  }, [selectedConv, internalUserId, companyId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!internalUserId || !companyId) return
    const channel = supabase
      .channel('manager-inbox-messages')
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
  }, [internalUserId, companyId, selectedConv])

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

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ManagerSidebar unreadMessages={unreadMessages} />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 32px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>Inbox</h1>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: conversation list */}
          <div style={{ width: '33%', minWidth: 260, maxWidth: 360, background: '#FFFFFF', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6' }}>
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
                      <span style={{ fontWeight: conv.unreadCount > 0 ? 700 : 500, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.partnerName}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#9CA3AF', flexShrink: 0, marginLeft: 6 }}>{formatTime(conv.lastTime)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                      {conv.partnerRole && (
                        <span style={{ fontSize: '0.7rem', color: ACCENT, fontWeight: 500 }}>{conv.partnerRole}</span>
                      )}
                      {conv.partnerRole && <span style={{ fontSize: '0.7rem', color: '#D1D5DB' }}>·</span>}
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
          </div>

          {/* Right: chat view */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F9FAFB' }}>
            {selectedConv ? (
              <>
                <div style={{ padding: '14px 24px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <Avatar name={selectedConv.partnerName} size={36} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{selectedConv.partnerName}</div>
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
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                    placeholder="Type a message..."
                    style={{ flex: 1, padding: '9px 14px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '0.875rem', outline: 'none' }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMsg || !msgInput.trim()}
                    style={{ padding: '9px 18px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.875rem', opacity: sendingMsg || !msgInput.trim() ? 0.6 : 1 }}
                  >
                    <Send size={15} /> Send
                  </button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', gap: 8 }}>
                <div style={{ fontSize: '2rem' }}>💬</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Select a conversation to start messaging</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
