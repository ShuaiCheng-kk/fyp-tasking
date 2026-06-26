'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { FileText, LogOut, Settings, ExternalLink } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const NAV_ITEMS = [
  { label: 'Marketing Pages', Icon: FileText, href: '/admin/dashboard', external: false },
  { label: 'View Live Site',  Icon: ExternalLink, href: '/',             external: true  },
  { label: 'Settings',        Icon: Settings,     href: '/admin/settings', external: false },
]

const THEME = {
  sidebarBg: '#1C1C1E',
  sidebarText: '#FFFFFF',
  sidebarActiveBg: '#F97316',
  sidebarActiveText: '#FFFFFF',
  sidebarHoverBg: 'rgba(255,255,255,0.1)',
  sidebarBorder: 'rgba(255,255,255,0.08)',
  logoBorder: 'rgba(255,255,255,0.08)',
}

export default function AdminSidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

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
      onMouseLeave={() => { setExpanded(false); setHoveredIdx(null) }}
      style={{
        width: expanded ? '220px' : '64px',
        background: THEME.sidebarBg,
        borderRight: `1px solid ${THEME.sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0, left: 0,
        zIndex: 20,
        transition: 'width 0.2s',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Link
        href="/admin/dashboard"
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

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'hidden' }}>
        {NAV_ITEMS.map(({ label, Icon, href, external }, idx) => {
          const active = !external && pathname === href
          return (
            <a
              key={label}
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noreferrer' : undefined}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: active
                  ? THEME.sidebarActiveBg
                  : hoveredIdx === idx
                    ? THEME.sidebarHoverBg
                    : 'transparent',
                color: active ? THEME.sidebarActiveText : THEME.sidebarText,
                fontWeight: active ? 600 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                marginBottom: '2px',
              }}
            >
              <Icon size={18} strokeWidth={2.1} style={{ display: 'block', flexShrink: 0 }} />
              <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
                {label}
              </span>
            </a>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 8px', borderTop: `1px solid ${THEME.sidebarBorder}`, flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleLogout}
          onMouseEnter={() => setHoveredIdx(-1)}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '10px 12px', borderRadius: '8px',
            background: hoveredIdx === -1 ? 'rgba(248,113,113,0.1)' : 'transparent',
            border: 'none',
            color: '#F87171', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
            whiteSpace: 'nowrap', transition: 'background 0.15s',
          }}
        >
          <LogOut size={18} strokeWidth={2.1} style={{ display: 'block', flexShrink: 0 }} />
          <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
            Logout
          </span>
        </button>
      </div>
    </aside>
  )
}
