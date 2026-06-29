'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  BarChart2,
  Users,
  MessageCircle,
  LogOut,
  UserPlus,
  ClipboardList,
  CheckSquare,
  CalendarDays,
  Settings,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const NAV_ITEMS = [
  { label: 'Dashboard',     Icon: LayoutDashboard, href: '/partner/dashboard',       dot: null as 'messages' | 'announcements' | 'review' | null },
  { label: 'Shifts',        Icon: CalendarDays,    href: '/partner/shifts',          dot: null },
  { label: 'Tasks',         Icon: CheckSquare,     href: '/partner/tasks',           dot: null },
  { label: 'Team',          Icon: Users,            href: '/partner/team',            dot: null },
  { label: 'Communication', Icon: MessageCircle,    href: '/partner/communication',   dot: 'messages' as const },
  { label: 'Recruitment',   Icon: UserPlus,         href: '/partner/recruitment',     dot: 'review' as const },
  { label: 'Attendance',    Icon: ClipboardList,    href: '/partner/attendance',      dot: null },
  { label: 'Report',        Icon: BarChart2,        href: '/partner/report',          dot: null },
  { label: 'Settings',      Icon: Settings,         href: '/partner/settings',        dot: null },
]

type Theme = {
  sidebarBg: string
  sidebarText: string
  sidebarActiveBg: string
  sidebarActiveText: string
  sidebarHoverBg: string
  sidebarBorder: string
  logoBorder: string
}

const PARTNER_THEME: Theme = {
  sidebarBg: '#1C1C1E',
  sidebarText: '#FFFFFF',
  sidebarActiveBg: '#F97316',
  sidebarActiveText: '#FFFFFF',
  sidebarHoverBg: 'rgba(255,255,255,0.1)',
  sidebarBorder: 'rgba(255,255,255,0.08)',
  logoBorder: 'rgba(255,255,255,0.08)',
}

