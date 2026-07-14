'use client'

// Casual Worker's message widget — a single thread with the Employee supervising their current
// job (never a general contact list; there's nobody else to message, and no job means no one to
// message). Lives on the Dashboard as one block, not a separate sidebar page.

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'

type Message = {
  id: string
  from_user_id: string
  to_user_id: string
  content: string
  created_at: string
}

type Props = {
  authId: string
  companyId: string
  supervisorId: string
  supervisorName: string
}

export default function CasualMessagePanel({ authId, companyId, supervisorId, supervisorName }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [selfId, setSelfId] = useState('')
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const res = await fetch(`/api/casual/messages?user_id=${authId}&other_user_id=${supervisorId}`)
    const data = await res.json()
    if (data.success) {
      setMessages(data.messages)
      setSelfId(data.self_id)
    }
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authId, supervisorId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const send = async () => {
    if (!draft.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/casual/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: authId, other_user_id: supervisorId, company_id: companyId, content: draft }),
      })
      const data = await res.json()
      if (data.success) {
        setDraft('')
        await load()
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageCircle size={16} color="#EA580C" />
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>Message {supervisorName}</p>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#9CA3AF' }}>Your supervisor for this job</p>
        </div>
      </div>

      <div ref={scrollRef} style={{ height: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px', marginBottom: 10 }}>
        {loading ? (
          <p style={{ margin: 'auto', fontSize: '0.8125rem', color: '#9CA3AF' }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ margin: 'auto', fontSize: '0.8125rem', color: '#9CA3AF' }}>No messages yet — say hello.</p>
        ) : (
          messages.map(msg => {
            const mine = msg.from_user_id === selfId
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%',
                  padding: '7px 12px',
                  borderRadius: 12,
                  fontSize: '0.8125rem',
                  lineHeight: 1.45,
                  background: mine ? 'linear-gradient(135deg, #F97316, #EA580C)' : '#F3F4F6',
                  color: mine ? '#FFFFFF' : '#111827',
                }}>
                  {msg.content}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          placeholder="Type a message…"
          style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.875rem', color: '#111827', outline: 'none' }}
        />
        <button type="button" onClick={send} disabled={sending || !draft.trim()}
          style={{ width: 38, height: 38, border: 'none', borderRadius: 8, background: (sending || !draft.trim()) ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (sending || !draft.trim()) ? 'default' : 'pointer', flexShrink: 0 }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 14,
  border: '1.5px solid #E5E7EB',
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}
