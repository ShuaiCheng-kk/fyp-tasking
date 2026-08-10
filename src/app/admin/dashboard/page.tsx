'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Check, ChevronDown, ExternalLink, FileText, ImagePlus, RefreshCcw, Save, Trash2 } from 'lucide-react'
import AdminSidebar from '@/components/AdminSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { MarketingContentBlock, MarketingPage, MarketingPageSummary } from '@/types/MarketingPage'
import { useAuthGuard } from '@/hooks/useAuthGuard'
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
  useAuthGuard()
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
  // Stale-while-revalidate cache so switching back to an already-visited page shows
  // instantly (no loading flash) instead of refetching from scratch every click.
  const pageCacheRef = useRef<Record<string, MarketingPage>>({})
  const [savingBlockId, setSavingBlockId] = useState('')
  const [uploadingBlockId, setUploadingBlockId] = useState('')
  const [editingCtaBtn, setEditingCtaBtn] = useState(false)
  const [editingProductsBtn, setEditingProductsBtn] = useState(false)
  const [iconPickerTarget, setIconPickerTarget] = useState<{ cardKey: string; iconBlockKey: string; sortOrder: number; anchorLeft: number; anchorRight: number; anchorBottom: number; anchorTop: number } | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [pageSwitcherOpen, setPageSwitcherOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageTargetBlock = useRef<MarketingContentBlock | null>(null)
  const pageSwitcherRef = useRef<HTMLDivElement>(null)

  // Page picker now lives next to the editor title instead of as a sidebar tree.
  const PRODUCTS_ORDER = ['products-shift-management', 'products-task-management', 'products-team-management', 'products-communication', 'products-recruitment', 'products-attendance', 'products-reports-insights']
  const pageSwitcherGroups = useMemo(() => {
    const bySlug = (slug: string) => pages.find(p => p.slug === slug) ?? null
    return [
      { parent: bySlug('home'), subs: [] as MarketingPageSummary[] },
      { parent: bySlug('products'), subs: PRODUCTS_ORDER.map(bySlug).filter(Boolean) as MarketingPageSummary[] },
      { parent: bySlug('industries'), subs: [] as MarketingPageSummary[] },
      { parent: bySlug('pricing'), subs: [] as MarketingPageSummary[] },
    ].filter(g => g.parent) as { parent: MarketingPageSummary; subs: MarketingPageSummary[] }[]
  }, [pages])

  useEffect(() => {
    if (!pageSwitcherOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (pageSwitcherRef.current && !pageSwitcherRef.current.contains(e.target as Node)) {
        setPageSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [pageSwitcherOpen])

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
    if (selectedSlug) localStorage.setItem('admin_selected_slug', selectedSlug)
  }, [selectedSlug])

  useEffect(() => {
    if (!adminUserId) return
    fetch(`/api/user/me?user_id=${adminUserId}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setUserName(d.user.full_name ?? ''); setUserPhoto(d.user.profile_photo_url ?? null) } })
      .catch(() => {})
  }, [adminUserId])

  const loadPages = useCallback(async (adminId: string) => {
    setLoadingPages(true)
    setError('')
    try {
      const res = await fetch(`/api/marketingadmin/pages?admin_user_id=${encodeURIComponent(adminId)}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      const nextPages = (data.pages ?? []) as MarketingPageSummary[]
      setPages(nextPages)
      // `current` may be a stale slug left over in localStorage from a page that no longer
      // exists (e.g. a retired page) — fall back to home/first instead of trying to load it.
      setSelectedSlug(current =>
        (current && nextPages.some(page => page.slug === current))
          ? current
          : nextPages.find(page => page.slug === 'home')?.slug || nextPages[0]?.slug || ''
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketing pages')
    } finally {
      setLoadingPages(false)
    }
  }, [])

  useEffect(() => {
    if (!adminUserId) return
    loadPages(adminUserId)
  }, [adminUserId, loadPages])

  // Platform-wide (no company scope) realtime — only refreshes the page LIST (sidebar), never
  // the currently-open page's content/drafts: another Marketing Admin renaming/adding/removing a
  // page shows up live, but this never silently overwrites text this admin is mid-typing in the
  // open page's editor (see loadPage below, which owns `drafts` and only runs on slug change).
  useEffect(() => {
    if (!adminUserId) return
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const channel = supabase
      .channel('marketingadmin-pages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_pages' }, () => loadPages(adminUserId))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [adminUserId, loadPages])


  useEffect(() => {
    if (!adminUserId || !selectedSlug) return

    const loadPage = async () => {
      setEditingBlockId('')
      setEditingCtaBtn(false)
      setEditingProductsBtn(false)
      setError('')
      setNotice('')

      const cached = pageCacheRef.current[selectedSlug]
      if (cached) {
        // Already visited this page — show it instantly, then quietly refresh in the background.
        setSelectedPage(cached)
        setDrafts(buildBlockMap(cached))
      } else {
        setLoadingPage(true)
      }

      try {
        const params = new URLSearchParams({ admin_user_id: adminUserId, slug: selectedSlug })
        const res = await fetch(`/api/marketingadmin/pages?${params.toString()}`)
        const data = await res.json()
        if (!data.success) throw new Error(data.message)
        const page = data.page as MarketingPage
        pageCacheRef.current[selectedSlug] = page
        setSelectedPage(page)
        setDrafts(buildBlockMap(page))
      } catch (err) {
        if (!cached) {
          setSelectedPage(null)
          setDrafts({})
          setError(err instanceof Error ? err.message : 'Failed to load page content')
        }
      } finally {
        setLoadingPage(false)
      }
    }

    loadPage()
  }, [adminUserId, selectedSlug])

  // Keep the cache in sync with every edit (save/create/delete/reorder block etc.) so
  // switching away and back never shows a stale pre-edit version from the cache.
  useEffect(() => {
    if (selectedPage) pageCacheRef.current[selectedPage.slug] = selectedPage
  }, [selectedPage])

  const saveBlock = async (block: MarketingContentBlock) => {
    if (!adminUserId) return
    setSavingBlockId(block.id)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/marketingadmin/pages', {
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
      const res = await fetch('/api/marketingadmin/blocks', {
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
      const res = await fetch(`/api/marketingadmin/blocks?admin_user_id=${adminUserId}&id=${block_id}`, { method: 'DELETE' })
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
    await fetch('/api/marketingadmin/pages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_user_id: adminUserId, updates }),
    })
  }

  const setIconBlock = async (iconBlockKey: string, iconName: string, sortOrder: number) => {
    if (!selectedPage || !adminUserId) return
    const existing = blockByKey[iconBlockKey]
    if (existing) {
      await fetch('/api/marketingadmin/pages', {
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
      const formData = new FormData()
      formData.append('admin_user_id', adminUserId)
      formData.append('block_key', block.block_key)
      formData.append('file', file)
      const uploadRes = await fetch('/api/marketingadmin/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadData.success) throw new Error(uploadData.message)

      const res = await fetch('/api/marketingadmin/pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_user_id: adminUserId, block_id: block.id, value: uploadData.publicUrl }),
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
      const formData = new FormData()
      formData.append('admin_user_id', adminUserId)
      formData.append('block_key', block.block_key)
      formData.append('file', file)
      const uploadRes = await fetch('/api/marketingadmin/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadData.success) throw new Error(uploadData.message)

      const res = await fetch('/api/marketingadmin/pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_user_id: adminUserId, block_id: block.id, value: uploadData.publicUrl }),
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
                const res = await fetch('/api/marketingadmin/pages', {
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
      // No content_block row exists for this key yet (it's been rendering from the code-level
      // fallback only) — clicking creates the row with the fallback as its starting value, then
      // drops straight into edit mode, instead of being permanently inert.
      return (
        <span
          tabIndex={0}
          role="button"
          title="Click to edit"
          onClick={async () => {
            if (!selectedPage) return
            const newBlock = await createBlock(selectedPage.id, blockKey, blockKey, fallback, (selectedPage.blocks?.length ?? 0) + 1)
            if (newBlock) setEditingBlockId(newBlock.id)
          }}
          onKeyDown={async (event) => {
            if (event.key !== 'Enter' || !selectedPage) return
            const newBlock = await createBlock(selectedPage.id, blockKey, blockKey, fallback, (selectedPage.blocks?.length ?? 0) + 1)
            if (newBlock) setEditingBlockId(newBlock.id)
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
          style={{ ...baseStyle, ...mergedTextStyle, cursor: 'text' }}
        >
          {value}
        </span>
      )
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
    fetch('/api/marketingadmin/pages', {
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
      const res = await fetch('/api/marketingadmin/pages', {
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
          onClick={async () => {
            if (!editing && selectedPage) {
              // Neither block exists yet (button has only ever shown its code fallback) — create
              // both now, seeded with the fallback values, so the popover below always has
              // something real to edit instead of staying permanently empty.
              if (!labelBlock) await createBlock(selectedPage.id, labelKey, labelKey, fallbackLabel, (selectedPage.blocks?.length ?? 0) + 1)
              if (!urlBlock) await createBlock(selectedPage.id, urlKey, urlKey, fallbackUrl, (selectedPage.blocks?.length ?? 0) + 2)
            }
            setEditing(!editing)
          }}
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

  const renderCtaBtnSection = (
    bgColor: string,
    headlineKey: string,
    subheadlineKey: string,
    fallbackHeadline = 'Ready to simplify your workforce?',
    fallbackSubheadline = 'Join SMEs already using Tasking to hire smarter, schedule faster, and track with confidence.',
  ) => {
    return (
      <section style={{ background: bgColor, padding: '62px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: headlineKey, fallback: fallbackHeadline, variant: 'cta', onDarkBg: true })}
        <div style={{ height: 16 }} />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {renderEditableText({ blockKey: subheadlineKey, fallback: fallbackSubheadline, variant: 'subhead', multiline: true, onDarkBg: true })}
        </div>
        <div style={{ height: 32 }} />
        {renderEditableBtn({
          labelKey: 'cta.button.label', urlKey: 'cta.button.url',
          fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started',
          editing: editingCtaBtn, setEditing: setEditingCtaBtn,
          btnStyle: { background: '#FFFFFF', color: ORANGE, borderRadius: 12, padding: '13px 32px', fontSize: 15, fontWeight: 800, cursor: 'pointer' },
        })}
      </section>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shared building blocks for the 7 Feature/Products pages (Shift Management,
  // Task Management, Company Management, Communication, Recruitment, Attendance,
  // Reports & Insights) — all 7 share the identical live-page structure: a dark
  // hero (badge, headline, button, hero video), a features carousel (icon,
  // name, desc, 3 checklist points), and either a 4-step "How It Works" or (Company
  // Management only) a role-breakdown section. No subheadline, no CTA section —
  // both were removed from every one of these 7 live pages.
  // ─────────────────────────────────────────────────────────────────────────

  const renderHeroVideoBlock = (videoBlockKey: string) => {
    const vBlock = blockByKey[videoBlockKey] ?? null
    const vUrl = vBlock ? (drafts[vBlock.id] ?? vBlock.value) : ''
    const vUploading = vBlock ? uploadingBlockId === vBlock.id : false
    return (
      <div
        style={{ maxWidth: 640, margin: '32px auto 0', borderRadius: 16, overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.15)', position: 'relative', cursor: 'pointer', minHeight: 260 }}
        onClick={async () => {
          // vBlock is missing when this page's content-block row was never seeded — create it
          // on the fly instead of silently no-oping the click.
          const target = vBlock ?? (selectedPage ? await createBlock(selectedPage.id, videoBlockKey, 'Hero Video URL', '', 100) : null)
          if (target) { videoTargetBlock.current = target; videoInputRef.current?.click() }
        }}
        onMouseEnter={e => { const ov = e.currentTarget.querySelector('.vid-overlay') as HTMLElement | null; if (ov) ov.style.opacity = '1' }}
        onMouseLeave={e => { const ov = e.currentTarget.querySelector('.vid-overlay') as HTMLElement | null; if (ov) ov.style.opacity = '0' }}
      >
        {vUrl ? (
          <video width="100%" controls muted loop playsInline style={{ display: 'block' }}>
            <source src={vUrl} />
          </video>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260, gap: 12, color: 'rgba(255,255,255,0.4)', padding: 24 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Click to upload hero video</span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>16:9 recommended</span>
          </div>
        )}
        <div className="vid-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0, transition: 'opacity 0.18s', pointerEvents: 'none' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>{vUploading ? 'Uploading…' : vUrl ? 'Replace Video' : 'Upload Video'}</span>
        </div>
      </div>
    )
  }

  const renderProductHero = (opts: { badgeFallback: string; headlineFallback: string; videoBlockKey: string }) => (
    <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
      <div style={{ marginBottom: 20 }}>
        {renderEditableText({ blockKey: 'hero.badge', fallback: opts.badgeFallback, variant: 'badge' })}
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto 28px' }}>
        {renderEditableText({ blockKey: 'hero.headline', fallback: opts.headlineFallback, variant: 'hero' })}
      </div>
      {renderEditableBtn({ labelKey: 'hero.button.label', urlKey: 'hero.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
      {renderHeroVideoBlock(opts.videoBlockKey)}
    </section>
  )

  const renderProductFeaturesSection = (fallbackTitle: string, fallbackSubtitle: string) => {
    const featureBlocks = (selectedPage?.blocks ?? [])
      .filter(b => b.block_key.startsWith('feature.') && b.block_key.endsWith('.name'))
      .sort((a, b) => a.sort_order - b.sort_order)
    return (
      <section style={{ background: '#FFFBF5', padding: '56px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ marginBottom: 10 }}>
            {renderEditableText({ blockKey: 'features.title', fallback: fallbackTitle, variant: 'sectionTitle' })}
          </div>
          {renderEditableText({ blockKey: 'features.subtitle', fallback: fallbackSubtitle, variant: 'body', styleOverride: { textAlign: 'center' as const } })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 18 }}>
          {featureBlocks.map((nameBlock, i) => {
            const idx = nameBlock.block_key.replace('feature.', '').replace('.name', '')
            const descKey = `feature.${idx}.desc`
            const iconKey = `feature.${idx}.icon`
            const p1Key = `feature.${idx}.point1`
            const p2Key = `feature.${idx}.point2`
            const p3Key = `feature.${idx}.point3`
            const descBlock = blockByKey[descKey]
            const cardDirty = (drafts[nameBlock.id] ?? '') !== nameBlock.value || (descBlock ? (drafts[descBlock.id] ?? '') !== descBlock.value : false)
            return (
              <div key={nameBlock.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(featureBlocks, dragIndexRef.current ?? i, i)} style={{ position: 'relative', background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 16, padding: 24 }}>
                <span style={{ position: 'absolute', top: 10, left: 10, cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1 }} title="Drag to reorder">⠿</span>
                {cardDirty && <span style={{ position: 'absolute', top: 36, right: 8, background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, zIndex: 2 }}>Unsaved</span>}
                <button
                  type="button"
                  onClick={() => {
                    deleteBlock(nameBlock.id)
                    if (descBlock) deleteBlock(descBlock.id)
                    const iconBlock = blockByKey[iconKey]; if (iconBlock) deleteBlock(iconBlock.id)
                    const p1 = blockByKey[p1Key]; if (p1) deleteBlock(p1.id)
                    const p2 = blockByKey[p2Key]; if (p2) deleteBlock(p2.id)
                    const p3 = blockByKey[p3Key]; if (p3) deleteBlock(p3.id)
                  }}
                  title="Remove feature card"
                  style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, lineHeight: 1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
                <div style={{ width: 44, height: 44, background: '#FEF3C7', borderRadius: 11, display: 'grid', placeItems: 'center', marginBottom: 14, position: 'relative' }}>
                  {renderIconBox(nameBlock.block_key, iconKey, blockByKey[iconKey]?.value ?? null, nameBlock.sort_order - 1)}
                </div>
                <div style={{ marginBottom: 8 }}>
                  {renderEditableText({ blockKey: nameBlock.block_key, fallback: 'Feature name', variant: 'cardTitle', styleOverride: { fontSize: 15, fontWeight: 600, color: '#1C1917' }, hideDirtyBadge: true })}
                </div>
                <div style={{ marginBottom: 12 }}>
                  {renderEditableText({ blockKey: descKey, fallback: 'Feature description', variant: 'cardBody', multiline: true, styleOverride: { fontSize: 14, lineHeight: 1.7 }, hideDirtyBadge: true })}
                </div>
                <div style={{ borderTop: '1px solid #F0E8D8', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Checklist points</p>
                  {[p1Key, p2Key, p3Key].map(pk => (
                    <div key={pk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: ORANGE, fontSize: 12, flexShrink: 0 }}>✓</span>
                      {renderEditableText({ blockKey: pk, fallback: '', placeholder: 'Add a point…', variant: 'cardBody', styleOverride: { fontSize: 13 }, hideDirtyBadge: true })}
                    </div>
                  ))}
                </div>
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
              await createBlock(selectedPage.id, `feature.${nextIdx}.icon`, `Feature ${nextIdx} Icon`, 'star', maxSort + 3)
              await createBlock(selectedPage.id, `feature.${nextIdx}.point1`, `Feature ${nextIdx} Point 1`, '', maxSort + 4)
              await createBlock(selectedPage.id, `feature.${nextIdx}.point2`, `Feature ${nextIdx} Point 2`, '', maxSort + 5)
              await createBlock(selectedPage.id, `feature.${nextIdx}.point3`, `Feature ${nextIdx} Point 3`, '', maxSort + 6)
            }}
            style={{ background: 'none', border: '2px dashed #F0E8D8', borderRadius: 16, padding: 24, cursor: 'pointer', color: '#A8A29E', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 120 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add feature card
          </button>
        </div>
      </section>
    )
  }

  const renderProductWorkflowSection = (
    fallbackTitle: string,
    fallbackSubtitle: string,
    steps: { step: string; titleKey: string; descKey: string; defaultTitle: string; defaultDesc: string }[],
  ) => (
    <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{ marginBottom: 12 }}>
          {renderEditableText({ blockKey: 'workflow.title', fallback: fallbackTitle, variant: 'sectionTitle' })}
        </div>
        {renderEditableText({ blockKey: 'workflow.subtitle', fallback: fallbackSubtitle, variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const } })}
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
  )

  const renderRecruitmentPreview = () => {
    const steps = [
      { step: '01', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Post',    defaultDesc: 'Publish your job opening to the public recruitment page. Casual workers and applicants can browse and apply instantly.' },
      { step: '02', titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Review',  defaultDesc: 'See every applicant ranked by AI recommendation. Skills, availability, and work history, all surfaced automatically.' },
      { step: '03', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Invite',  defaultDesc: "Select your candidate and send the invitation. It stays open until the shift starts, first to accept wins." },
      { step: '04', titleKey: 'workflow.step4.title', descKey: 'workflow.step4.desc', defaultTitle: 'Confirm', defaultDesc: 'Candidate accepts, job closes, worker is assigned to the shift. Done.' },
    ]
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {renderSectionWrap('section.hero.visible', 'Hero Section', renderProductHero({ badgeFallback: 'Recruitment', headlineFallback: 'Find the right people. Fast.', videoBlockKey: 'hero.video' }))}
        {renderSectionWrap('section.intro.visible', 'Features Grid', renderProductFeaturesSection('Everything you need to hire casual workers', 'Every feature in this module exists because SMEs asked for it.'))}
        {renderSectionWrap('section.content.visible', 'Workflow Steps', renderProductWorkflowSection('From open role to confirmed hire in four steps.', 'A complete hiring flow, built specifically for casual workforce management.', steps))}
      </div>
    )
  }

  const renderAttendancePreview = () => {
    const steps = [
      { step: '01', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Clock In',           defaultDesc: "Clock in within 30 minutes of the shift's start, tracked as Present or Late automatically." },
      { step: '02', titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Break',              defaultDesc: 'Start and end one break mid-shift whenever needed, no fixed window required.' },
      { step: '03', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Clock Out',          defaultDesc: 'Clock out once the shift ends, or once your supervisor releases you on an open-ended job.' },
      { step: '04', titleKey: 'workflow.step4.title', descKey: 'workflow.step4.desc', defaultTitle: 'Request & Review',   defaultDesc: 'Submit a swap or day-off request; the right approver decides, Manager or Owner/Partner.' },
    ]
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {renderSectionWrap('section.hero.visible', 'Hero Section', renderProductHero({ badgeFallback: 'Attendance', headlineFallback: 'Clock in and out, without the paperwork.', videoBlockKey: 'hero.video' }))}
        {renderSectionWrap('section.intro.visible', 'Features Grid', renderProductFeaturesSection('Everything you need to track attendance', 'From clocking in to correcting a record after the fact.'))}
        {renderSectionWrap('section.content.visible', 'Workflow Steps', renderProductWorkflowSection('From clocking in to a corrected record.', 'A complete attendance flow, with the right approver for every request.', steps))}
      </div>
    )
  }

  const renderTeamManagementPreview = () => {
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
        {renderSectionWrap('section.hero.visible', 'Hero Section', renderProductHero({ badgeFallback: 'Company Management', headlineFallback: 'Your company structure, exactly how you need it.', videoBlockKey: 'hero.video' }))}
        {renderSectionWrap('section.intro.visible', 'Features Grid', renderProductFeaturesSection('Everything you need to run your organisation', 'Structure, permissions, and access, all in one place.'))}

        {/* Roles */}
        {renderSectionWrap('section.content.visible', 'Role Breakdown',
          <section style={{ background: '#FFFFFF', padding: '56px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ marginBottom: 10 }}>
                {renderEditableText({ blockKey: 'roles.title', fallback: 'The right access for every role.', variant: 'sectionTitle' })}
              </div>
              {renderEditableText({ blockKey: 'roles.subtitle', fallback: 'Tasking is built around five roles, each with exactly the visibility and control they need, nothing more.', variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const } })}
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
      </div>
    )
  }

  const renderShiftManagementPreview = () => {
    const steps = [
      { step: '01', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Build',   defaultDesc: 'Start from scratch, reuse a template, split, or set recurring rules.' },
      { step: '02', titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Assign',  defaultDesc: 'Assign shifts to Managers and Employees on the timeline or calendar.' },
      { step: '03', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Publish', defaultDesc: 'One click turns the draft into an official schedule staff can see instantly.' },
      { step: '04', titleKey: 'workflow.step4.title', descKey: 'workflow.step4.desc', defaultTitle: 'Optimise', defaultDesc: 'Run an AI suggestion or bulk-edit shifts whenever plans change.' },
    ]
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {renderSectionWrap('section.hero.visible', 'Hero Section', renderProductHero({ badgeFallback: 'Shift Management', headlineFallback: 'Build the schedule your team can actually see.', videoBlockKey: 'hero.video' }))}
        {renderSectionWrap('section.intro.visible', 'Features Grid', renderProductFeaturesSection('Everything you need to run the schedule', 'From building the first draft to publishing the final version.'))}
        {renderSectionWrap('section.content.visible', 'Workflow Steps', renderProductWorkflowSection('From a blank week to a published schedule.', 'A complete scheduling flow, built for departments with shifting availability.', steps))}
      </div>
    )
  }

  const renderTaskManagementPreview = () => {
    const steps = [
      { step: '01', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Assign',     defaultDesc: 'Create a task and assign it one level down, from Owner to Manager to Employee to Casual Worker.' },
      { step: '02', titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Break Down', defaultDesc: 'Split the task into sub-tasks, with an order the assignee has to follow if one is set.' },
      { step: '03', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Track',      defaultDesc: 'Watch tasks move from Assigned to In Progress to Done on the board, in real time.' },
      { step: '04', titleKey: 'workflow.step4.title', descKey: 'workflow.step4.desc', defaultTitle: 'Rebalance',  defaultDesc: 'Let AI flag an overloaded assignee and reassign one of their tasks in a single click.' },
    ]
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {renderSectionWrap('section.hero.visible', 'Hero Section', renderProductHero({ badgeFallback: 'Task Management', headlineFallback: 'Assign work. Track it. Never lose sight of it.', videoBlockKey: 'hero.video' }))}
        {renderSectionWrap('section.intro.visible', 'Features Grid', renderProductFeaturesSection('Everything you need to get work done', 'From assigning the first task to catching an overloaded team member.'))}
        {renderSectionWrap('section.content.visible', 'Workflow Steps', renderProductWorkflowSection('From assigned to done, fully tracked.', 'A complete task flow, with AI watching for imbalances.', steps))}
      </div>
    )
  }

  const renderCommunicationPreview = () => {
    const steps = [
      { step: '01', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Post',         defaultDesc: 'Share an announcement company-wide or to a single department.' },
      { step: '02', titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Reach',        defaultDesc: 'The right audience sees it instantly, scoped to their role and department.' },
      { step: '03', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Message',      defaultDesc: "Start a direct conversation with anyone in your role's contact scope." },
      { step: '04', titleKey: 'workflow.step4.title', descKey: 'workflow.step4.desc', defaultTitle: 'Stay Updated', defaultDesc: 'Edit or delete your own posts anytime, with every conversation kept in one place.' },
    ]
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {renderSectionWrap('section.hero.visible', 'Hero Section', renderProductHero({ badgeFallback: 'Communication', headlineFallback: 'Keep everyone in the loop. In one place.', videoBlockKey: 'hero.video' }))}
        {renderSectionWrap('section.intro.visible', 'Features Grid', renderProductFeaturesSection('Everything you need to keep your team in sync', 'One module for announcements and direct messages, not two separate tools.'))}
        {renderSectionWrap('section.content.visible', 'Workflow Steps', renderProductWorkflowSection('From a quick update to a real conversation.', 'Announcements and messaging, scoped correctly for every role.', steps))}
      </div>
    )
  }

  const renderReportsInsightsPreview = () => {
    const steps = [
      { step: '01', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Select',      defaultDesc: 'Choose a date range and, if you need it, a department filter.' },
      { step: '02', titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Review',      defaultDesc: 'See the overview, department breakdown, workload, and casual worker sections instantly.' },
      { step: '03', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Investigate', defaultDesc: "Let AI surface anomalies your charts structurally can't show on their own." },
      { step: '04', titleKey: 'workflow.step4.title', descKey: 'workflow.step4.desc', defaultTitle: 'Export',      defaultDesc: 'Download the complete report as a PDF, every chart turned into a data table.' },
    ]
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {renderSectionWrap('section.hero.visible', 'Hero Section', renderProductHero({ badgeFallback: 'Reports & Insights', headlineFallback: 'Turn workforce data into decisions.', videoBlockKey: 'hero.video' }))}
        {renderSectionWrap('section.intro.visible', 'Features Grid', renderProductFeaturesSection('Everything you need to understand your workforce', "Every figure compared against the period before it, plus AI to catch what the charts can't."))}
        {renderSectionWrap('section.content.visible', 'Workflow Steps', renderProductWorkflowSection('From raw activity to a report you can share.', 'A complete reporting flow, from filtering the data to exporting it.', steps))}
      </div>
    )
  }

  const renderIndustriesPreview = () => {
    const industryBlocks = (selectedPage?.blocks ?? [])
      .filter(b => b.block_key.startsWith('industry.') && b.block_key.endsWith('.badge'))
      .sort((a, b) => a.sort_order - b.sort_order)

    return (
      <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>

        {/* Hero */}
        {renderSectionWrap('section.hero.visible', 'Hero Section',
          <section style={{ background: '#1C1C1E', padding: '72px 48px 64px', textAlign: 'center' }}>
            <div style={{ maxWidth: 620, margin: '0 auto 18px' }}>
              {renderEditableText({ blockKey: 'hero.headline', fallback: 'One platform. Every industry.', variant: 'hero' })}
            </div>
            <div style={{ maxWidth: 560, margin: '0 auto 32px' }}>
              {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Whether you run a café, a retail chain, or a construction firm, Tasking gives you the tools to manage your team and casual workforce with confidence.', variant: 'subhead', multiline: true })}
            </div>
            {renderEditableBtn({ labelKey: 'hero.button.label', urlKey: 'hero.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingProductsBtn, setEditing: setEditingProductsBtn, btnStyle: { background: ORANGE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
          </section>
        )}

        {/* Industries */}
        {renderSectionWrap('section.content.visible', 'Industries',
          <section style={{ background: '#FFFBF5', padding: '32px 48px 56px' }}>
            {industryBlocks.map((badgeBlock, i) => {
              const idx = badgeBlock.block_key.replace('industry.', '').replace('.badge', '')
              const statementKey = `industry.${idx}.statement`
              const imageKey = `industry.${idx}.image`
              const stepTitleBlocks = (selectedPage?.blocks ?? [])
                .filter(b => b.block_key.startsWith(`industry.${idx}.step`) && b.block_key.endsWith('.title'))
                .sort((a, b) => a.sort_order - b.sort_order)
              const stepNums = stepTitleBlocks.map(b => b.block_key.slice(`industry.${idx}.step`.length, -'.title'.length))
              const isEven = i % 2 === 0
              const relatedBlocks = [
                badgeBlock,
                blockByKey[statementKey],
                blockByKey[imageKey],
                ...stepNums.flatMap(n => [blockByKey[`industry.${idx}.step${n}.title`], blockByKey[`industry.${idx}.step${n}.desc`]]),
              ].filter(Boolean) as typeof badgeBlock[]
              const cardDirty = relatedBlocks.some(b => (drafts[b.id] ?? '') !== b.value)
              const nextStepNum = stepNums.length ? Math.max(...stepNums.map(n => parseInt(n) || 0)) + 1 : 1
              return (
                <div key={badgeBlock.id} draggable onDragStart={() => { dragIndexRef.current = i }} onDragOver={e => e.preventDefault()} onDrop={() => reorderBlocks(industryBlocks, dragIndexRef.current ?? i, i)} style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', top: 18, left: 0, cursor: 'grab', color: MUTED, fontSize: 14, lineHeight: 1, zIndex: 2 }} title="Drag to reorder">⠿</span>
                  {cardDirty && <span style={{ position: 'absolute', top: 16, right: 40, background: ORANGE, color: '#FFFFFF', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, zIndex: 2 }}>Unsaved</span>}
                  <button type="button" onClick={() => relatedBlocks.forEach(b => deleteBlock(b.id))} title="Remove industry" style={{ position: 'absolute', top: 16, right: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, lineHeight: 1, zIndex: 2 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                  <div style={{ display: 'flex', flexDirection: isEven ? 'row' : 'row-reverse', gap: 48, alignItems: 'flex-start', padding: '40px 0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: 16 }}>
                        {renderEditableText({ blockKey: badgeBlock.block_key, fallback: 'Industry', variant: 'badge', styleOverride: { background: '#FEF3C7', color: '#92400E', fontSize: 13 }, hideDirtyBadge: true })}
                      </div>
                      <div style={{ marginBottom: 20 }}>
                        {renderEditableText({ blockKey: statementKey, fallback: 'What problem does Tasking solve for this industry?', variant: 'sectionTitle', styleOverride: { fontSize: 22, textAlign: 'left' as const }, hideDirtyBadge: true })}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {stepNums.map((n, si) => {
                          const titleKey = `industry.${idx}.step${n}.title`
                          const descKey = `industry.${idx}.step${n}.desc`
                          return (
                            <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative' }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#FEF3C7', border: `1.5px solid ${ORANGE}`, color: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12, marginTop: 2 }}>
                                {si + 1}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ marginBottom: 4 }}>
                                  {renderEditableText({ blockKey: titleKey, fallback: 'Step title', variant: 'cardTitle', styleOverride: { fontSize: 15 }, hideDirtyBadge: true })}
                                </div>
                                {renderEditableText({ blockKey: descKey, fallback: 'Step description', variant: 'cardBody', multiline: true, styleOverride: { fontSize: 13 }, hideDirtyBadge: true })}
                              </div>
                              <button type="button" onClick={() => { const tb = blockByKey[titleKey]; const db = blockByKey[descKey]; if (tb) deleteBlock(tb.id); if (db) deleteBlock(db.id) }} title="Remove step" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 2, lineHeight: 1, flexShrink: 0 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      <button type="button" onClick={async () => {
                        if (!selectedPage) return
                        const base = badgeBlock.sort_order + 40 + nextStepNum * 2
                        await createBlock(selectedPage.id, `industry.${idx}.step${nextStepNum}.title`, `Industry ${idx} Step ${nextStepNum} Title`, 'New step', base)
                        await createBlock(selectedPage.id, `industry.${idx}.step${nextStepNum}.desc`, `Industry ${idx} Step ${nextStepNum} Description`, '', base + 1)
                      }} style={{ marginTop: 14, background: 'none', border: '1.5px dashed #E7DFD0', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', color: '#A8A29E', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add step
                      </button>
                    </div>
                    <div style={{ width: 240, flexShrink: 0 }}>
                      {renderImageBlock(blockByKey[imageKey] ?? null)}
                    </div>
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
              await createBlock(selectedPage.id, `industry.${nextIdx}.badge`, `Industry ${nextIdx} Badge`, 'New Industry', maxSort + 1)
              await createBlock(selectedPage.id, `industry.${nextIdx}.statement`, `Industry ${nextIdx} Statement`, 'What problem does Tasking solve for this industry?', maxSort + 2)
              await createBlock(selectedPage.id, `industry.${nextIdx}.step1.title`, `Industry ${nextIdx} Step 1 Title`, 'New step', maxSort + 3)
              await createBlock(selectedPage.id, `industry.${nextIdx}.step1.desc`, `Industry ${nextIdx} Step 1 Description`, '', maxSort + 4)
              await createBlock(selectedPage.id, `industry.${nextIdx}.image`, `Industry ${nextIdx} Image`, '', maxSort + 5)
            }} style={{ marginTop: 24, width: '100%', background: 'none', border: '2px dashed #F0E8D8', borderRadius: 16, padding: '20px 24px', cursor: 'pointer', color: '#A8A29E', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add industry
            </button>
          </section>
        )}

        {/* CTA */}
        {renderSectionWrap('section.cta.visible', 'CTA Section',
          <section style={{ background: ORANGE, padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ marginBottom: 14 }}>
                {renderEditableText({ blockKey: 'cta.headline', fallback: 'Start managing your workforce', variant: 'cta', styleOverride: { fontSize: 36 }, onDarkBg: true })}
              </div>
              <div style={{ marginBottom: 28 }}>
                {renderEditableText({ blockKey: 'cta.subheadline', fallback: 'No credit card. No setup fees. Just a smarter way to run your team.', variant: 'subhead', multiline: true, styleOverride: { fontSize: 16 }, onDarkBg: true })}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                {renderEditableBtn({ labelKey: 'cta.button.label', urlKey: 'cta.button.url', fallbackLabel: 'Get Started Free', fallbackUrl: '/get-started', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: '#FFFFFF', color: ORANGE, border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' } })}
                {renderEditableBtn({ labelKey: 'cta.button2.label', urlKey: 'cta.button2.url', fallbackLabel: 'View Pricing', fallbackUrl: '/pricing', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: 'transparent', color: '#FFFFFF', border: '2px solid rgba(255,255,255,0.6)', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
              </div>
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
      { key: 'shift',        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={ORANGE} strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><path d="M8 15h3M13 15h3M8 18h3" stroke={ORANGE} strokeWidth="1.75" strokeLinecap="round"/></svg>, name: 'Shift Management',     tagline: 'Build the schedule in minutes, not hours.',         href: '/products/shift-management' },
      { key: 'task',         icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke={ORANGE} strokeWidth="2"/><path d="M7.5 12l2.5 2.5 5-5" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, name: 'Task Management',      tagline: 'Assign work. Track it to done.',                    href: '/products/task-management' },
      { key: 'team',         icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3" stroke={ORANGE} strokeWidth="2"/><circle cx="5" cy="10" r="2.5" stroke={ORANGE} strokeWidth="1.75"/><circle cx="19" cy="10" r="2.5" stroke={ORANGE} strokeWidth="1.75"/><path d="M2 20c0-3 1.8-5 5-5M22 20c0-3-1.8-5-5-5M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={ORANGE} strokeWidth="1.75" strokeLinecap="round"/></svg>, name: 'Company Management',  tagline: 'Your company structure, exactly how you need it.',  href: '/products/team-management' },
      { key: 'communication',icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v12H8l-4 4V4Z" stroke={ORANGE} strokeWidth="2" strokeLinejoin="round"/><path d="M8 9h8M8 12.5h5" stroke={ORANGE} strokeWidth="1.75" strokeLinecap="round"/></svg>, name: 'Communication',        tagline: 'Keep everyone in the loop, in one place.',          href: '/products/communication' },
      { key: 'recruitment',  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke={ORANGE} strokeWidth="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/></svg>, name: 'Recruitment',         tagline: 'Find the right people. Fast.',                      href: '/products/recruitment' },
      { key: 'attendance',   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={ORANGE} strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><path d="M9 16l2 2 4-4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, name: 'Attendance',          tagline: 'Every clock-in. Verified.',                         href: '/products/attendance' },
      { key: 'reports',      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M12 20V4M20 20v-7" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/><path d="M3 20h18" stroke={ORANGE} strokeWidth="2" strokeLinecap="round"/></svg>, name: 'Reports & Insights',  tagline: 'Turn attendance and task data into decisions.',     href: '/products/reports-insights' },
    ]
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
              {renderEditableText({ blockKey: 'why.intro', fallback: "Most workforce tools were built for corporations with dedicated IT teams and six-figure software budgets. They come packed with modules that look impressive on a features list — but for an SME trying to manage a casual workforce, they just get in the way. Here’s what we left out, and why.", variant: 'body', multiline: true, styleOverride: { textAlign: 'center' as const, lineHeight: 1.75, fontSize: 17 } })}
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
              {renderEditableText({ blockKey: 'modules.title', fallback: 'Seven modules. One workflow. Zero gaps.', variant: 'sectionTitle' })}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginBottom: 16 }}>
                  {modules.slice(3, 6).map(renderModuleCard)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', maxWidth: 320, margin: '0 auto' }}>
                  {modules.slice(6).map(renderModuleCard)}
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
              {renderEditableBtn({ labelKey: 'cta.button2.label', urlKey: 'cta.button2.url', fallbackLabel: 'View Pricing', fallbackUrl: '/pricing', editing: editingCtaBtn, setEditing: setEditingCtaBtn, btnStyle: { background: 'transparent', color: '#FFFFFF', border: '2px solid rgba(255,255,255,0.6)', borderRadius: 10, padding: '13px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer' } })}
            </div>
            <div>
              {renderEditableText({ blockKey: 'cta.note', fallback: 'No credit card required. Free forever.', variant: 'body', styleOverride: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' as const }, onDarkBg: true })}
            </div>
          </div>
        </section>)}
      </div>
    )
  }

  const renderHomePreview = () => (
    <div style={{ background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      {renderSectionWrap('section.hero.visible', 'Hero Banner', (() => {
        const vBlock = blockByKey['video.demo'] ?? null
        const vUrl = vBlock ? (drafts[vBlock.id] ?? vBlock.value) : ''
        const vUploading = vBlock ? uploadingBlockId === vBlock.id : false
        return (
          <section style={{ background: '#1C1917', padding: '56px 54px 130px', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
            <svg
              viewBox="0 0 1440 260"
              preserveAspectRatio="none"
              style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '130px', pointerEvents: 'none' }}
            >
              <defs>
                <filter id="heroCurveBlurAdmin" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="18" />
                </filter>
              </defs>
              <path
                d="M0,170 C 260,110 480,60 720,60 C 960,60 1180,110 1440,170 L1440,340 L0,340 Z"
                fill="#FFFBF5"
                filter="url(#heroCurveBlurAdmin)"
              />
            </svg>
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '20px', background: '#FFFBF5', pointerEvents: 'none' }} />
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              {renderEditableText({ blockKey: 'hero.headline.line1', fallback: 'Hire. Schedule. Allocate.', variant: 'hero', styleOverride: { fontSize: 64 } })}
              <div style={{ height: 8 }} />
              {renderEditableText({ blockKey: 'hero.headline.line2', fallback: 'All in One Place.', variant: 'heroAccent', styleOverride: { fontSize: 64 } })}
            </div>
            <div
              style={{ maxWidth: 720, margin: '32px auto 0', borderRadius: 16, overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.15)', position: 'relative', cursor: 'pointer', minHeight: 340 }}
              onClick={async () => {
                // vBlock is missing when this page's content-block row was never seeded — create it
                // on the fly instead of silently no-oping the click.
                const target = vBlock ?? (selectedPage ? await createBlock(selectedPage.id, 'video.demo', 'Hero Demo Video URL', '', 100) : null)
                if (target) { videoTargetBlock.current = target; videoInputRef.current?.click() }
              }}
              onMouseEnter={e => { const ov = e.currentTarget.querySelector('.vid-overlay') as HTMLElement | null; if (ov) ov.style.opacity = '1' }}
              onMouseLeave={e => { const ov = e.currentTarget.querySelector('.vid-overlay') as HTMLElement | null; if (ov) ov.style.opacity = '0' }}
            >
              {vUrl ? (
                <video width="100%" controls muted loop playsInline style={{ display: 'block' }}>
                  <source src={vUrl} type="video/mp4" />
                </video>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340, gap: 12, color: 'rgba(255,255,255,0.4)', padding: 24 }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Click to upload hero video (30s)</span>
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
                  const res = await fetch('/api/marketingadmin/pages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_user_id: adminUserId, block_id: vBlock.id, value: '' }) })
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
            <div style={{ maxWidth: 720, margin: '28px auto 0' }}>
              {renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Tasking is the all-in-one workforce management platform that helps SMEs hire, schedule, and manage their teams without the complexity.', variant: 'subhead', multiline: true })}
            </div>
          </section>
        )
      })())}

      {renderSectionWrap('section.products.visible', 'Products Preview', <section style={{ background: '#FFFBF5', padding: '60px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: 'products.title', fallback: 'Everything You Need, In One Platform', variant: 'sectionTitle' })}
        <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 28, textAlign: 'left' }}>
          {[
            { key: 'shift', label: 'Shift Management' },
            { key: 'task', label: 'Task Management' },
            { key: 'recruitment', label: 'Recruitment' },
            { key: 'attendance', label: 'Attendance' },
          ].map(mod => (
            <div key={mod.key} style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 16, padding: 24 }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 900, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{mod.label}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ marginBottom: 6 }}>
                      {renderEditableText({ blockKey: `products.module.${mod.key}.feature${n}.title`, fallback: 'Feature title', variant: 'cardTitle', styleOverride: { fontSize: 14 } })}
                    </div>
                    <div style={{ fontSize: 12, color: '#78716C', lineHeight: 1.6 }}>
                      {renderEditableText({ blockKey: `products.module.${mod.key}.feature${n}.desc`, fallback: 'Feature description', variant: 'cardBody', multiline: true })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>)}

      {renderSectionWrap('section.why.visible', 'Why Tasking', <section style={{ background: '#FFFFFF', padding: '60px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: 'why.title', fallback: 'Why SMEs Choose Tasking', variant: 'sectionTitle' })}
        <div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, textAlign: 'left' }}>
          {[
            {
              titleKey: 'why.card.simple.title',
              descKey: 'why.card.simple.desc',
              imageKey: 'why.card.simple.image',
              title: 'One Platform for Everything',
              desc: 'Tasking brings workforce management into one connected platform. Manage your everyday operations in one place instead of switching between multiple tools.',
              icon: <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="9" r="5" stroke={ORANGE} strokeWidth="2" /><path d="M4 25c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" /></svg>,
            },
            {
              titleKey: 'why.card.control.title',
              descKey: 'why.card.control.desc',
              imageKey: 'why.card.control.image',
              title: 'Free to Run Your Business,\nNot Just to Try It',
              desc: 'The Free Plan supports complete day to day workflows without essential features locked behind a paywall. Paid features simply give you more automation, efficiency, and convenience.',
              icon: <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><rect x="3" y="5" width="22" height="19" rx="2" stroke={ORANGE} strokeWidth="2" /><path d="M10 24V17h8v7" stroke={ORANGE} strokeWidth="2" /><rect x="7" y="10" width="4" height="3" rx="0.5" stroke={ORANGE} strokeWidth="1.5" /><rect x="17" y="10" width="4" height="3" rx="0.5" stroke={ORANGE} strokeWidth="1.5" /></svg>,
            },
            {
              titleKey: 'why.card.ai.title',
              descKey: 'why.card.ai.desc',
              imageKey: 'why.card.ai.image',
              title: 'From Hiring to the Last Shift',
              desc: 'Tasking manages the complete casual worker journey, from recruitment to the end of their engagement. Every stage stays connected in one continuous workflow.',
              icon: <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><path d="M14 3L16.5 11L24 14L16.5 17L14 25L11.5 17L4 14L11.5 11L14 3Z" stroke={ORANGE} strokeWidth="2" strokeLinejoin="round" /></svg>,
            },
            {
              titleKey: 'why.card.casual.title',
              descKey: 'why.card.casual.desc',
              imageKey: 'why.card.casual.image',
              title: 'Built Around How SMEs Work',
              desc: 'Tasking is designed around the practical needs of SMEs, without unnecessary enterprise complexity. Simple workflows make it easy to manage operations without a dedicated HR or operations team.',
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
              <div style={{ marginBottom: 14 }}>
                {renderEditableText({ blockKey: card.descKey, fallback: card.desc, variant: 'cardBody', multiline: true })}
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Card image</p>
              {renderImageBlock(blockByKey[card.imageKey] ?? null)}
            </div>
          ))}
        </div>
      </section>)}

      {renderSectionWrap('section.industries.visible', 'Industries', <section style={{ background: '#FFFBF5', padding: '60px 48px', textAlign: 'center' }}>
        <div style={{ marginBottom: 36 }}>
          {renderEditableText({ blockKey: 'industries.title', fallback: 'Built for the Industries That Run on Casual Workers', variant: 'sectionTitle' })}
        </div>
        {(() => {
          const KEY_DEFAULT_ICONS: Record<string, string> = {
            retail: 'store', food: 'utensils', logistics: 'map-pin',
            events: 'calendar-check', event: 'calendar-check',
          }
          const KEY_DEFAULT_DESCS: Record<string, string> = {
            retail: 'Manage flexible staff across busy stores and changing shifts.',
            food: 'Coordinate casual teams across shifts, peak hours, and daily operations.',
            events: 'Organise temporary teams for events with changing staffing needs.',
            logistics: 'Manage flexible workers across schedules, tasks, and operational demands.',
            hospitality: 'Keep staff scheduling, attendance, and daily workforce operations organised.',
            cleaning: 'Coordinate distributed teams across locations, shifts, and recurring tasks.',
          }
          const deriveIcon = (blockKey: string) => {
            for (const [kw, icon] of Object.entries(KEY_DEFAULT_ICONS)) {
              if (blockKey.includes(kw)) return icon
            }
            return 'grid'
          }
          const deriveDesc = (blockKey: string) => {
            for (const [kw, desc] of Object.entries(KEY_DEFAULT_DESCS)) {
              if (blockKey.includes(kw)) return desc
            }
            return ''
          }
          const cardBlocks = (selectedPage?.blocks ?? [])
            .filter(b => b.block_key.startsWith('industries.card.') && !b.block_key.endsWith('.icon'))
            .sort((a, b) => a.sort_order - b.sort_order)
          const maxSort = cardBlocks.length > 0 ? Math.max(...cardBlocks.map(b => b.sort_order)) : 100
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
              {cardBlocks.map((nameBlock) => {
                const iconBlockKey = `${nameBlock.block_key}.icon`
                const descBlockKey = `${nameBlock.block_key}.desc`
                const currentIconName = blockByKey[iconBlockKey]?.value ?? deriveIcon(nameBlock.block_key)
                return (
                  <div key={nameBlock.id} style={{ background: '#FFFFFF', borderRadius: 16, padding: '32px 20px', border: '1px solid #F0E8D8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative' }}>
                    <button type="button"
                      onClick={() => { deleteBlock(nameBlock.id); const ib = blockByKey[iconBlockKey]; if (ib) deleteBlock(ib.id); const db = blockByKey[descBlockKey]; if (db) deleteBlock(db.id) }}
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
                    <div style={{ fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 1.5 }}>
                      {renderEditableText({ blockKey: descBlockKey, fallback: deriveDesc(nameBlock.block_key), placeholder: 'Add a description…', variant: 'body', multiline: true, styleOverride: { fontSize: 12, color: MUTED, textAlign: 'center' as const } })}
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
      </section>)}

      {renderSectionWrap('section.cta.visible', 'CTA Banner', renderCtaBtnSection(ORANGE, 'cta.headline', 'cta.subheadline', 'Ready to Simplify Your Workforce?', 'Get started with a complete workforce management platform, free from day one.'))}

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
            <div style={{ maxWidth: 640, margin: '0 auto 14px' }}>{renderEditableText({ blockKey: 'hero.headline', fallback: 'Transparent pricing. Zero surprises.', variant: 'hero', onDarkBg: true })}</div>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>{renderEditableText({ blockKey: 'hero.subheadline', fallback: 'Start for free. Scale as you grow. Get full access to all core workflows.', variant: 'subhead', multiline: true, onDarkBg: true })}</div>
          </section>
        )}

        {/* Plans */}
        {renderSectionWrap('section.plans.visible', 'Pricing Cards',
          <section style={{ background: '#FFFBF5', padding: '48px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              {/* Free card */}
              {(() => {
                const nextFreeIdx = freeFeatBlocks.length > 0 ? Math.max(...freeFeatBlocks.map(b => parseInt(b.block_key.split('.').pop() ?? '0'))) + 1 : 1
                const maxFreeOrder = freeFeatBlocks.length > 0 ? Math.max(...freeFeatBlocks.map(b => b.sort_order)) : 20
                return (
                  <div style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 20, padding: '36px 32px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <div style={{ marginBottom: 10 }}>{renderEditableText({ blockKey: 'plan.free.name', fallback: 'Free', variant: 'sectionTitle' })}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                      {renderEditableText({ blockKey: 'plan.free.price', fallback: '$0', variant: 'hero', styleOverride: { color: '#1C1917', fontSize: 40 } })}
                    </div>
                    <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${BORDER}` }}>{renderEditableText({ blockKey: 'plan.free.pricesub', fallback: '/ month', variant: 'body' })}</div>
                    <div style={{ marginBottom: 12 }}>{renderEditableText({ blockKey: 'plan.free.featuresintro', fallback: 'Core tools to run your workforce:', variant: 'body', styleOverride: { fontSize: 12, fontWeight: 600, color: '#9CA3AF' } })}</div>
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
                      {renderEditableText({ blockKey: 'plan.pro.price', fallback: '$20', variant: 'hero', styleOverride: { color: ORANGE, fontSize: 40 } })}
                    </div>
                    <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${BORDER}` }}>{renderEditableText({ blockKey: 'plan.pro.pricesub', fallback: '/ month', variant: 'body' })}</div>
                    <div style={{ marginBottom: 12 }}>{renderEditableText({ blockKey: 'plan.pro.featuresintro', fallback: 'Everything in Free, plus:', variant: 'body', styleOverride: { fontSize: 12, fontWeight: 600, color: '#9CA3AF' } })}</div>
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
              {renderEditableText({ blockKey: 'compare.title', fallback: 'Compare our plans', variant: 'sectionTitle' })}
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
                    await fetch('/api/marketingadmin/pages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_user_id: adminUserId, block_id: block.id, value: newVal }) })
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
                await fetch('/api/marketingadmin/pages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_user_id: adminUserId, updates }) })
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
                await fetch('/api/marketingadmin/pages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_user_id: adminUserId, updates }) })
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
              {renderEditableText({ blockKey: 'faq.title', fallback: 'Pricing FAQs', variant: 'sectionTitle' })}
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
    <main style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#F1F5F9', color: TEXT, fontFamily: 'Inter, system-ui, sans-serif' }}>
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
      <AdminSidebar />

      <style>{`
        @keyframes adminFadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .admin-page-fade {
          animation: adminFadeSlideUp 0.22s ease both;
        }
      `}</style>

      <section style={{ marginLeft: 64, background: 'transparent', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Page header — matches Owner's Communication/Reviews pages exactly */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Marketing Page Editor
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {adminUserId && (
              // Reset back to the default sans stack (Tailwind preflight) — <main> above forces
              // Inter for the editor UI, but the badge should render like it does on Owner's page,
              // which never overrides font-family.
              <span style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'" }}>
                <OwnerUserBadge userId={adminUserId} companyId="" />
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: '0 28px 44px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
              <div ref={pageSwitcherRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setPageSwitcherOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: TEXT }}>
                    {selectedSummary?.title ?? 'Select a page'}
                  </h2>
                  <ChevronDown size={16} color={MUTED} style={{ transform: pageSwitcherOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                </button>

                {pageSwitcherOpen && (
                  <div className="admin-page-fade" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 30, minWidth: 240, maxHeight: 420, overflowY: 'auto', background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 12px 32px rgba(15,23,42,0.16)', padding: 6 }}>
                    {loadingPages ? (
                      <p style={{ fontSize: 12, color: MUTED, padding: '6px 10px' }}>Loading…</p>
                    ) : (
                      pageSwitcherGroups.map(({ parent, subs }) => (
                        <div key={parent.id}>
                          <button
                            type="button"
                            onClick={() => { setSelectedSlug(parent.slug); setPageSwitcherOpen(false) }}
                            style={{
                              width: '100%', textAlign: 'left', display: 'block',
                              padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                              background: parent.slug === selectedSlug ? '#FFF7ED' : 'transparent',
                              color: parent.slug === selectedSlug ? ORANGE : TEXT,
                              fontWeight: parent.slug === selectedSlug ? 700 : 600,
                              fontSize: 13,
                            }}
                            onMouseEnter={e => { if (parent.slug !== selectedSlug) e.currentTarget.style.background = '#F9FAFB' }}
                            onMouseLeave={e => { if (parent.slug !== selectedSlug) e.currentTarget.style.background = 'transparent' }}
                          >
                            {parent.title}
                          </button>
                          {subs.map(sub => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => { setSelectedSlug(sub.slug); setPageSwitcherOpen(false) }}
                              style={{
                                width: '100%', textAlign: 'left', display: 'block',
                                padding: '7px 10px 7px 26px', borderRadius: 7, border: 'none', cursor: 'pointer',
                                background: sub.slug === selectedSlug ? '#FFF7ED' : 'transparent',
                                color: sub.slug === selectedSlug ? ORANGE : MUTED,
                                fontWeight: sub.slug === selectedSlug ? 700 : 500,
                                fontSize: 12.5,
                              }}
                              onMouseEnter={e => { if (sub.slug !== selectedSlug) e.currentTarget.style.background = '#F9FAFB' }}
                              onMouseLeave={e => { if (sub.slug !== selectedSlug) e.currentTarget.style.background = 'transparent' }}
                            >
                              {sub.title}
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}
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
                <div style={{ padding: 14, background: '#FFFFFF' }}>
              {loadingPage ? (
                <div style={{ display: 'grid', placeItems: 'center', minHeight: 520, color: MUTED, fontSize: 13, fontWeight: 700 }}>
                  Loading live preview...
                </div>
              ) : selectedPage ? (
                <div key={selectedPage.id} className="admin-page-fade">{selectedPage.slug === 'home' ? renderHomePreview() : selectedPage.slug === 'products' ? renderProductsPreview() : selectedPage.slug === 'pricing' ? renderPricingPreview() : selectedPage.slug === 'products-shift-management' ? renderShiftManagementPreview() : selectedPage.slug === 'products-task-management' ? renderTaskManagementPreview() : selectedPage.slug === 'products-communication' ? renderCommunicationPreview() : selectedPage.slug === 'products-reports-insights' ? renderReportsInsightsPreview() : selectedPage.slug === 'products-recruitment' ? renderRecruitmentPreview() : selectedPage.slug === 'products-attendance' ? renderAttendancePreview() : selectedPage.slug === 'products-team-management' ? renderTeamManagementPreview() : selectedPage.slug === 'industries' ? renderIndustriesPreview() : renderGenericPreview()}</div>

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
        </div>
      </section>
    </main>
    {renderIconPickerOverlay()}
  </>
  )
}
