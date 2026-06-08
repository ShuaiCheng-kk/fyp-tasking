'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Circle, ExternalLink, FileText, Layers3, LogOut, MousePointer2, RefreshCcw, Save, Shield, Sparkles } from 'lucide-react'
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
  const [adminUserId] = useState(() => typeof window === 'undefined' ? '' : window.localStorage.getItem('tasking_user_id') || '')
  const [pages, setPages] = useState<MarketingPageSummary[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [selectedPage, setSelectedPage] = useState<MarketingPage | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editingBlockId, setEditingBlockId] = useState('')
  const [loadingPages, setLoadingPages] = useState(true)
  const [loadingPage, setLoadingPage] = useState(false)
  const [savingBlockId, setSavingBlockId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

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
    const role = window.localStorage.getItem('tasking_user_role') || ''
    if (!adminUserId || role !== 'Marketing Admin') {
      router.replace('/signin')
    }
  }, [adminUserId, router])

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
      variant === 'subhead' ? { color: 'rgba(255,255,255,0.7)', fontSize: 17, lineHeight: 1.75, maxWidth: 520 } :
      variant === 'sectionTitle' ? { color: '#1C1917', fontSize: 32, fontWeight: 700, lineHeight: 1.2, fontFamily: 'var(--font-heading)' } :
      variant === 'cardTitle' ? { color: '#1C1917', fontSize: 17, fontWeight: 800, lineHeight: 1.35, fontFamily: 'var(--font-heading)' } :
      variant === 'cardBody' ? { color: '#78716C', fontSize: 14, lineHeight: 1.65 } :
      variant === 'cta' ? { color: '#FFFFFF', fontSize: 36, fontWeight: 700, lineHeight: 1.18, fontFamily: 'var(--font-heading)' } :
      { color: '#78716C', fontSize: 15, lineHeight: 1.7 }

    if (!canEdit) {
      return <span style={{ ...baseStyle, ...textStyle }}>{value}</span>
    }

    if (editing) {
      const fieldStyle: React.CSSProperties = {
        width: variant === 'badge' ? 220 : '100%',
        minWidth: variant === 'hero' || variant === 'heroAccent' ? 540 : 260,
        maxWidth: '100%',
        border: '2px solid #FDBA74',
        borderRadius: 10,
        padding: variant === 'hero' || variant === 'heroAccent' ? '10px 12px' : '9px 10px',
        color: variant === 'hero' || variant === 'heroAccent' || variant === 'subhead' || variant === 'cta' ? '#FFFFFF' : TEXT,
        background: variant === 'hero' || variant === 'heroAccent' || variant === 'subhead' || variant === 'cta' ? 'rgba(15,23,42,0.92)' : '#FFFFFF',
        fontFamily: 'var(--font-body)',
        fontSize: variant === 'hero' || variant === 'heroAccent' ? 28 : 14,
        fontWeight: variant === 'hero' || variant === 'heroAccent' || variant === 'cta' ? 800 : 600,
        lineHeight: 1.4,
      }

      return (
        <span style={{ display: 'block', maxWidth: variant === 'subhead' ? 540 : '100%' }}>
          {multiline ? (
            <textarea
              autoFocus
              value={value}
              onChange={(event) => setDrafts(current => ({ ...current, [block.id]: event.target.value }))}
              rows={variant === 'subhead' || variant === 'body' || variant === 'cardBody' ? 4 : 3}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
          ) : (
            <input
              autoFocus
              value={value}
              onChange={(event) => setDrafts(current => ({ ...current, [block.id]: event.target.value }))}
              style={fieldStyle}
            />
          )}
          <span style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => saveBlock(block)}
              disabled={!dirty || savingBlockId === block.id}
              className="btn-press"
              style={{ border: 'none', borderRadius: 9, background: dirty ? ORANGE : '#CBD5E1', color: '#FFFFFF', padding: '8px 12px', fontWeight: 900, fontSize: 12, cursor: dirty ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <Save size={13} /> {savingBlockId === block.id ? 'Saving' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => resetDraft(block)}
              style={{ border: '1px solid #CBD5E1', borderRadius: 9, background: '#FFFFFF', color: TEXT, padding: '8px 12px', fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <RefreshCcw size={13} /> Cancel
            </button>
          </span>
        </span>
      )
    }

    return (
      <span
        tabIndex={0}
        role="button"
        title="Double-click to edit"
        onDoubleClick={() => setEditingBlockId(block.id)}
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
      {hasCta ? (
        <section style={{ padding: '56px 48px', background: ORANGE, textAlign: 'center' }}>
          {hasBlock(blockByKey, 'cta.headline') ? renderEditableText({ blockKey: 'cta.headline', fallback: '', variant: 'cta' }) : null}
          {hasBlock(blockByKey, 'cta.headline') && hasBlock(blockByKey, 'cta.subheadline') ? <div style={{ height: 14 }} /> : null}
          {hasBlock(blockByKey, 'cta.subheadline') ? renderEditableText({ blockKey: 'cta.subheadline', fallback: '', variant: 'subhead', multiline: true }) : null}
        </section>
      ) : null}
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
      <section style={{ background: '#1C1C1E', padding: '76px 54px 86px' }}>
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
          <div style={{ minHeight: 320, borderRadius: 20, background: '#2C2C2E', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 60px rgba(249,115,22,0.24)', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: 700 }}>
            Dashboard Mockup
          </div>
        </div>
      </section>

      <section style={{ background: '#FFFBF5', padding: '60px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: 'why.title', fallback: 'Why SMEs Choose Tasking', variant: 'sectionTitle' })}
        <div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, textAlign: 'left' }}>
          {[
            {
              titleKey: 'why.card.simple.title',
              descKey: 'why.card.simple.desc',
              title: 'Simple Enough for Anyone',
              desc: 'Designed for SME owners who need results without a learning curve. No technical knowledge needed - just set up and go.',
            },
            {
              titleKey: 'why.card.control.title',
              descKey: 'why.card.control.desc',
              title: 'Full Control, Department by Department',
              desc: 'Managers handle their own recruitment and scheduling while owners keep full visibility across all departments.',
            },
            {
              titleKey: 'why.card.ai.title',
              descKey: 'why.card.ai.desc',
              title: 'Enterprise AI - Free for Everyone',
              desc: 'AI-powered job description generation, candidate recommendations, and anomaly detection are included in the free plan.',
            },
            {
              titleKey: 'why.card.casual.title',
              descKey: 'why.card.casual.desc',
              title: 'Built for Casual Workforce Realities',
              desc: 'Photo-based clock-in verification, digital attendance records, and automated workflows are built for flexible workers.',
            },
          ].map(card => (
            <div key={card.titleKey} className="card-lift" style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: 14, padding: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: '#FEF3C7', color: ORANGE, display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                <Sparkles size={18} />
              </div>
              <div style={{ marginBottom: 8 }}>
                {renderEditableText({ blockKey: card.titleKey, fallback: card.title, variant: 'cardTitle' })}
              </div>
              {renderEditableText({ blockKey: card.descKey, fallback: card.desc, variant: 'cardBody', multiline: true })}
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#FFFFFF', padding: '60px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: 'products.title', fallback: 'Everything You Need, In One Platform', variant: 'sectionTitle' })}
        <p style={{ margin: '14px auto 0', maxWidth: 560, color: '#78716C', lineHeight: 1.7, fontSize: 15 }}>
          Tasking covers every aspect of casual workforce management across 5 core modules.
        </p>
      </section>

      <section style={{ background: '#FFFBF5', padding: '60px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: 'industries.title', fallback: 'Built for the Industries That Run on Casual Workers', variant: 'sectionTitle' })}
      </section>

      <section style={{ background: ORANGE, padding: '62px 48px', textAlign: 'center' }}>
        {renderEditableText({ blockKey: 'cta.headline', fallback: 'Ready to simplify your workforce?', variant: 'cta' })}
        <div style={{ height: 16 }} />
        {renderEditableText({ blockKey: 'cta.subheadline', fallback: 'Join SMEs already using Tasking to hire smarter, schedule faster, and track with confidence.', variant: 'subhead', multiline: true })}
      </section>
    </div>
  )

  const dirtyBlocks = selectedPage?.blocks.filter(block => (drafts[block.id] ?? '') !== block.value) ?? []
  return (
    <main style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, rgba(249,115,22,0.10), transparent 34%), ${BG}`, color: TEXT, fontFamily: 'var(--font-body)' }}>
      <aside style={{ position: 'fixed', inset: '0 auto 0 0', width: 76, background: '#15171C', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 0', zIndex: 10, boxShadow: '8px 0 30px rgba(15,23,42,0.14)' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', marginBottom: 30, boxShadow: '0 14px 28px rgba(249,115,22,0.32)' }}>
          <Shield size={20} />
        </div>
        <div title="Marketing pages" style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(249,115,22,0.16)', color: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(249,115,22,0.24)' }}>
          <FileText size={19} />
        </div>
        <button
          type="button"
          onClick={signOut}
          title="Sign out"
          style={{ marginTop: 'auto', width: 42, height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#F87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <LogOut size={18} />
        </button>
      </aside>

      <section style={{ marginLeft: 76, padding: '28px 32px 44px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 18 }}>
          <div>
            <p style={{ margin: '0 0 8px', color: ORANGE, fontSize: 12, letterSpacing: 1.4, fontWeight: 800, textTransform: 'uppercase' }}>
              Platform Admin
            </p>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 34, lineHeight: 1.1, fontWeight: 800, color: TEXT }}>
              Marketing Live Editor
            </h1>
            <p style={{ margin: '10px 0 0', color: MUTED, fontSize: 14, fontWeight: 600 }}>
              Double-click highlighted text in the preview to edit it. This admin only manages marketing content.
            </p>
          </div>
          <div className="card-lift" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', border: `1px solid ${BORDER}`, borderRadius: 999, padding: '9px 15px 9px 9px', boxShadow: '0 16px 38px rgba(15,23,42,0.10)' }}>
            <span style={{ width: 32, height: 32, borderRadius: 999, background: ORANGE, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>A</span>
            <span style={{ fontSize: 13, fontWeight: 900 }}>Marketing Admin</span>
          </div>
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

        <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <section style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(14px)', border: `1px solid ${BORDER}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 42px rgba(15,23,42,0.07)' }}>
            <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${BORDER}`, background: 'linear-gradient(180deg, #FFFFFF, #F8FAFC)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 11, background: SOFT_ORANGE, color: ORANGE, display: 'grid', placeItems: 'center' }}>
                  <Layers3 size={17} />
                </span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: TEXT }}>Pages</h2>
                  <p style={{ margin: '3px 0 0', color: MUTED, fontSize: 11, fontWeight: 700 }}>{pages.length || 0} editable pages</p>
                </div>
              </div>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 170px)', overflowY: 'auto' }}>
              {loadingPages ? (
                <p style={{ margin: 0, padding: 10, color: MUTED, fontSize: 13 }}>Loading pages...</p>
              ) : pages.map(page => {
                const active = page.slug === selectedSlug
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setSelectedSlug(page.slug)}
                    className="card-lift"
                    style={{
                      textAlign: 'left',
                      border: `1px solid ${active ? '#FDBA74' : BORDER}`,
                      background: active ? 'linear-gradient(135deg, #FFF7ED, #FFFFFF)' : '#FFFFFF',
                      borderRadius: 12,
                      padding: '13px 12px',
                      cursor: 'pointer',
                      boxShadow: active ? '0 12px 26px rgba(249,115,22,0.14)' : '0 2px 10px rgba(15,23,42,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: active ? ORANGE : TEXT }}>{page.title}</p>
                      {active ? <Circle size={8} fill={ORANGE} color={ORANGE} /> : null}
                    </div>
                    <p style={{ margin: '6px 0 0', color: MUTED, fontSize: 11, fontWeight: 700 }}>{page.route_path}</p>
                    <p style={{ margin: '9px 0 0', color: active ? '#C2410C' : '#94A3B8', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.7 }}>{page.block_count} fields</p>
                  </button>
                )
              })}
            </div>
          </section>

          <section style={{ background: 'rgba(255,255,255,0.92)', border: `1px solid ${BORDER}`, borderRadius: 20, minHeight: 720, overflow: 'hidden', boxShadow: '0 22px 52px rgba(15,23,42,0.09)' }}>
            <div style={{ padding: '15px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: '#FFFFFF' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: TEXT }}>
                  {selectedSummary?.title ?? 'Select a page'}
                </h2>
                <p style={{ margin: '5px 0 0', color: MUTED, fontSize: 12, fontWeight: 700 }}>
                  {selectedSummary?.route_path ?? 'Choose a marketing page from the left'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: dirtyBlocks.length > 0 ? '#C2410C' : '#047857', background: dirtyBlocks.length > 0 ? SOFT_ORANGE : '#ECFDF5', border: `1px solid ${dirtyBlocks.length > 0 ? '#FED7AA' : '#BBF7D0'}`, borderRadius: 999, padding: '8px 11px', fontSize: 12, fontWeight: 900 }}>
                  <Check size={13} /> {dirtyBlocks.length > 0 ? `${dirtyBlocks.length} unsaved` : 'All saved'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: ORANGE, background: SOFT_ORANGE, border: '1px solid #FED7AA', borderRadius: 999, padding: '8px 11px', fontSize: 12, fontWeight: 900 }}>
                  <MousePointer2 size={13} /> Double-click text
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
                selectedPage.slug === 'home' ? renderHomePreview() : selectedPage.slug === 'about' ? renderAboutPreview() : renderGenericPreview()
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
