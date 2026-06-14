'use client'

import { useState, useEffect, useRef } from 'react'
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
  GripVertical,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const NAV_ITEMS = [
  { label: 'Dashboard',     Icon: LayoutDashboard, href: '/owner/dashboard',       dot: null as 'messages' | 'announcements' | 'review' | null },
  { label: 'Shifts',        Icon: CalendarDays,    href: '/owner/shifts',          dot: null },
  { label: 'Tasks',         Icon: CheckSquare,     href: '/owner/tasks',           dot: null },
  { label: 'Team',          Icon: Users,            href: '/owner/team',            dot: null },
  { label: 'Communication', Icon: MessageCircle,    href: '/owner/communication',   dot: 'messages' as const },
  { label: 'Recruitment',   Icon: UserPlus,         href: '/owner/recruitment',     dot: 'review' as const },
  { label: 'Attendance',    Icon: ClipboardList,    href: '/owner/attendance',      dot: null },
  { label: 'Report',        Icon: BarChart2,        href: '/owner/report',          dot: null },
]

const NAV_LABELS = NAV_ITEMS.map(i => i.label)
const ORDER_KEY = 'owner_sidebar_nav_order'

function mergeOrder(saved: string[]): string[] {
  const valid = saved.filter(l => NAV_LABELS.includes(l))
  const missing = NAV_LABELS.filter(l => !valid.includes(l))
  return [...valid, ...missing]
}

type Theme = {
  sidebarBg: string
  sidebarText: string
  sidebarActiveBg: string
  sidebarActiveText: string
  sidebarHoverBg: string
  sidebarBorder: string
  logoBorder: string
}

const OWNER_THEME: Theme = {
  sidebarBg: '#1C1C1E',
  sidebarText: '#FFFFFF',
  sidebarActiveBg: '#F97316',
  sidebarActiveText: '#FFFFFF',
  sidebarHoverBg: 'rgba(255,255,255,0.1)',
  sidebarBorder: 'rgba(255,255,255,0.08)',
  logoBorder: 'rgba(255,255,255,0.08)',
}

