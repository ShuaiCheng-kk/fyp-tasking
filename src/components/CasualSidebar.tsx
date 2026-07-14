'use client'

// Casual Worker sidebar — same visual system as OwnerSidebar/GuestSidebar (white, hover-expand,
// orange active state, logout at the bottom). A Casual Worker is a confirmed Guest User, so this
// reuses the exact chrome; only the nav items differ.

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Clock, ClipboardList, User, LogOut } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const NAV_ITEMS = [
  { label: 'Dashboard',     Icon: LayoutDashboard, href: '/casual/dashboard' },
  { label: 'Attendance',    Icon: Clock,            href: '/casual/attendance' },
  { label: 'Applications',  Icon: ClipboardList,    href: '/casual/applications' },
  { label: 'Profile',       Icon: User,             href: '/casual/profile' },
]

const THEME = {
  sidebarBg: '#FFFFFF',
  sidebarText: '#374151',
  sidebarActiveText: '#F97316',
  sidebarHoverBg: '#F9FAFB',
  sidebarBorder: '#E5E7EB',
}

export default function CasualSidebar({ disabled = false }: { disabled?: boolean }) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    localStorage.removeItem('tasking_user_id')
    localStorage.removeItem('tasking_user_role')
    localStorage.removeItem('tasking_company_id')
    localStorage.removeItem('tasking_active_session')
    // Logging out abandons any half-finished "apply to this job" intent — leaving it behind would
    // hijack the NEXT sign-in, bouncing them to the job board instead of their own pages.
    localStorage.removeItem('apply_job_id')
    sessionStorage.removeItem('tasking_session_active')
    window.location.href = '/signout'
  }

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
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
        href="/"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '20px 18px 18px',
          borderBottom: `1px solid ${THEME.sidebarBorder}`,
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

      {/* Nav — while `disabled` (first-login payment gate), every item except Profile is locked
          so the worker can't wander off before completing payment info. */}
      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'hidden' }}>
        {NAV_ITEMS.map(({ label, Icon, href }) => {
          const active = pathname === href
          const itemDisabled = disabled && label !== 'Profile'
          return (
            <Link
              key={label}
              href={itemDisabled ? '#' : href}
              aria-disabled={itemDisabled}
              onClick={e => { if (itemDisabled) e.preventDefault() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'transparent',
                border: active ? '1.5px solid #F97316' : '1.5px solid transparent',
                color: itemDisabled ? '#D1D5DB' : (active ? THEME.sidebarActiveText : THEME.sidebarText),
                fontWeight: active ? 600 : 500,
                fontSize: '0.9rem',
                cursor: itemDisabled ? 'not-allowed' : 'pointer',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                marginBottom: '2px',
                transition: 'background 0.12s, color 0.12s, border-color 0.15s',
              }}
              onMouseEnter={e => { if (!active && !itemDisabled) e.currentTarget.style.background = THEME.sidebarHoverBg }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <Icon size={18} strokeWidth={2.1} style={{ flexShrink: 0, color: 'currentColor' }} />
              <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 8px', borderTop: `1px solid ${THEME.sidebarBorder}`, flexShrink: 0 }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', background: 'none', border: 'none',
            cursor: 'pointer', borderRadius: '8px', color: '#EF4444',
            fontWeight: 500, fontSize: '0.9rem',
            transition: 'color 0.12s, background 0.12s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'none' }}
        >
          <LogOut size={18} strokeWidth={2} style={{ flexShrink: 0, color: 'inherit' }} />
          <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>Logout</span>
        </button>
      </div>
    </aside>
  )
}
