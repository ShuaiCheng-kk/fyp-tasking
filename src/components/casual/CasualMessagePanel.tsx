'use client'

// Casual Worker's message widget — a single thread with the Employee supervising their current
// job (never a general contact list; there's nobody else to message, and no job means no one to
// message). Lives on the Dashboard as one block, not a separate sidebar page. Attachments reuse
// the same [image:]/[file:name] content convention and /api/inbox/upload endpoint the Owner
// Communication panel uses, so photos/files sent here render the same way on both sides.

import { useEffect, useRef, useState } from 'react'
import { Download, FileText, ImagePlus, MessageCircle, Paperclip, Send, X } from 'lucide-react'
import { TitledBlock } from '@/components/panel'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'

type Message = {
  id: string
  from_user_id: string
  to_user_id: string
  content: string
  created_at: string
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString([], { month: 'short' })
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '')
  return `${day} ${month}, ${time}`
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
  const [uploading, setUploading] = useState(false)
  const [attachFiles, setAttachFiles] = useState<File[]>([])
  const [attachPreviews, setAttachPreviews] = useState<(string | null)[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  // Live-updates the thread when the supervising Employee sends a message, matching the
  // Owner/Manager Communication panel's realtime behavior.
  useResourceInvalidation(['communication'], () => { void load() })

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

  const pickAttachments = (files: File[]) => {
    setAttachFiles(prev => [...prev, ...files])
    setAttachPreviews(prev => [...prev, ...files.map(() => null)])
    files.forEach((file, i) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = e => {
        const dataUrl = e.target?.result as string
        setAttachPreviews(prev => {
          const baseIndex = prev.length - files.length + i
          const next = [...prev]
          next[baseIndex] = dataUrl
          return next
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const removeAttachment = (index: number) => {
    setAttachFiles(prev => prev.filter((_, i) => i !== index))
    setAttachPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const uploadAndSendAttachments = async () => {
    if (attachFiles.length === 0 || uploading) return
    setUploading(true)
    try {
      for (const file of attachFiles) {
        const form = new FormData()
        form.append('file', file)
        form.append('company_id', companyId)
        const upRes = await fetch('/api/inbox/upload', { method: 'POST', body: form })
        const upData = await upRes.json()
        if (!upData.success) throw new Error(upData.error ?? 'Upload failed')
        const isImage = file.type.startsWith('image/')
        const content = isImage ? `[image:]${upData.url}` : `[file:${upData.name}]${upData.url}`
        await fetch('/api/casual/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: authId, other_user_id: supervisorId, company_id: companyId, content }),
        })
      }
      setAttachFiles([])
      setAttachPreviews([])
      if (photoInputRef.current) photoInputRef.current.value = ''
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } finally {
      setUploading(false)
    }
  }

  const submit = () => {
    if (attachFiles.length > 0) void uploadAndSendAttachments()
    else void send()
  }

  // Stretches to whatever height its host gives it (the Dashboard pins it to the bottom of the
  // viewport); the thread list is the part that grows and scrolls.
  return (
    <TitledBlock
      icon={<MessageCircle size={15} color="#F97316" />}
      title={`Message ${supervisorName}`}
      containerStyle={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <div ref={scrollRef} style={{ flex: 1, minHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px', marginBottom: 10 }}>
        {loading ? (
          <p style={{ margin: 'auto', fontSize: '0.8125rem', color: '#9CA3AF' }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ margin: 'auto', fontSize: '0.8125rem', color: '#9CA3AF' }}>No messages yet — say hello.</p>
        ) : (
          messages.map(msg => {
            const mine = msg.from_user_id === selfId
            const isImage = msg.content.startsWith('[image:]')
            const fileMatch = msg.content.match(/^\[file:(.+?)\](.+)$/)
            const isFile = Boolean(fileMatch)
            const imgUrl = isImage ? msg.content.slice('[image:]'.length) : null
            const fileName = fileMatch?.[1] ?? null
            const fileUrl = fileMatch?.[2] ?? null
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
                  {isImage && imgUrl ? (
                    <a href={imgUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 12, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                      <img src={imgUrl} alt="attachment" style={{ display: 'block', maxWidth: '100%', maxHeight: 180, objectFit: 'cover' }} />
                    </a>
                  ) : isFile && fileUrl ? (
                    <div style={{ padding: '8px 11px', borderRadius: 12, background: mine ? '#FFEDD5' : '#F3F4F6', border: mine ? '1px solid #FED7AA' : '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={13} color="#3B82F6" /></div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</p>
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={fileName ?? true} style={{ fontSize: '0.7rem', color: '#3B82F6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, marginTop: 1, textDecoration: 'none' }}><Download size={9} /> Download</a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '7px 12px',
                      borderRadius: 12,
                      fontSize: '0.8125rem',
                      lineHeight: 1.45,
                      background: mine ? 'linear-gradient(135deg, #F97316, #EA580C)' : '#F3F4F6',
                      color: mine ? '#FFFFFF' : '#111827',
                    }}>
                      {msg.content}
                    </div>
                  )}
                  <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{formatTime(msg.created_at)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {attachFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {attachFiles.map((file, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 8, background: '#F3F4F6', border: '1px solid #E5E7EB', maxWidth: 180 }}>
              {attachPreviews[i] ? (
                <img src={attachPreviews[i]!} alt={file.name} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <FileText size={13} color="#6B7280" style={{ flexShrink: 0 }} />
              )}
              <span style={{ fontSize: '0.7rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <button onClick={() => removeAttachment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'flex', flexShrink: 0 }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="file" accept="image/*" multiple style={{ display: 'none' }}
          ref={photoInputRef}
          onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) pickAttachments(files); e.target.value = '' }}
        />
        <input
          type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" multiple style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) pickAttachments(files); e.target.value = '' }}
        />
        <button type="button" onClick={() => photoInputRef.current?.click()} title="Send photo"
          style={{ flexShrink: 0, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF7ED', border: '1.5px solid rgba(249,115,22,0.25)', borderRadius: 8, cursor: 'pointer', color: '#F97316' }}>
          <ImagePlus size={16} strokeWidth={2} />
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} title="Send file"
          style={{ flexShrink: 0, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EFF6FF', border: '1.5px solid rgba(59,130,246,0.25)', borderRadius: 8, cursor: 'pointer', color: '#3B82F6' }}>
          <Paperclip size={15} strokeWidth={2} />
        </button>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          placeholder="Type a message…"
          style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.875rem', color: '#111827', outline: 'none' }}
        />
        <button type="button" onClick={submit} disabled={sending || uploading || (!draft.trim() && attachFiles.length === 0)}
          style={{ width: 38, height: 38, border: 'none', borderRadius: 8, background: (sending || uploading || (!draft.trim() && attachFiles.length === 0)) ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (sending || uploading || (!draft.trim() && attachFiles.length === 0)) ? 'default' : 'pointer', flexShrink: 0 }}>
          <Send size={15} />
        </button>
      </div>
    </TitledBlock>
  )
}
