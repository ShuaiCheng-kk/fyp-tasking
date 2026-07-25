'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Clock, Coffee, CheckSquare, Users, Send, MessageCircle, AlertTriangle } from 'lucide-react'
import EmployeeSidebar from '@/components/EmployeeSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { Task, KanbanGroup } from '@/types/Task'

const GREEN  = '#16A34A'
const BORDER = '#E5E7EB'
const TEXT   = '#111827'
const MUTED  = '#6B7280'
const PANEL  = '#FFFFFF'

const CLOCK_IN_WINDOW_MINUTES_BEFORE = 30

function canClockIn(shift: { shift_date: string; start_time: string }): boolean {
  const shiftStart = new Date(`${shift.shift_date}T${shift.start_time}Z`)
  const earliestClockIn = new Date(shiftStart.getTime() - CLOCK_IN_WINDOW_MINUTES_BEFORE * 60000)
  return Date.now() >= earliestClockIn.getTime()
}

function canClockOut(shift: { shift_date: string; end_time: string; is_open_ended: boolean }): boolean {
  if (shift.is_open_ended) return true
  const shiftEnd = new Date(`${shift.shift_date}T${shift.end_time}Z`)
  return Date.now() >= shiftEnd.getTime()
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.includes('T')) return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return value.slice(0, 5)
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function Avatar({ name, size = 34, color = GREEN }: { name: string; size?: number; color?: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color + '22', color, fontWeight: 700, fontSize: size * 0.38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

type MyShiftRecord = { id: string; clock_in_time: string | null; clock_out_time: string | null; break_in_time: string | null; break_out_time: string | null; status: string }
type MyShift = {
  assignment: { id: string; user_id: string }
  shift: { id: string; title: string | null; shift_date: string; start_time: string; end_time: string; is_open_ended: boolean }
  record: MyShiftRecord | null
}

type ClockOutReleaseItem = {
  id: string
  casual_worker_id: string
  worker_name: string
  clock_in_time: string | null
  shift_title: string | null
  shift_date: string
  start_time: string
}

type SupervisedWorker = {
  shift_assignment_id: string
  id: string
  full_name: string
  email_address: string
  phone_number: string
  profile_photo_url: string | null
  shift_id: string
  shift_title: string
  start_time: string
  end_time: string
  is_open_ended: boolean
}

type Contact = { id: string; full_name: string; role: string; email_address: string }
type Conversation = { partnerId: string; partnerName: string; partnerRole: string; lastMessage: string; lastTime: string; unreadCount: number }
type Message = { id: string; from_user_id: string; to_user_id: string; content: string; created_at: string }

const STATUS_LABEL: Record<Task['status'], { label: string; color: string; bg: string }> = {
  'Assigned':    { label: 'Assigned',    color: '#475569', bg: '#F1F5F9' },
  'In Progress': { label: 'In Progress', color: '#2563EB', bg: '#DBEAFE' },
  'Review':      { label: 'In Review',   color: '#EA580C', bg: '#FFEDD5' },
  'Complete':    { label: 'Complete',    color: '#16A34A', bg: '#DCFCE7' },
}

export default function EmployeeDashboard() {
  const router = useRouter()

  const [userId, setUserId]       = useState('')
  const [authUserId, setAuthUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [loading, setLoading]     = useState(true)

  // My Shift
  const [myShifts, setMyShifts]       = useState<MyShift[]>([])
  const [clockBusyId, setClockBusyId] = useState('')
  const [clockMessage, setClockMessage] = useState('')

  // Supervised Casual Workers today + clock-out release queue
  const [supervisedWorkers, setSupervisedWorkers] = useState<SupervisedWorker[]>([])
  const [releaseQueue, setReleaseQueue]           = useState<ClockOutReleaseItem[]>([])
  const [releaseBusyId, setReleaseBusyId]         = useState('')

  // My Tasks — tasks this Employee's Manager assigned to them (separate from the Tasks page,
  // which is where this Employee assigns work down to their Casual Workers).
  const [myTasks, setMyTasks]       = useState<Task[]>([])
  const [myTasksLoading, setMyTasksLoading] = useState(true)

  // Messages — Manager, same-department Employee colleagues, and today's supervised Casual
  // Workers (see employeeInboxRepository.getEmployeeContacts). Compact panel, not a full page.
  const [contacts, setContacts]           = useState<Contact[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeContactId, setActiveContactId] = useState('')
  const [messages, setMessages]           = useState<Message[]>([])
  const [msgInput, setMsgInput]           = useState('')
  const [sendingMsg, setSendingMsg]       = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchMyShift = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${uid}&resource=my_shift`)
      const data = await res.json()
      if (data.success) setMyShifts(data.myShift?.shifts ?? [])
    } catch {}
  }, [])

  const fetchReleaseQueue = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${uid}&resource=clockout_release_queue`)
      const data = await res.json()
      if (data.success) setReleaseQueue(data.queue ?? [])
    } catch {}
  }, [])

  const fetchDashboard = useCallback(async (uid: string) => {
    const res = await fetch(`/api/employee/dashboard?user_id=${uid}`)
    const data = await res.json()
    return data
  }, [])

  const fetchMyTasks = useCallback(async (cid: string, empId: string) => {
    setMyTasksLoading(true)
    try {
      const res = await fetch(`/api/task?company_id=${cid}&kanban=true&assigned_user_id=${encodeURIComponent(empId)}&viewer_id=${encodeURIComponent(empId)}`)
      const data = await res.json()
      if (data.success) {
        const groups = data.groups as KanbanGroup
        const all = [...groups.Assigned, ...groups['In Progress'], ...groups.Review, ...groups.Complete]
          .filter(t => !t.parent_task_id)
          .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
        setMyTasks(all)
      }
    } catch {}
    finally { setMyTasksLoading(false) }
  }, [])

  const fetchContacts = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/employee/contacts?user_id=${uid}`)
      const data = await res.json()
      if (data.success) setContacts(data.contacts ?? [])
    } catch {}
  }, [])

  const fetchConversations = useCallback(async (empId: string) => {
    try {
      const res = await fetch(`/api/inbox/messages?user_id=${empId}`)
      const data = await res.json()
      if (data.success) setConversations(data.conversations ?? [])
    } catch {}
  }, [])

  const fetchThread = useCallback(async (empId: string, partnerId: string) => {
    try {
      const res = await fetch(`/api/inbox/messages/${partnerId}?user_id=${empId}`)
      const data = await res.json()
      if (data.success) setMessages(data.messages ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const uid = localStorage.getItem('tasking_user_id')
      if (!uid) { router.replace('/signin'); return }
      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }
      const internalId = meData.user.id ?? uid
      setUserId(internalId)
      setAuthUserId(uid)

      const dash = await fetchDashboard(uid)
      if (cancelled) return
      if (dash.success) {
        setCompanyId(dash.company_id ?? '')
        setCompanyName(dash.company_name ?? '')
        setDepartmentName(dash.department_name ?? '')
        setSupervisedWorkers(dash.supervised_workers ?? [])
        void fetchMyTasks(dash.company_id, internalId)
      }

      void fetchMyShift(internalId)
      void fetchReleaseQueue(uid)
      void fetchContacts(uid)
      void fetchConversations(internalId)
      setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchDashboard, fetchMyShift, fetchReleaseQueue, fetchContacts, fetchConversations, fetchMyTasks])

  useEffect(() => {
    if (!activeContactId || !userId) return
    void fetchThread(userId, activeContactId)
  }, [activeContactId, userId, fetchThread])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!userId) return
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const channel = supabase
      .channel('employee-dashboard-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user_id=eq.${userId}` }, (payload) => {
        const newMsg = payload.new as Message
        if (activeContactId && newMsg.from_user_id === activeContactId) setMessages(prev => [...prev, newMsg])
        void fetchConversations(userId)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, activeContactId, fetchConversations])

  const runClockAction = async (shift: MyShift, action: 'clock_in' | 'clock_out' | 'break_in' | 'break_out') => {
    setClockBusyId(`${shift.assignment.id}:${action}`)
    setClockMessage('')
    try {
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: authUserId, shift_assignment_id: shift.assignment.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Attendance action failed')
      await fetchMyShift(userId)
      const msgs: Record<string, string> = { clock_in: 'Clocked in.', clock_out: 'Clocked out.', break_in: 'Break started.', break_out: 'Break ended.' }
      setClockMessage(msgs[action] ?? 'Done.')
    } catch (err) {
      setClockMessage(err instanceof Error ? err.message : 'Attendance action failed')
    } finally { setClockBusyId('') }
  }

  const releaseClockOut = async (item: ClockOutReleaseItem) => {
    setReleaseBusyId(item.id)
    try {
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release_clockout', user_id: authUserId, attendance_record_id: item.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to release clock-out')
      setReleaseQueue(prev => prev.filter(q => q.id !== item.id))
    } catch (err) {
      setClockMessage(err instanceof Error ? err.message : 'Failed to release clock-out')
    } finally { setReleaseBusyId('') }
  }

  const openContact = (contactId: string) => {
    setActiveContactId(contactId)
    setMessages([])
  }

  const handleSend = async () => {
    if (!msgInput.trim() || !activeContactId || !userId) return
    setSendingMsg(true)
    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: userId, to_user_id: activeContactId, content: msgInput.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setMsgInput('')
        await fetchThread(userId, activeContactId)
        void fetchConversations(userId)
      }
    } catch {}
    finally { setSendingMsg(false) }
  }

  const activeContact = contacts.find(c => c.id === activeContactId)
  const title = companyName && departmentName ? `${companyName} [${departmentName}]` : companyName || 'Dashboard'
  const myTodayShifts = myShifts.filter(s => {
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return s.shift.shift_date === todayKey
  })

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F1F5F9' }}>
      <style>{`@keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }`}</style>
      <EmployeeSidebar />

      <main style={{ marginLeft: 64, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, gap: 0, animation: 'blockSlideUp 0.38s ease both 0.04s' }}>
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">{loading ? 'Dashboard' : title}</h1>
          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {userId && companyId && <OwnerUserBadge userId={userId} companyId={companyId} />}
          </div>
        </div>

        <div style={{ padding: '0 28px 28px', flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
          {/* ── Left column: My Shift, My Tasks ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            {/* My Shift */}
            <section style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 18px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Clock size={15} color={GREEN} />
                <span style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>My Shift</span>
              </div>
              {clockMessage && (
                <div style={{ marginBottom: 8, padding: '8px 12px', background: clockMessage.toLowerCase().includes('fail') || clockMessage.toLowerCase().includes('wait') ? '#FEF2F2' : '#ECFDF5', color: clockMessage.toLowerCase().includes('fail') || clockMessage.toLowerCase().includes('wait') ? '#B91C1C' : '#047857', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
                  {clockMessage}
                </div>
              )}
              {myTodayShifts.length === 0 ? (
                <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>No shift scheduled today.</p>
              ) : myTodayShifts.map(shift => {
                const clockedIn  = !!shift.record?.clock_in_time
                const clockedOut = !!shift.record?.clock_out_time
                const onBreak    = !!shift.record?.break_in_time && !shift.record?.break_out_time
                const breakDone  = !!shift.record?.break_in_time && !!shift.record?.break_out_time
                return (
                  <div key={shift.assignment.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid #F1F5F9` }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: TEXT }}>{shift.shift.title || 'My Shift'}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED }}>
                        {formatTime(shift.shift.start_time)} – {formatTime(shift.shift.end_time)}
                        {clockedIn && <> · In {formatTime(shift.record?.clock_in_time)}</>}
                        {onBreak && <> · On break</>}
                        {breakDone && !clockedOut && <> · Break done</>}
                        {clockedOut && <> · Out {formatTime(shift.record?.clock_out_time)}</>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!clockedIn && canClockIn(shift.shift) && (
                        <button onClick={() => runClockAction(shift, 'clock_in')} disabled={!!clockBusyId}
                          style={{ height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: GREEN, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          {clockBusyId === `${shift.assignment.id}:clock_in` ? 'Working…' : 'Clock In'}
                        </button>
                      )}
                      {clockedIn && !clockedOut && !onBreak && !breakDone && (
                        <button onClick={() => runClockAction(shift, 'break_in')} disabled={!!clockBusyId}
                          style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1.5px solid #D97706', background: '#FFFBEB', color: '#B45309', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Coffee size={12} /> Break In
                        </button>
                      )}
                      {clockedIn && !clockedOut && onBreak && (
                        <button onClick={() => runClockAction(shift, 'break_out')} disabled={!!clockBusyId}
                          style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1.5px solid #D97706', background: '#FFF7ED', color: '#B45309', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Coffee size={12} /> Break Out
                        </button>
                      )}
                      {clockedIn && !clockedOut && canClockOut(shift.shift) && (
                        <button onClick={() => runClockAction(shift, 'clock_out')} disabled={!!clockBusyId}
                          style={{ height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: '#334155', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          {clockBusyId === `${shift.assignment.id}:clock_out` ? 'Working…' : 'Clock Out'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>

            {/* My Tasks — assigned to this Employee by their Manager */}
            <section style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 18px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
                <CheckSquare size={15} color={GREEN} />
                <span style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>My Tasks</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, marginLeft: 'auto' }}>{myTasks.length} total</span>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myTasksLoading ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: MUTED, fontSize: 13 }}><Spinner dark /> Loading…</div>
                ) : myTasks.length === 0 ? (
                  <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>No tasks assigned to you yet.</p>
                ) : myTasks.map(task => {
                  const s = STATUS_LABEL[task.status]
                  const needsRework = !!task.rejection_reason && task.status === 'In Progress'
                  return (
                    <div key={task.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</p>
                        {task.due_at && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: MUTED }}>Due {new Date(task.due_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
                      </div>
                      {needsRework && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#FEF2F2', color: '#DC2626' }}>
                          <AlertTriangle size={10} /> Rework
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          {/* ── Right column: Supervised Casual Workers + Messages ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            {/* Supervised Casual Workers today + clock-out release queue */}
            <section style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 18px', flexShrink: 0, maxHeight: '38%', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Users size={15} color={GREEN} />
                <span style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>Casual Workers Today</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, marginLeft: 'auto' }}>{supervisedWorkers.length}</span>
              </div>
              {supervisedWorkers.length === 0 ? (
                <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>No Casual Workers under you today.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {supervisedWorkers.map(w => {
                    const release = releaseQueue.find(r => r.casual_worker_id === w.id)
                    return (
                      <div key={w.shift_assignment_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: '#F8FAFC' }}>
                        <Avatar name={w.full_name} size={30} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 12.5, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.full_name}</p>
                          <p style={{ margin: '1px 0 0', fontSize: 11, color: MUTED }}>{w.shift_title} · {formatTime(w.start_time)}–{w.is_open_ended ? 'Open' : formatTime(w.end_time)}</p>
                        </div>
                        {release && (
                          <button onClick={() => releaseClockOut(release)} disabled={!!releaseBusyId}
                            style={{ height: 28, padding: '0 10px', borderRadius: 7, border: 'none', background: GREEN, color: '#fff', fontWeight: 700, fontSize: 11, cursor: releaseBusyId ? 'default' : 'pointer', flexShrink: 0 }}>
                            {releaseBusyId === release.id ? '…' : 'Release'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Messages — Manager, department colleagues, and today's Casual Workers */}
            <section style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: 150, flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ padding: '12px 12px 8px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <MessageCircle size={13} color={GREEN} />
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: TEXT }}>Messages</span>
                </div>
                {contacts.map(c => {
                  const conv = conversations.find(v => v.partnerId === c.id)
                  return (
                    <button key={c.id} onClick={() => openContact(c.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: activeContactId === c.id ? '#DCFCE7' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                      <Avatar name={c.full_name} size={26} color={c.role === 'Manager' ? '#2563EB' : GREEN} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 11.5, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.full_name}</p>
                      </div>
                      {conv && conv.unreadCount > 0 && (
                        <span style={{ minWidth: 15, height: 15, padding: '0 3px', borderRadius: 999, background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{conv.unreadCount}</span>
                      )}
                    </button>
                  )
                })}
                {contacts.length === 0 && <p style={{ padding: '0 12px', color: MUTED, fontSize: 12 }}>No contacts yet.</p>}
              </div>

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                {!activeContact ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>Select a contact to start chatting.</div>
                ) : (
                  <>
                    <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>{activeContact.full_name}</span>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {messages.map(m => {
                        const mine = m.from_user_id === userId
                        return (
                          <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', background: mine ? GREEN : '#F1F5F9', color: mine ? '#fff' : TEXT, padding: '7px 11px', borderRadius: 12, fontSize: 12.5 }}>
                            {m.content}
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                    <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 8, flexShrink: 0 }}>
                      <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void handleSend() }}
                        placeholder="Type a message…"
                        style={{ flex: 1, height: 34, padding: '0 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12.5, outline: 'none' }} />
                      <button onClick={handleSend} disabled={sendingMsg || !msgInput.trim()}
                        style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: sendingMsg || !msgInput.trim() ? 0.6 : 1 }}>
                        <Send size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
