'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { getApplicationFlowState } from '@/components/guest/ApplicationFlow'

export type NotificationResource =
  | 'dashboard'
  | 'tasks'
  | 'shifts'
  | 'attendance'
  | 'communication'
  | 'recruitment'
  | 'team'
  | 'applications'

export type NotificationCounts = Record<NotificationResource, number>

type RuntimeUser = {
  authId: string
  id: string
  role: string
  companyId: string
  // Employee-only (confirmed 2026-07-31): needed to scope the unread-announcements count below —
  // an Employee only ever sees their own department's Manager-posted announcements (see
  // ownerAnnouncementRepository's isEmployee branch, which returns nothing without this).
  departmentId: string | null
}

type RealtimeNotificationsContextValue = {
  counts: NotificationCounts
  ready: boolean
  user: RuntimeUser | null
  refresh: () => void
}

const EMPTY_COUNTS: NotificationCounts = {
  dashboard: 0,
  tasks: 0,
  shifts: 0,
  attendance: 0,
  communication: 0,
  recruitment: 0,
  team: 0,
  applications: 0,
}

const RealtimeNotificationsContext = createContext<RealtimeNotificationsContextValue>({
  counts: EMPTY_COUNTS,
  ready: false,
  user: null,
  refresh: () => {},
})

const TABLE_RESOURCES: Record<string, NotificationResource[]> = {
  tasks: ['tasks', 'dashboard'],
  messages: ['communication'],
  announcements: ['communication'],
  job_postings: ['recruitment', 'dashboard'],
  job_applicants: ['recruitment', 'applications', 'dashboard'],
  job_invitations: ['applications', 'recruitment', 'dashboard'],
  shift_swap_requests: ['attendance', 'dashboard'],
  off_day_requests: ['attendance', 'shifts', 'dashboard'],
  shifts: ['shifts', 'attendance', 'dashboard'],
  shift_assignments: ['shifts', 'attendance', 'dashboard'],
  attendance_records: ['attendance', 'dashboard'],
  users: ['team', 'dashboard'],
  manager_departments: ['team', 'dashboard'],
  employee_departments: ['team', 'dashboard'],
  casualworker_departments: ['team', 'dashboard'],
  departments: ['team', 'dashboard'],
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase()
}

function dispatchInvalidation(resources: NotificationResource[], source: string) {
  const unique = [...new Set(resources)]
  window.dispatchEvent(new CustomEvent('tasking:resource-invalidated', { detail: { resources: unique, source } }))
  for (const resource of unique) {
    window.dispatchEvent(new CustomEvent(`tasking:${resource}-invalidated`, { detail: { source } }))
  }
  if (unique.includes('tasks')) window.dispatchEvent(new Event('task-insights-updated'))
}

async function fetchJson(url: string) {
  const res = await fetch(url)
  return res.json()
}

function readStringSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return new Set(JSON.parse(raw))
  } catch {}
  return new Set()
}

