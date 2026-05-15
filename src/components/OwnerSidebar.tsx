'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  BarChart2,
  Users,
  Inbox,
  Settings,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

const NAV_ITEMS = [
  { label: 'Dashboard', Icon: LayoutDashboard, href: '/owner/dashboard' },
  { label: 'Report',    Icon: BarChart2,       href: '/owner/report'    },
  { label: 'Team',      Icon: Users,           href: '/owner/team'      },
  { label: 'Inbox',     Icon: Inbox,           href: '/owner/inbox'     },
  { label: 'Settings',  Icon: Settings,        href: '/owner/settings'  },
]

export default function OwnerSidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
          localStorage.removeItem('tasking_user_id')
          localStorage.removeItem('tasking_company_id')
          localStorage.removeItem('tasking_active_session')
          window.location.href = '/signin'
          return
        }

        if (session) {
          const sessionMarker = sessionStorage.getItem('tasking_session_active')
          if (!sessionMarker) {
            supabase.auth.signOut()
            localStorage.removeItem('tasking_user_id')
            localStorage.removeItem('tasking_company_id')
            localStorage.removeItem('tasking_active_session')
            window.location.href = '/signin'
            return
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    localStorage.removeItem('tasking_user_id')
    localStorage.removeItem('tasking_company_id')
    localStorage.removeItem('tasking_active_session')
    window.location.href = '/signout'
  }

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        width: expanded ? '220px' : '64px',
        background: '#FFFFFF',
        borderRight: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
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
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '20px 18px 18px',
          borderBottom: '1px solid #F3F4F6',
          textDecoration: 'none',
          flexShrink: 0,
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
          fontWeight: 700,
          fontSize: '1.0625rem',
          color: '#111827',
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0,
          transition: 'opacity 0.15s',
        }}>
          Tasking
        </span>
      </Link>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'hidden' }}>
        {NAV_ITEMS.map(({ label, Icon, href }) => {
          const active = pathname === href
          return (
            <a
              key={label}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: active ? '#FFF7ED' : 'transparent',
                color: active ? '#EA580C' : '#6B7280',
                fontWeight: active ? 600 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                marginBottom: '2px',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#F3F4F6' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <Icon
                size={18}
                strokeWidth={2.1}
                style={{ flexShrink: 0, color: active ? '#EA580C' : 'currentColor' }}
              />
              <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
                {label}
              </span>
            </a>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '8px', marginTop: '2px' }}>
          <button
            onClick={handleSignOut}
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
              color: '#EF4444',
              fontWeight: 500,
              fontSize: '0.9rem',
              transition: 'color 0.12s, background 0.12s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#DC2626'
              e.currentTarget.style.background = '#FEF2F2'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#EF4444'
              e.currentTarget.style.background = 'none'
            }}
          >
            <LogOut size={18} strokeWidth={2} style={{ flexShrink: 0, color: 'inherit' }} />
            <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
              Logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}
