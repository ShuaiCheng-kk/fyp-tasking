'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, FileText, ImagePlus, MousePointer2, RefreshCcw, Save, Trash2 } from 'lucide-react'
import AdminSidebar from '@/components/AdminSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { createBrowserClient } from '@supabase/ssr'
import { MarketingContentBlock, MarketingPage, MarketingPageSummary } from '@/types/MarketingPage'

const ORANGE = '#F97316'
const TEXT = '#0F172A'
const MUTED = '#64748B'
const BORDER = '#E2E8F0'
const BG = '#EFF4FA'
const SOFT_ORANGE = '#FFF7ED'

function buildBlockMap(page: MarketingPage | null): Record<string, string> {
  if (!page) return {}
  return page.blocks.reduce<Record<string, string>>((acc, block) => {
    acc[block.id] = block.value
    return acc
  }, {})
}

function getDraftValue(drafts: Record<string, string>, block: MarketingContentBlock | null, fallback: string): string {
  if (!block) return fallback
  return drafts[block.id] ?? block.value ?? fallback
}

function hasBlock(blocks: Record<string, MarketingContentBlock>, blockKey: string): boolean {
  return Boolean(blocks[blockKey])
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [adminUserId, setAdminUserId] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const [userName, setUserName] = useState('')
  const [userPhoto, setUserPhoto] = useState<string | null>(null)
  const [pages, setPages] = useState<MarketingPageSummary[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [selectedPage, setSelectedPage] = useState<MarketingPage | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editingBlockId, setEditingBlockId] = useState('')
  const [loadingPages, setLoadingPages] = useState(true)
  const [loadingPage, setLoadingPage] = useState(false)
  const [savingBlockId, setSavingBlockId] = useState('')
  const [uploadingBlockId, setUploadingBlockId] = useState('')
  const [editingCtaBtn, setEditingCtaBtn] = useState(false)
  const [editingProductsBtn, setEditingProductsBtn] = useState(false)
  const [editingIndustriesBtn, setEditingIndustriesBtn] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageTargetBlock = useRef<MarketingContentBlock | null>(null)

  const selectedSummary = useMemo(
    () => pages.find(page => page.slug === selectedSlug) ?? null,
    [pages, selectedSlug],
  )

  const blockByKey = useMemo(() => {
    return (selectedPage?.blocks ?? []).reduce<Record<string, MarketingContentBlock>>((acc, block) => {
      acc[block.block_key] = block
      return acc
    }, {})
  }, [selectedPage])

  useEffect(() => {
    const id = window.localStorage.getItem('tasking_user_id') || ''
    const role = window.localStorage.getItem('tasking_user_role') || ''
    setAdminUserId(id)
    if (!id || role !== 'Marketing Admin') {
      router.replace('/signin')
    } else {
      setAuthChecked(true)
    }
  }, [router])

  useEffect(() => {
    if (!adminUserId) return
    fetch(`/api/user/me?user_id=${adminUserId}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setUserName(d.user.full_name ?? ''); setUserPhoto(d.user.profile_photo_url ?? null) } })
      .catch(() => {})
  }, [adminUserId])

  useEffect(() => {
    if (!adminUserId) return

    const loadPages = async () => {
      setLoadingPages(true)
      setError('')
      try {
        const res = await fetch(`/api/admin/marketing-pages?admin_user_id=${encodeURIComponent(adminUserId)}`)
        const data = await res.json()
        if (!data.success) throw new Error(data.message)
        const nextPages = (data.pages ?? []) as MarketingPageSummary[]
        setPages(nextPages)
        setSelectedSlug(current => current || nextPages.find(page => page.slug === 'home')?.slug || nextPages[0]?.slug || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load marketing pages')
      } finally {
        setLoadingPages(false)
      }
    }

    loadPages()
  }, [adminUserId])

  useEffect(() => {
    if (!adminUserId || !selectedSlug) return

    const loadPage = async () => {
      setLoadingPage(true)
      setEditingBlockId('')
      setEditingCtaBtn(false)
      setEditingProductsBtn(false)
      setEditingIndustriesBtn(false)
      setError('')
      setNotice('')
      try {
        const params = new URLSearchParams({ admin_user_id: adminUserId, slug: selectedSlug })
        const res = await fetch(`/api/admin/marketing-pages?${params.toString()}`)
        const data = await res.json()
        if (!data.success) throw new Error(data.message)
        const page = data.page as MarketingPage
        setSelectedPage(page)
        setDrafts(buildBlockMap(page))
      } catch (err) {
        setSelectedPage(null)
        setDrafts({})
        setError(err instanceof Error ? err.message : 'Failed to load page content')
      } finally {
        setLoadingPage(false)
      }
    }

    loadPage()
  }, [adminUserId, selectedSlug])

  const saveBlock = async (block: MarketingContentBlock) => {
    if (!adminUserId) return
    setSavingBlockId(block.id)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/marketing-pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_user_id: adminUserId,
          block_id: block.id,
          value: drafts[block.id] ?? '',
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      const updated = data.block as MarketingContentBlock
      setSelectedPage(current => {
        if (!current) return current
        return {
          ...current,
          blocks: current.blocks.map(item => item.id === updated.id ? updated : item),
        }
      })
      setDrafts(current => ({ ...current, [updated.id]: updated.value }))
      setEditingBlockId('')
      setNotice('Saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save content')
    } finally {
      setSavingBlockId('')
    }
  }

  const resetDraft = (block: MarketingContentBlock) => {
    setDrafts(current => ({ ...current, [block.id]: block.value }))
    setEditingBlockId('')
  }

  const signOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' }).catch(() => null)
    window.localStorage.removeItem('tasking_user_id')
    window.localStorage.removeItem('tasking_user_role')
    router.replace('/signin')
  }

  const videoInputRef = useRef<HTMLInputElement>(null)
  const videoTargetBlock = useRef<MarketingContentBlock | null>(null)

  const uploadMedia = async (block: MarketingContentBlock, file: File) => {
    setUploadingBlockId(block.id)
    setError('')
    setNotice('')
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const ext = file.name.split('.').pop()
      const path = `${block.block_key}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('marketing-images')
        .upload(path, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: urlData } = supabase.storage.from('marketing-images').getPublicUrl(path)
      const res = await fetch('/api/admin/marketing-pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_user_id: adminUserId, block_id: block.id, value: urlData.publicUrl }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      const updated = data.block as MarketingContentBlock
      setSelectedPage(current => current ? { ...current, blocks: current.blocks.map(b => b.id === updated.id ? updated : b) } : current)
      setDrafts(current => ({ ...current, [updated.id]: updated.value }))
      setNotice('Uploaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingBlockId('')
    }
  }

  const uploadImage = async (block: MarketingContentBlock, file: File) => {
    setUploadingBlockId(block.id)
    setError('')
    setNotice('')
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const ext = file.name.split('.').pop()
      const path = `${block.block_key}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('marketing-images')
        .upload(path, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage.from('marketing-images').getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      const res = await fetch('/api/admin/marketing-pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_user_id: adminUserId, block_id: block.id, value: publicUrl }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      const updated = data.block as MarketingContentBlock
      setSelectedPage(current => {
        if (!current) return current
        return { ...current, blocks: current.blocks.map(b => b.id === updated.id ? updated : b) }
      })
      setDrafts(current => ({ ...current, [updated.id]: updated.value }))
      setNotice('Image uploaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed')
    } finally {
      setUploadingBlockId('')
    }
  }

  const renderImageBlock = (block: MarketingContentBlock | null) => {
    if (!block) return null
    const currentUrl = drafts[block.id] ?? block.value ?? ''
    const uploading = uploadingBlockId === block.id

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: 200,
            borderRadius: 16,
            border: `2px dashed ${currentUrl ? '#FDBA74' : '#CBD5E1'}`,
            background: currentUrl ? '#000' : '#F8FAFC',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt="Dashboard preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 14 }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: MUTED, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🖥️</div>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: TEXT }}>Built-in dashboard mockup</p>
              <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Upload an image below to replace it</p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => { imageTargetBlock.current = block; imageInputRef.current?.click() }}
            disabled={uploading}
            className="btn-press"
            style={{ border: 'none', borderRadius: 9, background: ORANGE, color: '#FFFFFF', padding: '9px 14px', fontWeight: 800, fontSize: 13, cursor: uploading ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: uploading ? 0.7 : 1 }}
          >
            <ImagePlus size={14} /> {uploading ? 'Uploading…' : currentUrl ? 'Choose Another Picture' : 'Upload Custom Image'}
          </button>
          {currentUrl ? (
            <button
              type="button"
              onClick={async () => {
                const res = await fetch('/api/admin/marketing-pages', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ admin_user_id: adminUserId, block_id: block.id, value: '' }),
                })
                const data = await res.json()
                if (data.success) {
                  setSelectedPage(current => current ? { ...current, blocks: current.blocks.map(b => b.id === data.block.id ? data.block : b) } : current)
                  setDrafts(current => ({ ...current, [block.id]: '' }))
                  setNotice('Image removed')
                }
              }}
              style={{ border: '1px solid #FECACA', borderRadius: 9, background: '#FEF2F2', color: '#DC2626', padding: '9px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <Trash2 size={14} /> Remove
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  const renderEditableText = ({
    blockKey,
    fallback,
    variant,
    multiline = false,
  }: {
    blockKey: string
    fallback: string
    variant: 'badge' | 'hero' | 'heroAccent' | 'subhead' | 'sectionTitle' | 'body' | 'cardTitle' | 'cardBody' | 'cta'
    multiline?: boolean
  }) => {
    const block = blockByKey[blockKey] ?? null
    const value = getDraftValue(drafts, block, fallback)
    const editing = !!block && editingBlockId === block.id
    const dirty = !!block && (drafts[block.id] ?? '') !== block.value
    const canEdit = !!block

    const baseStyle: React.CSSProperties = {
      position: 'relative',
      display: variant === 'body' || variant === 'subhead' || variant === 'cardBody' ? 'block' : 'inline-block',
      borderRadius: variant === 'badge' ? 999 : 8,
      outline: '2px solid transparent',
      outlineOffset: 4,
      cursor: canEdit ? 'text' : 'default',
      transition: 'outline-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease',
    }

    const textStyle: React.CSSProperties =
      variant === 'badge' ? { color: '#FB923C', fontSize: 13, fontWeight: 700, background: 'rgba(249,115,22,0.18)', padding: '5px 14px' } :
      variant === 'hero' ? { color: '#FFFFFF', fontSize: 52, fontWeight: 700, lineHeight: 1.08, fontFamily: 'var(--font-heading)' } :
      variant === 'heroAccent' ? { color: ORANGE, fontSize: 52, fontWeight: 700, lineHeight: 1.08, fontFamily: 'var(--font-heading)' } :
      variant === 'subhead' ? { color: 'rgba(255,255,255,0.7)', fontSize: 17, lineHeight: 1.75, maxWidth: 520, textAlign: 'center' as const } :
      variant === 'sectionTitle' ? { color: '#1C1917', fontSize: 32, fontWeight: 700, lineHeight: 1.2, fontFamily: 'var(--font-heading)' } :
      variant === 'cardTitle' ? { color: '#1C1917', fontSize: 17, fontWeight: 800, lineHeight: 1.35, fontFamily: 'var(--font-heading)' } :
      variant === 'cardBody' ? { color: '#78716C', fontSize: 14, lineHeight: 1.65 } :
      variant === 'cta' ? { color: '#FFFFFF', fontSize: 36, fontWeight: 700, lineHeight: 1.18, fontFamily: 'var(--font-heading)' } :
      { color: '#78716C', fontSize: 15, lineHeight: 1.7 }

    if (!canEdit) {
      return <span style={{ ...baseStyle, ...textStyle }}>{value}</span>
    }

    if (editing) {
      return (
        <span style={{ position: 'relative', display: baseStyle.display }}>
          <span
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            contentEditable
            suppressContentEditableWarning
            autoFocus
            dangerouslySetInnerHTML={{ __html: value }}
            onInput={(e) => setDrafts(curr => ({ ...curr, [block.id]: (e.target as HTMLElement).textContent ?? '' }))}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); resetDraft(block) }
              if (!multiline && e.key === 'Enter') { e.preventDefault(); if (dirty) saveBlock(block) }
            }}
            style={{
              ...baseStyle,
              ...textStyle,
              display: 'block',
              outline: '2px solid #FDBA74',
              outlineOffset: 4,
              cursor: 'text',
              whiteSpace: 'pre-wrap',
              minWidth: 40,
            }}
          />
          <span style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, display: 'flex', gap: 6, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '6px 8px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', whiteSpace: 'nowrap' }}>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); saveBlock(block) }}
              disabled={!dirty || savingBlockId === block.id}
              style={{ border: 'none', borderRadius: 7, background: dirty ? ORANGE : '#CBD5E1', color: '#FFFFFF', padding: '6px 10px', fontWeight: 900, fontSize: 11, cursor: dirty ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Save size={11} /> {savingBlockId === block.id ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); resetDraft(block) }}
              style={{ border: '1px solid #CBD5E1', borderRadius: 7, background: '#FFFFFF', color: TEXT, padding: '6px 10px', fontWeight: 800, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <RefreshCcw size={11} /> Cancel
            </button>
          </span>
        </span>
      )
    }

    return (
      <span
        tabIndex={0}
        role="button"
        title="Click to edit"
        onClick={() => setEditingBlockId(block.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') setEditingBlockId(block.id)
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.outlineColor = '#FDBA74'
          event.currentTarget.style.backgroundColor = variant === 'hero' || variant === 'heroAccent' || variant === 'subhead' || variant === 'cta' ? 'rgba(249,115,22,0.08)' : '#FFF7ED'
          event.currentTarget.style.boxShadow = '0 10px 24px rgba(249,115,22,0.14)'
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.outlineColor = 'transparent'
          event.currentTarget.style.backgroundColor = variant === 'badge' ? 'rgba(249,115,22,0.18)' : 'transparent'
          event.currentTarget.style.boxShadow = 'none'
        }}
        style={{ ...baseStyle, ...textStyle }}
      >
        {value}
        <span style={{ position: 'absolute', right: -8, top: -14, transform: 'translateX(100%)', background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, opacity: dirty ? 1 : 0 }}>
          Unsaved
        </span>
      </span>
    )
  }

  const toggleSection = (blockKey: string, currentlyVisible: boolean) => {
    const block = blockByKey[blockKey] ?? null
    if (!block) return
    const newVal = currentlyVisible ? 'false' : 'true'
    setDrafts(prev => ({ ...prev, [block.id]: newVal }))
    setSavingBlockId(block.id)
    fetch('/api/admin/marketing-pages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_id: block.id, value: newVal, admin_user_id: adminUserId }),
    }).finally(() => setSavingBlockId(''))
  }

  const isSectionVisible = (blockKey: string) => {
    const block = blockByKey[blockKey] ?? null
    if (!block) return true
    return (drafts[block.id] ?? block.value) !== 'false'
  }

  const renderSectionWrap = (
    visibilityKey: string,
    label: string,
    children: React.ReactNode,
  ) => {
    const block = blockByKey[visibilityKey] ?? null
    const visible = isSectionVisible(visibilityKey)
    const saving = block ? savingBlockId === block.id : false

    if (!visible) {
      return (
        <div style={{ background: '#F1F5F9', border: '2px dashed #CBD5E1', borderRadius: 0, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>{label} — hidden from visitors</span>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(visibilityKey, false)}
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#FFFFFF', border: '1.5px solid #CBD5E1', borderRadius: 8, color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? 'Saving…' : 'Show section'}
          </button>
        </div>
      )
    }

    return (
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 4,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)',
            border: '1px solid rgba(226,232,240,0.8)', borderRadius: 10,
            padding: '5px 10px 5px 8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}
        >
          <div
            onClick={() => toggleSection(visibilityKey, true)}
            style={{
              width: 34, height: 19, borderRadius: 999, position: 'relative', cursor: 'pointer', flexShrink: 0,
              background: ORANGE, transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: 17, width: 15, height: 15,
              borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap' }}>
            {saving ? 'Saving…' : label}
          </span>
        </div>
        {children}
      </div>
    )
  }

  const renderEditableBtn = ({
    labelKey, urlKey, fallbackLabel, fallbackUrl, editing, setEditing, btnStyle,
  }: {
    labelKey: string; urlKey: string; fallbackLabel: string; fallbackUrl: string
    editing: boolean; setEditing: (v: boolean) => void
    btnStyle: React.CSSProperties
  }) => {
    const labelBlock = blockByKey[labelKey] ?? null
    const urlBlock   = blockByKey[urlKey]   ?? null
    const labelVal = labelBlock ? (drafts[labelBlock.id] ?? labelBlock.value) : fallbackLabel

    const saveBlock = async (block: MarketingContentBlock) => {
      setSavingBlockId(block.id)
      const res = await fetch('/api/admin/marketing-pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_user_id: adminUserId, block_id: block.id, value: drafts[block.id] ?? block.value }),
      })
      const data = await res.json()
      setSavingBlockId('')
      if (data.success) {
        setSelectedPage(c => c ? { ...c, blocks: c.blocks.map(b => b.id === data.block.id ? data.block : b) } : c)
        setNotice('Saved')
      }
    }

    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          style={{ ...btnStyle, border: editing ? `2px solid #FDBA74` : (btnStyle.border as string ?? '2px solid transparent'), display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          {labelVal}
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 5 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </span>
        </button>
        {editing && (
          <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px', minWidth: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: ORANGE, letterSpacing: 1.1, textTransform: 'uppercase' }}>Button Properties</p>
              <button type="button" onClick={() => setEditing(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: MUTED, padding: 2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {labelBlock && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: MUTED }}>Label</p>
                <input value={drafts[labelBlock.id] ?? labelBlock.value} onChange={e => setDrafts(p => ({ ...p, [labelBlock.id]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', color: TEXT }} />
              </div>
            )}
            {urlBlock && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: MUTED }}>URL</p>
                <select
                  value=""
                  onChange={e => { if (e.target.value) setDrafts(p => ({ ...p, [urlBlock.id]: e.target.value })) }}
                  style={{ width: '100%', padding: '7px 10px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 12, outline: 'none', color: MUTED, background: '#FFFFFF', marginBottom: 6 }}
                >
                  <option value="">Pick a page…</option>
                  {pages.map(p => (
                    <option key={p.slug} value={p.route_path}>{p.title} — {p.route_path}</option>
                  ))}
                </select>
                <input
                  value={drafts[urlBlock.id] ?? urlBlock.value}
                  onChange={e => setDrafts(p => ({ ...p, [urlBlock.id]: e.target.value }))}
                  placeholder={fallbackUrl}
                  style={{ width: '100%', padding: '7px 10px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 12, fontFamily: 'monospace', outline: 'none', color: TEXT }}
                />
              </div>
            )}
            <button type="button"
              onClick={async () => { if (labelBlock) await saveBlock(labelBlock); if (urlBlock) await saveBlock(urlBlock); setEditing(false) }}
              style={{ width: '100%', padding: '8px', background: ORANGE, border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              {savingBlockId ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderCtaBtnSection = (bgColor: string, headlineKey: string, subheadlineKey: string) => {
    const hasBtn = !!(blockByKey['cta.button.label'] || blockByKey['cta.button.url'])
    return (
      <section style={{ background: bgColor, padding: '62px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: headlineKey, fallback: 'Ready to simplify your workforce?', variant: 'cta' })}
        <div style={{ height: 16 }} />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {renderEditableText({ blockKey: subheadlineKey, fallback: 'Join SMEs already using Tasking to hire smarter, schedule faster, and track with confidence.', variant: 'subhead', multiline: true })}
        </div>
        {hasBtn && (
          <>
            <div style={{ height: 32 }} />
            {renderEditableBtn({
              labelKey: 'cta.button.label', urlKey: 'cta.button.url',
              fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started',
              editing: editingCtaBtn, setEditing: setEditingCtaBtn,
              btnStyle: { background: '#FFFFFF', color: ORANGE, borderRadius: 12, padding: '13px 32px', fontSize: 15, fontWeight: 800, cursor: 'pointer' },
            })}
          </>
        )}
      </section>
    )
  }

  const renderGenericPreview = () => {
    const hasIntro = hasBlock(blockByKey, 'intro.title') || hasBlock(blockByKey, 'intro.body')
    const hasCta = hasBlock(blockByKey, 'cta.headline') || hasBlock(blockByKey, 'cta.subheadline')
    const secondaryBlocks = (selectedPage?.blocks ?? []).filter(block =>
      !block.block_key.startsWith('hero.') &&
      !block.block_key.startsWith('intro.') &&
      !block.block_key.startsWith('cta.')
    )

    return (
    <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      <section style={{ background: '#1C1C1E', padding: '64px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: 'hero.headline', fallback: selectedPage?.title ?? 'Marketing page', variant: 'hero' })}
        <div style={{ height: 18 }} />
        {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Double-click this text to edit the marketing content for this page.', variant: 'subhead', multiline: true })}
      </section>
      {hasIntro ? (
        <section style={{ padding: '56px 48px', background: '#FFFBF5' }}>
          {hasBlock(blockByKey, 'intro.title') ? renderEditableText({ blockKey: 'intro.title', fallback: 'Section headline', variant: 'sectionTitle' }) : null}
          {hasBlock(blockByKey, 'intro.title') && hasBlock(blockByKey, 'intro.body') ? <div style={{ height: 14 }} /> : null}
          {hasBlock(blockByKey, 'intro.body') ? renderEditableText({ blockKey: 'intro.body', fallback: 'Add the body copy for this marketing section from the live editor.', variant: 'body', multiline: true }) : null}
        </section>
      ) : null}
      {secondaryBlocks.length > 0 ? (
        <section style={{ padding: '56px 48px', background: '#FFFFFF' }}>
          <h2 style={{ margin: '0 0 24px', color: '#1C1917', fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>Page content</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            {secondaryBlocks.map(block => (
              <div key={block.id} className="card-lift" style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: 14, padding: 20 }}>
                <p style={{ margin: '0 0 10px', color: '#94A3B8', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{block.label}</p>
                {renderEditableText({
                  blockKey: block.block_key,
                  fallback: block.value,
                  variant: block.block_type === 'textarea' || block.block_type === 'list' ? 'cardBody' : 'cardTitle',
                  multiline: block.block_type === 'textarea' || block.block_type === 'list',
                })}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {hasCta ? renderCtaBtnSection(ORANGE, 'cta.headline', 'cta.subheadline') : null}
    </div>
    )
  }

  const renderAboutPreview = () => (
    <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      <section style={{ background: '#1C1C1E', padding: '76px 48px', textAlign: 'center' }}>
        <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, marginBottom: 24 }}>
          About
        </span>
        {renderEditableText({ blockKey: 'hero.headline', fallback: "Built by people who've seen the chaos firsthand.", variant: 'hero' })}
        <div style={{ height: 20 }} />
        {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Tasking was born out of a simple frustration - watching SMEs struggle with casual workforce management using tools that were never built for them.', variant: 'subhead', multiline: true })}
      </section>

      <section style={{ background: '#FFFBF5', padding: '64px 48px', textAlign: 'center' }}>
        <h2 style={{ margin: 0, color: '#1C1917', fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Learn more about us</h2>
        <p style={{ margin: '12px auto 38px', color: '#78716C', fontSize: 16, lineHeight: 1.7, maxWidth: 640 }}>
          Everything you need to know about why Tasking exists and the people behind it.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, textAlign: 'left' }}>
          {[
            ['Mission', 'Why we built Tasking and what we stand for.'],
            ['Problem & Solution', 'The real problems SMEs face, and exactly how we fix them.'],
            ['Meet the Team', 'The people behind Tasking.'],
            ['FAQ', 'Answers to the questions we get most often.'],
          ].map(([title, body]) => (
            <div key={title} className="card-lift" style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 16, padding: 26 }}>
              <h3 style={{ margin: 0, color: '#1C1917', fontSize: 17, fontWeight: 800 }}>{title}</h3>
              <p style={{ margin: '8px 0 0', color: '#78716C', fontSize: 14, lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: ORANGE, padding: '62px 48px', textAlign: 'center' }}>
        <p style={{ margin: '0 auto 18px', maxWidth: 720, color: '#FFFFFF', fontSize: 28, fontWeight: 800, lineHeight: 1.25, fontFamily: 'var(--font-heading)' }}>
          &quot;We didn&apos;t build another HR tool. We built the thing SMEs actually needed.&quot;
        </p>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 600 }}>- The Tasking Team</p>
      </section>
    </div>
  )

  const renderHomePreview = () => (
    <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      {renderSectionWrap('section.hero.visible', 'Hero Banner', <section style={{ background: '#1C1C1E', padding: '76px 54px 86px', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 440px', gap: 48, alignItems: 'center' }}>
          <div>
            {renderEditableText({ blockKey: 'hero.badge', fallback: 'Built for SMEs', variant: 'badge' })}
            <div style={{ height: 26 }} />
            {renderEditableText({ blockKey: 'hero.headline.line1', fallback: 'Hire. Schedule. Track.', variant: 'hero' })}
            <div style={{ height: 8 }} />
            {renderEditableText({ blockKey: 'hero.headline.line2', fallback: 'All in One Place.', variant: 'heroAccent' })}
            <div style={{ height: 22 }} />
            {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Tasking is the all-in-one casual workforce management platform that helps SMEs hire, schedule, and track their teams without the complexity.', variant: 'subhead', multiline: true })}
          </div>
          {(() => {
            const imgBlock = blockByKey['hero.dashboard_image'] ?? null
            const imgUrl = imgBlock ? (drafts[imgBlock.id] ?? imgBlock.value) : ''
            const isUploading = imgBlock ? uploadingBlockId === imgBlock.id : false
            return (
              <div
                style={{ position: 'relative', minHeight: 320, borderRadius: 20, background: '#2C2C2E', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 60px rgba(249,115,22,0.24)', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => { if (imgBlock) { imageTargetBlock.current = imgBlock; imageInputRef.current?.click() } }}
                onMouseEnter={e => { const ov = e.currentTarget.querySelector('.img-overlay') as HTMLElement | null; if (ov) ov.style.opacity = '1' }}
                onMouseLeave={e => { const ov = e.currentTarget.querySelector('.img-overlay') as HTMLElement | null; if (ov) ov.style.opacity = '0' }}
              >
                {imgUrl ? (
                  <img src={imgUrl} alt="Dashboard preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 320 }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 320, color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 700, gap: 8, textAlign: 'center', padding: 24 }}>
                    <ImagePlus size={28} style={{ opacity: 0.5 }} />
                    <span>Click to upload image</span>
                  </div>
                )}
                <div className="img-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0, transition: 'opacity 0.18s', borderRadius: 20 }}>
                  <ImagePlus size={26} color="#fff" />
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>{isUploading ? 'Uploading…' : imgUrl ? 'Change Image' : 'Upload Image'}</span>
                </div>
              </div>
            )
          })()}
        </div>
      </section>)}

      {renderSectionWrap('section.how-it-works.visible', 'How It Works', (() => {
        const vBlock = blockByKey['video.demo'] ?? null
        const vUrl = vBlock ? (drafts[vBlock.id] ?? vBlock.value) : ''
        const vUploading = vBlock ? uploadingBlockId === vBlock.id : false
        return (
          <section style={{ background: ORANGE, padding: '72px 48px', textAlign: 'center' }}>
            <div style={{ marginBottom: 6, color: '#FFFFFF' }}>
              {renderEditableText({ blockKey: 'video.title', fallback: 'See Tasking in Action', variant: 'cta' })}
            </div>
            <div style={{ margin: '10px auto 36px', maxWidth: 560 }}>
              {renderEditableText({ blockKey: 'video.subtitle', fallback: 'Watch how Tasking simplifies your entire casual workforce workflow in minutes.', variant: 'subhead', multiline: true })}
            </div>
            <div
              style={{ maxWidth: 760, margin: '0 auto', borderRadius: 14, overflow: 'hidden', background: '#1C1917', position: 'relative', cursor: vBlock ? 'pointer' : 'default', minHeight: 360 }}
              onClick={() => { if (vBlock) { videoTargetBlock.current = vBlock; videoInputRef.current?.click() } }}
              onMouseEnter={e => { const ov = e.currentTarget.querySelector('.vid-overlay') as HTMLElement | null; if (ov) ov.style.opacity = '1' }}
              onMouseLeave={e => { const ov = e.currentTarget.querySelector('.vid-overlay') as HTMLElement | null; if (ov) ov.style.opacity = '0' }}
            >
              {vUrl ? (
                <video width="100%" controls muted loop playsInline style={{ display: 'block' }}>
                  <source src={vUrl} type="video/mp4" />
                </video>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 12, color: 'rgba(255,255,255,0.4)', padding: 24 }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Click to upload demo video</span>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>MP4 recommended</span>
                </div>
              )}
              <div className="vid-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0, transition: 'opacity 0.18s', pointerEvents: 'none' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>{vUploading ? 'Uploading…' : vUrl ? 'Replace Video' : 'Upload Video'}</span>
              </div>
            </div>
            {vUrl && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation()
                  if (!vBlock) return
                  const res = await fetch('/api/admin/marketing-pages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_user_id: adminUserId, block_id: vBlock.id, value: '' }) })
                  const data = await res.json()
                  if (data.success) {
                    setSelectedPage(c => c ? { ...c, blocks: c.blocks.map(b => b.id === data.block.id ? data.block : b) } : c)
                    setDrafts(c => ({ ...c, [vBlock.id]: '' }))
                    setNotice('Video removed')
                  }
                }}
                style={{ marginTop: 14, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, background: 'transparent', color: '#fff', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Remove video
              </button>
            )}
          </section>
        )
      })())}

      {renderSectionWrap('section.why.visible', 'Why Tasking', <section style={{ background: '#FFFBF5', padding: '60px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: 'why.title', fallback: 'Why SMEs Choose Tasking', variant: 'sectionTitle' })}
        <div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, textAlign: 'left' }}>
          {[
            {
              titleKey: 'why.card.simple.title',
              descKey: 'why.card.simple.desc',
              title: 'Simple Enough for Anyone',
              desc: 'Designed for SME owners who need results without a learning curve. No technical knowledge needed - just set up and go.',
              icon: <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="9" r="5" stroke={ORANGE} strokeWidth="2" /><path d="M4 25c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>,
            },
            {
              titleKey: 'why.card.control.title',
              descKey: 'why.card.control.desc',
              title: 'Full Control, Department by Department',
              desc: 'Managers handle their own recruitment and scheduling while owners keep full visibility across all departments.',
              icon: <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><rect x="3" y="5" width="22" height="19" rx="2" stroke={ORANGE} strokeWidth="2" /><path d="M10 24V17h8v7" stroke={ORANGE} strokeWidth="2" /><rect x="7" y="10" width="4" height="3" rx="0.5" stroke={ORANGE} strokeWidth="1.5" /><rect x="17" y="10" width="4" height="3" rx="0.5" stroke={ORANGE} strokeWidth="1.5" /></svg>,
            },
            {
              titleKey: 'why.card.ai.title',
              descKey: 'why.card.ai.desc',
              title: 'Enterprise AI - Free for Everyone',
              desc: 'AI-powered job description generation, candidate recommendations, and anomaly detection are included in the free plan.',
              icon: <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><path d="M14 3L16.5 11L24 14L16.5 17L14 25L11.5 17L4 14L11.5 11L14 3Z" stroke={ORANGE} strokeWidth="2" strokeLinejoin="round" /></svg>,
            },
            {
              titleKey: 'why.card.casual.title',
              descKey: 'why.card.casual.desc',
              title: 'Built for Casual Workforce Realities',
              desc: 'Photo-based clock-in verification, digital attendance records, and automated workflows are built for flexible workers.',
              icon: <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="10" stroke={ORANGE} strokeWidth="2" /><path d="M14 8V14L17.5 16.5" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
            },
          ].map(card => (
            <div key={card.titleKey} className="card-lift" style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 14, padding: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: '#FEF3C7', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                {card.icon}
              </div>
              <div style={{ marginBottom: 8 }}>
                {renderEditableText({ blockKey: card.titleKey, fallback: card.title, variant: 'cardTitle' })}
              </div>
              {renderEditableText({ blockKey: card.descKey, fallback: card.desc, variant: 'cardBody', multiline: true })}
            </div>
          ))}
        </div>
      </section>)}

      {renderSectionWrap('section.products.visible', 'Products Preview', <section style={{ background: '#FFFFFF', padding: '60px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: 'products.title', fallback: 'Everything You Need, In One Platform', variant: 'sectionTitle' })}
        <div style={{ margin: '14px auto 32px', maxWidth: 560 }}>
          {renderEditableText({ blockKey: 'products.subtitle', fallback: 'Tasking covers every aspect of casual workforce management across 5 core modules.', variant: 'body', multiline: true })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14, textAlign: 'left' }}>
          {[
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke={ORANGE} strokeWidth="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/></svg>, title: 'Recruitment', descKey: 'products.card.recruitment.desc', fallback: 'Post jobs, shortlist candidates, and send invitations — powered by AI.' },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={ORANGE} strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><path d="M9 16l2 2 4-4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, title: 'Attendance', descKey: 'products.card.attendance.desc', fallback: 'Photo-verified clock-in, AI auto-approval, and anomaly detection.' },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" stroke={ORANGE} strokeWidth="2" strokeLinejoin="round"/><path d="M19 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" stroke={ORANGE} strokeWidth="1.5" strokeLinejoin="round"/></svg>, title: 'AI Features', descKey: 'products.card.ai.desc', fallback: 'Intelligent automation built into every step of your workflow.' },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3" stroke={ORANGE} strokeWidth="2"/><circle cx="5" cy="10" r="2.5" stroke={ORANGE} strokeWidth="1.75"/><circle cx="19" cy="10" r="2.5" stroke={ORANGE} strokeWidth="1.75"/><path d="M2 20c0-3 1.8-5 5-5" stroke={ORANGE} strokeWidth="1.75" strokeLinecap="round"/><path d="M22 20c0-3-1.8-5-5-5" stroke={ORANGE} strokeWidth="1.75" strokeLinecap="round"/><path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/></svg>, title: 'Team Management', descKey: 'products.card.team.desc', fallback: 'Manage roles, departments, and permissions with ease.' },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/></svg>, title: 'Smart Notifications', descKey: 'products.card.notifications.desc', fallback: 'Automated alerts that keep your team informed and on time.' },
          ].map(({ icon, title, descKey, fallback }) => (
            <div key={title} style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: 14, padding: '20px 16px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: '#FEF3C7', display: 'grid', placeItems: 'center', marginBottom: 14 }}>{icon}</div>
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: TEXT, fontFamily: 'var(--font-heading)' }}>{title}</p>
              <div style={{ fontSize: 12, color: '#78716C', lineHeight: 1.6 }}>
                {renderEditableText({ blockKey: descKey, fallback, variant: 'cardBody', multiline: true })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32 }}>
          {renderEditableBtn({ labelKey: 'products.button.label', urlKey: 'products.button.url', fallbackLabel: 'Explore All Features', fallbackUrl: '/products', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' } })}
        </div>
      </section>)}

      {renderSectionWrap('section.industries.visible', 'Industries', <section style={{ background: '#FFFBF5', padding: '60px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: 'industries.title', fallback: 'Built for the Industries That Run on Casual Workers', variant: 'sectionTitle' })}
        <div style={{ margin: '14px auto 36px', maxWidth: 560 }}>
          {renderEditableText({ blockKey: 'industries.subtitle', fallback: 'From retail floors to event venues, Tasking adapts to the way your industry works.', variant: 'body', multiline: true })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
          {[
            { icon: <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><path d="M10 14V10a6 6 0 0 1 12 0v4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><rect x="4" y="13" width="24" height="15" rx="2" stroke={ORANGE} strokeWidth="2"/></svg>, key: 'industries.card.retail', fallback: 'Retail' },
            { icon: <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><path d="M10 6v6a4 4 0 0 0 4 4v10" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><path d="M22 6v20" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><path d="M18 6c0 3.314 1.343 6 4 7" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><path d="M10 6v3M12 6v3M14 6v3" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/></svg>, key: 'industries.card.food', fallback: 'Food & Beverage' },
            { icon: <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="10" width="20" height="13" rx="2" stroke={ORANGE} strokeWidth="2"/><path d="M22 15h5l3 5v3h-8V15z" stroke={ORANGE} strokeWidth="2" strokeLinejoin="round"/><circle cx="8" cy="24" r="2.5" stroke={ORANGE} strokeWidth="2"/><circle cx="24" cy="24" r="2.5" stroke={ORANGE} strokeWidth="2"/></svg>, key: 'industries.card.logistics', fallback: 'Logistics' },
            { icon: <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="4" y="6" width="24" height="22" rx="2" stroke={ORANGE} strokeWidth="2"/><path d="M22 4v4M10 4v4M4 14h24" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><path d="M10 20h2v2h-2zM15 20h2v2h-2zM20 20h2v2h-2z" fill={ORANGE}/></svg>, key: 'industries.card.events', fallback: 'Event Management' },
          ].map(({ icon, key, fallback }) => (
            <div key={key} style={{ background: '#FFFFFF', borderRadius: 16, padding: '32px 20px', border: '1px solid #F0E8D8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: '#FEF3C7', display: 'grid', placeItems: 'center' }}>{icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, fontFamily: 'var(--font-heading)', textAlign: 'center' }}>
                {renderEditableText({ blockKey: key, fallback, variant: 'cardTitle' })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32 }}>
          {renderEditableBtn({ labelKey: 'industries.button.label', urlKey: 'industries.button.url', fallbackLabel: 'Explore All Industries', fallbackUrl: '/industries', editing: editingIndustriesBtn, setEditing: setEditingIndustriesBtn, btnStyle: { background: '#FFFFFF', color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' } })}
        </div>
      </section>)}

      {renderSectionWrap('section.cta.visible', 'CTA Banner', renderCtaBtnSection(ORANGE, 'cta.headline', 'cta.subheadline'))}

    </div>
  )

  if (!authChecked) return null

  const dirtyBlocks = selectedPage?.blocks.filter(block => (drafts[block.id] ?? '') !== block.value) ?? []
  return (
    <main style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, rgba(249,115,22,0.10), transparent 34%), ${BG}`, color: TEXT, fontFamily: 'var(--font-body)' }}>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          const target = imageTargetBlock.current
          if (file && target) uploadImage(target, file)
          e.target.value = ''
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          const target = videoTargetBlock.current
          if (file && target) uploadMedia(target, file)
          e.target.value = ''
        }}
      />
      <AdminSidebar
        pages={pages}
        selectedSlug={selectedSlug}
        onSelectSlug={setSelectedSlug}
        loadingPages={loadingPages}
      />

      <section style={{ marginLeft: 64, padding: '28px 32px 44px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 18 }}>
          <div>
            <p style={{ margin: '0 0 8px', color: ORANGE, fontSize: 12, letterSpacing: 1.4, fontWeight: 800, textTransform: 'uppercase' }}>
              Marketing Admin
            </p>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 34, lineHeight: 1.1, fontWeight: 800, color: TEXT }}>
              Marketing Live Editor
            </h1>
            <p style={{ margin: '10px 0 0', color: MUTED, fontSize: 14, fontWeight: 600 }}>
              Click any text in the preview to edit it in-place. This admin only manages marketing content.
            </p>
          </div>
          {adminUserId && <OwnerUserBadge userId={adminUserId} companyId="" />}
        </header>

        {error ? (
          <div style={{ marginBottom: 14, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', fontSize: 13, fontWeight: 700 }}>
            {error}
          </div>
        ) : null}

        {notice ? (
          <div style={{ marginBottom: 14, background: '#ECFDF5', border: '1px solid #BBF7D0', color: '#047857', borderRadius: 10, padding: '12px 14px', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={15} /> {notice}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <section style={{ background: 'rgba(255,255,255,0.92)', border: `1px solid ${BORDER}`, borderRadius: 20, minHeight: 720, overflow: 'hidden', boxShadow: '0 22px 52px rgba(15,23,42,0.09)' }}>
            <div style={{ padding: '15px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: '#FFFFFF' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: TEXT }}>
                  {selectedSummary?.title ?? 'Select a page'}
                </h2>
                <p style={{ margin: '5px 0 0', color: MUTED, fontSize: 12, fontWeight: 700 }}>
                  {selectedSummary?.route_path ?? 'Choose a page above'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: dirtyBlocks.length > 0 ? '#C2410C' : '#047857', background: dirtyBlocks.length > 0 ? SOFT_ORANGE : '#ECFDF5', border: `1px solid ${dirtyBlocks.length > 0 ? '#FED7AA' : '#BBF7D0'}`, borderRadius: 999, padding: '8px 11px', fontSize: 12, fontWeight: 900 }}>
                  <Check size={13} /> {dirtyBlocks.length > 0 ? `${dirtyBlocks.length} unsaved` : 'All saved'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: ORANGE, background: SOFT_ORANGE, border: '1px solid #FED7AA', borderRadius: 999, padding: '8px 11px', fontSize: 12, fontWeight: 900 }}>
                  <MousePointer2 size={13} /> Click text to edit
                </span>
                {selectedSummary ? (
                  <a
                    href={selectedSummary.route_path}
                    target="_blank"
                    rel="noreferrer"
                    className="card-lift"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '9px 11px', color: TEXT, fontSize: 12, fontWeight: 800, background: '#FFFFFF' }}
                  >
                    <ExternalLink size={14} /> View
                  </a>
                ) : null}
              </div>
            </div>

            <div style={{ padding: 18, background: 'linear-gradient(180deg, #F8FAFC, #EEF4FB)', minHeight: 650 }}>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 18, overflow: 'hidden', background: '#FFFFFF', boxShadow: '0 18px 42px rgba(15,23,42,0.08)' }}>
                <div style={{ height: 42, background: '#F8FAFC', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: '#F87171' }} />
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: '#FBBF24' }} />
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: '#34D399' }} />
                  </div>
                  <div style={{ minWidth: 260, maxWidth: 420, height: 26, borderRadius: 999, background: '#FFFFFF', border: `1px solid ${BORDER}`, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                    tasking.local{selectedSummary?.route_path ?? '/'}
                  </div>
                  <div style={{ width: 36 }} />
                </div>
                <div style={{ padding: 14, background: '#FFFFFF' }}>
              {loadingPage ? (
                <div style={{ display: 'grid', placeItems: 'center', minHeight: 520, color: MUTED, fontSize: 13, fontWeight: 700 }}>
                  Loading live preview...
                </div>
              ) : selectedPage ? (
                <>{selectedPage.slug === 'home' ? renderHomePreview() : selectedPage.slug === 'about' ? renderAboutPreview() : renderGenericPreview()}</>

              ) : (
                <div style={{ display: 'grid', placeItems: 'center', minHeight: 520, background: '#FFFFFF', borderRadius: 14, color: MUTED, fontSize: 13, fontWeight: 700 }}>
                  Run the Supabase SQL first, then this live preview will show editable content.
                </div>
              )}
                </div>
              </div>
            </div>
          </section>

        </div>
      </section>
    </main>
  )
}
