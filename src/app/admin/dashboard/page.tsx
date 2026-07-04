'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, FileText, ImagePlus, RefreshCcw, Save, Trash2 } from 'lucide-react'
import AdminSidebar from '@/components/AdminSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { createBrowserClient } from '@supabase/ssr'
import { MarketingContentBlock, MarketingPage, MarketingPageSummary } from '@/types/MarketingPage'
import { MarketingIcon, MARKETING_ICON_NAMES } from '@/app/(marketing)/marketingIcons'
import { comparisonTable as pricingComparisonTable } from '@/app/(marketing)/pricing/content'

function ContentEditableSpan({ initialValue, onTextChange, onKeyDown, style, autoFocus }: {
  initialValue: string
  onTextChange: (text: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLSpanElement>) => void
  style: React.CSSProperties
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerText = initialValue
    if (autoFocus) {
      ref.current.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onTextChange((e.target as HTMLElement).textContent ?? '')}
      onKeyDown={onKeyDown}
      style={style}
    />
  )
}

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
  const [selectedSlug, setSelectedSlug] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('admin_selected_slug') ?? '') : ''
  )
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
  const [iconPickerTarget, setIconPickerTarget] = useState<{ cardKey: string; iconBlockKey: string; sortOrder: number; anchorLeft: number; anchorRight: number; anchorBottom: number; anchorTop: number } | null>(null)
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

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/signin')
    })
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) supabase.auth.signOut({ scope: 'local' }).finally(() => router.replace('/signin'))
    })

    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    if (selectedSlug) localStorage.setItem('admin_selected_slug', selectedSlug)
  }, [selectedSlug])

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

  const createBlock = async (page_id: string, block_key: string, label: string, value: string, sort_order: number) => {
    if (!adminUserId) return null
    try {
      const res = await fetch('/api/marketing/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_user_id: adminUserId, page_id, block_key, block_type: 'text', label, value, sort_order }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      const newBlock = data.block as MarketingContentBlock
      setSelectedPage(current => current ? { ...current, blocks: [...current.blocks, newBlock] } : current)
      return newBlock
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create block')
      return null
    }
  }

  const deleteBlock = async (block_id: string) => {
    if (!adminUserId) return
    try {
      const res = await fetch(`/api/marketing/blocks?admin_user_id=${adminUserId}&id=${block_id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setSelectedPage(current => current ? { ...current, blocks: current.blocks.filter(b => b.id !== block_id) } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete block')
    }
  }

  const dragIndexRef = useRef<number | null>(null)

  const reorderBlocks = async (blocks: { id: string; sort_order: number }[], fromIndex: number, toIndex: number, getRelatedIds?: (b: { id: string; sort_order: number }) => string[]) => {
    if (fromIndex === toIndex || !adminUserId) return
    const reordered = [...blocks]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const updates = reordered.map((b, i) => ({ id: b.id, sort_order: i * 10 }))
    setSelectedPage(current => {
      if (!current) return current
      const updateMap: Record<string, number> = {}
      updates.forEach(u => { updateMap[u.id] = u.sort_order })
      return { ...current, blocks: current.blocks.map(b => updateMap[b.id] !== undefined ? { ...b, sort_order: updateMap[b.id] } : b) }
    })
    await fetch('/api/admin/marketing-pages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_user_id: adminUserId, updates }),
    })
  }

  const setIconBlock = async (iconBlockKey: string, iconName: string, sortOrder: number) => {
    if (!selectedPage || !adminUserId) return
    const existing = blockByKey[iconBlockKey]
    if (existing) {
      await fetch('/api/admin/marketing-pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_user_id: adminUserId, block_id: existing.id, value: iconName }),
      })
      setSelectedPage(current => current ? { ...current, blocks: current.blocks.map(b => b.id === existing.id ? { ...b, value: iconName } : b) } : current)
      setDrafts(d => ({ ...d, [existing.id]: iconName }))
    } else {
      const newBlock = await createBlock(selectedPage.id, iconBlockKey, 'Icon', iconName, sortOrder)
      if (newBlock) setDrafts(d => ({ ...d, [newBlock.id]: iconName }))
    }
    setIconPickerTarget(null)
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
    placeholder,
    variant,
    multiline = false,
    styleOverride,
    onDarkBg = false,
    hideDirtyBadge = false,
  }: {
    blockKey: string
    fallback: string
    placeholder?: string
    variant: 'badge' | 'hero' | 'heroAccent' | 'subhead' | 'sectionTitle' | 'body' | 'cardTitle' | 'cardBody' | 'cta' | 'eyebrow'
    multiline?: boolean
    styleOverride?: React.CSSProperties
    onDarkBg?: boolean
    hideDirtyBadge?: boolean
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
      variant === 'subhead' ? { color: 'rgba(255,255,255,0.65)', fontSize: 17, lineHeight: 1.75, textAlign: 'center' as const } :
      variant === 'sectionTitle' ? { color: '#1C1917', fontSize: 32, fontWeight: 700, lineHeight: 1.2, fontFamily: 'var(--font-heading)' } :
      variant === 'cardTitle' ? { color: '#1C1917', fontSize: 17, fontWeight: 800, lineHeight: 1.35, fontFamily: 'var(--font-heading)' } :
      variant === 'cardBody' ? { color: '#78716C', fontSize: 14, lineHeight: 1.65 } :
      variant === 'eyebrow' ? { fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.1em' } :
      variant === 'cta' ? { color: '#FFFFFF', fontSize: 36, fontWeight: 700, lineHeight: 1.18, fontFamily: 'var(--font-heading)' } :
      { color: '#78716C', fontSize: 15, lineHeight: 1.7 }

    const mergedTextStyle = { ...textStyle, ...styleOverride }

    if (!canEdit) {
      return <span style={{ ...baseStyle, ...mergedTextStyle }}>{value}</span>
    }

    if (editing) {
      return (
        <span style={{ position: 'relative', display: baseStyle.display }}>
          <ContentEditableSpan
            initialValue={value}
            autoFocus
            onTextChange={(text) => setDrafts(curr => ({ ...curr, [block.id]: text }))}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); resetDraft(block) }
              if (!multiline && e.key === 'Enter') { e.preventDefault(); if (dirty) saveBlock(block) }
            }}
            style={{
              ...baseStyle,
              ...mergedTextStyle,
              ...(onDarkBg ? { color: '#FFFFFF' } : {}),
              display: 'block',
              outline: `2px solid ${onDarkBg ? 'rgba(255,255,255,0.6)' : '#FDBA74'}`,
              outlineOffset: 4,
              cursor: 'text',
              whiteSpace: 'pre-wrap',
              minWidth: 40,
              backgroundColor: onDarkBg ? 'rgba(0,0,0,0.25)' : 'transparent',
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
          event.currentTarget.style.outlineColor = onDarkBg ? 'rgba(255,255,255,0.5)' : '#FDBA74'
          event.currentTarget.style.backgroundColor = onDarkBg ? 'rgba(255,255,255,0.1)' : (variant === 'hero' || variant === 'heroAccent' || variant === 'subhead' || variant === 'cta' ? 'rgba(249,115,22,0.08)' : '#FFF7ED')
          event.currentTarget.style.boxShadow = onDarkBg ? '0 4px 16px rgba(0,0,0,0.15)' : '0 10px 24px rgba(249,115,22,0.14)'
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.outlineColor = 'transparent'
          event.currentTarget.style.backgroundColor = variant === 'badge' ? 'rgba(249,115,22,0.18)' : 'transparent'
          event.currentTarget.style.boxShadow = 'none'
        }}
        style={{ ...baseStyle, ...mergedTextStyle }}
      >
        {value
          ? value
          : <span style={{ color: onDarkBg ? 'rgba(255,255,255,0.35)' : '#CBD5E1', fontStyle: 'italic', fontWeight: 400 }}>{placeholder ?? fallback}</span>}
        {!hideDirtyBadge && <span style={{ position: 'absolute', right: -8, top: -14, transform: 'translateX(100%)', background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, opacity: dirty ? 1 : 0 }}>Unsaved</span>}
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
        {block && (
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
        )}
        {children}
      </div>
    )
  }

  const openIconPicker = (e: React.MouseEvent, cardKey: string, iconBlockKey: string, sortOrder: number) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setIconPickerTarget({ cardKey, iconBlockKey, sortOrder, anchorLeft: rect.left, anchorRight: rect.right, anchorBottom: rect.bottom, anchorTop: rect.top })
  }

  const renderIconBox = (cardKey: string, iconBlockKey: string, currentIconName: string | null, sortOrder: number, size = 20) => (
    <div
      onClick={(e) => openIconPicker(e, cardKey, iconBlockKey, sortOrder)}
      title="Click to change icon"
      style={{ cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {currentIconName
        ? <MarketingIcon name={currentIconName} size={size} />
        : <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={ORANGE} strokeWidth="1.5"/><path d="M12 8v4M12 16h.01" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round"/></svg>
      }
      <div style={{ position: 'absolute', bottom: -4, right: -4, background: ORANGE, borderRadius: '50%', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </div>
    </div>
  )

  const renderIconPickerOverlay = () => {
    if (!iconPickerTarget) return null
    const { iconBlockKey, sortOrder } = iconPickerTarget
    const currentIconName = blockByKey[iconBlockKey]?.value ?? null
    return createPortal(
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,0.25)' }} onClick={() => setIconPickerTarget(null)} />
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 999, background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 14px 8px', boxShadow: '0 16px 48px rgba(0,0,0,0.22)', width: 220, boxSizing: 'border-box' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: MUTED, marginBottom: 8, textAlign: 'center', letterSpacing: '0.08em' }}>CHOOSE ICON</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }}>
            {MARKETING_ICON_NAMES.map(name => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={(e) => { e.stopPropagation(); setIconBlock(iconBlockKey, name, sortOrder) }}
                style={{ background: currentIconName === name ? '#FEF3C7' : 'transparent', border: `1.5px solid ${currentIconName === name ? ORANGE : 'transparent'}`, borderRadius: 6, padding: '5px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (currentIconName !== name) (e.currentTarget as HTMLElement).style.background = '#FFF7ED' }}
                onMouseLeave={e => { if (currentIconName !== name) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <MarketingIcon name={name} size={16} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setIconPickerTarget(null)} style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', fontSize: 12, color: MUTED, cursor: 'pointer', padding: '4px 0' }}>Cancel</button>
        </div>
      </>,
      document.body
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
                <input
                  list={`url-options-${urlBlock.id}`}
                  value={drafts[urlBlock.id] ?? urlBlock.value}
                  onChange={e => setDrafts(p => ({ ...p, [urlBlock.id]: e.target.value }))}
                  placeholder={fallbackUrl}
                  style={{ width: '100%', padding: '7px 10px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 12, fontFamily: 'monospace', outline: 'none', color: TEXT }}
                />
                <datalist id={`url-options-${urlBlock.id}`}>
                  <option value="/get-started">Get Started</option>
                  <option value="/signin">Sign In</option>
                  <option value="/signup">Sign Up</option>
                  <option value="#modules">Modules section (anchor)</option>
                  {pages.map(p => (
                    <option key={p.slug} value={p.route_path}>{p.title}</option>
                  ))}
                </datalist>
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
        {renderEditableText({ blockKey: headlineKey, fallback: 'Ready to simplify your workforce?', variant: 'cta', onDarkBg: true })}
        <div style={{ height: 16 }} />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {renderEditableText({ blockKey: subheadlineKey, fallback: 'Join SMEs already using Tasking to hire smarter, schedule faster, and track with confidence.', variant: 'subhead', multiline: true, onDarkBg: true })}
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

  const renderAiFeaturesPreview = () => {
    const featureIcons = [
      <svg key="star" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke={ORANGE} strokeWidth="2" strokeLinejoin="round" /></svg>,
      <svg key="pen" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="check" width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={ORANGE} strokeWidth="2" /><path d="M8 12l3 3 5-5" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="shield" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    ]
    const aiFeaturesBlocks = (selectedPage?.blocks ?? [])
      .filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
      .sort((a, b) => a.sort_order - b.sort_order)
    const steps = [
      { step: '01', labelKey: 'workflow.step1.label', defaultLabel: 'Recruit', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Post a job',             defaultDesc: 'AI generates the description and ranks applicants automatically — so you open the list already knowing who to pick.' },
      { step: '02', labelKey: 'workflow.step2.label', defaultLabel: 'Verify',  titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Casual worker clocks in', defaultDesc: 'AI verifies the photo against the record and flags anything that looks off — before it becomes your problem.' },
      { step: '03', labelKey: 'workflow.step3.label', defaultLabel: 'Approve', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Shift ends',              defaultDesc: 'AI reviews the timesheet and approves or escalates instantly — so clean records never sit waiting for manual review.' },
    ]
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>

        {/* Hero */}
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>
              {renderEditableText({ blockKey: 'hero.badge', fallback: 'AI Features', variant: 'badge' })}
            </div>
            <div style={{ maxWidth: 640, margin: '0 auto 18px' }}>
              {renderEditableText({ blockKey: 'hero.headline', fallback: 'Enterprise-grade AI. Free for everyone.', variant: 'hero' })}
            </div>
            <div style={{ maxWidth: 520, margin: '0 auto 32px' }}>
              {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Four intelligent tools built into your workflow from day one — no upgrades, no paywalls, no excuses.', variant: 'subhead', multiline: true })}
            </div>
            {renderEditableBtn({ labelKey: 'hero.button.label', urlKey: 'hero.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
          </section>
        )}

        {/* Features grid */}
        {renderSectionWrap('section.intro.visible', 'Features Grid',
          <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ marginBottom: 10 }}>
                {renderEditableText({ blockKey: 'features.title', fallback: "What's inside", variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'features.subtitle', fallback: 'Four AI tools. All free. All built in.', variant: 'body', styleOverride: { textAlign: 'center' as const } })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 18 }}>
              {aiFeaturesBlocks.map((nameBlock, i) => {
                const idx = nameBlock.block_key.replace('feature.', '').replace('.name', '')
                const descKey = `feature.${idx}.desc`

                const descBlock = blockByKey[descKey]
                const cardDirty = (drafts[nameBlock.id] ?? '') !== nameBlock.value || (descBlock ? (drafts[descBlock.id] ?? '') !== descBlock.value : false)
                return (
                  <div key={nameBlock.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(aiFeaturesBlocks, dragIndexRef.current ?? i, i)} style={{ position: 'relative', background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 16, padding: 24 }}>
                    <span style={{ position: 'absolute', top: 10, left: 10, cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1 }} title="Drag to reorder">⠿</span>
                    {cardDirty && <span style={{ position: 'absolute', top: 36, right: 8, background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, zIndex: 2 }}>Unsaved</span>}
                    <button
                      type="button"
                      onClick={() => deleteBlock(nameBlock.id).then(() => { if (descBlock) deleteBlock(descBlock.id) })}
                      title="Remove feature card"
                      style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, lineHeight: 1 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                    <div style={{ width: 44, height: 44, background: '#FEF3C7', borderRadius: 11, display: 'grid', placeItems: 'center', marginBottom: 14, position: 'relative' }}>
                      {renderIconBox(nameBlock.block_key, `feature.${nameBlock.block_key.replace('feature.','').replace('.name','')}.icon`, blockByKey[`feature.${nameBlock.block_key.replace('feature.','').replace('.name','')}.icon`]?.value ?? null, nameBlock.sort_order - 1)}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      {renderEditableText({ blockKey: nameBlock.block_key, fallback: 'Feature name', variant: 'cardTitle', styleOverride: { fontSize: 15, fontWeight: 600, color: '#1C1917' }, hideDirtyBadge: true })}
                    </div>
                    {renderEditableText({ blockKey: descKey, fallback: 'Feature description', variant: 'cardBody', multiline: true, styleOverride: { fontSize: 14, lineHeight: 1.7 }, hideDirtyBadge: true })}
                  </div>
                )
              })}
              {/* Add feature card */}
              <button
                type="button"
                onClick={async () => {
                  if (!selectedPage) return
                  const existing = (selectedPage.blocks ?? []).filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
                  const maxIdx = existing.reduce((m, b) => { const n = parseInt(b.block_key.split('.')[1]); return n > m ? n : m }, 0)
                  const nextIdx = maxIdx + 1
                  const maxSort = existing.reduce((m, b) => b.sort_order > m ? b.sort_order : m, 0)
                  await createBlock(selectedPage.id, `feature.${nextIdx}.name`, `Feature ${nextIdx} Name`, '', maxSort + 1)
                  await createBlock(selectedPage.id, `feature.${nextIdx}.desc`, `Feature ${nextIdx} Description`, '', maxSort + 2)
                }}
                style={{ background: 'none', border: '2px dashed #F0E8D8', borderRadius: 16, padding: 24, cursor: 'pointer', color: '#A8A29E', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 120 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add feature card
              </button>
            </div>
          </section>
        )}

        {/* Workflow steps */}
        {renderSectionWrap('section.content.visible', 'Workflow Steps',
          <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ marginBottom: 12 }}>
                {renderEditableText({ blockKey: 'workflow.title', fallback: 'AI that works with you, not around you.', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'workflow.subtitle', fallback: "These aren't standalone tools. They're built into the exact moments in your workflow where they matter most.", variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const } })}
            </div>
            {/* Step circles row with connecting line */}
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 20 }}>
              {/* connecting line */}
              <div style={{ position: 'absolute', top: 36, left: '16.66%', right: '16.66%', height: 2, background: 'linear-gradient(90deg, #F97316, #FED7AA 50%, #F97316)', zIndex: 0 }} />
              {steps.map(s => (
                <div key={s.step} style={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF3C7', border: '3px solid #F97316', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: ORANGE, letterSpacing: '0.1em', lineHeight: 1 }}>STEP</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: ORANGE, lineHeight: 1.1 }}>{s.step}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Step content row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
              {steps.map(s => (
                <div key={s.step} style={{ textAlign: 'center', padding: '0 16px' }}>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ display: 'inline-block', background: '#FEF3C7', borderRadius: 999, padding: '3px 12px' }}>
                      {renderEditableText({ blockKey: s.labelKey, fallback: s.defaultLabel, variant: 'eyebrow', styleOverride: { fontSize: 12, fontWeight: 600, color: '#92400E', textTransform: 'none' as const, letterSpacing: 0 } })}
                    </span>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    {renderEditableText({ blockKey: s.titleKey, fallback: s.defaultTitle, variant: 'cardTitle', styleOverride: { fontSize: 16, fontWeight: 700, color: '#1C1917' } })}
                  </div>
                  {renderEditableText({ blockKey: s.descKey, fallback: s.defaultDesc, variant: 'cardBody', multiline: true, styleOverride: { fontSize: 14, color: '#78716C', lineHeight: 1.7 } })}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        {renderSectionWrap('section.cta.visible', 'CTA Section',
          <section style={{ background: ORANGE, padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ marginBottom: 14 }}>
                {renderEditableText({ blockKey: 'cta.headline', fallback: 'Ready to put AI to work?', variant: 'cta', styleOverride: { fontSize: 36 }, onDarkBg: true })}
              </div>
              <div style={{ marginBottom: 28 }}>
                {renderEditableText({ blockKey: 'cta.subheadline', fallback: 'All four AI features are free. No upgrade required.', variant: 'subhead', multiline: true, styleOverride: { fontSize: 16 }, onDarkBg: true })}
              </div>
              {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
            </div>
          </section>
        )}

      </div>
    )
  }

  const renderSmartNotificationsPreview = () => {
    const featureIcons = [
      <svg key="timer" width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke={ORANGE} strokeWidth="2" /><path d="M12 9v4l2.5 2.5" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 2h6M12 2v3" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>,
      <svg key="bell"  width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>,
      <svg key="alert" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 9v4M12 17h.01" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="check" width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={ORANGE} strokeWidth="2" /><path d="M8 12l3 3 5-5" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="mega"  width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 11l19-9-9 19-2-8-8-2z" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="zap"   width="20" height="20" viewBox="0 0 24 24" fill="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    ]
    const snFeatureBlocks = (selectedPage?.blocks ?? [])
      .filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
      .sort((a, b) => a.sort_order - b.sort_order)
    const timelineBlocks = (selectedPage?.blocks ?? [])
      .filter(b => b.block_key.startsWith('timeline.') && b.block_key.endsWith('.trigger'))
      .sort((a, b) => a.sort_order - b.sort_order)

    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>

        {/* Hero */}
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>
              {renderEditableText({ blockKey: 'hero.badge', fallback: 'Smart Notifications', variant: 'badge' })}
            </div>
            <div style={{ maxWidth: 640, margin: '0 auto 18px' }}>
              {renderEditableText({ blockKey: 'hero.headline', fallback: 'No more chasing people for updates.', variant: 'hero' })}
            </div>
            <div style={{ maxWidth: 520, margin: '0 auto 32px' }}>
              {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Tasking handles the follow-ups. You handle the business.', variant: 'subhead', multiline: true })}
            </div>
            {renderEditableBtn({ labelKey: 'hero.button.label', urlKey: 'hero.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
          </section>
        )}

        {/* Features grid */}
        {renderSectionWrap('section.intro.visible', 'Features Grid',
          <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ marginBottom: 10 }}>
                {renderEditableText({ blockKey: 'features.title', fallback: 'Every notification your workflow needs', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'features.subtitle', fallback: 'Automatic, targeted, and triggered at exactly the right moment.', variant: 'body', styleOverride: { textAlign: 'center' as const } })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 18 }}>
              {snFeatureBlocks.map((nameBlock, i) => {
                const idx = nameBlock.block_key.replace('feature.', '').replace('.name', '')
                const descKey = `feature.${idx}.desc`
                const descBlock = blockByKey[descKey]
                const cardDirty = (drafts[nameBlock.id] ?? '') !== nameBlock.value || (descBlock ? (drafts[descBlock.id] ?? '') !== descBlock.value : false)
                return (
                  <div key={nameBlock.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(snFeatureBlocks, dragIndexRef.current ?? i, i)} style={{ position: 'relative', background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 16, padding: 24 }}>
                    <span style={{ position: 'absolute', top: 10, left: 10, cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1 }} title="Drag to reorder">⠿</span>
                    {cardDirty && <span style={{ position: 'absolute', top: 36, right: 8, background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, zIndex: 2 }}>Unsaved</span>}
                    <button type="button" onClick={() => deleteBlock(nameBlock.id).then(() => { if (descBlock) deleteBlock(descBlock.id) })} title="Remove feature card" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, lineHeight: 1 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                    <div style={{ width: 44, height: 44, background: '#FEF3C7', borderRadius: 11, display: 'grid', placeItems: 'center', marginBottom: 14, position: 'relative' }}>
                      {renderIconBox(nameBlock.block_key, `feature.${nameBlock.block_key.replace('feature.','').replace('.name','')}.icon`, blockByKey[`feature.${nameBlock.block_key.replace('feature.','').replace('.name','')}.icon`]?.value ?? null, nameBlock.sort_order - 1)}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      {renderEditableText({ blockKey: nameBlock.block_key, fallback: 'Feature name', variant: 'cardTitle', styleOverride: { fontSize: 15, fontWeight: 600, color: '#1C1917' }, hideDirtyBadge: true })}
                    </div>
                    {renderEditableText({ blockKey: descKey, fallback: 'Feature description', variant: 'cardBody', multiline: true, styleOverride: { fontSize: 14, lineHeight: 1.7 }, hideDirtyBadge: true })}
                  </div>
                )
              })}
              <button type="button" onClick={async () => {
                if (!selectedPage) return
                const existing = (selectedPage.blocks ?? []).filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
                const maxIdx = existing.reduce((m, b) => { const n = parseInt(b.block_key.split('.')[1]); return n > m ? n : m }, 0)
                const maxSort = existing.reduce((m, b) => b.sort_order > m ? b.sort_order : m, 0)
                const nextIdx = maxIdx + 1
                await createBlock(selectedPage.id, `feature.${nextIdx}.name`, `Feature ${nextIdx} Name`, '', maxSort + 1)
                await createBlock(selectedPage.id, `feature.${nextIdx}.desc`, `Feature ${nextIdx} Description`, '', maxSort + 2)
              }} style={{ background: 'none', border: '2px dashed #F0E8D8', borderRadius: 16, padding: 24, cursor: 'pointer', color: '#A8A29E', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 120 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add feature card
              </button>
            </div>
          </section>
        )}

        {/* Timeline */}
        {renderSectionWrap('section.content.visible', 'Timeline',
          <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <div style={{ marginBottom: 12 }}>
                {renderEditableText({ blockKey: 'timeline.title', fallback: 'The right message. At the right moment. Every time.', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'timeline.subtitle', fallback: 'Every notification in Tasking is triggered automatically — no manual sending, no missed updates.', variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const } })}
            </div>
            <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 23, top: 24, bottom: 24, width: 2, background: '#F0E8D8' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {timelineBlocks.map((triggerBlock, i) => {
                  const idx = triggerBlock.block_key.replace('timeline.', '').replace('.trigger', '')
                  const eventKey = `timeline.${idx}.event`
                  const eventBlock = blockByKey[eventKey]
                  return (
                    <div key={triggerBlock.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(timelineBlocks, dragIndexRef.current ?? i, i)} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', paddingBottom: i < timelineBlocks.length - 1 ? 28 : 0, position: 'relative' }}>
                      <span style={{ position: 'absolute', top: 0, left: -18, cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1 }} title="Drag to reorder">⠿</span>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEF3C7', border: '3px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>
                      </div>
                      <div style={{ paddingTop: 8, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          {renderEditableText({ blockKey: triggerBlock.block_key, fallback: 'Trigger', variant: 'cardTitle', styleOverride: { fontSize: 15, fontWeight: 600, color: '#1C1917' } })}
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M3 8h10M9 4l4 4-4 4" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                        {renderEditableText({ blockKey: eventKey, fallback: 'Event description', variant: 'cardBody', multiline: true, styleOverride: { fontSize: 14, color: '#78716C', lineHeight: 1.65 } })}
                      </div>
                      <button
                        type="button"
                        onClick={() => { deleteBlock(triggerBlock.id); if (eventBlock) deleteBlock(eventBlock.id) }}
                        title="Remove item"
                        style={{ position: 'absolute', top: 6, right: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 3, lineHeight: 1, fontSize: 15, fontWeight: 700, flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}
                      >×</button>
                    </div>
                  )
                })}
                {selectedPage && (() => {
                  const maxIdx = timelineBlocks.reduce((m, b) => { const n = parseInt(b.block_key.split('.')[1]); return n > m ? n : m }, 0)
                  const maxSort = timelineBlocks.length > 0 ? Math.max(...timelineBlocks.map(b => b.sort_order)) : 0
                  return (
                    <button type="button"
                      onClick={async () => {
                        const next = maxIdx + 1
                        await createBlock(selectedPage.id, `timeline.${next}.trigger`, `Timeline ${next} Trigger`, 'New trigger', maxSort + 1)
                        await createBlock(selectedPage.id, `timeline.${next}.event`, `Timeline ${next} Event`, 'Event description', maxSort + 2)
                      }}
                      style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: '2px dashed #F0E8D8', borderRadius: 12, padding: '12px 20px', cursor: 'pointer', color: '#A8A29E', fontSize: 13, fontWeight: 600 }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add timeline item
                    </button>
                  )
                })()}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        {renderSectionWrap('section.cta.visible', 'CTA Section',
          <section style={{ background: ORANGE, padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ marginBottom: 14 }}>
                {renderEditableText({ blockKey: 'cta.headline', fallback: 'Stay in the loop. Automatically.', variant: 'cta', styleOverride: { fontSize: 36 }, onDarkBg: true })}
              </div>
              <div style={{ marginBottom: 28 }}>
                {renderEditableText({ blockKey: 'cta.subheadline', fallback: 'Every key moment in your workflow, covered — without you lifting a finger.', variant: 'subhead', multiline: true, styleOverride: { fontSize: 16 }, onDarkBg: true })}
              </div>
              {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
            </div>
          </section>
        )}

      </div>
    )
  }

  const renderRecruitmentPreview = () => {
    const featureIcons = [
      <svg key="post"     width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v6h6M12 18v-6M9 15h6" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="users"    width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" stroke={ORANGE} strokeWidth="2" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>,
      <svg key="clock"    width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={ORANGE} strokeWidth="2" /><path d="M12 6v6l4 2" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="list"     width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="cal"      width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={ORANGE} strokeWidth="2" /><path d="M16 2v4M8 2v4M3 10h18" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>,
      <svg key="search"   width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={ORANGE} strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>,
      <svg key="undo"     width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 7v6h6" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="globe"    width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={ORANGE} strokeWidth="2" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={ORANGE} strokeWidth="2" /></svg>,
    ]
    const recruitFeatureBlocks = (selectedPage?.blocks ?? [])
      .filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
      .sort((a, b) => a.sort_order - b.sort_order)
    const steps = [
      { step: '01', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Post',    defaultDesc: 'Publish your job opening to the public recruitment page. Casual workers and applicants can browse and apply instantly.' },
      { step: '02', titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Review',  defaultDesc: 'See every applicant ranked by AI recommendation. Skills, availability, and work history — all surfaced automatically.' },
      { step: '03', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Invite',  defaultDesc: 'Select your candidate and send the invitation. The 12-hour acceptance window starts automatically.' },
      { step: '04', titleKey: 'workflow.step4.title', descKey: 'workflow.step4.desc', defaultTitle: 'Confirm', defaultDesc: 'Candidate accepts, job closes, worker is assigned to the shift. Done.' },
    ]
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>

        {/* Hero */}
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>
              {renderEditableText({ blockKey: 'hero.badge', fallback: 'Recruitment', variant: 'badge' })}
            </div>
            <div style={{ maxWidth: 640, margin: '0 auto 18px' }}>
              {renderEditableText({ blockKey: 'hero.headline', fallback: 'Find the right people. Fast.', variant: 'hero' })}
            </div>
            <div style={{ maxWidth: 520, margin: '0 auto 32px' }}>
              {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'From job posting to confirmed hire — without the back-and-forth.', variant: 'subhead', multiline: true })}
            </div>
            {renderEditableBtn({ labelKey: 'hero.button.label', urlKey: 'hero.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
          </section>
        )}

        {/* Features grid */}
        {renderSectionWrap('section.intro.visible', 'Features Grid',
          <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ marginBottom: 10 }}>
                {renderEditableText({ blockKey: 'features.title', fallback: 'Everything you need to hire casual workers', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'features.subtitle', fallback: 'Every feature in this module exists because SMEs asked for it.', variant: 'body', styleOverride: { textAlign: 'center' as const } })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 18 }}>
              {recruitFeatureBlocks.map((nameBlock, i) => {
                const idx = nameBlock.block_key.replace('feature.', '').replace('.name', '')
                const descKey = `feature.${idx}.desc`
                const descBlock = blockByKey[descKey]
                const cardDirty = (drafts[nameBlock.id] ?? '') !== nameBlock.value || (descBlock ? (drafts[descBlock.id] ?? '') !== descBlock.value : false)
                return (
                  <div key={nameBlock.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(recruitFeatureBlocks, dragIndexRef.current ?? i, i)} style={{ position: 'relative', background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 16, padding: 24 }}>
                    <span style={{ position: 'absolute', top: 10, left: 10, cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1 }} title="Drag to reorder">⠿</span>
                    {cardDirty && <span style={{ position: 'absolute', top: 36, right: 8, background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, zIndex: 2 }}>Unsaved</span>}
                    <button
                      type="button"
                      onClick={() => deleteBlock(nameBlock.id).then(() => { if (descBlock) deleteBlock(descBlock.id) })}
                      title="Remove feature card"
                      style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, lineHeight: 1 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                    <div style={{ width: 44, height: 44, background: '#FEF3C7', borderRadius: 11, display: 'grid', placeItems: 'center', marginBottom: 14, position: 'relative' }}>
                      {renderIconBox(nameBlock.block_key, `feature.${nameBlock.block_key.replace('feature.','').replace('.name','')}.icon`, blockByKey[`feature.${nameBlock.block_key.replace('feature.','').replace('.name','')}.icon`]?.value ?? null, nameBlock.sort_order - 1)}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      {renderEditableText({ blockKey: nameBlock.block_key, fallback: 'Feature name', variant: 'cardTitle', styleOverride: { fontSize: 15, fontWeight: 600, color: '#1C1917' }, hideDirtyBadge: true })}
                    </div>
                    {renderEditableText({ blockKey: descKey, fallback: 'Feature description', variant: 'cardBody', multiline: true, styleOverride: { fontSize: 14, lineHeight: 1.7 }, hideDirtyBadge: true })}
                  </div>
                )
              })}
              <button
                type="button"
                onClick={async () => {
                  if (!selectedPage) return
                  const existing = (selectedPage.blocks ?? []).filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
                  const maxIdx = existing.reduce((m, b) => { const n = parseInt(b.block_key.split('.')[1]); return n > m ? n : m }, 0)
                  const maxSort = existing.reduce((m, b) => b.sort_order > m ? b.sort_order : m, 0)
                  const nextIdx = maxIdx + 1
                  await createBlock(selectedPage.id, `feature.${nextIdx}.name`, `Feature ${nextIdx} Name`, '', maxSort + 1)
                  await createBlock(selectedPage.id, `feature.${nextIdx}.desc`, `Feature ${nextIdx} Description`, '', maxSort + 2)
                }}
                style={{ background: 'none', border: '2px dashed #F0E8D8', borderRadius: 16, padding: 24, cursor: 'pointer', color: '#A8A29E', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 120 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add feature card
              </button>
            </div>
          </section>
        )}

        {/* Workflow steps */}
        {renderSectionWrap('section.content.visible', 'Workflow Steps',
          <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ marginBottom: 12 }}>
                {renderEditableText({ blockKey: 'workflow.title', fallback: 'From open role to confirmed hire in four steps.', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'workflow.subtitle', fallback: 'A complete hiring flow — built specifically for casual workforce management.', variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const } })}
            </div>
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', marginBottom: 20 }}>
              <div style={{ position: 'absolute', top: 36, left: '12.5%', right: '12.5%', height: 2, background: 'linear-gradient(90deg, #F97316, #FED7AA 33%, #FED7AA 66%, #F97316)', zIndex: 0 }} />
              {steps.map(s => (
                <div key={s.step} style={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF3C7', border: '3px solid #F97316', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: ORANGE, letterSpacing: '0.1em', lineHeight: 1 }}>STEP</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: ORANGE, lineHeight: 1.1 }}>{s.step}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
              {steps.map(s => (
                <div key={s.step} style={{ textAlign: 'center', padding: '0 12px' }}>
                  <div style={{ marginBottom: 8 }}>
                    {renderEditableText({ blockKey: s.titleKey, fallback: s.defaultTitle, variant: 'cardTitle', styleOverride: { fontSize: 15, fontWeight: 700, color: '#1C1917' } })}
                  </div>
                  {renderEditableText({ blockKey: s.descKey, fallback: s.defaultDesc, variant: 'cardBody', multiline: true, styleOverride: { fontSize: 13, color: '#78716C', lineHeight: 1.65 } })}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        {renderSectionWrap('section.cta.visible', 'CTA Section',
          <section style={{ background: ORANGE, padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ marginBottom: 14 }}>
                {renderEditableText({ blockKey: 'cta.headline', fallback: 'Your next hire is one post away.', variant: 'cta', styleOverride: { fontSize: 36 }, onDarkBg: true })}
              </div>
              <div style={{ marginBottom: 28 }}>
                {renderEditableText({ blockKey: 'cta.subheadline', fallback: 'Join SMEs already using Tasking to fill shifts faster and smarter.', variant: 'subhead', multiline: true, styleOverride: { fontSize: 16 }, onDarkBg: true })}
              </div>
              {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
            </div>
          </section>
        )}

      </div>
    )
  }

  const renderAttendancePreview = () => {
    const featureIcons = [
      <svg key="clock"   width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={ORANGE} strokeWidth="2" /><path d="M12 6v6l4 2" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="camera"  width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="13" r="4" stroke={ORANGE} strokeWidth="2" /></svg>,
      <svg key="sign"    width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><polygon points="18 2 22 6 12 16 8 16 8 12 18 2" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="check"   width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M22 4L12 14.01l-3-3" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="lock"    width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke={ORANGE} strokeWidth="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>,
      <svg key="star"    width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke={ORANGE} strokeWidth="2" strokeLinejoin="round" /></svg>,
      <svg key="shield"  width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    ]
    const attendanceFeatureBlocks = (selectedPage?.blocks ?? [])
      .filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
      .sort((a, b) => a.sort_order - b.sort_order)
    const steps = [
      { step: '01', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Clock In',         defaultDesc: 'Casual worker clocks in and submits a live photo. Time and photo are recorded instantly.' },
      { step: '02', titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Confirm',          defaultDesc: 'The assigned employee confirms the casual worker was present and carried out their duties.' },
      { step: '03', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Submit',           defaultDesc: 'Employee signs and submits the attendance record to the manager for review.' },
      { step: '04', titleKey: 'workflow.step4.title', descKey: 'workflow.step4.desc', defaultTitle: 'Review & Approve', defaultDesc: 'Manager reviews the record — or lets AI approve it automatically if everything checks out.' },
    ]
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>

        {/* Hero */}
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>
              {renderEditableText({ blockKey: 'hero.badge', fallback: 'Attendance', variant: 'badge' })}
            </div>
            <div style={{ maxWidth: 640, margin: '0 auto 18px' }}>
              {renderEditableText({ blockKey: 'hero.headline', fallback: 'Every clock-in. Verified. Every record. Protected.', variant: 'hero' })}
            </div>
            <div style={{ maxWidth: 520, margin: '0 auto 32px' }}>
              {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Accurate attendance tracking with AI built in — so nothing slips through the cracks.', variant: 'subhead', multiline: true })}
            </div>
            {renderEditableBtn({ labelKey: 'hero.button.label', urlKey: 'hero.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
          </section>
        )}

        {/* Features grid */}
        {renderSectionWrap('section.intro.visible', 'Features Grid',
          <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ marginBottom: 10 }}>
                {renderEditableText({ blockKey: 'features.title', fallback: 'Everything you need to track attendance with confidence', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'features.subtitle', fallback: 'From the moment they clock in to the moment the record is approved.', variant: 'body', styleOverride: { textAlign: 'center' as const } })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 18 }}>
              {attendanceFeatureBlocks.map((nameBlock, i) => {
                const idx = nameBlock.block_key.replace('feature.', '').replace('.name', '')
                const descKey = `feature.${idx}.desc`

                const descBlock = blockByKey[descKey]
                const cardDirty = (drafts[nameBlock.id] ?? '') !== nameBlock.value || (descBlock ? (drafts[descBlock.id] ?? '') !== descBlock.value : false)
                return (
                  <div key={nameBlock.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(attendanceFeatureBlocks, dragIndexRef.current ?? i, i)} style={{ position: 'relative', background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 16, padding: 24 }}>
                    <span style={{ position: 'absolute', top: 10, left: 10, cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1 }} title="Drag to reorder">⠿</span>
                    {cardDirty && <span style={{ position: 'absolute', top: 36, right: 8, background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, zIndex: 2 }}>Unsaved</span>}
                    <button
                      type="button"
                      onClick={() => deleteBlock(nameBlock.id).then(() => { if (descBlock) deleteBlock(descBlock.id) })}
                      title="Remove feature card"
                      style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, lineHeight: 1 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                    <div style={{ width: 44, height: 44, background: '#FEF3C7', borderRadius: 11, display: 'grid', placeItems: 'center', marginBottom: 14, position: 'relative' }}>
                      {renderIconBox(nameBlock.block_key, `feature.${nameBlock.block_key.replace('feature.','').replace('.name','')}.icon`, blockByKey[`feature.${nameBlock.block_key.replace('feature.','').replace('.name','')}.icon`]?.value ?? null, nameBlock.sort_order - 1)}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      {renderEditableText({ blockKey: nameBlock.block_key, fallback: 'Feature name', variant: 'cardTitle', styleOverride: { fontSize: 15, fontWeight: 600, color: '#1C1917' }, hideDirtyBadge: true })}
                    </div>
                    {renderEditableText({ blockKey: descKey, fallback: 'Feature description', variant: 'cardBody', multiline: true, styleOverride: { fontSize: 14, lineHeight: 1.7 }, hideDirtyBadge: true })}
                  </div>
                )
              })}
              {/* Add feature card */}
              <button
                type="button"
                onClick={async () => {
                  if (!selectedPage) return
                  const existing = (selectedPage.blocks ?? []).filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
                  const maxIdx = existing.reduce((m, b) => { const n = parseInt(b.block_key.split('.')[1]); return n > m ? n : m }, 0)
                  const nextIdx = maxIdx + 1
                  const maxSort = existing.reduce((m, b) => b.sort_order > m ? b.sort_order : m, 0)
                  await createBlock(selectedPage.id, `feature.${nextIdx}.name`, `Feature ${nextIdx} Name`, '', maxSort + 1)
                  await createBlock(selectedPage.id, `feature.${nextIdx}.desc`, `Feature ${nextIdx} Description`, '', maxSort + 2)
                }}
                style={{ background: 'none', border: '2px dashed #F0E8D8', borderRadius: 16, padding: 24, cursor: 'pointer', color: '#A8A29E', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 120 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add feature card
              </button>
            </div>
          </section>
        )}

        {/* Workflow steps */}
        {renderSectionWrap('section.content.visible', 'Workflow Steps',
          <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ marginBottom: 12 }}>
                {renderEditableText({ blockKey: 'workflow.title', fallback: 'From clock-in to approved record — fully covered.', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'workflow.subtitle', fallback: 'A complete attendance flow with verification and AI built into every step.', variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const } })}
            </div>
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', marginBottom: 20 }}>
              <div style={{ position: 'absolute', top: 36, left: '12.5%', right: '12.5%', height: 2, background: 'linear-gradient(90deg, #F97316, #FED7AA 33%, #FED7AA 66%, #F97316)', zIndex: 0 }} />
              {steps.map(s => (
                <div key={s.step} style={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF3C7', border: '3px solid #F97316', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: ORANGE, letterSpacing: '0.1em', lineHeight: 1 }}>STEP</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: ORANGE, lineHeight: 1.1 }}>{s.step}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
              {steps.map(s => (
                <div key={s.step} style={{ textAlign: 'center', padding: '0 12px' }}>
                  <div style={{ marginBottom: 8 }}>
                    {renderEditableText({ blockKey: s.titleKey, fallback: s.defaultTitle, variant: 'cardTitle', styleOverride: { fontSize: 15, fontWeight: 700, color: '#1C1917' } })}
                  </div>
                  {renderEditableText({ blockKey: s.descKey, fallback: s.defaultDesc, variant: 'cardBody', multiline: true, styleOverride: { fontSize: 13, color: '#78716C', lineHeight: 1.65 } })}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        {renderSectionWrap('section.cta.visible', 'CTA Section',
          <section style={{ background: ORANGE, padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ marginBottom: 14 }}>
                {renderEditableText({ blockKey: 'cta.headline', fallback: 'No more disputed timesheets.', variant: 'cta', styleOverride: { fontSize: 36 }, onDarkBg: true })}
              </div>
              <div style={{ marginBottom: 28 }}>
                {renderEditableText({ blockKey: 'cta.subheadline', fallback: 'Photo-verified, AI-assisted, and fully auditable — from the first clock-in.', variant: 'subhead', multiline: true, styleOverride: { fontSize: 16 }, onDarkBg: true })}
              </div>
              {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
            </div>
          </section>
        )}

      </div>
    )
  }

  const renderTeamManagementPreview = () => {
    const featureIcons = [
      <svg key="dept"    width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="8" height="5" rx="1" stroke={ORANGE} strokeWidth="2" /><rect x="14" y="3" width="8" height="5" rx="1" stroke={ORANGE} strokeWidth="2" /><rect x="8" y="16" width="8" height="5" rx="1" stroke={ORANGE} strokeWidth="2" /><path d="M6 8v4h12V8M12 12v4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>,
      <svg key="link"    width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="perm"    width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
      <svg key="block"   width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={ORANGE} strokeWidth="2" /><path d="M4.93 4.93l14.14 14.14" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>,
      <svg key="dash"    width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke={ORANGE} strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1" stroke={ORANGE} strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1" stroke={ORANGE} strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1" stroke={ORANGE} strokeWidth="2" /></svg>,
      <svg key="eye"     width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke={ORANGE} strokeWidth="2" /></svg>,
      <svg key="history" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 3v5h5" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 7v5l3 3" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    ]
    const tmFeatureBlocks = (selectedPage?.blocks ?? [])
      .filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
      .sort((a, b) => a.sort_order - b.sort_order)
    const roleBlocks = (selectedPage?.blocks ?? [])
      .filter(b => b.block_key.startsWith('role.') && b.block_key.endsWith('.name'))
      .sort((a, b) => a.sort_order - b.sort_order)
    const roleBadgeColors: Record<string, { badge: string; badgeBg: string }> = {
      Owner:           { badge: '#92400E', badgeBg: '#FEF3C7' },
      Partner:         { badge: '#7C3AED', badgeBg: '#EDE9FE' },
      Manager:         { badge: '#1E3A5F', badgeBg: '#DBEAFE' },
      Employee:        { badge: '#065F46', badgeBg: '#D1FAE5' },
      'Casual Worker': { badge: '#374151', badgeBg: '#F3F4F6' },
      'Guest User':    { badge: '#4B3A2A', badgeBg: '#F0E8D8' },
    }

    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>

        {/* Hero */}
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>
              {renderEditableText({ blockKey: 'hero.badge', fallback: 'Team Management', variant: 'badge' })}
            </div>
            <div style={{ maxWidth: 640, margin: '0 auto 18px' }}>
              {renderEditableText({ blockKey: 'hero.headline', fallback: 'Your company structure, exactly how you need it.', variant: 'hero' })}
            </div>
            <div style={{ maxWidth: 500, margin: '0 auto 32px' }}>
              {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Full control from the top. Focused access for everyone else.', variant: 'subhead', multiline: true })}
            </div>
            {renderEditableBtn({ labelKey: 'hero.button.label', urlKey: 'hero.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
          </section>
        )}

        {/* Features grid */}
        {renderSectionWrap('section.intro.visible', 'Features Grid',
          <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ marginBottom: 10 }}>
                {renderEditableText({ blockKey: 'features.title', fallback: 'Everything you need to run your organisation', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'features.subtitle', fallback: 'Structure, permissions, and access — all in one place.', variant: 'body', styleOverride: { textAlign: 'center' as const } })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 18 }}>
              {tmFeatureBlocks.map((nameBlock, i) => {
                const idx = nameBlock.block_key.replace('feature.', '').replace('.name', '')
                const descKey = `feature.${idx}.desc`
                const descBlock = blockByKey[descKey]
                const cardDirty = (drafts[nameBlock.id] ?? '') !== nameBlock.value || (descBlock ? (drafts[descBlock.id] ?? '') !== descBlock.value : false)
                return (
                  <div key={nameBlock.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(tmFeatureBlocks, dragIndexRef.current ?? i, i)} style={{ position: 'relative', background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 16, padding: 24 }}>
                    <span style={{ position: 'absolute', top: 10, left: 10, cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1 }} title="Drag to reorder">⠿</span>
                    {cardDirty && <span style={{ position: 'absolute', top: 36, right: 8, background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, zIndex: 2 }}>Unsaved</span>}
                    <button type="button" onClick={() => deleteBlock(nameBlock.id).then(() => { if (descBlock) deleteBlock(descBlock.id) })} title="Remove feature card" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, lineHeight: 1 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                    <div style={{ width: 44, height: 44, background: '#FEF3C7', borderRadius: 11, display: 'grid', placeItems: 'center', marginBottom: 14, position: 'relative' }}>
                      {renderIconBox(nameBlock.block_key, `feature.${nameBlock.block_key.replace('feature.','').replace('.name','')}.icon`, blockByKey[`feature.${nameBlock.block_key.replace('feature.','').replace('.name','')}.icon`]?.value ?? null, nameBlock.sort_order - 1)}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      {renderEditableText({ blockKey: nameBlock.block_key, fallback: 'Feature name', variant: 'cardTitle', styleOverride: { fontSize: 15, fontWeight: 600, color: '#1C1917' }, hideDirtyBadge: true })}
                    </div>
                    {renderEditableText({ blockKey: descKey, fallback: 'Feature description', variant: 'cardBody', multiline: true, styleOverride: { fontSize: 14, lineHeight: 1.7 }, hideDirtyBadge: true })}
                  </div>
                )
              })}
              <button type="button" onClick={async () => {
                if (!selectedPage) return
                const existing = (selectedPage.blocks ?? []).filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
                const maxIdx = existing.reduce((m, b) => { const n = parseInt(b.block_key.split('.')[1]); return n > m ? n : m }, 0)
                const maxSort = existing.reduce((m, b) => b.sort_order > m ? b.sort_order : m, 0)
                const nextIdx = maxIdx + 1
                await createBlock(selectedPage.id, `feature.${nextIdx}.name`, `Feature ${nextIdx} Name`, '', maxSort + 1)
                await createBlock(selectedPage.id, `feature.${nextIdx}.desc`, `Feature ${nextIdx} Description`, '', maxSort + 2)
              }} style={{ background: 'none', border: '2px dashed #F0E8D8', borderRadius: 16, padding: 24, cursor: 'pointer', color: '#A8A29E', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 120 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add feature card
              </button>
            </div>
          </section>
        )}

        {/* Roles */}
        {renderSectionWrap('section.content.visible', 'Role Breakdown',
          <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ marginBottom: 10 }}>
                {renderEditableText({ blockKey: 'roles.title', fallback: 'The right access for every role.', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'roles.subtitle', fallback: 'Tasking is built around five roles, each with exactly the visibility and control they need — nothing more.', variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const } })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(roleBlocks.length || 5, 5)}, minmax(0,1fr))`, gap: 14 }}>
              {roleBlocks.map(nameBlock => {
                const idx = nameBlock.block_key.replace('role.', '').replace('.name', '')
                const descKey = `role.${idx}.desc`
                const descBlock = blockByKey[descKey]
                const nameVal = drafts[nameBlock.id] ?? nameBlock.value
                const colors = roleBadgeColors[nameVal] ?? { badge: '#374151', badgeBg: '#F3F4F6' }
                const cardDirty = (drafts[nameBlock.id] ?? '') !== nameBlock.value || (descBlock ? (drafts[descBlock.id] ?? '') !== descBlock.value : false)
                return (
                  <div key={nameBlock.id} style={{ position: 'relative', background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: 16, padding: 20 }}>
                    {cardDirty && <span style={{ position: 'absolute', top: 10, right: 8, background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, zIndex: 2 }}>Unsaved</span>}
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ display: 'inline-block', background: colors.badgeBg, color: colors.badge, padding: '4px 12px', borderRadius: 100, fontSize: 13, fontWeight: 700 }}>
                        {renderEditableText({ blockKey: nameBlock.block_key, fallback: 'Role', variant: 'cardTitle', styleOverride: { display: 'inline', fontSize: 13, fontWeight: 700, color: colors.badge }, hideDirtyBadge: true })}
                      </span>
                    </div>
                    {renderEditableText({ blockKey: descKey, fallback: 'Role description', variant: 'cardBody', multiline: true, styleOverride: { fontSize: 14, lineHeight: 1.7 }, hideDirtyBadge: true })}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* CTA */}
        {renderSectionWrap('section.cta.visible', 'CTA Section',
          <section style={{ background: ORANGE, padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ marginBottom: 14 }}>
                {renderEditableText({ blockKey: 'cta.headline', fallback: 'Get your team set up in minutes.', variant: 'cta', styleOverride: { fontSize: 36 }, onDarkBg: true })}
              </div>
              <div style={{ marginBottom: 28 }}>
                {renderEditableText({ blockKey: 'cta.subheadline', fallback: 'No IT team. No training programme. Just a clean system your whole organisation can use from day one.', variant: 'subhead', multiline: true, styleOverride: { fontSize: 16 }, onDarkBg: true })}
              </div>
              {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
            </div>
          </section>
        )}

      </div>
    )
  }

  const renderIndustriesPreview = () => {
    const industryBlocks = (selectedPage?.blocks ?? [])
      .filter(b => b.block_key.startsWith('industry.') && b.block_key.endsWith('.badge'))
      .sort((a, b) => a.sort_order - b.sort_order)

    const industryIconMap: Record<string, React.ReactNode> = {
      retail: <svg width="80" height="80" viewBox="0 0 24 24" fill="none" strokeWidth="1.25"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke={ORANGE} strokeLinecap="round" strokeLinejoin="round" /><line x1="3" y1="6" x2="21" y2="6" stroke={ORANGE} strokeLinecap="round" /><path d="M16 10a4 4 0 0 1-8 0" stroke={ORANGE} strokeLinecap="round" strokeLinejoin="round" /></svg>,
      fnb: <svg width="80" height="80" viewBox="0 0 24 24" fill="none" strokeWidth="1.25"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" stroke={ORANGE} strokeLinecap="round" strokeLinejoin="round" /><path d="M7 2v20" stroke={ORANGE} strokeLinecap="round" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" stroke={ORANGE} strokeLinecap="round" strokeLinejoin="round" /></svg>,
      logistics: <svg width="80" height="80" viewBox="0 0 24 24" fill="none" strokeWidth="1.25"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke={ORANGE} strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="10" r="3" stroke={ORANGE} /></svg>,
      'event-management': <svg width="80" height="80" viewBox="0 0 24 24" fill="none" strokeWidth="1.25"><rect x="3" y="4" width="18" height="18" rx="2" stroke={ORANGE} strokeLinecap="round" strokeLinejoin="round" /><line x1="16" y1="2" x2="16" y2="6" stroke={ORANGE} strokeLinecap="round" /><line x1="8" y1="2" x2="8" y2="6" stroke={ORANGE} strokeLinecap="round" /><line x1="3" y1="10" x2="21" y2="10" stroke={ORANGE} strokeLinecap="round" /><path d="m9 16 2 2 4-4" stroke={ORANGE} strokeLinecap="round" strokeLinejoin="round" /></svg>,
    }

    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>

        {/* Hero */}
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>
              {renderEditableText({ blockKey: 'hero.badge', fallback: 'Industries', variant: 'badge' })}
            </div>
            <div style={{ maxWidth: 620, margin: '0 auto 18px' }}>
              {renderEditableText({ blockKey: 'hero.headline', fallback: 'One platform. Every industry.', variant: 'hero' })}
            </div>
            <div style={{ maxWidth: 560, margin: '0 auto 32px' }}>
              {renderEditableText({ blockKey: 'hero.subheadline', fallback: "Whether you're running a retail floor, a restaurant, a warehouse, or an event — Tasking is built to handle the way your workforce actually operates.", variant: 'subhead', multiline: true })}
            </div>
            {renderEditableBtn({ labelKey: 'hero.button.label', urlKey: 'hero.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
          </section>
        )}

        {/* Intro */}
        {renderSectionWrap('section.intro.visible', 'Intro Section',
          <section style={{ background: '#FFFFFF', padding: '56px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <div style={{ marginBottom: 16 }}>
                {renderEditableText({ blockKey: 'intro.title', fallback: "The workforce challenge looks different in every industry. The solution doesn't.", variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'intro.body', fallback: 'Every business that relies on casual workers faces the same core problems.', variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const } })}
            </div>
          </section>
        )}

        {/* Industries */}
        {renderSectionWrap('section.content.visible', 'Industries',
          <section style={{ background: '#FFFBF5', padding: '32px 48px 56px' }}>
            {industryBlocks.map((badgeBlock, i) => {
              const idx = badgeBlock.block_key.replace('industry.', '').replace('.badge', '')
              const idBlock = blockByKey[`industry.${idx}.id`]
              const industryId = idBlock ? (drafts[idBlock.id] ?? idBlock.value) : idx
              const questionKey = `industry.${idx}.question`
              const painpointKey = `industry.${idx}.painpoint`
              const solutionKey = `industry.${idx}.solution`
              const icon = industryIconMap[industryId] ?? industryIconMap['retail']
              const isEven = i % 2 === 0
              const relatedBlocks = [badgeBlock, blockByKey[questionKey], blockByKey[painpointKey], blockByKey[solutionKey], idBlock].filter(Boolean) as typeof badgeBlock[]
              const cardDirty = relatedBlocks.some(b => (drafts[b.id] ?? '') !== b.value)
              return (
                <div key={badgeBlock.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(industryBlocks, dragIndexRef.current ?? i, i)} style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', top: 18, left: 0, cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1, zIndex: 2 }} title="Drag to reorder">⠿</span>
                  {cardDirty && <span style={{ position: 'absolute', top: 16, right: 40, background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, zIndex: 2 }}>Unsaved</span>}
                  <button type="button" onClick={() => relatedBlocks.forEach(b => deleteBlock(b.id))} title="Remove industry" style={{ position: 'absolute', top: 16, right: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, lineHeight: 1, zIndex: 2 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                  <div style={{ display: 'flex', flexDirection: isEven ? 'row' : 'row-reverse', gap: 48, alignItems: 'center', padding: '40px 0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: 16 }}>
                        {renderEditableText({ blockKey: badgeBlock.block_key, fallback: 'Industry', variant: 'badge', styleOverride: { background: '#FEF3C7', color: '#92400E', fontSize: 13 }, hideDirtyBadge: true })}
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        {renderEditableText({ blockKey: questionKey, fallback: 'Question headline', variant: 'sectionTitle', styleOverride: { fontSize: 22, textAlign: 'left' as const }, hideDirtyBadge: true })}
                      </div>
                      <div style={{ marginBottom: 20 }}>
                        {renderEditableText({ blockKey: painpointKey, fallback: 'Pain point description', variant: 'body', multiline: true, styleOverride: { fontSize: 14, color: '#78716C' }, hideDirtyBadge: true })}
                      </div>
                      <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: ORANGE, marginBottom: 8 }}>How Tasking helps</p>
                      {renderEditableText({ blockKey: solutionKey, fallback: 'Solution description', variant: 'body', multiline: true, styleOverride: { fontSize: 14, color: '#1C1917' }, hideDirtyBadge: true })}
                    </div>
                    {(() => {
                      const icoBlockKey = `industry.${idx}.icon`
                      const resolvedName = blockByKey[icoBlockKey]?.value ?? industryId
                      return (
                        <div style={{ width: 240, height: 240, flexShrink: 0, background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', position: 'relative', cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); openIconPicker(e, badgeBlock.block_key, icoBlockKey, badgeBlock.sort_order - 1) }}>
                          <MarketingIcon name={resolvedName} size={80} />
                          <div style={{ position: 'absolute', bottom: 10, right: 10, background: ORANGE, borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                  {i < industryBlocks.length - 1 && <div style={{ height: 1, background: '#F0E8D8' }} />}
                </div>
              )
            })}
            <button type="button" onClick={async () => {
              if (!selectedPage) return
              const existing = (selectedPage.blocks ?? []).filter(b => b.block_key.startsWith('industry.') && b.block_key.endsWith('.badge'))
              const maxIdx = existing.reduce((m, b) => { const n = parseInt(b.block_key.split('.')[1]); return n > m ? n : m }, 0)
              const maxSort = existing.reduce((m, b) => b.sort_order > m ? b.sort_order : m, 29)
              const nextIdx = maxIdx + 1
              await createBlock(selectedPage.id, `industry.${nextIdx}.id`, `Industry ${nextIdx} ID`, `industry-${nextIdx}`, maxSort + 1)
              await createBlock(selectedPage.id, `industry.${nextIdx}.badge`, `Industry ${nextIdx} Badge`, 'New Industry', maxSort + 2)
              await createBlock(selectedPage.id, `industry.${nextIdx}.question`, `Industry ${nextIdx} Question`, 'What challenge does this industry face?', maxSort + 3)
              await createBlock(selectedPage.id, `industry.${nextIdx}.painpoint`, `Industry ${nextIdx} Pain Point`, '', maxSort + 4)
              await createBlock(selectedPage.id, `industry.${nextIdx}.solution`, `Industry ${nextIdx} Solution`, '', maxSort + 5)
            }} style={{ marginTop: 24, width: '100%', background: 'none', border: '2px dashed #F0E8D8', borderRadius: 16, padding: '20px 24px', cursor: 'pointer', color: '#A8A29E', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add industry
            </button>
          </section>
        )}

        {/* Closing */}
        {renderSectionWrap('section.closing.visible', 'Closing Statement',
          <section style={{ background: '#F5F0E8', padding: '56px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <div style={{ marginBottom: 14 }}>
                {renderEditableText({ blockKey: 'closing.title', fallback: 'Different industry. Same result.', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'closing.body', fallback: 'Less time coordinating. Fewer no-shows.', variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const } })}
            </div>
          </section>
        )}

        {/* CTA */}
        {renderSectionWrap('section.cta.visible', 'CTA Section',
          <section style={{ background: ORANGE, padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ marginBottom: 14 }}>
                {renderEditableText({ blockKey: 'cta.headline', fallback: 'Ready to see Tasking in your industry?', variant: 'cta', styleOverride: { fontSize: 36 }, onDarkBg: true })}
              </div>
              <div style={{ marginBottom: 28 }}>
                {renderEditableText({ blockKey: 'cta.subheadline', fallback: 'Join SMEs already using Tasking to manage their casual workforce.', variant: 'subhead', multiline: true, styleOverride: { fontSize: 16 }, onDarkBg: true })}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
                {renderEditableBtn({ labelKey: 'cta.button2.label', urlKey: 'cta.button2.url', fallbackLabel: 'View Pricing', fallbackUrl: '/pricing', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: 'transparent', color: '#FFFFFF', border: '2px solid rgba(255,255,255,0.6)', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
              </div>
              {renderEditableText({ blockKey: 'cta.footnote', fallback: 'No credit card required. Free forever.', variant: 'body', styleOverride: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center' as const }, onDarkBg: true })}
            </div>
          </section>
        )}

      </div>
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
      {renderSectionWrap('section.hero.visible', 'Hero Section',
        <section style={{ background: '#1C1C1E', padding: '64px 48px', textAlign: 'center' }}>
          {renderEditableText({ blockKey: 'hero.headline', fallback: selectedPage?.title ?? 'Marketing page', variant: 'hero' })}
          <div style={{ height: 18 }} />
          {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Double-click this text to edit the marketing content for this page.', variant: 'subhead', multiline: true })}
        </section>
      )}
      {hasIntro ? renderSectionWrap('section.intro.visible', 'Intro Section',
        <section style={{ padding: '56px 48px', background: '#FFFBF5' }}>
          {hasBlock(blockByKey, 'intro.title') ? renderEditableText({ blockKey: 'intro.title', fallback: 'Section headline', variant: 'sectionTitle' }) : null}
          {hasBlock(blockByKey, 'intro.title') && hasBlock(blockByKey, 'intro.body') ? <div style={{ height: 14 }} /> : null}
          {hasBlock(blockByKey, 'intro.body') ? renderEditableText({ blockKey: 'intro.body', fallback: 'Add the body copy for this marketing section from the live editor.', variant: 'body', multiline: true }) : null}
        </section>
      ) : null}
      {secondaryBlocks.length > 0 ? renderSectionWrap('section.content.visible', 'Page Content',
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
      {hasCta ? renderSectionWrap('section.cta.visible', 'CTA Section', renderCtaBtnSection(ORANGE, 'cta.headline', 'cta.subheadline')) : null}
    </div>
    )
  }

  const renderProductsPreview = () => {
    const ORANGE = '#F97316'
    const modules = [
      { key: 'recruitment', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke={ORANGE} strokeWidth="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/></svg>, name: 'Recruitment',         tagline: 'Find the right people. Fast.',                      href: '/products/recruitment' },
      { key: 'attendance',  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={ORANGE} strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><path d="M9 16l2 2 4-4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, name: 'Attendance',          tagline: 'Every clock-in. Verified.',                         href: '/products/attendance' },
      { key: 'team',        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3" stroke={ORANGE} strokeWidth="2"/><circle cx="5" cy="10" r="2.5" stroke={ORANGE} strokeWidth="1.75"/><circle cx="19" cy="10" r="2.5" stroke={ORANGE} strokeWidth="1.75"/><path d="M2 20c0-3 1.8-5 5-5M22 20c0-3-1.8-5-5-5M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={ORANGE} strokeWidth="1.75" strokeLinecap="round"/></svg>, name: 'Team Management',     tagline: 'Your company structure, exactly how you need it.',  href: '/products/team-management' },
      { key: 'notifications',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/></svg>, name: 'Smart Notifications', tagline: 'No more chasing people for updates.',                 href: '/products/smart-notifications' },
      { key: 'ai',          icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" stroke={ORANGE} strokeWidth="2" strokeLinejoin="round"/><path d="M19 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" stroke={ORANGE} strokeWidth="1.5" strokeLinejoin="round"/></svg>, name: 'AI Features',         tagline: 'Enterprise-grade AI. Free for everyone.',          href: '/products/ai-features' },
    ]
    const notIncluded = ['Payment & Payroll', 'Integrations', 'Reporting & Analytics', 'Support & Onboarding']
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {/* Hero */}
        {renderSectionWrap('section.hero.visible', 'Hero Section', <section style={{ background: '#1C1C1E', padding: '96px 48px 80px', textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            {renderEditableText({ blockKey: 'hero.badge', fallback: 'Products', variant: 'badge' })}
          </div>
          <div style={{ maxWidth: 760, margin: '0 auto 20px' }}>
            {renderEditableText({ blockKey: 'hero.headline', fallback: 'One platform. Every tool your casual workforce needs.', variant: 'hero' })}
          </div>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {renderEditableText({ blockKey: 'hero.subheadline', fallback: "Tasking brings recruitment, attendance, team management, and AI automation together in one place — so you can stop juggling tools and start running your business.", variant: 'subhead', multiline: true })}
          </div>
          <div style={{ height: 36 }} />
          {renderEditableBtn({ labelKey: 'hero.button.label', urlKey: 'hero.button.url', fallbackLabel: 'Explore Our Modules', fallbackUrl: '#modules', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
        </section>)}

        {/* We kept it simple */}
        {renderSectionWrap('section.why.visible', '"We kept it simple"', <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {renderEditableText({ blockKey: 'why.eyebrow', fallback: 'What we left out', variant: 'eyebrow' })}
            </p>
            <div style={{ marginBottom: 12 }}>
              {renderEditableText({ blockKey: 'why.title', fallback: 'We kept it simple. On purpose.', variant: 'sectionTitle', styleOverride: { fontSize: 36, fontWeight: 600 } })}
            </div>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              {renderEditableText({ blockKey: 'why.intro', fallback: "Most workforce tools were built for corporations with dedicated IT teams and six-figure software budgets. They come packed with modules that look impressive on a features list — but for an SME trying to manage a casual workforce, they just get in the way. Here's what we left out, and why.", variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const, lineHeight: 1.75, fontSize: 17 } })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 20, marginBottom: 32 }}>
            {[
              { titleKey: 'why.card.payroll.title',      bodyKey: 'why.card.payroll.body',      fallbackTitle: 'Payment & Payroll',      fallbackBody: "Payroll is a legal minefield — tax filings, CPF calculations, regional compliance. It belongs in dedicated payroll software, not a workforce management tool. We stay in our lane so you're not exposed to the risks." },
              { titleKey: 'why.card.integrations.title', bodyKey: 'why.card.integrations.body', fallbackTitle: 'Integrations',           fallbackBody: "Enterprise API connectors exist for companies with full-time IT departments. If you're running an SME, you don't need a 12-week implementation just to get your team scheduled." },
              { titleKey: 'why.card.reporting.title',    bodyKey: 'why.card.reporting.body',    fallbackTitle: 'Reporting & Analytics',  fallbackBody: 'Labour forecasting and sales-based scheduling sound great. But they require months of historical data and dedicated analysts to be useful. We give you what actually matters — who showed up, when, and whether the record is accurate.' },
              { titleKey: 'why.card.onboarding.title',   bodyKey: 'why.card.onboarding.body',   fallbackTitle: 'Support & Onboarding',   fallbackBody: "If you need a 3-day onboarding programme to use a scheduling tool, something's already gone wrong. Tasking is designed so your team picks it up on day one." },
            ].map(({ titleKey, bodyKey, fallbackTitle, fallbackBody }) => (
              <div key={titleKey} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 16, padding: 32, position: 'relative' }}>
                <span style={{ position: 'absolute', top: 20, right: 20, background: '#F3F4F6', color: '#9CA3AF', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, letterSpacing: '0.04em' }}>Not included</span>
                <div style={{ paddingRight: 100, marginBottom: 10 }}>
                  {renderEditableText({ blockKey: titleKey, fallback: fallbackTitle, variant: 'cardTitle', styleOverride: { color: '#6B7280', fontSize: 18, fontWeight: 600 } })}
                </div>
                {renderEditableText({ blockKey: bodyKey, fallback: fallbackBody, variant: 'cardBody', multiline: true, styleOverride: { fontSize: 15, lineHeight: 1.7 } })}
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center' }}>
            {renderEditableText({ blockKey: 'why.footer', fallback: 'Less bloat. More clarity. Everything your team needs to run a casual workforce — nothing that slows you down.', variant: 'body', styleOverride: { fontSize: 16, fontWeight: 600, color: '#1C1917', textAlign: 'center' as const } })}
          </p>
        </section>)}

        {/* Comparison table */}
        {renderSectionWrap('section.comparison.visible', 'Comparison Table', (() => {
          const comparisonBlocks = (selectedPage?.blocks ?? [])
            .filter(b => b.block_key.startsWith('comparison.row.'))
            .sort((a, b) => a.sort_order - b.sort_order)

          const addRow = async () => {
            if (!selectedPage) return
            const nextOrder = comparisonBlocks.length > 0
              ? Math.max(...comparisonBlocks.map(b => b.sort_order)) + 1
              : 200
            const key = `comparison.row.${Date.now()}`
            await createBlock(selectedPage.id, key, `Comparison Row`, '', nextOrder)
          }

          return (
            <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{ marginBottom: 10 }}>
                  {renderEditableText({ blockKey: 'comparison.title', fallback: 'Built different. Here\'s the proof.', variant: 'sectionTitle', styleOverride: { fontSize: 34 } })}
                </div>
                {renderEditableText({ blockKey: 'comparison.subtitle', fallback: 'Features that exist in Tasking and nowhere else.', variant: 'body', styleOverride: { textAlign: 'center' as const } })}
              </div>
              <div style={{ maxWidth: 600, margin: '0 auto', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 36px', background: '#1C1917', padding: '14px 24px', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>Feature</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', textAlign: 'center' }}>Current Workforce Tools</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ORANGE, textAlign: 'center' }}>Tasking</span>
                  <span />
                </div>
                {comparisonBlocks.map(block => (
                  <div key={block.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 36px', padding: '11px 24px', background: '#FFFFFF', borderTop: '1px solid #F3F4F6', alignItems: 'center', gap: 4 }}>
                    <div>
                      {renderEditableText({ blockKey: block.block_key, fallback: block.value, variant: 'body', styleOverride: { fontSize: 13, color: '#6B7280', fontWeight: 400 } })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{ width: 24, height: 24, borderRadius: 999, background: 'rgba(239,68,68,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#EF4444" strokeWidth="1.75" strokeLinecap="round"/></svg>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{ width: 24, height: 24, borderRadius: 999, background: 'rgba(249,115,22,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3.5 3.5 5.5-7" stroke={ORANGE} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                    </div>
                    <button
                      type="button"
                      title="Remove row"
                      onClick={() => deleteBlock(block.id)}
                      style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: '#CBD5E1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {/* Add row */}
                <div style={{ borderTop: '1px solid #F3F4F6', padding: '10px 24px' }}>
                  <button
                    type="button"
                    onClick={addRow}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed #D1D5DB', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#9CA3AF', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE; (e.currentTarget as HTMLButtonElement).style.color = ORANGE }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#D1D5DB'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>
                    Add feature row
                  </button>
                </div>
              </div>
            </section>
          )
        })())}

        {/* Module cards */}
        {renderSectionWrap('section.modules.visible', 'Module Cards', <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ marginBottom: 12 }}>
              {renderEditableText({ blockKey: 'modules.title', fallback: 'Five modules. One workflow. Zero gaps.', variant: 'sectionTitle' })}
            </div>
            {renderEditableText({ blockKey: 'modules.subtitle', fallback: 'Every module in Tasking is designed to work together — from the moment you post a job to the moment the shift ends.', variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const } })}
          </div>
          {(() => {
            const renderModuleCard = (m: typeof modules[0]) => (
              <div key={m.key} style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: 48, height: 48, background: '#FEF3C7', borderRadius: 12, display: 'grid', placeItems: 'center', marginBottom: 16 }}>{m.icon}</div>
                <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1C1917', fontFamily: 'var(--font-heading)' }}>{m.name}</p>
                <div style={{ marginBottom: 12 }}>
                  {renderEditableText({ blockKey: `module.${m.key}.tagline`, fallback: m.tagline, variant: 'body', styleOverride: { fontSize: 13, fontWeight: 700, color: ORANGE } })}
                </div>
                <div style={{ marginBottom: 20, flex: 1 }}>
                  {renderEditableText({ blockKey: `module.${m.key}.body`, fallback: '', variant: 'body', multiline: true, styleOverride: { fontSize: 13, color: '#6B7280', lineHeight: 1.7 } })}
                </div>
                <div>
                  {renderEditableText({ blockKey: `module.${m.key}.link`, fallback: `See how ${m.name} works →`, variant: 'body', styleOverride: { fontSize: 13, fontWeight: 600, color: ORANGE } })}
                </div>
              </div>
            )
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginBottom: 16 }}>
                  {modules.slice(0, 3).map(renderModuleCard)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 16, maxWidth: 640, margin: '0 auto' }}>
                  {modules.slice(3).map(renderModuleCard)}
                </div>
              </>
            )
          })()}
        </section>)}

        {/* CTA */}
        {renderSectionWrap('section.cta.visible', 'CTA Section', <section style={{ background: ORANGE, padding: '72px 48px', textAlign: 'center' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ marginBottom: 16 }}>
              {renderEditableText({ blockKey: 'cta.headline', fallback: 'Ready to see it in action?', variant: 'cta', styleOverride: { fontSize: 40, fontWeight: 700 }, onDarkBg: true })}
            </div>
            <div style={{ marginBottom: 32 }}>
              {renderEditableText({ blockKey: 'cta.subheadline', fallback: 'Join SMEs already using Tasking to hire smarter, schedule faster, and track with confidence.', variant: 'subhead', multiline: true, styleOverride: { fontSize: 17, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }, onDarkBg: true })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
              {renderEditableBtn({ labelKey: 'cta.button2.label', urlKey: 'cta.button2.url', fallbackLabel: 'View Pricing', fallbackUrl: '/pricing', editing: editingIndustriesBtn, setEditing: setEditingIndustriesBtn, btnStyle: { background: 'transparent', color: '#FFFFFF', border: '2px solid rgba(255,255,255,0.6)', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
            </div>
            <div>
              {renderEditableText({ blockKey: 'cta.note', fallback: 'No credit card required. Free forever.', variant: 'body', styleOverride: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' as const }, onDarkBg: true })}
            </div>
          </div>
        </section>)}
      </div>
    )
  }

  const renderAboutMissionPreview = () => {
    const painBlocks  = (selectedPage?.blocks ?? []).filter(b => b.block_key.startsWith('why.pain.')  && !b.block_key.includes('.visible')).sort((a, b) => a.sort_order - b.sort_order)
    const goalBlocks  = (selectedPage?.blocks ?? []).filter(b => b.block_key.startsWith('goals.')     && b.block_key.endsWith('.title')).sort((a, b) => a.sort_order - b.sort_order)
    const valueBlocks = (selectedPage?.blocks ?? []).filter(b => b.block_key.startsWith('values.')    && b.block_key.endsWith('.badge')).sort((a, b) => a.sort_order - b.sort_order)
    const dragRef = dragIndexRef

    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>{renderEditableText({ blockKey: 'hero.badge', fallback: 'Mission', variant: 'badge' })}</div>
            <div style={{ maxWidth: 640, margin: '0 auto 18px' }}>{renderEditableText({ blockKey: 'hero.headline', fallback: 'We built Tasking because SMEs deserve better.', variant: 'hero' })}</div>
            <div style={{ maxWidth: 520, margin: '0 auto' }}>{renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Not a watered-down version of enterprise software. Not another spreadsheet wrapper.', variant: 'subhead', multiline: true })}</div>
          </section>
        )}

        {renderSectionWrap('section.why.visible', 'Why We Built It',
          <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
            <div style={{ marginBottom: 16 }}>{renderEditableText({ blockKey: 'why.headline', fallback: 'Why we built it', variant: 'sectionTitle' })}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
              <div>
                <div style={{ marginBottom: 12 }}>{renderEditableText({ blockKey: 'why.para1', fallback: '', variant: 'body', multiline: true })}</div>
                <div>{renderEditableText({ blockKey: 'why.para2', fallback: '', variant: 'body', multiline: true })}</div>
              </div>
              <div style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: 16, padding: 28 }}>
                {painBlocks.map((pb, i) => (
                  <div key={pb.id} draggable onDragStart={() => { dragRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(painBlocks, dragRef.current ?? i, i)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < painBlocks.length - 1 ? 14 : 0, cursor: 'grab' }}>
                    <span style={{ fontSize: 14, color: '#CBD5E1', userSelect: 'none', flexShrink: 0, marginTop: 1 }}>⠿</span>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FEF3C7', border: '2px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#F97316' }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1 }}>{renderEditableText({ blockKey: pb.block_key, fallback: pb.value, placeholder: 'Pain point…', variant: 'body', hideDirtyBadge: false })}</div>
                    <button onClick={() => deleteBlock(pb.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 15, padding: '0 4px', flexShrink: 0 }}>🗑</button>
                  </div>
                ))}
                <button onClick={() => { const idx = painBlocks.length + 1; createBlock(selectedPage!.id, `why.pain.${idx}`, 'Pain Point', '', (painBlocks[painBlocks.length - 1]?.sort_order ?? 0) + 10) }}
                  style={{ marginTop: 12, background: 'none', border: '1px dashed #CBD5E1', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#64748B', cursor: 'pointer', width: '100%' }}>+ Add pain point</button>
              </div>
            </div>
          </section>
        )}

        {renderSectionWrap('section.goals.visible', 'What We Set Out To Do',
          <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
            <div style={{ marginBottom: 32 }}>{renderEditableText({ blockKey: 'goals.headline', fallback: 'What we set out to do', variant: 'sectionTitle' })}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {goalBlocks.map((gb, i) => {
                const n = gb.block_key.replace('goals.', '').replace('.title', '')
                return (
                  <div key={gb.id} draggable onDragStart={() => { dragRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(goalBlocks, dragRef.current ?? i, i)}
                    style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 14, color: '#CBD5E1', cursor: 'grab' }}>⠿</span>
                    <button onClick={() => { deleteBlock(gb.id); const bodyBlock = (selectedPage?.blocks ?? []).find(b => b.block_key === `goals.${n}.body`); if (bodyBlock) deleteBlock(bodyBlock.id) }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 14 }}>🗑</button>
                    <div style={{ marginBottom: 8, paddingLeft: 24 }}>{renderEditableText({ blockKey: `goals.${n}.title`, fallback: gb.value, placeholder: 'Goal title', variant: 'body', styleOverride: { fontWeight: 700 } })}</div>
                    <div style={{ paddingLeft: 24 }}>{renderEditableText({ blockKey: `goals.${n}.body`, fallback: '', placeholder: 'Goal description', variant: 'body', multiline: true })}</div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => { const n = goalBlocks.length + 1; createBlock(selectedPage!.id, `goals.${n}.title`, 'Goal Title', '', (goalBlocks[goalBlocks.length-1]?.sort_order ?? 0) + 10); createBlock(selectedPage!.id, `goals.${n}.body`, 'Goal Body', '', (goalBlocks[goalBlocks.length-1]?.sort_order ?? 0) + 11) }}
              style={{ marginTop: 16, background: 'none', border: '1px dashed #CBD5E1', borderRadius: 8, padding: '8px 18px', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>+ Add goal</button>
          </section>
        )}

        {renderSectionWrap('section.values.visible', 'What We Stand For',
          <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
            <div style={{ marginBottom: 32 }}>{renderEditableText({ blockKey: 'values.headline', fallback: 'What we stand for', variant: 'sectionTitle' })}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {valueBlocks.map((vb, i) => {
                const n = vb.block_key.replace('values.', '').replace('.badge', '')
                return (
                  <div key={vb.id} draggable onDragStart={() => { dragRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(valueBlocks, dragRef.current ?? i, i)}
                    style={{ background: '#FFFBF5', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 14, color: '#CBD5E1', cursor: 'grab' }}>⠿</span>
                    <button onClick={() => { deleteBlock(vb.id); const t = (selectedPage?.blocks ?? []).find(b => b.block_key === `values.${n}.title`); const bo = (selectedPage?.blocks ?? []).find(b => b.block_key === `values.${n}.body`); if (t) deleteBlock(t.id); if (bo) deleteBlock(bo.id) }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 14 }}>🗑</button>
                    <div style={{ marginBottom: 8, paddingLeft: 24 }}>{renderEditableText({ blockKey: `values.${n}.badge`, fallback: vb.value, placeholder: 'Badge label', variant: 'badge' })}</div>
                    <div style={{ marginBottom: 8 }}>{renderEditableText({ blockKey: `values.${n}.title`, fallback: '', placeholder: 'Value title', variant: 'body', styleOverride: { fontWeight: 700 } })}</div>
                    <div>{renderEditableText({ blockKey: `values.${n}.body`, fallback: '', placeholder: 'Value description', variant: 'body', multiline: true })}</div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => { const n = valueBlocks.length + 1; createBlock(selectedPage!.id, `values.${n}.badge`, 'Value Badge', '', (valueBlocks[valueBlocks.length-1]?.sort_order ?? 0) + 10); createBlock(selectedPage!.id, `values.${n}.title`, 'Value Title', '', (valueBlocks[valueBlocks.length-1]?.sort_order ?? 0) + 11); createBlock(selectedPage!.id, `values.${n}.body`, 'Value Body', '', (valueBlocks[valueBlocks.length-1]?.sort_order ?? 0) + 12) }}
              style={{ marginTop: 16, background: 'none', border: '1px dashed #CBD5E1', borderRadius: 8, padding: '8px 18px', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>+ Add value</button>
          </section>
        )}

        {renderSectionWrap('section.cta.visible', 'CTA Section',
          <section style={{ background: ORANGE, padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 500, margin: '0 auto 24px' }}>
              {renderEditableText({ blockKey: 'cta.headline', fallback: 'Ready to see it for yourself?', variant: 'cta' })}
            </div>
            {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
          </section>
        )}
      </div>
    )
  }

  const renderAboutProblemSolutionPreview = () => {
    const problemBlocks = (selectedPage?.blocks ?? []).filter(b => /^problems\.\d+\.title$/.test(b.block_key)).sort((a, b) => a.sort_order - b.sort_order)
    const gapBlocks     = (selectedPage?.blocks ?? []).filter(b => /^gaps\.\d+\.title$/.test(b.block_key)).sort((a, b) => a.sort_order - b.sort_order)
    const fixBlocks     = (selectedPage?.blocks ?? []).filter(b => b.block_key.startsWith('fixes.')    && b.block_key.endsWith('.problem')).sort((a, b) => a.sort_order - b.sort_order)
    const dragRef = dragIndexRef

    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>{renderEditableText({ blockKey: 'hero.badge', fallback: 'Problem & Solution', variant: 'badge' })}</div>
            <div style={{ maxWidth: 640, margin: '0 auto 18px' }}>{renderEditableText({ blockKey: 'hero.headline', fallback: 'The problem is real. The fixes are already built.', variant: 'hero' })}</div>
            <div style={{ maxWidth: 520, margin: '0 auto' }}>{renderEditableText({ blockKey: 'hero.subheadline', fallback: "Here's an honest breakdown of what's broken in casual workforce management.", variant: 'subhead', multiline: true })}</div>
          </section>
        )}

        {renderSectionWrap('section.problems.visible', 'Problems',
          <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
            <div style={{ marginBottom: 12 }}>{renderEditableText({ blockKey: 'problems.title', fallback: 'What SMEs are dealing with every day', variant: 'sectionTitle' })}</div>
            <div style={{ marginBottom: 28 }}>{renderEditableText({ blockKey: 'problems.subtitle', fallback: '', variant: 'body', multiline: true })}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {problemBlocks.map((pb, i) => {
                const n = pb.block_key.replace('problems.', '').replace('.title', '')
                return (
                  <div key={pb.id} draggable onDragStart={() => { dragRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(problemBlocks, dragRef.current ?? i, i)}
                    style={{ display: 'flex', gap: 12, background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, position: 'relative' }}>
                    <span style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', fontSize: 14, color: '#CBD5E1', cursor: 'grab' }}>⠿</span>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FEF3C7', border: '2px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 16 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#F97316' }}>{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 6 }}>{renderEditableText({ blockKey: `problems.${n}.title`, fallback: pb.value, placeholder: 'Problem title', variant: 'body', styleOverride: { fontWeight: 700 } })}</div>
                      <div>{renderEditableText({ blockKey: `problems.${n}.body`, fallback: '', placeholder: 'Problem description', variant: 'body', multiline: true })}</div>
                    </div>
                    <button onClick={() => { deleteBlock(pb.id); const bo = (selectedPage?.blocks ?? []).find(b => b.block_key === `problems.${n}.body`); if (bo) deleteBlock(bo.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 14, flexShrink: 0 }}>🗑</button>
                  </div>
                )
              })}
            </div>
            <button onClick={() => { const n = problemBlocks.length + 1; createBlock(selectedPage!.id, `problems.${n}.title`, 'Problem Title', '', (problemBlocks[problemBlocks.length-1]?.sort_order ?? 0) + 10); createBlock(selectedPage!.id, `problems.${n}.body`, 'Problem Body', '', (problemBlocks[problemBlocks.length-1]?.sort_order ?? 0) + 11) }}
              style={{ marginTop: 12, background: 'none', border: '1px dashed #CBD5E1', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>+ Add problem</button>
          </section>
        )}

        {renderSectionWrap('section.gaps.visible', 'Market Gaps',
          <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
            <div style={{ marginBottom: 12 }}>{renderEditableText({ blockKey: 'gaps.title', fallback: "Existing tools weren't built for this", variant: 'sectionTitle' })}</div>
            <div style={{ marginBottom: 28 }}>{renderEditableText({ blockKey: 'gaps.subtitle', fallback: '', variant: 'body', multiline: true })}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {gapBlocks.map((gb, i) => {
                const n = gb.block_key.replace('gaps.', '').replace('.title', '')
                return (
                  <div key={gb.id} draggable onDragStart={() => { dragRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(gapBlocks, dragRef.current ?? i, i)}
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 14, color: '#CBD5E1', cursor: 'grab' }}>⠿</span>
                    <button onClick={() => { deleteBlock(gb.id); const det = (selectedPage?.blocks ?? []).find(b => b.block_key === `gaps.${n}.detail`); if (det) deleteBlock(det.id) }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 13 }}>🗑</button>
                    <div style={{ marginBottom: 6, paddingLeft: 20 }}>{renderEditableText({ blockKey: `gaps.${n}.title`, fallback: gb.value, placeholder: 'Gap title', variant: 'body', styleOverride: { fontWeight: 700, color: '#6B7280' } })}</div>
                    <div style={{ paddingLeft: 20 }}>{renderEditableText({ blockKey: `gaps.${n}.detail`, fallback: '', placeholder: 'Gap detail', variant: 'body', multiline: true })}</div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => { const n = gapBlocks.length + 1; createBlock(selectedPage!.id, `gaps.${n}.title`, 'Gap Title', '', (gapBlocks[gapBlocks.length-1]?.sort_order ?? 0) + 10); createBlock(selectedPage!.id, `gaps.${n}.detail`, 'Gap Detail', '', (gapBlocks[gapBlocks.length-1]?.sort_order ?? 0) + 11) }}
              style={{ marginTop: 12, background: 'none', border: '1px dashed #CBD5E1', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>+ Add gap</button>
          </section>
        )}

        {renderSectionWrap('section.fixes.visible', 'How Tasking Fixes It',
          <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
            <div style={{ marginBottom: 12 }}>{renderEditableText({ blockKey: 'fixes.title', fallback: 'Every problem. Directly addressed.', variant: 'sectionTitle' })}</div>
            <div style={{ marginBottom: 28 }}>{renderEditableText({ blockKey: 'fixes.subtitle', fallback: '', variant: 'body', multiline: true })}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {fixBlocks.map((fb, i) => {
                const n = fb.block_key.replace('fixes.', '').replace('.problem', '')
                return (
                  <div key={fb.id} draggable onDragStart={() => { dragRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(fixBlocks, dragRef.current ?? i, i)}
                    style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22, position: 'relative' }}>
                    <span style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', fontSize: 14, color: '#CBD5E1', cursor: 'grab' }}>⠿</span>
                    <button onClick={() => { deleteBlock(fb.id); ['solution', 'detail'].forEach(k => { const b = (selectedPage?.blocks ?? []).find(x => x.block_key === `fixes.${n}.${k}`); if (b) deleteBlock(b.id) }) }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 14 }}>🗑</button>
                    <div style={{ paddingLeft: 16 }}>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Problem: </span>
                        {renderEditableText({ blockKey: `fixes.${n}.problem`, fallback: fb.value, placeholder: 'Problem label', variant: 'body', hideDirtyBadge: true })}
                      </div>
                      <div style={{ color: ORANGE, fontWeight: 700, marginBottom: 8 }}>{renderEditableText({ blockKey: `fixes.${n}.solution`, fallback: '', placeholder: 'Solution headline', variant: 'body', hideDirtyBadge: true })}</div>
                      <div>{renderEditableText({ blockKey: `fixes.${n}.detail`, fallback: '', placeholder: 'Solution detail', variant: 'body', multiline: true, hideDirtyBadge: true })}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => { const n = fixBlocks.length + 1; const base = (fixBlocks[fixBlocks.length-1]?.sort_order ?? 0) + 10; ['problem', 'solution', 'detail'].forEach((k, j) => createBlock(selectedPage!.id, `fixes.${n}.${k}`, `Fix ${n} ${k}`, '', base + j)) }}
              style={{ marginTop: 12, background: 'none', border: '1px dashed #CBD5E1', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>+ Add fix</button>
          </section>
        )}

        {renderSectionWrap('section.cta.visible', 'CTA Section',
          <section style={{ background: ORANGE, padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 500, margin: '0 auto 24px' }}>
              {renderEditableText({ blockKey: 'cta.headline', fallback: 'See it working. For free.', variant: 'cta' })}
            </div>
            {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
          </section>
        )}
      </div>
    )
  }

  const renderAboutTeamPreview = () => {
    const memberColors: Record<string, { color: string; bg: string }> = {
      '1': { color: '#F97316', bg: '#FEF3C7' }, '2': { color: '#8B5CF6', bg: '#EDE9FE' },
      '3': { color: '#0EA5E9', bg: '#E0F2FE' }, '4': { color: '#10B981', bg: '#D1FAE5' },
      '5': { color: '#EF4444', bg: '#FEE2E2' }, '6': { color: '#F59E0B', bg: '#FEF3C7' },
    }
    const memberBlocks = (selectedPage?.blocks ?? []).filter(b => b.block_key.startsWith('member.') && b.block_key.endsWith('.name')).sort((a, b) => a.sort_order - b.sort_order)
    const dragRef = dragIndexRef

    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>{renderEditableText({ blockKey: 'hero.badge', fallback: 'The Team', variant: 'badge' })}</div>
            <div style={{ maxWidth: 640, margin: '0 auto 18px' }}>{renderEditableText({ blockKey: 'hero.headline', fallback: 'The people behind Tasking.', variant: 'hero' })}</div>
            <div style={{ maxWidth: 520, margin: '0 auto' }}>{renderEditableText({ blockKey: 'hero.subheadline', fallback: 'A multidisciplinary team of six.', variant: 'subhead', multiline: true })}</div>
          </section>
        )}

        {renderSectionWrap('section.team.visible', 'Team Members',
          <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {memberBlocks.map((mb, i) => {
                const n = mb.block_key.replace('member.', '').replace('.name', '')
                const { color, bg } = memberColors[n] ?? { color: '#F97316', bg: '#FEF3C7' }
                const initials = (selectedPage?.blocks ?? []).find(b => b.block_key === `member.${n}.initials`)?.value ?? '?'
                return (
                  <div key={mb.id} draggable onDragStart={() => { dragRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(memberBlocks, dragRef.current ?? i, i)}
                    style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22, position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 14, color: '#CBD5E1', cursor: 'grab' }}>⠿</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingLeft: 18 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: bg, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color }}>{initials}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: 4 }}>{renderEditableText({ blockKey: `member.${n}.name`, fallback: mb.value, placeholder: 'Full name', variant: 'body', styleOverride: { fontWeight: 700 }, hideDirtyBadge: true })}</div>
                        <div>{renderEditableText({ blockKey: `member.${n}.role`, fallback: '', placeholder: 'Role', variant: 'body', styleOverride: { fontSize: 13, color: '#78716C' }, hideDirtyBadge: true })}</div>
                      </div>
                    </div>
                    <div style={{ paddingLeft: 18, marginBottom: 10 }}>{renderEditableText({ blockKey: `member.${n}.desc`, fallback: '', placeholder: 'Description', variant: 'body', multiline: true, hideDirtyBadge: true })}</div>
                    <div style={{ paddingLeft: 18 }}>{renderEditableText({ blockKey: `member.${n}.focus`, fallback: '', placeholder: 'Focus areas (comma-separated)', variant: 'body', styleOverride: { fontSize: 12, color: '#78716C' }, hideDirtyBadge: true })}</div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {renderSectionWrap('section.cta.visible', 'CTA Section',
          <section style={{ background: ORANGE, padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              {renderEditableText({ blockKey: 'cta.headline', fallback: 'Six people. One platform. Built for the businesses that need it most.', variant: 'cta' })}
            </div>
          </section>
        )}
      </div>
    )
  }

  const renderAboutFaqPreview = () => {
    const faqQBlocks = (selectedPage?.blocks ?? []).filter(b => b.block_key.startsWith('faq.') && b.block_key.endsWith('.q')).sort((a, b) => a.sort_order - b.sort_order)
    const dragRef = dragIndexRef
    const nextFaqIdx = faqQBlocks.length > 0 ? Math.max(...faqQBlocks.map(b => parseInt(b.block_key.split('.')[1] ?? '0'))) + 1 : 1

    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>{renderEditableText({ blockKey: 'hero.badge', fallback: 'FAQ', variant: 'badge' })}</div>
            <div style={{ maxWidth: 640, margin: '0 auto 18px' }}>{renderEditableText({ blockKey: 'hero.headline', fallback: 'Questions we get all the time.', variant: 'hero' })}</div>
            <div style={{ maxWidth: 520, margin: '0 auto' }}>{renderEditableText({ blockKey: 'hero.subheadline', fallback: "Honest answers about how Tasking works, what's free, and what to expect.", variant: 'subhead', multiline: true })}</div>
          </section>
        )}

        {renderSectionWrap('section.faq.visible', 'FAQ Items',
          <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {faqQBlocks.map((qb, i) => {
                const n = qb.block_key.replace('faq.', '').replace('.q', '')
                const aKey  = `faq.${n}.a`
                const aBlock = (selectedPage?.blocks ?? []).find(b => b.block_key === aKey)
                const dirty = (drafts[qb.id] ?? '') !== qb.value || (aBlock ? (drafts[aBlock.id] ?? '') !== aBlock.value : false)
                return (
                  <div key={qb.id} draggable onDragStart={() => { dragRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(faqQBlocks, dragRef.current ?? i, i)}
                    style={{ position: 'relative', background: '#FFFFFF', border: `1px solid ${dirty ? ORANGE : BORDER}`, borderRadius: 14, padding: '18px 48px 18px 40px' }}>
                    <span style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', cursor: 'grab', fontSize: 14, color: '#CBD5E1' }}>⠿</span>
                    {dirty && <span style={{ position: 'absolute', top: 8, right: 36, background: ORANGE, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100 }}>Unsaved</span>}
                    <button onClick={() => { deleteBlock(qb.id); if (aBlock) deleteBlock(aBlock.id) }} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 15 }}>🗑</button>
                    <div style={{ marginBottom: 8 }}>{renderEditableText({ blockKey: qb.block_key, fallback: qb.value, placeholder: 'Your question?', variant: 'body', styleOverride: { fontWeight: 600 }, hideDirtyBadge: true })}</div>
                    {aBlock && <div>{renderEditableText({ blockKey: aKey, fallback: aBlock.value, placeholder: 'Type your answer here...', variant: 'body', multiline: true, hideDirtyBadge: true })}</div>}
                  </div>
                )
              })}
            </div>
            <button onClick={() => { createBlock(selectedPage!.id, `faq.${nextFaqIdx}.q`, 'FAQ Question', '', (faqQBlocks[faqQBlocks.length - 1]?.sort_order ?? 0) + 10); createBlock(selectedPage!.id, `faq.${nextFaqIdx}.a`, 'FAQ Answer', '', (faqQBlocks[faqQBlocks.length - 1]?.sort_order ?? 0) + 11) }}
              style={{ marginTop: 14, background: 'none', border: '1px dashed #CBD5E1', borderRadius: 8, padding: '8px 18px', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>+ Add question</button>
          </section>
        )}

        {renderSectionWrap('section.still.visible', 'Still Have Questions',
          <section style={{ background: '#FFFFFF', padding: '48px' }}>
            <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
              <div style={{ marginBottom: 10 }}>{renderEditableText({ blockKey: 'still.headline', fallback: 'Still have questions?', variant: 'sectionTitle' })}</div>
              <div style={{ marginBottom: 20 }}>{renderEditableText({ blockKey: 'still.body', fallback: 'The best way to get answers is to try it. Everything in the core plan is free.', variant: 'body', multiline: true })}</div>
              {renderEditableBtn({ labelKey: 'still.button.label', urlKey: 'still.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '12px 26px', fontSize: 14, fontWeight: 700, cursor: 'pointer' } })}
            </div>
          </section>
        )}
      </div>
    )
  }

  const renderAboutPreview = () => (
    <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      {renderSectionWrap('section.hero.visible', 'Hero Section',
        <section style={{ background: '#1C1C1E', padding: '96px 48px 80px', textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            {renderEditableText({ blockKey: 'hero.badge', fallback: 'About', variant: 'badge' })}
          </div>
          <div style={{ maxWidth: 720, margin: '0 auto 20px' }}>
            {renderEditableText({ blockKey: 'hero.headline', fallback: "Built by people who've seen the chaos firsthand.", variant: 'hero' })}
          </div>
          <div style={{ maxWidth: 580, margin: '0 auto' }}>
            {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Tasking was born out of a simple frustration — watching SMEs struggle with casual workforce management using tools that were never built for them.', variant: 'subhead', multiline: true })}
          </div>
        </section>
      )}

      {renderSectionWrap('section.learn-more.visible', 'Learn More Cards',
        <section style={{ background: '#FFFBF5', padding: '64px 48px', textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}>
            {renderEditableText({ blockKey: 'learn-more.title', fallback: 'Learn more about us', variant: 'sectionTitle' })}
          </div>
          <div style={{ maxWidth: 640, margin: '0 auto 38px' }}>
            {renderEditableText({ blockKey: 'learn-more.subtitle', fallback: 'Everything you need to know about why Tasking exists and the people behind it.', variant: 'body', multiline: true })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, textAlign: 'left' }}>
            {[
              { titleKey: 'learn-more.card.mission.title',  bodyKey: 'learn-more.card.mission.body',  fallbackTitle: 'Mission',            fallbackBody: 'Why we built Tasking and what we stand for.' },
              { titleKey: 'learn-more.card.problem.title',  bodyKey: 'learn-more.card.problem.body',  fallbackTitle: 'Problem & Solution', fallbackBody: 'The real problems SMEs face, and exactly how we fix them.' },
              { titleKey: 'learn-more.card.team.title',     bodyKey: 'learn-more.card.team.body',     fallbackTitle: 'Meet the Team',      fallbackBody: 'The people behind Tasking.' },
              { titleKey: 'learn-more.card.faq.title',      bodyKey: 'learn-more.card.faq.body',      fallbackTitle: 'FAQ',                fallbackBody: 'Answers to the questions we get most often.' },
            ].map(({ titleKey, bodyKey, fallbackTitle, fallbackBody }) => (
              <div key={titleKey} className="card-lift" style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 16, padding: 26 }}>
                <div style={{ marginBottom: 8 }}>{renderEditableText({ blockKey: titleKey, fallback: fallbackTitle, variant: 'cardTitle' })}</div>
                {renderEditableText({ blockKey: bodyKey, fallback: fallbackBody, variant: 'cardBody', multiline: true })}
              </div>
            ))}
          </div>
        </section>
      )}

      {renderSectionWrap('section.cta.visible', 'CTA / Quote Section',
        <section style={{ background: ORANGE, padding: '72px 48px', textAlign: 'center' }}>
          <div style={{ maxWidth: 640, margin: '0 auto 20px', color: '#FFFFFF', fontSize: 30, fontWeight: 700, lineHeight: 1.3, fontFamily: 'var(--font-heading)' }}>
            {renderEditableText({ blockKey: 'cta.quote', fallback: '"We didn\'t build another HR tool. We built the thing SMEs actually needed."', variant: 'cta' })}
          </div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: 600 }}>
            {renderEditableText({ blockKey: 'cta.author', fallback: '— The Tasking Team', variant: 'body' })}
          </p>
        </section>
      )}
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
        {(() => {
          const KEY_DEFAULT_ICONS: Record<string, string> = {
            retail: 'store', food: 'utensils', logistics: 'map-pin',
            events: 'calendar-check', event: 'calendar-check',
          }
          const deriveIcon = (blockKey: string) => {
            for (const [kw, icon] of Object.entries(KEY_DEFAULT_ICONS)) {
              if (blockKey.includes(kw)) return icon
            }
            return 'grid'
          }
          const cardBlocks = (selectedPage?.blocks ?? [])
            .filter(b => b.block_key.startsWith('industries.card.') && !b.block_key.endsWith('.icon'))
            .sort((a, b) => a.sort_order - b.sort_order)
          const maxSort = cardBlocks.length > 0 ? Math.max(...cardBlocks.map(b => b.sort_order)) : 100
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
              {cardBlocks.map((nameBlock) => {
                const iconBlockKey = `${nameBlock.block_key}.icon`
                const currentIconName = blockByKey[iconBlockKey]?.value ?? deriveIcon(nameBlock.block_key)
                return (
                  <div key={nameBlock.id} style={{ background: '#FFFFFF', borderRadius: 16, padding: '32px 20px', border: '1px solid #F0E8D8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative' }}>
                    <button type="button"
                      onClick={() => { deleteBlock(nameBlock.id); const ib = blockByKey[iconBlockKey]; if (ib) deleteBlock(ib.id) }}
                      title="Remove card"
                      style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 3, lineHeight: 1, fontSize: 15, fontWeight: 700 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}
                    >×</button>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: '#FEF3C7', display: 'grid', placeItems: 'center' }}>
                      {renderIconBox(nameBlock.block_key, iconBlockKey, currentIconName, nameBlock.sort_order, 28)}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, fontFamily: 'var(--font-heading)', textAlign: 'center' }}>
                      {renderEditableText({ blockKey: nameBlock.block_key, fallback: 'Industry', variant: 'cardTitle' })}
                    </div>
                  </div>
                )
              })}
              {selectedPage && (
                <button type="button"
                  onClick={async () => {
                    const slug = `item${Date.now()}`
                    await createBlock(selectedPage.id, `industries.card.${slug}`, 'Industry Card', 'New Industry', maxSort + 10)
                  }}
                  style={{ background: 'none', border: '2px dashed #F0E8D8', borderRadius: 16, padding: '32px 20px', cursor: 'pointer', color: '#A8A29E', fontSize: 13, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 140 }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }}>+</span>
                  Add industry
                </button>
              )}
            </div>
          )
        })()}
        <div style={{ marginTop: 32 }}>
          {renderEditableBtn({ labelKey: 'industries.button.label', urlKey: 'industries.button.url', fallbackLabel: 'Explore All Industries', fallbackUrl: '/industries', editing: editingIndustriesBtn, setEditing: setEditingIndustriesBtn, btnStyle: { background: '#FFFFFF', color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' } })}
        </div>
      </section>)}

      {renderSectionWrap('section.cta.visible', 'CTA Banner', renderCtaBtnSection(ORANGE, 'cta.headline', 'cta.subheadline'))}

    </div>
  )

  const renderPricingPreview = () => {
    const freeFeatBlocks = (selectedPage?.blocks ?? []).filter(b => b.block_key.startsWith('plan.free.feature.')).sort((a,b) => a.sort_order - b.sort_order)
    const proFeatBlocks  = (selectedPage?.blocks ?? []).filter(b => b.block_key.startsWith('plan.pro.feature.')).sort((a,b) => a.sort_order - b.sort_order)
    const faqQBlocks     = (selectedPage?.blocks ?? []).filter(b => b.block_key.startsWith('faq.') && b.block_key.endsWith('.q')).sort((a,b) => a.sort_order - b.sort_order)
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>

        {/* Hero */}
        {renderSectionWrap('section.hero.visible', 'Hero',
          <section style={{ background: '#1C1C1E', padding: '56px 48px', textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>{renderEditableText({ blockKey: 'hero.badge', fallback: 'Pricing', variant: 'badge' })}</div>
            <div style={{ maxWidth: 560, margin: '0 auto 14px' }}>{renderEditableText({ blockKey: 'hero.headline', fallback: 'Simple pricing. No surprises.', variant: 'hero', onDarkBg: true })}</div>
            <div style={{ maxWidth: 520, margin: '0 auto' }}>{renderEditableText({ blockKey: 'hero.subheadline', fallback: "Start free. Scale when you're ready.", variant: 'subhead', multiline: true, onDarkBg: true })}</div>
          </section>
        )}

        {/* Plans */}
        {renderSectionWrap('section.plans.visible', 'Pricing Cards',
          <section style={{ background: '#FFFBF5', padding: '48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              {renderEditableText({ blockKey: 'plans.title', fallback: 'Find the plan that fits your team.', variant: 'sectionTitle' })}
              <div style={{ marginTop: 8 }}>{renderEditableText({ blockKey: 'plans.subtitle', fallback: 'Two plans. Zero hidden fees.', variant: 'body', styleOverride: { textAlign: 'center' as const } })}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              {/* Free card */}
              {(() => {
                const nextFreeIdx = freeFeatBlocks.length > 0 ? Math.max(...freeFeatBlocks.map(b => parseInt(b.block_key.split('.').pop() ?? '0'))) + 1 : 1
                const maxFreeOrder = freeFeatBlocks.length > 0 ? Math.max(...freeFeatBlocks.map(b => b.sort_order)) : 20
                return (
                  <div style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 20, padding: '36px 32px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 18, right: 18, background: '#F3F4F6', color: '#6B7280', padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      {renderEditableText({ blockKey: 'plan.free.badge', fallback: 'Free Forever', variant: 'body' })}
                    </span>
                    <div style={{ marginBottom: 10 }}>{renderEditableText({ blockKey: 'plan.free.name', fallback: 'Free', variant: 'sectionTitle' })}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                      {renderEditableText({ blockKey: 'plan.free.price', fallback: '$0', variant: 'hero', styleOverride: { color: '#1C1917', fontSize: 40 } })}
                    </div>
                    <div style={{ marginBottom: 12 }}>{renderEditableText({ blockKey: 'plan.free.pricesub', fallback: 'per month, forever', variant: 'body' })}</div>
                    <div style={{ paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${BORDER}` }}>{renderEditableText({ blockKey: 'plan.free.tagline', fallback: 'Everything you need to get started.', variant: 'body' })}</div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, flex: 1 }}>
                      {freeFeatBlocks.map((fb, i) => (
                        <li key={fb.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(freeFeatBlocks, dragIndexRef.current ?? i, i)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1, flexShrink: 0 }} title="Drag to reorder">⠿</span>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <div style={{ flex: 1 }}>{renderEditableText({ blockKey: fb.block_key, fallback: fb.value, placeholder: 'Type a feature...', variant: 'body' })}</div>
                          <button type="button" onClick={() => deleteBlock(fb.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2, flexShrink: 0, opacity: 0.6 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={() => createBlock(selectedPage!.id, `plan.free.feature.${nextFreeIdx}`, 'Feature', '', maxFreeOrder + 2)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1.5px dashed ${BORDER}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: MUTED, cursor: 'pointer', marginBottom: 20 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add feature
                    </button>
                    {renderEditableBtn({ labelKey: 'plan.free.cta.label', urlKey: 'plan.free.cta.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', textAlign: 'center' as const } })}
                  </div>
                )
              })()}
              {/* Pro card */}
              {(() => {
                const nextProIdx = proFeatBlocks.length > 0 ? Math.max(...proFeatBlocks.map(b => parseInt(b.block_key.split('.').pop() ?? '0'))) + 1 : 1
                const maxProOrder = proFeatBlocks.length > 0 ? Math.max(...proFeatBlocks.map(b => b.sort_order)) : 50
                return (
                  <div style={{ background: '#FFFFFF', border: `2px solid ${ORANGE}`, borderRadius: 20, padding: '36px 32px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 8px 40px rgba(249,115,22,0.12)' }}>
                    <span style={{ position: 'absolute', top: 18, right: 18, background: ORANGE, color: '#FFFFFF', padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      {renderEditableText({ blockKey: 'plan.pro.badge', fallback: 'Most Popular', variant: 'body' })}
                    </span>
                    <div style={{ marginBottom: 10 }}>{renderEditableText({ blockKey: 'plan.pro.name', fallback: 'Pro', variant: 'sectionTitle' })}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                      {renderEditableText({ blockKey: 'plan.pro.price', fallback: '$6', variant: 'hero', styleOverride: { color: ORANGE, fontSize: 40 } })}
                    </div>
                    <div style={{ marginBottom: 12 }}>{renderEditableText({ blockKey: 'plan.pro.pricesub', fallback: 'per user / month', variant: 'body' })}</div>
                    <div style={{ paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${BORDER}` }}>{renderEditableText({ blockKey: 'plan.pro.tagline', fallback: 'For teams that need more control.', variant: 'body' })}</div>
                    <div style={{ marginBottom: 12 }}>{renderEditableText({ blockKey: 'plan.pro.featuresintro', fallback: 'Includes everything in the Free Plan, plus:', variant: 'body', styleOverride: { fontSize: 12, fontWeight: 600, color: '#9CA3AF' } })}</div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, flex: 1 }}>
                      {proFeatBlocks.map((fb, i) => (
                        <li key={fb.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(proFeatBlocks, dragIndexRef.current ?? i, i)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1, flexShrink: 0 }} title="Drag to reorder">⠿</span>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <div style={{ flex: 1 }}>{renderEditableText({ blockKey: fb.block_key, fallback: fb.value, placeholder: 'Type a feature...', variant: 'body' })}</div>
                          <button type="button" onClick={() => deleteBlock(fb.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2, flexShrink: 0, opacity: 0.6 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={() => createBlock(selectedPage!.id, `plan.pro.feature.${nextProIdx}`, 'Feature', '', maxProOrder + 2)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1.5px dashed ${BORDER}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: MUTED, cursor: 'pointer', marginBottom: 20 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add feature
                    </button>
                    {renderEditableBtn({ labelKey: 'plan.pro.cta.label', urlKey: 'plan.pro.cta.url', fallbackLabel: 'Get Started', fallbackUrl: '/get-started', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', textAlign: 'center' as const } })}
                  </div>
                )
              })()}
            </div>
          </section>
        )}

        {/* Comparison table — fully editable */}
        {renderSectionWrap('section.compare.visible', 'Comparison Table',
          <section style={{ background: '#FFFFFF', padding: '48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              {renderEditableText({ blockKey: 'compare.title', fallback: 'Everything side by side.', variant: 'sectionTitle' })}
              <div style={{ marginTop: 8 }}>{renderEditableText({ blockKey: 'compare.subtitle', fallback: "See exactly what's included in each plan.", variant: 'body', styleOverride: { textAlign: 'center' as const } })}</div>
            </div>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {(() => {
              const rowIdxs = (selectedPage?.blocks ?? [])
                .filter(b => b.block_key.startsWith('compare.row.') && b.block_key.endsWith('.type'))
                .sort((a, b) => a.sort_order - b.sort_order)
              const maxOrder = rowIdxs.length > 0 ? Math.max(...rowIdxs.map(b => b.sort_order)) : 180
              const nextIdx = rowIdxs.length > 0 ? Math.max(...rowIdxs.map(b => parseInt(b.block_key.split('.')[2]))) + 1 : 1
              const Tick = ({ val, blockKey }: { val: boolean; blockKey: string }) => {
                const block = blockByKey[blockKey]
                return (
                  <button type="button" title="Click to toggle" onClick={async () => {
                    if (!block || !selectedPage || !adminUserId) return
                    const newVal = val ? 'false' : 'true'
                    await fetch('/api/admin/marketing-pages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_user_id: adminUserId, block_id: block.id, value: newVal }) })
                    setSelectedPage(c => c ? { ...c, blocks: c.blocks.map(b => b.id === block.id ? { ...b, value: newVal } : b) } : c)
                    setDrafts(d => ({ ...d, [block.id]: newVal }))
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: 4, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FFF7ED'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    {val
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <span style={{ color: '#D1D5DB', fontSize: 16, lineHeight: 1 }}>—</span>}
                  </button>
                )
              }
              // Build group buckets: each group = { header: typeBlock | null, rows: typeBlock[] }
              type CompareGroup = { header: typeof rowIdxs[0] | null; rows: typeof rowIdxs }
              const groups: CompareGroup[] = []
              for (const tb of rowIdxs) {
                if (tb.value === 'group') {
                  groups.push({ header: tb, rows: [] })
                } else {
                  if (groups.length === 0) groups.push({ header: null, rows: [] })
                  groups[groups.length - 1].rows.push(tb)
                }
              }

              const reorderGroups = async (fromGrpIdx: number, toGrpIdx: number) => {
                if (fromGrpIdx === toGrpIdx || !adminUserId) return
                const reordered = [...groups]
                const [moved] = reordered.splice(fromGrpIdx, 1)
                reordered.splice(toGrpIdx, 0, moved)
                // Flatten to all typeBlocks in new order
                const flat = reordered.flatMap(g => g.header ? [g.header, ...g.rows] : g.rows)
                const updates = flat.map((b, i) => ({ id: b.id, sort_order: i * 10 }))
                setSelectedPage(current => {
                  if (!current) return current
                  const m: Record<string, number> = {}
                  updates.forEach(u => { m[u.id] = u.sort_order })
                  return { ...current, blocks: current.blocks.map(b => m[b.id] !== undefined ? { ...b, sort_order: m[b.id] } : b) }
                })
                await fetch('/api/admin/marketing-pages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_user_id: adminUserId, updates }) })
              }

              const reorderRowsInGroup = async (grpIdx: number, fromRowIdx: number, toRowIdx: number) => {
                if (fromRowIdx === toRowIdx || !adminUserId) return
                const grp = groups[grpIdx]
                const reordered = [...grp.rows]
                const [moved] = reordered.splice(fromRowIdx, 1)
                reordered.splice(toRowIdx, 0, moved)
                // Only reassign sort_orders for rows in this group; keep header and other groups unchanged
                // Compute base sort_order from the header (or 0) and space rows after it
                const baseOrder = grp.header ? grp.header.sort_order : 0
                const updates = reordered.map((b, i) => ({ id: b.id, sort_order: baseOrder + (i + 1) * 2 }))
                setSelectedPage(current => {
                  if (!current) return current
                  const m: Record<string, number> = {}
                  updates.forEach(u => { m[u.id] = u.sort_order })
                  return { ...current, blocks: current.blocks.map(b => m[b.id] !== undefined ? { ...b, sort_order: m[b.id] } : b) }
                })
                await fetch('/api/admin/marketing-pages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_user_id: adminUserId, updates }) })
              }

              return (
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 80px 32px', background: '#1C1917', padding: '12px 20px' }}>
                    <span />
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Feature</span>
                    <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 13, textAlign: 'center' as const }}>Free</span>
                    <span style={{ color: '#FB923C', fontWeight: 700, fontSize: 13, textAlign: 'center' as const }}>Pro</span>
                    <span />
                  </div>
                  {groups.map((grp, gi) => (
                    <div key={grp.header?.id ?? `ungrouped-${gi}`}>
                      {/* Group header — dragging it moves the whole group */}
                      {grp.header && (() => {
                        const idx = grp.header.block_key.split('.')[2]
                        const labelBlock = blockByKey[`compare.row.${idx}.label`]
                        const isFirstItem = gi === 0 && !grp.header
                        return (
                          <div
                            draggable
                            onDragStart={() => { dragIndexRef.current = gi }}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => reorderGroups(dragIndexRef.current ?? gi, gi)}
                            style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 80px 32px', background: '#F9FAFB', padding: '8px 20px', borderTop: `1px solid ${BORDER}`, alignItems: 'center' }}
                          >
                            <span style={{ cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1 }} title="Drag to move group">⠿</span>
                            <div>{labelBlock && renderEditableText({ blockKey: labelBlock.block_key, fallback: labelBlock.value, placeholder: 'Group name', variant: 'body', styleOverride: { fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.1em' } })}</div>
                            <span /><span />
                            <button type="button" onClick={() => { deleteBlock(grp.header!.id); if (labelBlock) deleteBlock(labelBlock.id); grp.rows.forEach(r => { const ridx = r.block_key.split('.')[2]; ['feature','free','pro'].forEach(k => { const b = blockByKey[`compare.row.${ridx}.${k}`]; if (b) deleteBlock(b.id) }); deleteBlock(r.id) }) }} title="Remove group and its rows" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2, opacity: 0.6 }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          </div>
                        )
                      })()}
                      {/* Rows within this group — dragging reorders within the group only */}
                      {grp.rows.map((typeBlock, ri) => {
                        const idx = typeBlock.block_key.split('.')[2]
                        const featBlock = blockByKey[`compare.row.${idx}.feature`]
                        const freeBlock = blockByKey[`compare.row.${idx}.free`]
                        const proBlock  = blockByKey[`compare.row.${idx}.pro`]
                        const isFree = freeBlock?.value === 'true'
                        const isPro  = proBlock?.value === 'true'
                        return (
                          <div key={typeBlock.id} draggable onDragStart={() => { dragIndexRef.current = ri }} onDragOver={e => e.preventDefault()} onDrop={() => reorderRowsInGroup(gi, dragIndexRef.current ?? ri, ri)} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 80px 32px', padding: '8px 20px', borderTop: `1px solid #F5F0E8`, alignItems: 'center' }}>
                            <span style={{ cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1 }} title="Drag to reorder row">⠿</span>
                            <div>{featBlock && renderEditableText({ blockKey: featBlock.block_key, fallback: featBlock.value, placeholder: 'Feature name', variant: 'body', styleOverride: { fontSize: 13, color: '#374151' } })}</div>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>{freeBlock && <Tick val={isFree} blockKey={freeBlock.block_key} />}</div>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>{proBlock && <Tick val={isPro} blockKey={proBlock.block_key} />}</div>
                            <button type="button" onClick={() => { deleteBlock(typeBlock.id); if (featBlock) deleteBlock(featBlock.id); if (freeBlock) deleteBlock(freeBlock.id); if (proBlock) deleteBlock(proBlock.id) }} title="Remove row" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2, opacity: 0.6 }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  {/* Add buttons */}
                  <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: `1px solid ${BORDER}`, background: '#FAFAF9' }}>
                    <button type="button" onClick={() => { if (!selectedPage) return; createBlock(selectedPage.id, `compare.row.${nextIdx}.type`, 'Type', 'row', maxOrder + 2); createBlock(selectedPage.id, `compare.row.${nextIdx}.feature`, 'Feature', '', maxOrder + 3); createBlock(selectedPage.id, `compare.row.${nextIdx}.free`, 'Free', 'false', maxOrder + 4); createBlock(selectedPage.id, `compare.row.${nextIdx}.pro`, 'Pro', 'true', maxOrder + 5) }} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1.5px dashed ${BORDER}`, borderRadius: 7, padding: '5px 12px', fontSize: 11, color: MUTED, cursor: 'pointer' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add row
                    </button>
                    <button type="button" onClick={() => { if (!selectedPage) return; createBlock(selectedPage.id, `compare.row.${nextIdx}.type`, 'Type', 'group', maxOrder + 2); createBlock(selectedPage.id, `compare.row.${nextIdx}.label`, 'Label', '', maxOrder + 3) }} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1.5px dashed ${BORDER}`, borderRadius: 7, padding: '5px 12px', fontSize: 11, color: MUTED, cursor: 'pointer' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add group header
                    </button>
                  </div>
                </div>
              )
            })()}
            </div>
          </section>
        )}

        {/* FAQ */}
        {renderSectionWrap('section.faq.visible', 'FAQ',
          <section style={{ background: '#FFFBF5', padding: '48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              {renderEditableText({ blockKey: 'faq.title', fallback: 'Pricing questions, answered.', variant: 'sectionTitle' })}
            </div>
            {(() => {
              const maxFaqOrder = faqQBlocks.length > 0 ? Math.max(...faqQBlocks.map(b => b.sort_order)) : 70
              const nextFaqIdx = faqQBlocks.length > 0 ? Math.max(...faqQBlocks.map(b => parseInt(b.block_key.replace('faq.','').replace('.q','')))) + 1 : 1
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640, margin: '0 auto' }}>
                  {faqQBlocks.map((qb, i) => {
                    const idx = qb.block_key.replace('faq.', '').replace('.q', '')
                    const aKey = `faq.${idx}.a`
                    const aBlock = blockByKey[aKey]
                    const dirty = (drafts[qb.id] ?? '') !== qb.value || (aBlock ? (drafts[aBlock.id] ?? '') !== aBlock.value : false)
                    return (
                      <div key={qb.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(faqQBlocks, dragIndexRef.current ?? i, i)} style={{ position: 'relative', background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 44px 16px 36px', cursor: 'default' }}>
                        <span style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1 }} title="Drag to reorder">⠿</span>
                        {dirty && <span style={{ position: 'absolute', top: 8, right: 36, background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '2px 6px', fontSize: 9, fontWeight: 900 }}>Unsaved</span>}
                        <button type="button" onClick={() => { deleteBlock(qb.id); if (aBlock) deleteBlock(aBlock.id) }} title="Remove" style={{ position: 'absolute', top: 12, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2, opacity: 0.6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                        {renderEditableText({ blockKey: qb.block_key, fallback: qb.value, placeholder: 'Your question?', variant: 'body', styleOverride: { fontWeight: 600, color: '#1C1917', marginBottom: 8 }, hideDirtyBadge: true })}
                        {aBlock && renderEditableText({ blockKey: aKey, fallback: aBlock.value, placeholder: 'Type your answer here...', variant: 'body', multiline: true, hideDirtyBadge: true })}
                      </div>
                    )
                  })}
                  <button type="button" onClick={() => { if (!selectedPage) return; createBlock(selectedPage.id, `faq.${nextFaqIdx}.q`, 'Question', '', maxFaqOrder + 2); createBlock(selectedPage.id, `faq.${nextFaqIdx}.a`, 'Answer', '', maxFaqOrder + 3) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1.5px dashed ${BORDER}`, borderRadius: 10, padding: '10px 16px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add question
                  </button>
                </div>
              )
            })()}
          </section>
        )}

        {/* CTA */}
        {renderSectionWrap('section.cta.visible', 'CTA Banner',
          <section style={{ background: ORANGE, padding: '56px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ marginBottom: 12 }}>{renderEditableText({ blockKey: 'cta.headline', fallback: 'Start free. No commitment.', variant: 'hero', styleOverride: { color: '#FFFFFF' }, onDarkBg: true })}</div>
              <div style={{ marginBottom: 28 }}>{renderEditableText({ blockKey: 'cta.subheadline', fallback: 'Join SMEs already using Tasking.', variant: 'subhead', multiline: true, styleOverride: { color: 'rgba(255,255,255,0.85)' }, onDarkBg: true })}</div>
              {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
              <div style={{ marginTop: 16 }}>{renderEditableText({ blockKey: 'cta.footnote', fallback: 'No credit card required. Cancel anytime.', variant: 'body', styleOverride: { color: 'rgba(255,255,255,0.7)', fontSize: 13 }, onDarkBg: true })}</div>
            </div>
          </section>
        )}

      </div>
    )
  }

  if (!authChecked) return null

  const dirtyBlocks = selectedPage?.blocks.filter(block => (drafts[block.id] ?? '') !== block.value) ?? []
  return (
  <>
    <main style={{ minHeight: '100vh', background: '#27272A', color: TEXT, fontFamily: 'Inter, system-ui, sans-serif' }}>
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

      <section style={{ marginLeft: 64, padding: '35px 32px 44px', background: 'transparent' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
          <div>
            <p style={{ margin: '0 0 6px', color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 34, lineHeight: 1.1, fontWeight: 800, color: '#F1F5F9' }}>
              Marketing Live Editor
            </h1>
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
          <section style={{ background: 'rgba(255,255,255,0.92)', border: `1px solid ${BORDER}`, borderRadius: 20, minHeight: 720, overflow: 'hidden', boxShadow: '0 8px 32px rgba(15,23,42,0.14)' }}>
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
                <>{selectedPage.slug === 'home' ? renderHomePreview() : selectedPage.slug === 'products' ? renderProductsPreview() : selectedPage.slug === 'about' ? renderAboutPreview() : selectedPage.slug === 'pricing' ? renderPricingPreview() : selectedPage.slug === 'products-ai-features' ? renderAiFeaturesPreview() : selectedPage.slug === 'products-recruitment' ? renderRecruitmentPreview() : selectedPage.slug === 'products-attendance' ? renderAttendancePreview() : selectedPage.slug === 'products-smart-notifications' ? renderSmartNotificationsPreview() : selectedPage.slug === 'products-team-management' ? renderTeamManagementPreview() : selectedPage.slug === 'industries' ? renderIndustriesPreview() : selectedPage.slug === 'about-mission' ? renderAboutMissionPreview() : selectedPage.slug === 'about-problem-solution' ? renderAboutProblemSolutionPreview() : selectedPage.slug === 'about-team' ? renderAboutTeamPreview() : selectedPage.slug === 'about-faq' ? renderAboutFaqPreview() : renderGenericPreview()}</>

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
    {renderIconPickerOverlay()}
  </>
  )
}
