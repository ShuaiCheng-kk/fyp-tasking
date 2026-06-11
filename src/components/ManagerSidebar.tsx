'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, BarChart2, Users, MessageCircle,
  LogOut, UserPlus, ClipboardList, CalendarDays, CheckSquare,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const MANAGER_BLUE = '#2563EB'
const SIDEBAR_BG  = '#1E3A5F'
const SIDEBAR_BORDER = '#163050'

const NAV_ITEMS = [
  { label: 'Dashboard',     Icon: LayoutDashboard, href: '/manager/dashboard',     dot: null as 'messages' | 'announcements' | null },
  { label: 'Shifts',        Icon: CalendarDays,    href: '/manager/shifts',        dot: null },
  { label: 'Tasks',         Icon: CheckSquare,     href: '/manager/tasks',         dot: null },
  { label: 'Team',          Icon: Users,           href: '/manager/team',          dot: null },
  { label: 'Communication', Icon: MessageCircle,   href: '/manager/communication', dot: 'messages' as const },
  { label: 'Recruitment',   Icon: UserPlus,        href: '/manager/recruitment',   dot: null },
  { label: 'Attendance',    Icon: ClipboardList,   href: '/manager/attendance',    dot: null },
  { label: 'Report',        Icon: BarChart2,       href: '/manager/report',        dot: null },
]

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

        fetch(`/api/inbox/unread-count?user_id=${internalId}&company_id=${cid}`)
          .then(r => r.json())
          .then(data => { if (data.success) setMsgCount(data.unread_messages ?? 0) })
          .catch(() => {})

        const readKey = `ann_read_ids_${cid}_${internalId}`
        let readIds: Set<string> = new Set()
        try {
          const raw = localStorage.getItem(readKey)
          if (raw) readIds = new Set(JSON.parse(raw))
        } catch {}

        const deptId: string | null = d.user.department_id ?? null
        const annUrl = `/api/inbox/announcements?company_id=${cid}&role=manager&user_id=${internalId}${deptId ? `&department_id=${deptId}` : ''}`
        fetch(annUrl)
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
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user_id=eq.${internalId}` },
            () => setMsgCount(c => c + 1))
          .subscribe()

        const refreshAnnCount = () => {
          const readKey2 = `ann_read_ids_${cid}_${internalId}`
          let rids: Set<string> = new Set()
          try { const raw2 = localStorage.getItem(readKey2); if (raw2) rids = new Set(JSON.parse(raw2)) } catch {}
          const url2 = `/api/inbox/announcements?company_id=${cid}&role=manager&user_id=${internalId}${deptId ? `&department_id=${deptId}` : ''}`
          fetch(url2).then(r => r.json()).then(data => {
            if (data.success) setAnnCount((data.announcements as { id: string }[]).filter((a: { id: string }) => !rids.has(a.id)).length)
          }).catch(() => {})
        }

        const annChannel = supabase
          .channel('manager-sidebar-announcements')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements', filter: `company_id=eq.${cid}` },
            refreshAnnCount)
          .subscribe()

        return () => {
          supabase.removeChannel(msgChannel)
          supabase.removeChannel(annChannel)
        }
      })
      .catch(() => {})
  }, [])

  // Clear dots when user visits Communication page
  useEffect(() => {
    if (pathname === '/manager/communication') {
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
        display: 'flex', flexDirection: 'column',
        height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 20,
        transition: 'width 0.2s', overflow: 'hidden', flexShrink: 0,
      }}
    >
      <Link
        href="/"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '20px 18px 18px', borderBottom: `1px solid ${SIDEBAR_BORDER}`,
          textDecoration: 'none', flexShrink: 0,
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
          fontWeight: 700, fontSize: '1.0625rem', color: '#FFFFFF',
          letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0, transition: 'opacity 0.15s',
        }}>
          Tasking
        </span>
      </Link>

      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'hidden' }}>
        {NAV_ITEMS.map(({ label, Icon, href, dot }) => {
          const active = pathname === href || (href === '/manager/communication' && (pathname === '/manager/announcements' || pathname === '/manager/inbox'))
          const showDot = dot === 'messages' ? totalDot > 0 : false
          return (
            <a
              key={label}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                background: active ? MANAGER_BLUE : 'transparent',
                color: active ? '#FFFFFF' : '#93C5FD',
                fontWeight: active ? 600 : 500, fontSize: '0.9rem',
                cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
                marginBottom: '2px', transition: 'background 0.12s, color 0.12s',
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
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
              borderRadius: '8px', color: '#EF4444', fontWeight: 500, fontSize: '0.9rem',
              transition: 'color 0.12s, background 0.12s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'none' }}
          >
            <LogOut size={18} strokeWidth={2} style={{ flexShrink: 0, color: 'inherit' }} />
            <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
