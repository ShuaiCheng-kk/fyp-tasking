'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  History,
  User,
  LogOut,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const SIDEBAR_BG = '#16A34A'
const SIDEBAR_BORDER = '#15803D'
const ACTIVE_BG = '#15803D'

const navItems = [
  { label: 'Dashboard', Icon: LayoutDashboard, href: '/worker/dashboard' },
  { label: 'Attendance', Icon: Clock, href: '/worker/attendance' },
  { label: 'Availability', Icon: CalendarDays, href: '/worker/availability' },
  { label: 'Job History', Icon: History, href: '/worker/job-history' },
  { label: 'Profile', Icon: User, href: '/worker/profile' },
]

export default function WorkerSidebar() {
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
    sessionStorage.removeItem('tasking_session_active')

    window.location.href = '/signout'
  }

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        width: expanded ? '220px' : '64px',
        background: SIDEBAR_BG,
        borderRight: `1px solid ${SIDEBAR_BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 20,
        transition: 'width 0.2s',
        overflow: 'hidden',
      }}
    >
      <Link
        href="/worker/dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '20px 18px 18px',
          borderBottom: `1px solid ${SIDEBAR_BORDER}`,
          textDecoration: 'none',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="white" />
          <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="#16A34A" />
          <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="#16A34A" />
          <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="#16A34A" />
          <circle cx="22" cy="10.25" r="3.5" fill="#4ADE80" />
          <path
            d="M20.3 10.25L21.5 11.5L23.8 9"
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span
          style={{
            fontWeight: 700,
            fontSize: '1.0625rem',
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
            opacity: expanded ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
        >
          Tasking
        </span>
      </Link>

      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {navItems.map(({ label, Icon, href }) => {
          const active = pathname === href

          return (
            <Link
              key={label}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: active ? ACTIVE_BG : 'transparent',
                color: active ? '#FFFFFF' : '#BBF7D0',
                fontWeight: active ? 600 : 500,
                fontSize: '0.9rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                marginBottom: '2px',
              }}
            >
              <Icon size={18} strokeWidth={2.1} />
              <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '12px 8px', borderTop: `1px solid ${SIDEBAR_BORDER}` }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '8px',
            color: '#FCA5A5',
            fontWeight: 500,
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
          }}
        >
          <LogOut size={18} />
          <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
            Logout
          </span>
        </button>
      </div>
    </aside>
  )
}