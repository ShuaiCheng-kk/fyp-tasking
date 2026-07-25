'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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
  employee_off_day_requests: ['attendance', 'shifts', 'dashboard'],
  shifts: ['shifts', 'attendance', 'dashboard'],
  shift_assignments: ['shifts', 'attendance', 'dashboard'],
  attendance_records: ['attendance', 'dashboard'],
  users: ['team', 'dashboard'],
  manager_departments: ['team', 'dashboard'],
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
        setUser({ authId, id: data.user.id, role: data.user.role, companyId })
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
          const readKey = `ann_read_ids_${user.companyId}_${user.id}`
          let readIds = new Set<string>()
          try {
            const raw = localStorage.getItem(readKey)
            if (raw) readIds = new Set(JSON.parse(raw))
          } catch {}
          const annData = await fetchJson(`/api/inbox/announcements?company_id=${encodeURIComponent(user.companyId)}&role=${annRole}`).catch(() => null)
          if (annData?.success) {
            next.communication += ((annData.announcements ?? []) as Array<{ id: string; from_user_id: string; created_at: string; updated_at?: string | null }>)
              .filter(a => a.from_user_id !== user.id && !readIds.has(`${a.id}:${a.updated_at ?? a.created_at}`)).length
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
      }

      if (role === 'guest user' || role === 'casual worker') {
        const appsData = await fetchJson(`/api/guest/applications?user_id=${encodeURIComponent(user.id)}`).catch(() => null)
        if (appsData?.success) {
          const seenKey = `applications_seen_${user.id}`
          const seen = readStringSet(seenKey)
          next.applications = ((appsData.applications ?? []) as Array<{ id: string; status: string; invitation_status?: string | null; updated_at?: string | null }>)
            .filter(app => app.status !== 'pending')
            .filter(app => !seen.has(`${app.id}:${app.status}:${app.invitation_status ?? ''}:${app.updated_at ?? ''}`)).length
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

    const companyTables = ['tasks', 'announcements', 'job_postings', 'shift_swap_requests', 'employee_off_day_requests', 'shifts', 'users', 'departments']
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
