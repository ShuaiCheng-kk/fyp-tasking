'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, MessageSquare, Megaphone, Settings, LogOut } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const NAV_ITEMS = [
  { label: 'Dashboard',     Icon: LayoutDashboard, href: '/manager/dashboard',     dot: null as 'messages' | 'announcements' | null },
  { label: 'Team',          Icon: Users,           href: '/manager/team',          dot: null },
  { label: 'Announcements', Icon: Megaphone,       href: '/manager/announcements', dot: 'announcements' as const },
  { label: 'Inbox',         Icon: MessageSquare,   href: '/manager/inbox',         dot: 'messages' as const },
  { label: 'Settings',      Icon: Settings,        href: '/manager/settings',      dot: null },
]

const ACCENT = '#3B82F6'
const ACTIVE_BG = '#EFF6FF'

export default function ManagerSidebar({

  unreadMessages,
  unreadAnnouncements,
}: {

  unreadMessages?: number
  unreadAnnouncements?: number
}) {
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
        if (!cid) return

        // Unread messages: from API
        fetch(`/api/inbox/unread-count?user_id=${internalId}&company_id=${cid}`)
          .then(r => r.json())
          .then(data => { if (data.success) setMsgCount(data.unread_messages ?? 0) })
          .catch(() => {})

        // Unread announcements: from localStorage per-ID read set
        const readKey = `ann_read_ids_${cid}_${internalId}`
        let readIds: Set<string> = new Set()
        try {
          const raw = localStorage.getItem(readKey)
          if (raw) readIds = new Set(JSON.parse(raw))
        } catch {}

        fetch(`/api/inbox/announcements?company_id=${cid}&role=manager`)
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
          .channel('manager-sidebar-messages')
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'messages',
            filter: `to_user_id=eq.${internalId}`,
          }, () => { setMsgCount(c => c + 1) })
          .subscribe()

        const annChannel = supabase
          .channel('manager-sidebar-announcements')
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'announcements',
            filter: `company_id=eq.${cid}`,
          }, () => { setAnnCount(c => c + 1) })
          .subscribe()

        return () => {
          supabase.removeChannel(msgChannel)
          supabase.removeChannel(annChannel)
        }
      })
      .catch(() => {})
  }, [])

  // Clear message dot immediately when user opens inbox
  useEffect(() => {
    if (pathname === '/manager/inbox') setMsgCount(0)
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
          <rect width="32" height="32" rx="8" fill="#3B82F6" />
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

      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'hidden' }}>
        {NAV_ITEMS.map(({ label, Icon, href, dot }) => {
          const active = pathname === href
          const showDot = dot === 'messages' ? msgCount > 0 : dot === 'announcements' ? annCount > 0 : false
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
                background: active ? ACTIVE_BG : 'transparent',
                color: active ? ACCENT : '#6B7280',
                fontWeight: active ? 600 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                marginBottom: '2px',
                transition: 'background 0.12s, color 0.12s',
                position: 'relative',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#F3F4F6' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ position: 'relative', flexShrink: 0 }}>
                <Icon
                  size={18}
                  strokeWidth={2.1}
                  style={{ display: 'block', color: active ? ACCENT : 'currentColor' }}
                />
                {showDot && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#EF4444', border: '1.5px solid #fff',
                  }} />
                )}
              </span>
              <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
                {label}
              </span>
            </a>
          )
        })}
      </nav>

      <div style={{ padding: '12px 8px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '8px', marginTop: '2px' }}>
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
