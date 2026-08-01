'use client'

// Employee's Communication page — same page shell/tab-switcher design as Owner/Partner/Manager's
// Communication page (src/components/communication/CommunicationView.tsx): header, floating pill
// tab switcher with an animated sliding indicator, full-height content area. Built as its own
// page (not routed through CommunicationView) because Employee's Chat/Announcements are already
// separately-built, purpose-scoped components — EmployeeChatbox only ever contacts this
// Employee's own Manager/colleagues/supervised Casual Workers (/api/employee/contacts), and
// EmployeeAnnouncementsPanel is read-only (Employee can't post, O/P/M-only) and department-scoped
// — reusing those keeps this page correct without touching CommunicationView (shared by the
// frozen Owner/Partner/Manager pages).

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Megaphone } from 'lucide-react'
import EmployeeSidebar from '@/components/EmployeeSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import EmployeeChatbox from '@/components/employee/EmployeeChatbox'
import EmployeeAnnouncementsPanel from '@/components/employee/EmployeeAnnouncementsPanel'
import { useEmployeeClockedOut } from '@/hooks/useEmployeeClockedOut'

type Tab = 'chat' | 'announcements'

export default function EmployeeCommunicationPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const tabBarRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ chat: null, announcements: null })
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, opacity: 0 })

  const [userId, setUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  // Once clocked out of every shift today, sending messages locks — same rule as the Tasks and
  // Shifts pages (2026-08-02).
  const employeeClockedOut = useEmployeeClockedOut(userId)

  // Tab-level red dots — same "Chat: unread messages / Announcements: unread posts" split as
  // Manager's CommunicationView. Fed by callbacks from EmployeeChatbox/EmployeeAnnouncementsPanel
  // themselves (each already tracks this live) rather than a second independent fetch here, so
  // the dot clears the instant the user reads something inside the tab, not on the next realtime tick.
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadAnnCount, setUnreadAnnCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const uid = localStorage.getItem('tasking_user_id')
      if (!uid) { router.replace('/signin'); return }
      const res = await fetch(`/api/user/me?user_id=${uid}`)
      const data = await res.json()
      if (cancelled) return
      if (!data.success) { router.replace('/signin'); return }
      setUserId(data.user.id ?? uid)
      setCompanyId(data.user.company_id ?? '')
      setDepartmentId(data.user.department_id ?? '')
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  useLayoutEffect(() => {
    const container = tabBarRef.current
    const activeButton = tabButtonRefs.current[activeTab]
    if (!container || !activeButton) return
    const containerRect = container.getBoundingClientRect()
    const activeRect = activeButton.getBoundingClientRect()
    setTabIndicator({ left: activeRect.left - containerRect.left, width: activeRect.width, opacity: 1 })
    // Unread counts arrive async and change each pill's width (the badge dot adds itself + an
    // 8px gap) — recompute whenever they change too, not just on tab switch, or the black
    // indicator stays sized to the pre-badge width and the dot pokes out past its edge.
  }, [activeTab, unreadMessages, unreadAnnCount])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F1F5F9' }}>
      <style>{`@keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }`}</style>
      <EmployeeSidebar />

      <main style={{ marginLeft: 64, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, animation: 'blockSlideUp 0.38s ease both 0.04s' }}>
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">Communication</h1>
          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {userId && companyId && <OwnerUserBadge userId={userId} companyId={companyId} />}
          </div>
        </div>

        {/* Tab switcher row — same floating pill capsule with animated indicator as Manager's Communication page */}
        <div style={{ padding: '0 28px 16px', flexShrink: 0 }}>
          <div
            ref={tabBarRef}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: 4,
              background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'relative',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', top: 4, left: tabIndicator.left, width: tabIndicator.width,
                height: 'calc(100% - 8px)', borderRadius: 999,
                background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
                boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
                opacity: tabIndicator.opacity,
                transform: tabIndicator.opacity ? 'translateY(0)' : 'translateY(4px)',
                transition: 'left 0.24s cubic-bezier(0.22, 1, 0.36, 1), width 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                pointerEvents: 'none',
              }}
            />
            {([
              { key: 'chat', label: 'Chat', Icon: MessageSquare, badge: unreadMessages },
              { key: 'announcements', label: 'Announcements', Icon: Megaphone, badge: unreadAnnCount },
            ] as const).map(tab => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  ref={el => { tabButtonRefs.current[tab.key] = el }}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    position: 'relative', zIndex: 1, height: 36, padding: '0 18px', borderRadius: 999,
                    border: 'none', background: 'transparent', color: active ? '#FFFFFF' : '#64748B',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                    transition: 'color 0.18s ease, transform 0.18s ease',
                    transform: active ? 'translateY(-0.5px)' : 'translateY(0)',
                  }}
                >
                  {tab.label}
                  {tab.badge > 0 && (
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#EF4444', flexShrink: 0, border: active ? '1.5px solid #111827' : '1.5px solid #fff' }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '0 28px 28px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {companyId && userId && (
            <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
              <EmployeeChatbox companyId={companyId} internalUserId={userId} onUnreadCount={setUnreadMessages} readOnly={employeeClockedOut} />
            </div>
          )}
          {companyId && userId && departmentId && (
            <div style={{ display: activeTab === 'announcements' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
              <EmployeeAnnouncementsPanel companyId={companyId} internalUserId={userId} departmentId={departmentId} onUnreadCount={setUnreadAnnCount} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