export default function OwnerSidebar({
  unreadMessages,
  unreadAnnouncements,
}: {
  unreadMessages?: number
  unreadAnnouncements?: number
}) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [userRole, setUserRole] = useState('')
  const theme = OWNER_THEME
  const [msgCount, setMsgCount] = useState(unreadMessages ?? 0)
  const [annCount, setAnnCount] = useState(unreadAnnouncements ?? 0)
  const [reviewCount, setReviewCount] = useState(0)

  // ── Sidebar order ──────────────────────────────────────────────────────────
  const [navOrder, setNavOrder] = useState<string[]>(NAV_LABELS)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY)
      if (saved) setNavOrder(mergeOrder(JSON.parse(saved)))
    } catch {}
  }, [])

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const dragNodeRef = useRef<HTMLAnchorElement | null>(null)

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    // Transparent drag image so we don't see the default ghost
    const ghost = document.createElement('div')
    ghost.style.position = 'fixed'
    ghost.style.top = '-1000px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropIdx(idx)
  }

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null); setDropIdx(null); return
    }
    const next = [...navOrder]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)
    setNavOrder(next)
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch {}
    setDragIdx(null)
    setDropIdx(null)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setDropIdx(null)
  }

  // ── Unread counts + realtime ────────────────────────────────────────────────
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

        fetch(`/api/inbox/unread-count?user_id=${internalId}&company_id=${cid}`)
          .then(r => r.json())
          .then(data => { if (data.success) setMsgCount(data.unread_messages ?? 0) })
          .catch(() => {})

        fetch(`/api/recruitment?company_id=${cid}&resource=pending_approval`)
          .then(r => r.json())
          .then(data => { if (data.success) setReviewCount((data.pendingPostings as unknown[]).length ?? 0) })
          .catch(() => {})

        const readKey = `ann_read_ids_${cid}_${internalId}`
        let readIds: Set<string> = new Set()
        try {
          const raw = localStorage.getItem(readKey)
          if (raw) readIds = new Set(JSON.parse(raw))
        } catch {}

        fetch(`/api/inbox/announcements?company_id=${cid}&role=owner`)
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
          .channel('owner-sidebar-messages')
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
          .channel('owner-sidebar-review')
          .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'job_postings',
            filter: `company_id=eq.${cid}`,
          }, refreshReviewCount)
          .subscribe()

        const refreshAnnCount = () => {
          const rkey = `ann_read_ids_${cid}_${internalId}`
          let rids: Set<string> = new Set()
          try { const raw2 = localStorage.getItem(rkey); if (raw2) rids = new Set(JSON.parse(raw2)) } catch {}
          fetch(`/api/inbox/announcements?company_id=${cid}&role=owner`)
            .then(r => r.json())
            .then(data => {
              if (data.success) setAnnCount((data.announcements as { id: string }[]).filter(a => !rids.has(a.id)).length)
            }).catch(() => {})
        }

        const annChannel = supabase
          .channel('owner-sidebar-announcements')
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

  useEffect(() => {
    const handler = () => setReviewCount(0)
    window.addEventListener('recruitment-review-opened', handler)
    return () => window.removeEventListener('recruitment-review-opened', handler)
  }, [])

  useEffect(() => {
    if (pathname !== '/owner/communication') return
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
        fetch(`/api/inbox/announcements?company_id=${cid}&role=owner`)
          .then(r => r.json())
          .then(data => {
            if (!data.success) return
            const allIds = (data.announcements as { id: string }[]).map(a => a.id)
            localStorage.setItem(`ann_read_ids_${cid}_${internalId}`, JSON.stringify(allIds))
          }).catch(() => {})
      }).catch(() => {})
  }, [pathname])

  useEffect(() => { if (unreadMessages !== undefined) setMsgCount(unreadMessages) }, [unreadMessages])
  useEffect(() => { if (unreadAnnouncements !== undefined) setAnnCount(unreadAnnouncements) }, [unreadAnnouncements])

  const visibleLabels = userRole === 'Manager'
    ? navOrder.filter(l => l !== 'Report')
    : navOrder

  const orderedItems = visibleLabels
    .map(label => NAV_ITEMS.find(item => item.label === label))
    .filter(Boolean) as typeof NAV_ITEMS

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
        {orderedItems.map(({ label, Icon, href, dot }, idx) => {
          const active = pathname === href
          const showDot = dot === 'messages' ? msgCount > 0 : dot === 'announcements' ? annCount > 0 : dot === 'review' ? reviewCount > 0 : false
          const isDragging = dragIdx === idx
          const isDropTarget = dropIdx === idx && dragIdx !== null && dragIdx !== idx

          return (
            <a
              key={label}
              ref={idx === 0 ? dragNodeRef : undefined}
              href={href}
              draggable={expanded}
              onDragStart={e => handleDragStart(e, idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={e => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={e => { if (dragIdx !== null) e.preventDefault() }}
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
                cursor: expanded ? 'grab' : 'pointer',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                marginBottom: '2px',
                transition: 'background 0.12s, color 0.12s, opacity 0.12s',
                position: 'relative',
                opacity: isDragging ? 0.35 : 1,
                // Drop indicator: orange top border on the target slot
                borderTop: isDropTarget ? '2px solid #F97316' : '2px solid transparent',
              }}
              onMouseEnterCapture={(e) => { if (!active && !isDragging) { (e.currentTarget as HTMLAnchorElement).style.background = theme.sidebarHoverBg } }}
              onMouseLeaveCapture={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = active ? theme.sidebarActiveBg : 'transparent' } }}
            >
              {/* Drag handle — visible only when expanded and hovering */}
              <span style={{
                position: 'absolute',
                left: 2,
                opacity: expanded && hoveredIdx === idx && !active ? 0.4 : 0,
                transition: 'opacity 0.15s',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}>
                <GripVertical size={12} strokeWidth={2} />
              </span>

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
