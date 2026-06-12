'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, ClipboardList, MessageCircle, LogOut } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const NAV_ITEMS = [
  { label: 'Dashboard',     Icon: LayoutDashboard, href: '/employee/dashboard',     dot: null as 'messages' | 'announcements' | null },
  { label: 'Communication', Icon: MessageCircle,   href: '/employee/communication', dot: 'messages' as const },
  { label: 'Attendance',    Icon: ClipboardList,   href: '/employee/attendance',    dot: null },
]

const EMPLOYEE_GREEN = '#16A34A'
const SIDEBAR_BG = '#14532D'
const SIDEBAR_BORDER = '#0F3F24'

export default function EmployeeSidebar({ unreadMessages, unreadAnnouncements }: { unreadMessages?: number; unreadAnnouncements?: number }) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [msgCount, setMsgCount] = useState(unreadMessages ?? 0)
  const [annCount, setAnnCount] = useState(unreadAnnouncements ?? 0)

  useEffect(() => {
    const authUid = typeof localStorage !== 'undefined' ? localStorage.getItem('tasking_user_id') : null
    if (!authUid) return

    fetch(`/api/user/me?user_id=${authUid}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        const internalId: string = d.user.id
        const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${authUid}`)

        fetch(`/api/inbox/unread-count?user_id=${internalId}`)
          .then(r => r.json())
          .then(data => { if (data.success) setMsgCount(data.unread_messages ?? 0) })
          .catch(() => {})

        // Unread announcements: compare fetched list against localStorage read set
        const readKey = `ann_read_ids_${cid}_${internalId}`
        let readIds: Set<string> = new Set()
        try {
          const raw = localStorage.getItem(readKey)
          if (raw) readIds = new Set(JSON.parse(raw))
        } catch {}

        fetch(`/api/employee/announcements?user_id=${authUid}`)
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              const unread = (data.announcements as { id: string }[]).filter(a => !readIds.has(a.id)).length
              setAnnCount(unread)
            }
          })
          .catch(() => {})

        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const msgChannel = supabase
          .channel('employee-sidebar-messages')
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'messages',
            filter: `to_user_id=eq.${internalId}`,
          }, () => { setMsgCount(c => c + 1) })
          .subscribe()

        const annChannel = supabase
          .channel('employee-sidebar-announcements')
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'announcements',
          }, () => { setAnnCount(c => c + 1) })
          .subscribe()

        return () => {
          supabase.removeChannel(msgChannel)
          supabase.removeChannel(annChannel)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (pathname === '/employee/communication') {
      setMsgCount(0)
      setAnnCount(0)
    }
  }, [pathname])

  useEffect(() => { if (unreadMessages !== undefined) setMsgCount(unreadMessages) }, [unreadMessages])
  useEffect(() => { if (unreadAnnouncements !== undefined) setAnnCount(unreadAnnouncements) }, [unreadAnnouncements])

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

  const totalDot = msgCount + annCount

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
        flexShrink: 0,
      }}
    >
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '20px 18px 18px',
          borderBottom: `1px solid ${SIDEBAR_BORDER}`,
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
          <rect width="32" height="32" rx="8" fill="#16A34A" />
          <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="white" />
          <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="white" />
          <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="white" />
          <circle cx="22" cy="10.25" r="3.5" fill="#4ADE80" />
          <path d="M20.3 10.25L21.5 11.5L23.8 9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{
          fontWeight: 700,
          fontSize: '1.0625rem',
          color: '#FFFFFF',
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0,
          transition: 'opacity 0.15s',
        }}>
          Tasking
        </span>
      </Link>

      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'hidden' }}>
        {NAV_ITEMS.map(({ label, Icon, href, dot }) => {
          const active = pathname === href || (href === '/employee/communication' && (pathname === '/employee/announcements' || pathname === '/employee/inbox'))
          const showDot = dot === 'messages' ? totalDot > 0 : false
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
                background: active ? EMPLOYEE_GREEN : 'transparent',
                color: active ? '#FFFFFF' : '#DCFCE7',
                fontWeight: active ? 600 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                marginBottom: '2px',
                transition: 'background 0.12s, color 0.12s',
                position: 'relative',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ position: 'relative', flexShrink: 0 }}>
                <Icon size={18} strokeWidth={2.1} style={{ display: 'block', color: 'currentColor' }} />
                {showDot && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#EF4444', border: `1.5px solid ${SIDEBAR_BG}`,
                  }} />
                )}
              </span>
              <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                {label}
                {showDot && totalDot > 0 && (
                  <span style={{ minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {totalDot}
                  </span>
                )}
              </span>
            </a>
          )
        })}
      </nav>

      <div style={{ padding: '12px 8px', borderTop: `1px solid ${SIDEBAR_BORDER}`, flexShrink: 0 }}>
        <div style={{ borderTop: `1px solid ${SIDEBAR_BORDER}`, paddingTop: '8px', marginTop: '2px' }}>
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
              transition: 'color 0.12s, background 0.12s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FECACA'
              e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#FCA5A5'
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
