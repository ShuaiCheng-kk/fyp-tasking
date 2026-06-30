'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { FileText, LogOut, Settings, ChevronDown, ChevronRight } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { MarketingPageSummary } from '@/types/MarketingPage'

const THEME = {
  sidebarBg:         '#1C1C1E',
  sidebarText:       '#FFFFFF',
  sidebarActiveBg:   '#F97316',
  sidebarActiveText: '#FFFFFF',
  sidebarHoverBg:    'rgba(255,255,255,0.1)',
  sidebarBorder:     'rgba(255,255,255,0.08)',
  logoBorder:        'rgba(255,255,255,0.08)',
  subText:           'rgba(255,255,255,0.45)',
  subActive:         '#F97316',
  subHover:          'rgba(255,255,255,0.08)',
}

interface Props {
  pages?: MarketingPageSummary[]
  selectedSlug?: string
  onSelectSlug?: (slug: string) => void
  loadingPages?: boolean
}

export default function AdminSidebar({ pages = [], selectedSlug = '', onSelectSlug, loadingPages }: Props) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ marketingPages: true, products: true, about: true })

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    localStorage.removeItem('tasking_user_id')
    localStorage.removeItem('tasking_company_id')
    window.location.href = '/signout'
  }

  const hasPageTree = onSelectSlug !== undefined

  const PRODUCTS_ORDER = ['products-ai-features', 'products-recruitment', 'products-attendance', 'products-team-management', 'products-smart-notifications']
  const productsParent = pages.find(p => p.slug === 'products')
  const productsSubs   = PRODUCTS_ORDER.map(slug => pages.find(p => p.slug === slug)).filter(Boolean) as MarketingPageSummary[]
  const ABOUT_ORDER = ['about-mission', 'about-problem-solution', 'about-team', 'about-faq']
  const aboutParent    = pages.find(p => p.slug === 'about')
  const aboutSubs      = ABOUT_ORDER.map(slug => pages.find(p => p.slug === slug)).filter(Boolean) as MarketingPageSummary[]
  // Order: Home, Products (+subs), Industries, Pricing, About (+subs)
  const STANDALONE_ORDER = ['industries', 'pricing']
  const standalonePages = STANDALONE_ORDER
    .map(slug => pages.find(p => p.slug === slug))
    .filter(Boolean) as MarketingPageSummary[]

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))

  const pageBtn = (page: MarketingPageSummary, indent = false) => {
    const active = page.slug === selectedSlug
    return (
      <button
        key={page.id}
        type="button"
        onClick={() => onSelectSlug?.(page.slug)}
        style={{
          width: '100%', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 6,
          padding: indent ? '6px 8px 6px 28px' : '6px 8px',
          borderRadius: 7, border: 'none', cursor: 'pointer',
          background: active ? 'rgba(249,115,22,0.18)' : 'transparent',
          color: active ? THEME.subActive : THEME.sidebarText,
          fontWeight: active ? 700 : 400,
          fontSize: indent ? 12 : 13,
          whiteSpace: 'nowrap',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = THEME.subHover }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        {active && <span style={{ width: 3, height: 12, borderRadius: 2, background: THEME.subActive, flexShrink: 0 }} />}
        {page.title}
      </button>
    )
  }

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { setExpanded(false); setHoveredKey(null) }}
      style={{
        width: expanded ? '240px' : '64px',
        background: THEME.sidebarBg,
        borderRight: `1px solid ${THEME.sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0, left: 0,
        zIndex: 20,
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '20px 18px 18px',
          borderBottom: `1px solid ${THEME.logoBorder}`,
          textDecoration: 'none', flexShrink: 0,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
          <rect width="32" height="32" rx="8" fill="#F97316" />
          <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="white" />
          <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="white" />
          <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="white" />
          <circle cx="22" cy="10.25" r="3.5" fill="#10B981" />
          <path d="M20.3 10.25L21.5 11.5L23.8 9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{
          fontWeight: 700, fontSize: '1.0625rem', color: THEME.sidebarText,
          letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0, transition: 'opacity 0.15s',
        }}>
          Tasking
        </span>
      </Link>

      {/* Scrollable body */}
      <div className="admin-sidebar-body" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', scrollbarWidth: 'none' } as React.CSSProperties}>

        {/* Marketing Pages + page tree */}
        <div style={{ padding: '12px 8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            <a
              href="/admin/dashboard"
              onMouseEnter={() => setHoveredKey('marketing')}
              onMouseLeave={() => setHoveredKey(null)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                background: pathname === '/admin/dashboard' ? THEME.sidebarActiveBg : hoveredKey === 'marketing' ? THEME.sidebarHoverBg : 'transparent',
                color: pathname === '/admin/dashboard' ? THEME.sidebarActiveText : THEME.sidebarText,
                fontWeight: pathname === '/admin/dashboard' ? 600 : 500,
                fontSize: '0.9rem', textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              <FileText size={18} strokeWidth={2.1} style={{ display: 'block', flexShrink: 0 }} />
              <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>Marketing Pages</span>
            </a>
            {hasPageTree && expanded && (
              <button type="button" onClick={() => toggleGroup('marketingPages')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.subText, padding: '0 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {openGroups.marketingPages ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            )}
          </div>

          {/* Page tree — shown only when expanded and props provided */}
          {hasPageTree && openGroups.marketingPages && (
            <div style={{
              opacity: expanded ? 1 : 0,
              transition: 'opacity 0.15s',
              pointerEvents: expanded ? 'auto' : 'none',
              paddingLeft: 8,
              borderLeft: `1.5px solid rgba(255,255,255,0.1)`,
              marginLeft: 20,
              marginBottom: 8,
            }}>
              {loadingPages ? (
                <p style={{ fontSize: 12, color: THEME.subText, padding: '4px 8px', whiteSpace: 'nowrap' }}>Loading…</p>
              ) : (
                <>
                  {/* Home */}
                  {pages.find(p => p.slug === 'home') && pageBtn(pages.find(p => p.slug === 'home')!, false)}

                  {/* Products group */}
                  {productsParent && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>{pageBtn(productsParent, false)}</div>
                        {productsSubs.length > 0 && (
                          <button type="button" onClick={() => toggleGroup('products')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.subText, padding: '0 4px', display: 'flex', alignItems: 'center' }}>
                            {openGroups.products ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                        )}
                      </div>
                      {openGroups.products && productsSubs.map(p => pageBtn(p, true))}
                    </div>
                  )}

                  {/* Industries, Pricing */}
                  {standalonePages.map(p => pageBtn(p, false))}

                  {/* About group */}
                  {aboutParent && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>{pageBtn(aboutParent, false)}</div>
                        {aboutSubs.length > 0 && (
                          <button type="button" onClick={() => toggleGroup('about')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.subText, padding: '0 4px', display: 'flex', alignItems: 'center' }}>
                            {openGroups.about ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                        )}
                      </div>
                      {openGroups.about && aboutSubs.map(p => pageBtn(p, true))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Other nav items */}
        <div style={{ padding: '0 8px 12px' }}>
          {[
            { label: 'Settings', Icon: Settings, href: '/admin/settings', external: false },
          ].map(({ label, Icon, href, external }) => (
            <a
              key={label}
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noreferrer' : undefined}
              onMouseEnter={() => setHoveredKey(label)}
              onMouseLeave={() => setHoveredKey(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px', marginBottom: 2,
                background: hoveredKey === label ? THEME.sidebarHoverBg : 'transparent',
                color: THEME.sidebarText,
                fontWeight: 500, fontSize: '0.9rem',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              <Icon size={18} strokeWidth={2.1} style={{ display: 'block', flexShrink: 0 }} />
              <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>{label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div style={{ padding: '12px 8px', borderTop: `1px solid ${THEME.sidebarBorder}`, flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleLogout}
          onMouseEnter={() => setHoveredKey('logout')}
          onMouseLeave={() => setHoveredKey(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '10px 12px', borderRadius: '8px',
            background: hoveredKey === 'logout' ? 'rgba(248,113,113,0.1)' : 'transparent',
            border: 'none', color: '#F87171', cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap',
            transition: 'background 0.15s',
          }}
        >
          <LogOut size={18} strokeWidth={2.1} style={{ display: 'block', flexShrink: 0 }} />
          <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>Logout</span>
        </button>
      </div>
    </aside>
  )
}