export default function PartnerSidebar({
  unreadMessages,
  unreadAnnouncements,
}: {
  unreadMessages?: number
  unreadAnnouncements?: number
}) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [userRole, setUserRole] = useState('')
  const theme = PARTNER_THEME
  const [msgCount, setMsgCount] = useState(unreadMessages ?? 0)
  const [annCount, setAnnCount] = useState(unreadAnnouncements ?? 0)
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    const authUid = typeof localStorage !== 'undefined' ? localStorage.getItem('tasking_user_id') : null
    if (!authUid) return

    fetch(`/api/user/me?user_id=${authUid}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        setUserRole(d.user.role)
        const internalId: string = d.user.id
        const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${authUid}`)
        if (!cid) return

        // Unread messages: from API (DB-backed, accurate)
        fetch(`/api/inbox/unread-count?user_id=${internalId}&company_id=${cid}`)
          .then(r => r.json())
          .then(data => { if (data.success) setMsgCount(data.unread_messages ?? 0) })
          .catch(() => {})

        // Pending review jobs
        fetch(`/api/recruitment?company_id=${cid}&resource=pending_approval`)
          .then(r => r.json())
          .then(data => { if (data.success) setReviewCount((data.pendingPostings as unknown[]).length ?? 0) })
          .catch(() => {})

        // Unread announcements: from localStorage per-ID read set (page writes this)
        // We fetch the announcement list to know total count, then subtract read IDs
        const readKey = `ann_read_ids_${cid}_${internalId}`
        let readIds: Set<string> = new Set()
        try {
          const raw = localStorage.getItem(readKey)
          if (raw) readIds = new Set(JSON.parse(raw))
        } catch {}

        fetch(`/api/inbox/announcements?company_id=${cid}&role=Partner`)
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
          .channel('partner-sidebar-messages')
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'messages',
            filter: `to_user_id=eq.${internalId}`,
          }, () => { setMsgCount(c => c + 1) })
          .subscribe()

        const refreshReviewCount = () => {
          fetch(`/api/recruitment?company_id=${cid}&resource=pending_approval`)
            .then(r => r.json())
            .then(data => { if (data.success) setReviewCount((data.pendingPostings as unknown[]).length ?? 0) })
            .catch(() => {})
        }

        const reviewChannel = supabase
          .channel('partner-sidebar-review')
          .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'job_postings',
            filter: `company_id=eq.${cid}`,
          }, refreshReviewCount)
          .subscribe()

        const refreshAnnCount = () => {
          const rkey = `ann_read_ids_${cid}_${internalId}`
          let rids: Set<string> = new Set()
          try { const raw2 = localStorage.getItem(rkey); if (raw2) rids = new Set(JSON.parse(raw2)) } catch {}
          fetch(`/api/inbox/announcements?company_id=${cid}&role=Partner`)
            .then(r => r.json())
            .then(data => {
              if (data.success) setAnnCount((data.announcements as { id: string }[]).filter(a => !rids.has(a.id)).length)
            }).catch(() => {})
        }

        const annChannel = supabase
          .channel('partner-sidebar-announcements')
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'announcements',
            filter: `company_id=eq.${cid}`,
          }, refreshAnnCount)
          .subscribe()

        return () => {
          supabase.removeChannel(msgChannel)
          supabase.removeChannel(annChannel)
          supabase.removeChannel(reviewChannel)
        }
      })
      .catch(() => {})
  }, [])

  // Clear review dot when user opens the Review tab (event from the page)
  useEffect(() => {
    const handler = () => setReviewCount(0)
    window.addEventListener('recruitment-review-opened', handler)
    return () => window.removeEventListener('recruitment-review-opened', handler)
  }, [])

  // When user opens communication page, mark all announcements as read in localStorage
  useEffect(() => {
    if (pathname !== '/partner/communication') return
    setMsgCount(0)
    setAnnCount(0)
    const authUid = typeof localStorage !== 'undefined' ? localStorage.getItem('tasking_user_id') : null
    if (!authUid) return
    fetch(`/api/user/me?user_id=${authUid}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        const internalId: string = d.user.id
        const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${authUid}`)
        if (!cid) return
        fetch(`/api/inbox/announcements?company_id=${cid}&role=Partner`)
          .then(r => r.json())
          .then(data => {
            if (!data.success) return
            const allIds = (data.announcements as { id: string }[]).map(a => a.id)
            localStorage.setItem(`ann_read_ids_${cid}_${internalId}`, JSON.stringify(allIds))
          }).catch(() => {})
      }).catch(() => {})
  }, [pathname])

  useEffect(() => {
    if (unreadMessages !== undefined) setMsgCount(unreadMessages)
  }, [unreadMessages])
  useEffect(() => {
    if (unreadAnnouncements !== undefined) setAnnCount(unreadAnnouncements)
  }, [unreadAnnouncements])

  const visibleNavItems = userRole === 'Manager'
    ? NAV_ITEMS.filter(item => item.label !== 'Report')
    : NAV_ITEMS

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
        background: theme.sidebarBg,
        borderRight: `1px solid ${theme.sidebarBorder}`,
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
          borderBottom: `1px solid ${theme.logoBorder}`,
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
          <rect width="32" height="32" rx="8" fill={userRole === 'Manager' ? '#3B82F6' : '#F97316'} />
          <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="white" />
          <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="white" />
          <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="white" />
          <circle cx="22" cy="10.25" r="3.5" fill="#10B981" />
          <path d="M20.3 10.25L21.5 11.5L23.8 9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{
          fontWeight: 700,
          fontSize: '1.0625rem',
          color: theme.sidebarText,
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
        {visibleNavItems.map(({ label, Icon, href, dot }) => {
          const active = pathname === href
          const showDot = dot === 'messages' ? msgCount > 0 : dot === 'announcements' ? annCount > 0 : dot === 'review' ? reviewCount > 0 : false
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
                background: active ? theme.sidebarActiveBg : 'transparent',
                color: active ? theme.sidebarActiveText : theme.sidebarText,
                fontWeight: active ? 600 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                marginBottom: '2px',
                transition: 'background 0.12s, color 0.12s',
                position: 'relative',
              }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = theme.sidebarHoverBg } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent' } }}
            >
              <span style={{ position: 'relative', flexShrink: 0 }}>
                <Icon
                  size={18}
                  strokeWidth={2.1}
                  style={{ display: 'block', color: 'currentColor' }}
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

      {/* Logout */}
      <div style={{ padding: '12px 8px', borderTop: `1px solid ${theme.logoBorder}`, flexShrink: 0 }}>
        <div style={{ borderTop: `1px solid ${theme.sidebarBorder}`, paddingTop: '8px', marginTop: '2px' }}>
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

