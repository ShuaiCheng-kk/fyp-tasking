'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { LogOut, LayoutDashboard, BarChart2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const THEME = {
  sidebarBg:         '#27272A',
  sidebarText:       '#A1A1AA',
  sidebarActiveBg:   '#3F3F46',
  sidebarActiveText: '#FAFAFA',
  sidebarHoverBg:    'rgba(255,255,255,0.06)',
  sidebarBorder:     'rgba(255,255,255,0.1)',
  logoBorder:        '#27272A',
}

const NAV = [
  { label: 'Dashboard', Icon: LayoutDashboard, href: '/useradmin/dashboard' },
  { label: 'Reports', Icon: BarChart2, href: '/useradmin/reports' },
]

export default function UserAdminSidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

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
        width: expanded ? '220px' : '64px',
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
      <a
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
          fontWeight: 700, fontSize: '1.0625rem', color: '#FFFFFF',
          letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0, transition: 'opacity 0.15s',
        }}>
          Tasking
        </span>
      </a>

      {/* Nav */}
      <div style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV.map(({ label, Icon, href }) => {
          const active = pathname === href || (href !== '/useradmin/dashboard' && pathname.startsWith(href))
          return (
            <a
              key={label}
              href={href}
              onMouseEnter={() => setHoveredKey(label)}
              onMouseLeave={() => setHoveredKey(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                background: active ? THEME.sidebarActiveBg : hoveredKey === label ? THEME.sidebarHoverBg : 'transparent',
                color: active ? THEME.sidebarActiveText : THEME.sidebarText,
                fontWeight: active ? 600 : 500,
                fontSize: '0.9rem', textDecoration: 'none', whiteSpace: 'nowrap',
                transition: 'background 0.15s',
              }}
            >
              <Icon size={18} strokeWidth={2.1} style={{ display: 'block', flexShrink: 0 }} />
              <span style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? 160 : 0, overflow: 'hidden', transition: 'opacity 0.15s' }}>{label}</span>
            </a>
          )
        })}
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
          <span style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? 160 : 0, overflow: 'hidden', transition: 'opacity 0.15s' }}>Logout</span>
        </button>
      </div>
    </aside>
  )
}