export function RealtimeNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<RuntimeUser | null>(null)
  const [counts, setCounts] = useState<NotificationCounts>(EMPTY_COUNTS)
  const [ready, setReady] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const invalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingResourcesRef = useRef<Set<NotificationResource>>(new Set())

  useEffect(() => {
    let cancelled = false
    const resolveUser = async () => {
      const authId = localStorage.getItem('tasking_user_id')
      if (!authId) {
        setReady(true)
        return
      }
      try {
        const data = await fetchJson(`/api/user/me?user_id=${encodeURIComponent(authId)}`)
        if (cancelled || !data.success) {
          if (!cancelled) setReady(true)
          return
        }
        const companyId =
          localStorage.getItem('tasking_company_id') ??
          localStorage.getItem(`tasking_company_id_${authId}`) ??
          data.user.company_id ??
          ''
        setUser({ authId, id: data.user.id, role: data.user.role, companyId, departmentId: data.user.department_id ?? null })
      } catch {
        if (!cancelled) setReady(true)
      }
    }
    void resolveUser()
    return () => { cancelled = true }
  }, [])

  const refreshCounts = useCallback(async () => {
    if (!user) return
    const role = normalizeRole(user.role)
    const next: NotificationCounts = { ...EMPTY_COUNTS }

    try {
      if (user.companyId) {
        const unreadData = await fetchJson(`/api/inbox/unread-count?user_id=${encodeURIComponent(user.id)}&company_id=${encodeURIComponent(user.companyId)}`).catch(() => null)
        if (unreadData?.success) next.communication += unreadData.unread_messages ?? 0

        if (role === 'owner' || role === 'partner' || role === 'manager') {
          const annRole = role === 'manager' ? 'manager' : role === 'partner' ? 'partner' : 'owner'
          // BUG-053: this used to read a `ann_read_ids_*` localStorage key that nothing in the app
          // ever wrote to (CommunicationView.tsx tracks read state server-side via
          // /api/inbox/announcements/read, keyed by plain announcement id — not localStorage, and
          // not the `id:updated_at` composite key this used to check) — so the filter below never
          // actually excluded anything a user had genuinely read, and the dot could never clear.
          // Read the same server-persisted set CommunicationView itself uses.
          const readData = await fetchJson(`/api/inbox/announcements/read?user_id=${encodeURIComponent(user.id)}&company_id=${encodeURIComponent(user.companyId)}`).catch(() => null)
          const readIds = new Set<string>(readData?.success ? (readData.readIds ?? []) : [])
          const annData = await fetchJson(`/api/inbox/announcements?company_id=${encodeURIComponent(user.companyId)}&role=${annRole}`).catch(() => null)
          if (annData?.success) {
            next.communication += ((annData.announcements ?? []) as Array<{ id: string; user_id: string }>)
              .filter(a => a.user_id !== user.id && !readIds.has(a.id)).length
          }

          const dashboardData = await fetchJson(`/api/owner/dashboard?company_id=${encodeURIComponent(user.companyId)}&owner_id=${encodeURIComponent(user.id)}${role === 'manager' ? '&viewer_role=Manager' : ''}`).catch(() => null)
          if (dashboardData?.success) {
            const waiting = (dashboardData.summary?.waiting_on_you ?? []) as Array<{ id: string; count: number }>
            const taskNotifications = (dashboardData.summary?.task_notifications ?? []) as Array<{ count: number }>
            next.recruitment += waiting.filter(i => i.id === 'job_posting_approval' || i.id === 'applicant_accept').reduce((sum, i) => sum + i.count, 0)
            next.attendance += waiting.filter(i => i.id === 'off_day_deadline' || i.id === 'shift_swap').reduce((sum, i) => sum + i.count, 0)
            next.tasks += waiting.filter(i => i.id === 'task_review').reduce((sum, i) => sum + i.count, 0)
            if (role !== 'manager') next.tasks += taskNotifications.reduce((sum, i) => sum + i.count, 0)
            next.dashboard = waiting.filter(i => i.count > 0).length + (role === 'manager' ? 0 : taskNotifications.reduce((sum, i) => sum + i.count, 0))
          }

          if (role === 'manager') {
            const myTasksData = await fetchJson(`/api/task?company_id=${encodeURIComponent(user.companyId)}&kanban=true&assigned_user_id=${encodeURIComponent(user.id)}&viewer_id=${encodeURIComponent(user.id)}`).catch(() => null)
            if (myTasksData?.success) {
              const seen = readStringSet(`manager_mytasks_seen_${user.companyId}_${user.id}`)
              const signature = (task: { id: string; rejected_at?: string | null }) => `${task.id}::${task.rejected_at ?? ''}`
              const assigned = ((myTasksData.groups?.Assigned ?? []) as Array<{ id: string; rejected_at?: string | null; parent_task_id?: string | null }>)
                .filter(task => !task.parent_task_id && !seen.has(signature(task)))
              const rejected = ((myTasksData.groups?.['In Progress'] ?? []) as Array<{ id: string; rejected_at?: string | null; rejection_reason?: string | null; parent_task_id?: string | null }>)
                .filter(task => !task.parent_task_id && !!task.rejection_reason && !!task.rejected_at && !seen.has(signature(task)))
              next.tasks += assigned.length + rejected.length
              next.dashboard += assigned.length + rejected.length
            }
          }
        }

        // BUG-037: Employee never got a live 'attendance' count at all — this whole function only
        // had an Owner/Partner/Manager branch, so an Employee's sidebar dot for "someone responded
        // to my swap request" / "I need to respond to a swap request" never lit up in real time,
        // only after manually opening the Shifts page (which computes the same thing locally in
        // MyRequestsPanel, just never fed it back up to the sidebar).
        if (role === 'employee') {
          const myReqData = await fetchJson(`/api/attendance?resource=my_requests&user_id=${encodeURIComponent(user.id)}`).catch(() => null)
          if (myReqData?.success) {
            const swaps = (myReqData.swaps ?? []) as Array<{ id: string; requester_id: string; counterpart_id: string; counterpart_status: string; status: string }>
            const needsMyResponse = swaps.filter(s => s.counterpart_id === user.id && s.counterpart_status === 'pending' && s.status === 'pending').length
            // A requester's swap the counterpart already decided on stops counting once the user has
            // actually opened it in MyRequestsPanel (variant="employee") — same `swap-${id}` seen-key
            // that panel writes to localStorage, otherwise this count (unlike MyRequestsPanel's own)
            // never dropped even after the user clicked through every request (BUG-054 follow-up).
            const seenKey = `employee_myreq_seen_${user.companyId}_${user.id}`
            const seen = readStringSet(seenKey)
            const counterpartResponded = swaps.filter(s => s.requester_id === user.id && s.counterpart_status !== 'pending' && !seen.has(`swap-${s.id}`)).length

            // Same "offday-${week}[-${decisionAt}]" seen-key MyRequestsPanel's own
            // myFixedOffUpdateCount computes and writes — a Fixed Day Off request that just got
            // approved/rejected wasn't feeding this sidebar dot at all before (confirmed
            // 2026-07-31), only the swap half was.
            const fixedOff = (myReqData.fixed_off ?? []) as Array<{ requested_week: string; source: string; status: string; reviewed_at?: string | null; created_at?: string | null }>
            const fixedOffGroupsByWeek = new Map<string, typeof fixedOff>()
            fixedOff.forEach(req => {
              if (req.source !== 'submitted' || req.status === 'pending') return
              const group = fixedOffGroupsByWeek.get(req.requested_week) ?? []
              group.push(req)
              fixedOffGroupsByWeek.set(req.requested_week, group)
            })
            let fixedOffUpdateCount = 0
            fixedOffGroupsByWeek.forEach((group, weekStart) => {
              const latestDecisionAt = group
                .map(req => req.reviewed_at ?? req.created_at ?? '')
                .filter(Boolean)
                .sort()
                .at(-1)
              const key = latestDecisionAt ? `offday-${weekStart}-${latestDecisionAt}` : `offday-${weekStart}`
              if (!seen.has(key)) fixedOffUpdateCount += 1
            })

            next.attendance += needsMyResponse + counterpartResponded + fixedOffUpdateCount
            next.shifts += needsMyResponse
          }

          // Employee can't post announcements, only read their own Manager's department ones
          // (see ownerAnnouncementRepository's isEmployee branch) — this was never counted into
          // next.communication at all before (confirmed 2026-07-31), so the sidebar Communication
          // dot only ever reflected unread messages for Employee, never unread announcements,
          // once realtime took over from the one-shot fallback fetch.
          if (user.departmentId) {
            const annReadData = await fetchJson(`/api/inbox/announcements/read?user_id=${encodeURIComponent(user.id)}&company_id=${encodeURIComponent(user.companyId)}`).catch(() => null)
            const annReadIds = new Set<string>(annReadData?.success ? (annReadData.readIds ?? []) : [])
            const annData = await fetchJson(`/api/inbox/announcements?company_id=${encodeURIComponent(user.companyId)}&role=employee&audience_department_id=${encodeURIComponent(user.departmentId)}`).catch(() => null)
            if (annData?.success) {
              next.communication += ((annData.announcements ?? []) as Array<{ id: string; user_id: string }>)
                .filter(a => a.user_id !== user.id && !annReadIds.has(a.id)).length
            }
          }

          // Same "task_review" concept as Owner/Partner/Manager's Waiting-On-You card (see the
          // task_review branch above) — a Casual Worker moving a task this Employee assigned them
          // into Review needs this Employee to Approve/Reject it. Employee has no Waiting-On-You
          // dashboard summary to read it from, so it's read straight off the Kanban instead,
          // scoped to tasks this Employee assigned (assigned_by).
          const reviewData = await fetchJson(`/api/task?company_id=${encodeURIComponent(user.companyId)}&kanban=true&assigned_by=${encodeURIComponent(user.id)}&viewer_id=${encodeURIComponent(user.id)}`).catch(() => null)
          if (reviewData?.success) {
            next.tasks += ((reviewData.groups?.Review ?? []) as Array<{ id: string }>).length

            // Same "Uncompleted Tasks" concept as the Tasks page's own bucket
            // (TasksView.tsx's isClockedOutUnfinished) — a task still Assigned/In Progress whose
            // Casual Worker has since clocked out needs the Employee to reassign it, so it lights
            // up the Tasks sidebar dot the same way a pending Review does (2026-08-01).
            const dashData = await fetchJson(`/api/employee/dashboard?user_id=${encodeURIComponent(user.id)}`).catch(() => null)
            if (dashData?.success) {
              const clockedOutIds = new Set(
                ((dashData.supervised_workers ?? []) as Array<{ id: string; clock_out_time: string | null }>)
                  .filter(w => w.clock_out_time)
                  .map(w => w.id),
              )
              const unfinished = [
                ...((reviewData.groups?.Assigned ?? []) as Array<{ assigned_user_id: string | null; parent_task_id: string | null }>),
                ...((reviewData.groups?.['In Progress'] ?? []) as Array<{ assigned_user_id: string | null; parent_task_id: string | null }>),
              ].filter(t => !t.parent_task_id && t.assigned_user_id && clockedOutIds.has(t.assigned_user_id))
              next.tasks += unfinished.length
            }
          }
        }
      }

      if (role === 'guest user' || role === 'casual worker') {
        const appsData = await fetchJson(`/api/guest/applications?user_id=${encodeURIComponent(user.id)}`).catch(() => null)
        if (appsData?.success) {
          const seen = readStringSet(`applications_seen_${user.id}`)
          const apps = (appsData.applications ?? []) as Array<{
            id: string
            status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled_by_employer' | 'job_closed'
            job_invitations?: { status?: string | null }[] | null
          }>
          // Sidebar dot = OR of the two dots the Applications page itself can show (2026-07-31):
          // the Ongoing pill's "you have an offer to respond to" dot (step 2 of
          // ApplicationFlow.tsx's classification — presence-based, clears the moment the worker
          // acts on it, not a seen/unseen thing) and the History pill's "unread terminal outcome"
          // dot (BUG-032 — a terminal application whose signature isn't in the same
          // `applications_seen_*` set page.tsx's markHistorySeen writes to).
          let needsAcceptReject = 0
          let hasUnseenHistory = false
          for (const app of apps) {
            const invitationStatus = Array.isArray(app.job_invitations) ? app.job_invitations[0]?.status ?? '' : ''
            const state = getApplicationFlowState({
              status: app.status,
              invitation_status: (invitationStatus || undefined) as
                | 'sent' | 'accepted' | 'declined' | 'expired' | 'position_filled' | 'cancelled' | undefined,
            })
            if (state.kind === 'stepper' && state.step === 2) needsAcceptReject += 1
            if (state.kind === 'terminal' && !seen.has(`${app.id}:${app.status}:${invitationStatus}:`)) hasUnseenHistory = true
          }
          next.applications = needsAcceptReject + (hasUnseenHistory ? 1 : 0)
        }
      }
    } finally {
      setCounts(next)
      setReady(true)
    }
  }, [user])

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => { void refreshCounts() }, 250)
  }, [refreshCounts])

  const queueInvalidation = useCallback((resources: NotificationResource[], source: string) => {
    for (const resource of resources) pendingResourcesRef.current.add(resource)
    if (invalidationTimerRef.current) clearTimeout(invalidationTimerRef.current)
    invalidationTimerRef.current = setTimeout(() => {
      const queued = [...pendingResourcesRef.current]
      pendingResourcesRef.current.clear()
      if (queued.length > 0) dispatchInvalidation(queued, source)
      scheduleRefresh()
    }, 250)
  }, [scheduleRefresh])

  useEffect(() => {
    if (!user) return
    void refreshCounts()
  }, [user, refreshCounts])

  useEffect(() => {
    if (!user) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const companyTables = ['tasks', 'announcements', 'job_postings', 'shift_swap_requests', 'off_day_requests', 'shifts', 'users', 'departments']
    const channels = [
      ...companyTables.map(table =>
        supabase
          .channel(`global-${table}-${user.companyId || user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table, filter: user.companyId ? `company_id=eq.${user.companyId}` : undefined },
            () => queueInvalidation(TABLE_RESOURCES[table] ?? ['dashboard'], table))
          .subscribe(),
      ),
      supabase
        .channel(`global-messages-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `to_user_id=eq.${user.id}` },
          () => queueInvalidation(TABLE_RESOURCES.messages, 'messages'))
        .subscribe(),
      supabase
        .channel(`global-job-applicants-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applicants' },
          () => queueInvalidation(TABLE_RESOURCES.job_applicants, 'job_applicants'))
        .subscribe(),
      supabase
        .channel(`global-job-invitations-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_invitations' },
          () => queueInvalidation(TABLE_RESOURCES.job_invitations, 'job_invitations'))
        .subscribe(),
      supabase
        .channel(`global-shift-assignments-${user.companyId || user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_assignments' },
          () => queueInvalidation(TABLE_RESOURCES.shift_assignments, 'shift_assignments'))
        .subscribe(),
      supabase
        .channel(`global-attendance-records-${user.companyId || user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' },
          () => queueInvalidation(TABLE_RESOURCES.attendance_records, 'attendance_records'))
        .subscribe(),
      supabase
        .channel(`global-manager-departments-${user.companyId || user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'manager_departments' },
          () => queueInvalidation(TABLE_RESOURCES.manager_departments, 'manager_departments'))
        .subscribe(),
      supabase
        .channel(`global-employee-departments-${user.companyId || user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_departments' },
          () => queueInvalidation(TABLE_RESOURCES.employee_departments, 'employee_departments'))
        .subscribe(),
      supabase
        .channel(`global-casualworker-departments-${user.companyId || user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'casualworker_departments' },
          () => queueInvalidation(TABLE_RESOURCES.casualworker_departments, 'casualworker_departments'))
        .subscribe(),
    ]

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        dispatchInvalidation(Object.keys(EMPTY_COUNTS) as NotificationResource[], 'visibility')
        scheduleRefresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('task-insights-updated', scheduleRefresh)
    window.addEventListener('storage', scheduleRefresh)

    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('task-insights-updated', scheduleRefresh)
      window.removeEventListener('storage', scheduleRefresh)
      channels.forEach(channel => { void supabase.removeChannel(channel) })
    }
  }, [queueInvalidation, scheduleRefresh, user])

  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    if (invalidationTimerRef.current) clearTimeout(invalidationTimerRef.current)
  }, [])

  const value = useMemo<RealtimeNotificationsContextValue>(() => ({
    counts,
    ready,
    user,
    refresh: scheduleRefresh,
  }), [counts, ready, scheduleRefresh, user])

  return (
    <RealtimeNotificationsContext.Provider value={value}>
      {children}
    </RealtimeNotificationsContext.Provider>
  )
}

export function useRealtimeNotifications() {
  return useContext(RealtimeNotificationsContext)
}

export function useResourceInvalidation(resources: NotificationResource[], callback: () => void) {
  const resourcesKey = resources.join('|')
  const callbackRef = useRef(callback)
  useEffect(() => { callbackRef.current = callback }, [callback])

  useEffect(() => {
    const set = new Set(resources)
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ resources?: NotificationResource[] }>).detail
      if (!detail?.resources?.some(resource => set.has(resource))) return
      callbackRef.current()
    }
    window.addEventListener('tasking:resource-invalidated', handler)
    return () => window.removeEventListener('tasking:resource-invalidated', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourcesKey])
}
