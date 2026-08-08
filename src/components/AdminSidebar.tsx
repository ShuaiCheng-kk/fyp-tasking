'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { FileText, LogOut, Star } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const THEME = {
  sidebarBg:         '#FFFFFF',
  sidebarText:       '#374151',
  sidebarActiveBg:   'transparent',
  sidebarActiveText: '#F97316',
  sidebarHoverBg:    '#F9FAFB',
  sidebarBorder:     '#E5E7EB',
  logoBorder:        '#E5E7EB',
  logoutHoverBg:     '#FEF2F2',
  subText:           '#9CA3AF',
  subActive:         '#F97316',
  subHover:          '#F9FAFB',
}

export default function AdminSidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [pendingReviewCount, setPendingReviewCount] = useState(0)

  // Live-updates the Reviews nav dot so it reflects new pending reviews immediately,
  // not just on next page load/navigation — matches the pending count shown on the
  // Reviews page's own "Pending" tab.
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const fetchPendingCount = () => {
      fetch('/api/marketingadmin/reviews')
        .then(r => r.json())
        .then(d => { if (d.success) setPendingReviewCount((d.reviews ?? []).filter((r: { approved: boolean }) => !r.approved).length) })
        .catch(() => {})
    }
    fetchPendingCount()

    const channel = supabase
      .channel('admin-sidebar-reviews')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, fetchPendingCount)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

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
        // The admin <main> wrapper forces Inter for the editor UI, but the sidebar
        // should render in the same default sans stack as OwnerSidebar (which never
        // overrides font-family) so the nav labels look identical to Owner's.
        fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
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

        {/* Nav items — page selection now lives in the editor's own title dropdown, not here */}
        <div style={{ padding: '12px 8px' }}>
          {[
            { label: 'Editor', Icon: FileText, href: '/admin/dashboard', external: false, showDot: false },
            { label: 'Reviews', Icon: Star, href: '/admin/reviews', external: false, showDot: pendingReviewCount > 0 },
          ].map(({ label, Icon, href, external, showDot }) => (
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
                background: pathname === href ? THEME.sidebarActiveBg : hoveredKey === label ? THEME.sidebarHoverBg : 'transparent',
                border: pathname === href ? `1.5px solid ${THEME.sidebarActiveText}` : '1.5px solid transparent',
                color: pathname === href ? THEME.sidebarActiveText : THEME.sidebarText,
                fontWeight: pathname === href ? 600 : 500,
                fontSize: '0.9rem',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              <span style={{ position: 'relative', flexShrink: 0 }}>
                <Icon size={18} strokeWidth={2.1} style={{ display: 'block' }} />
                {showDot && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#EF4444', border: '1.5px solid #fff',
                  }} />
                )}
              </span>
              <span style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? 200 : 0, overflow: 'hidden', transition: 'opacity 0.15s' }}>{label}</span>
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
            background: hoveredKey === 'logout' ? THEME.logoutHoverBg : 'transparent',
            border: 'none', color: '#DC2626', cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap',
            transition: 'background 0.15s',
          }}
        >
          <LogOut size={18} strokeWidth={2.1} style={{ display: 'block', flexShrink: 0 }} />
          <span style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? 200 : 0, overflow: 'hidden', transition: 'opacity 0.15s' }}>Logout</span>
        </button>
      </div>
    </aside>
  )
}
