'use client'

// Employee Dashboard's "My Tasks" widget — same Kanban mechanics and card language as Manager's
// "My Tasks" tab on the Tasks page (src/components/tasks/TasksView.tsx renderMyTasksView): four
// status columns, drag exactly one column forward, same STATUS_CONFIG colors/icons and card
// badges (priority / sub-task count / rework), same "Drag cards to move" header hint. Built as
// its own lightweight widget (not the shared TaskCard, which carries Owner/Partner-only editing
// affordances this dashboard surface doesn't need) — click opens a read-only detail popup;
// full editing stays on the dedicated Tasks page.

import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, ArrowRight, Check, CheckCircle, ChevronDown, Clock, Eye, GitBranch, GripVertical, Layers } from 'lucide-react'
import { Task } from '@/types/Task'
import { ShowcaseCard } from '@/components/panel'
import { ModalHeader, modalLabelStyle, modalInputStyle } from '@/components/modal'
import { modalKeyframes } from '@/components/theme/tokens'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'
import { DASHBOARD_SKELETON_KEYFRAMES, SkeletonLine } from '@/components/dashboard/ClockFlow'

const COLUMNS: Task['status'][] = ['Assigned', 'In Progress', 'Review', 'Complete']

// Same deadline-warning rule as Owner/Manager's own Tasks page (TasksView.tsx) — red only once
// overdue or within 2 hours of due, not unconditionally. An Employee is internal staff (in again
// tomorrow), unlike a Casual Worker's board (CasualTaskBoard.tsx), which is scoped to a single
// day's gig and deliberately keeps every deadline red regardless of how far off it is (2026-08-02
// — this widget previously copied that CW rule by mistake).
function isDueOverdue(due: string): boolean {
  return new Date(due) < new Date()
}
function isDueWithinHours(due: string, hours: number): boolean {
  const msRemaining = new Date(due).getTime() - Date.now()
  return msRemaining > 0 && msRemaining <= hours * 60 * 60 * 1000
}

// Same "DD Mon, HH:MMAM/PM" format as Manager's My Tasks tab (TasksView.tsx's
// formatDeadlineTime/formatDeadlineDisplay) — this widget previously used
// Date.toLocaleString's "Mon D, HH:MM AM/PM" instead, a visibly different format for the same
// deadline (2026-08-01).
function formatDeadlineTime(value: string): string {
  const date = new Date(value)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const hour12 = hours % 12 || 12
  const suffix = hours < 12 ? 'AM' : 'PM'
  return `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')}${suffix}`
}
function formatDeadlineDisplay(value: string): string {
  const d = new Date(value)
  const dayMonth = `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-US', { month: 'short' })}`
  return `${dayMonth}, ${formatDeadlineTime(value)}`
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Low: { bg: '#F1F5F9', text: '#475569' },
  Medium: { bg: '#DBEAFE', text: '#1D4ED8' },
  High: { bg: '#FFEDD5', text: '#C2410C' },
  Urgent: { bg: '#FEE2E2', text: '#B91C1C' },
}

const STATUS_CONFIG: Record<Task['status'], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  'Assigned':    { label: 'Assigned',    color: '#475569', bg: '#E2E8F0', icon: <Layers size={13} /> },
  'In Progress': { label: 'In Progress', color: '#2563EB', bg: '#DBEAFE', icon: <Clock size={13} /> },
  'Review':      { label: 'Review',      color: '#EA580C', bg: '#FED7AA', icon: <Eye size={13} /> },
  'Complete':    { label: 'Complete',    color: '#16A34A', bg: '#BBF7D0', icon: <CheckCircle size={13} /> },
}

type Props = {
  companyId: string
  internalUserId: string
  // Once every one of today's shifts is clocked out, the Employee has left for the day — same
  // "read-only once clocked out" rule as the Casual Worker's own board (CasualTaskBoard.tsx's
  // readOnly), applied here to Assigned/In Progress drag-to-move and sub-task ticking (2026-08-02).
  clockedOut?: boolean
}

export default function EmployeeMyTasksBoard({ companyId, internalUserId, clockedOut = false }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Task['status'] | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())

  // "New task" red dot — same mechanics as Manager's My Tasks tab (TasksView.tsx: myTaskSignature/
  // seenMyTaskSigs/isUnseenMyTaskAlert), this widget never had it (2026-08-02). Keyed on
  // id + rejected_at so a rework (a new rejected_at) re-flags a task the Employee already saw
  // once, the same as a brand-new assignment would. Only Assigned carries the dot — once dragged
  // past it the Employee has necessarily already acted on it; a rework is the one case an
  // In Progress card still counts as "unseen" (see needsRework badge for the always-visible
  // rework flag, separate from this dot).
  const taskSignature = (task: Task) => `${task.id}::${task.rejected_at ?? ''}`
  const [seenTaskSigs, setSeenTaskSigs] = useState<Set<string>>(new Set())
  const seenKey = companyId && internalUserId ? `employee_mytasks_seen_${companyId}_${internalUserId}` : null
  const markTaskSeen = (task: Task) => {
    const sig = taskSignature(task)
    setSeenTaskSigs(prev => {
      if (prev.has(sig)) return prev
      const next = new Set(prev); next.add(sig)
      if (seenKey) { try { localStorage.setItem(seenKey, JSON.stringify([...next])) } catch {} }
      return next
    })
  }
  useEffect(() => {
    if (!seenKey) return
    try {
      const raw = localStorage.getItem(seenKey)
      if (raw) setSeenTaskSigs(new Set(JSON.parse(raw)))
    } catch {}
  }, [seenKey])
  // Garbage-collect signatures no longer on the board (completed/reassigned, or a stale
  // pre-rejection signature superseded by the task's current one).
  useEffect(() => {
    if (tasks.length === 0 || !seenKey) return
    const liveSigs = new Set(tasks.map(taskSignature))
    setSeenTaskSigs(prev => {
      const pruned = new Set([...prev].filter(sig => liveSigs.has(sig)))
      if (pruned.size === prev.size) return prev
      try { localStorage.setItem(seenKey, JSON.stringify([...pruned])) } catch {}
      return pruned
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, seenKey])
  const isUnseenTaskAlert = (task: Task): boolean =>
    !seenTaskSigs.has(taskSignature(task)) &&
    (task.status === 'Assigned' || (task.status === 'In Progress' && !!task.rejection_reason && !!task.rejected_at))

  const lastLoadedAtRef = useRef(0)
  const load = async () => {
    if (!companyId || !internalUserId) return
    lastLoadedAtRef.current = Date.now()
    const res = await fetch(`/api/task?company_id=${companyId}&kanban=true&assigned_user_id=${encodeURIComponent(internalUserId)}&viewer_id=${encodeURIComponent(internalUserId)}`)
    const data = await res.json()
    if (data.success) {
      const groups = data.groups as Record<Task['status'], Task[]>
      setTasks([...groups.Assigned, ...groups['In Progress'], ...groups.Review, ...groups.Complete])
    }
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, internalUserId])

  // Skip the realtime echo of our own just-completed write (same fix as BUG-060/CasualTaskBoard).
  useResourceInvalidation(['tasks'], () => {
    if (Date.now() - lastLoadedAtRef.current < 1500) return
    void load()
  })

  const canDragTask = (task: Task): boolean =>
    !clockedOut && task.status !== 'Review' && task.status !== 'Complete'

  // A card can only ever move exactly one column forward — never backward, never skip a column.
  // Shared by the actual drop handler below and by the column highlight on drag-over, so a column
  // that would reject the drop never lights up as if it were a valid target in the first place
  // (same fix as Casual Worker's board, 2026-08-01 — this widget never had it).
  const isValidDropTarget = (task: Task, targetStatus: Task['status']): boolean => {
    if (!canDragTask(task)) return false
    const currentIdx = COLUMNS.indexOf(task.status)
    const targetIdx = COLUMNS.indexOf(targetStatus)
    return targetIdx === currentIdx + 1
  }

  const handleDrop = async (task: Task, targetStatus: Task['status']) => {
    setDragOverCol(null)
    setDraggingTaskId(null)
    if (!isValidDropTarget(task, targetStatus)) return

    const subTasks = tasks.filter(t => t.parent_task_id === task.id)
    const affectedIds = new Set([task.id, ...subTasks.map(t => t.id)])

    setTasks(prev => prev.map(t =>
      affectedIds.has(t.id) ? { ...t, status: targetStatus } : t
    ))

    try {
      const results = await Promise.all([...affectedIds].map(id => fetch('/api/task', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: targetStatus }),
      }).then(r => r.json())))
      if (results.some(r => !r.success)) throw new Error()
    } catch {
      void load()
    }
  }

  // Sub-tasks are a one-way checklist (matches taskService.completeSubTask): tick in sequence
  // order while the parent is In Progress; there is no un-ticking. Ticking every sub-task does
  // NOT move the parent — the assignee still drags the card to Review themselves, same as a task
  // with no sub-tasks (2026-08-02, reversing 2026-07-31's auto-promote-on-last-tick — the system
  // shouldn't decide the work is review-ready just because a checklist is done). No separate
  // "Start Task"/"Submit for Review" button (previously added for BUG-025) — dragging the card is
  // the only way a task advances.
  const canToggleSubTask = (sub: Task): boolean => {
    if (clockedOut) return false
    if (sub.is_completed) return false
    const parent = tasks.find(t => t.id === sub.parent_task_id)
    if (!parent || parent.status !== 'In Progress') return false
    const siblings = tasks.filter(t => t.parent_task_id === sub.parent_task_id)
    return !siblings.some(s => (s.sequence_order ?? 0) < (sub.sequence_order ?? 0) && !s.is_completed)
  }

  const toggleSubTask = async (sub: Task) => {
    if (!canToggleSubTask(sub)) return
    // Once every sub-task is ticked there's nothing left to check off — collapse the checklist so
    // it doesn't sit expanded showing an all-done, purely static list. This does NOT move the
    // parent card: ticking sub-tasks is a checklist, not a decision that the work is ready for
    // review — only the assignee dragging the card to Review does that (2026-08-02, reversing
    // 2026-08-01's auto-promote-on-last-tick).
    const siblings = tasks.filter(t => t.parent_task_id === sub.parent_task_id)
    const isLastSubTask = !siblings.some(s => s.id !== sub.id && !s.is_completed)
    if (isLastSubTask && sub.parent_task_id) {
      const parentId = sub.parent_task_id
      setExpandedTaskIds(prev => {
        const next = new Set(prev)
        next.delete(parentId)
        return next
      })
    }
    setTasks(prev => prev.map(t => t.id === sub.id ? { ...t, is_completed: true } : t))
    try {
      const res = await fetch('/api/task', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sub.id, action: 'complete_subtask', assigned_by: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error()
      void load()
    } catch {
      void load()
    }
  }

  // Same field style as Casual Worker's read-only detail popup — the shared modal.ts
  // modalInputStyle (0.9375rem) runs visibly bigger than TasksView.tsx's own local override,
  // which both boards now match pixel-for-pixel (2026-07-31).
  const viewFieldValue: React.CSSProperties = { ...modalInputStyle, fontSize: '0.8125rem', padding: '9px 12px', fontFamily: 'inherit', display: 'flex', alignItems: 'center' }
  const viewEmpty: React.CSSProperties = { ...viewFieldValue, color: '#9CA3AF', fontStyle: 'italic' }

  const toggleExpanded = (taskId: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const subTasksByParent = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.parent_task_id) continue
    const arr = subTasksByParent.get(t.parent_task_id) ?? []
    arr.push(t)
    subTasksByParent.set(t.parent_task_id, arr)
  }
  for (const arr of subTasksByParent.values()) arr.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))

  return (
    <div style={{ height: '100%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
    <ShowcaseCard
      icon={<Layers size={15} color="#F97316" />}
      title="My Tasks"
      rightContent={
        // No hint once clocked out — cards read as done (not draggable, no hover motion), same
        // as the Casual Worker's own board once its readOnly kicks in (2026-08-02).
        !clockedOut && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 600, color: '#9CA3AF', background: '#F3F4F6', padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <GripVertical size={11} /> Drag cards to move
          </span>
        )
      }
      fillHeight
    >
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'row', gap: 10, height: '100%', boxSizing: 'border-box', minWidth: 640 }}>
          <style>{DASHBOARD_SKELETON_KEYFRAMES}</style>
          {COLUMNS.map(col => (
            <div key={col} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, background: '#F7F8FA', borderRadius: 12, border: '1px solid #F0F1F3', padding: '10px 10px 12px' }}>
              <SkeletonLine width="60%" height={13} />
              <SkeletonLine height={64} radius={10} />
              <SkeletonLine height={64} radius={10} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 0, height: '100%', boxSizing: 'border-box', minWidth: 640, overflowX: 'auto' }}>
          {/* Same hover lift + shadow and sub-task expand transition as Casual Worker's board
              (src/components/casual/CasualTaskBoard.tsx) — this widget never had it (2026-07-31). */}
          <style>{`
            .task-card {
              transition: box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease;
            }
            .task-card:hover {
              box-shadow: 0 6px 22px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(249,115,22,0.15);
              transform: translateY(-2px);
            }
            @keyframes empSubtasksIn {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .emp-subtasks-in { animation: empSubtasksIn 0.2s ease both; }
          `}</style>
          {COLUMNS.map((col, colIdx) => {
            const cfg = STATUS_CONFIG[col]
            // Unseen (new-task dot) cards float to the top of their column — same rule as
            // Manager's My Tasks tab (2026-08-02).
            const items = tasks
              .filter(t => t.status === col && !t.parent_task_id)
              .slice()
              .sort((a, b) => (isUnseenTaskAlert(b) ? 1 : 0) - (isUnseenTaskAlert(a) ? 1 : 0))
            const isOver = dragOverCol === col
            return (
              <Fragment key={col}>
                {colIdx > 0 && (
                  <div style={{ flexShrink: 0, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(249,115,22,0.35)', flexShrink: 0 }}>
                      <ArrowRight size={12} strokeWidth={2.5} />
                    </div>
                  </div>
                )}
                <div
                  onDragOver={e => {
                    const task = tasks.find(t => t.id === draggingTaskId)
                    if (!task || !isValidDropTarget(task, col)) return
                    e.preventDefault()
                    setDragOverCol(col)
                  }}
                  onDragLeave={() => setDragOverCol(prev => (prev === col ? null : prev))}
                  onDrop={e => {
                    e.preventDefault()
                    const task = tasks.find(t => t.id === draggingTaskId)
                    if (task) void handleDrop(task, col)
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    background: isOver ? '#FFF7ED' : '#F7F8FA',
                    borderRadius: 12,
                    border: `1px solid ${isOver ? '#F97316' : '#F0F1F3'}`,
                    overflow: 'hidden',
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                >
                  <div style={{ padding: '11px 14px 10px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, borderBottom: '1px solid #ECEEF1' }}>
                    <div style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>{cfg.icon}</div>
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: cfg.color, flex: 1 }}>{cfg.label}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 999 }}>{items.length}</span>
                  </div>

                  <div style={{ flex: 1, minHeight: 96, overflowY: 'auto', padding: '10px 18px 12px', display: 'flex', flexDirection: 'column' }}>
                    {items.length === 0 ? (
                      // Same empty-state placeholder as Manager's My Tasks tab
                      // (TasksView.tsx renderMyTasksView) — this widget never had one, so an
                      // empty column just rendered blank instead (2026-08-02).
                      <div style={{ flex: 1, minHeight: 164, margin: '8px 0', padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        {{ Assigned: <Layers size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, 'In Progress': <Clock size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, Review: <Eye size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, Complete: <CheckCircle size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} /> }[col]}
                        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No {cfg.label.toLowerCase()} tasks</p>
                      </div>
                    ) : items.map(task => {
                      const draggable = canDragTask(task)
                      const priority = task.priority ? PRIORITY_COLORS[task.priority] : null
                      const needsRework = !!task.rejection_reason && task.status === 'In Progress'
                      const subTasks = subTasksByParent.get(task.id) ?? []
                      const expanded = expandedTaskIds.has(task.id)
                      // Playing-card-stack effect behind the card when it has sub-tasks and isn't
                      // expanded yet — matches Casual Worker's board exactly (2026-07-31).
                      const showStack = subTasks.length > 0 && !expanded
                      // Card height/font/spacing now matches Manager's My Tasks tab TaskCard exactly
                      // (showAssignee=false path in TasksView.tsx) instead of this widget's own
                      // one-off smaller sizing (2026-08-02).
                      const isNew = isUnseenTaskAlert(task)
                      return (
                        <div key={task.id} style={{ position: 'relative', marginBottom: showStack ? 22 : 14 }}>
                        {showStack && (
                          <>
                            <div style={{ position: 'absolute', left: 12, right: 12, bottom: -8, height: 14, background: '#EEF1F5', border: '1px solid #E2E8F0', borderRadius: 10, zIndex: 0 }} />
                            <div style={{ position: 'absolute', left: 6, right: 6, bottom: -4, height: 14, background: '#F7F9FB', border: '1px solid #E5E7EB', borderRadius: 10, zIndex: 1 }} />
                          </>
                        )}
                        {/* zIndex 3: above the card's own white box (zIndex 2 below), so it sits
                            visibly on the card's white surface instead of getting covered by it —
                            same as Manager's My Tasks tab (2026-08-02). */}
                        {isNew && (
                          <span title="New task" style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: '#EF4444', zIndex: 3 }} />
                        )}
                        <div
                          draggable={draggable}
                          onDragStart={() => { if (draggable) { setDraggingTaskId(task.id); markTaskSeen(task) } }}
                          onDragEnd={() => { setDraggingTaskId(null); setDragOverCol(null) }}
                          onClick={() => { markTaskSeen(task); setDetailTask(task) }}
                          className="task-card"
                          style={{
                            position: 'relative',
                            zIndex: 2,
                            background: '#FFFFFF',
                            border: '1px solid #E5E7EB',
                            borderRadius: 10,
                            padding: '16px 16px',
                            cursor: draggable ? 'grab' : 'pointer',
                            opacity: draggingTaskId === task.id ? 0.5 : 1,
                            boxSizing: 'border-box',
                          }}
                        >
                          {(priority || needsRework || subTasks.length > 0 || task.assigned_by_name) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                              {priority && task.priority && (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: priority.bg, color: priority.text, letterSpacing: '0.01em' }}>
                                  {task.priority}
                                </span>
                              )}
                              {task.assigned_by_name && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                                  Assigned by {task.assigned_by_name}
                                </span>
                              )}
                              {needsRework && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: '#FEF2F2', color: '#DC2626', letterSpacing: '0.01em' }}>
                                  <AlertTriangle size={10} /> Rework
                                </span>
                              )}
                              {subTasks.length > 0 && (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); toggleExpanded(task.id) }}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#F1F5F9', color: '#475569', border: 'none', cursor: 'pointer' }}
                                >
                                  <GitBranch size={10} />
                                  {subTasks.length}
                                  <ChevronDown size={10} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                </button>
                              )}
                            </div>
                          )}

                          <p style={{ margin: '0 0 12px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>{task.title}</p>

                          {task.due_at && (() => {
                            const deadlineWarning = task.status !== 'Complete' && (isDueOverdue(task.due_at) || isDueWithinHours(task.due_at, 2))
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '0 0 8px' }}>
                                {deadlineWarning ? <AlertCircle size={13} color="#EF4444" /> : <Clock size={13} color="#9CA3AF" />}
                                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: deadlineWarning ? '#EF4444' : '#6B7280', whiteSpace: 'nowrap' }}>
                                  {formatDeadlineDisplay(task.due_at)}
                                </span>
                              </div>
                            )
                          })()}
                        </div>

                        {expanded && subTasks.length > 0 && (
                          <div className="emp-subtasks-in" style={{ marginTop: 8, paddingLeft: 14, paddingRight: 20 }}>
                            {subTasks.map((sub, idx) => {
                              const done = sub.is_completed
                              const canToggle = canToggleSubTask(sub)
                              const toggleTitle = done
                                ? 'Completed'
                                : task.status !== 'In Progress'
                                ? 'Start the task before checking off sub-tasks'
                                : canToggle
                                ? 'Mark as done'
                                : 'Complete the previous sub-task first'
                              return (
                              <div key={sub.id} style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                  <span style={{ width: 20, height: 20, marginTop: 10, borderRadius: '50%', background: done ? '#DCFCE7' : '#FFF3E8', color: done ? '#15803D' : '#EA580C', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {idx + 1}
                                  </span>
                                  {idx < subTasks.length - 1 && <div style={{ width: 1, flex: 1, background: '#E2E8F0' }} />}
                                </div>
                                <div
                                  style={{ flex: 1, minWidth: 0, marginBottom: 8, padding: '9px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #EEF0F2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                                >
                                  <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: '0.75rem', fontWeight: 600, color: done ? '#9CA3AF' : '#111827' }}>
                                    {sub.title}
                                  </p>
                                  <button
                                    type="button"
                                    disabled={!canToggle}
                                    onClick={e => { e.stopPropagation(); void toggleSubTask(sub) }}
                                    title={toggleTitle}
                                    style={{
                                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                      // Three distinct states, not two + opacity: done (green,
                                      // checked), unlocked (white ring, ready to tick), locked
                                      // (solid grey disc — sequence hasn't reached it yet). The
                                      // previous dimmed-white-ring look for "locked" read as a
                                      // rendering glitch rather than an intentional state
                                      // (2026-08-02).
                                      border: !done && canToggle ? '1.5px solid #D1D5DB' : 'none',
                                      background: done ? '#16A34A' : canToggle ? '#FFFFFF' : '#D1D5DB',
                                      color: '#FFFFFF',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: canToggle ? 'pointer' : 'not-allowed',
                                      padding: 0,
                                    }}
                                  >
                                    {done && <Check size={13} strokeWidth={3} />}
                                  </button>
                                </div>
                              </div>
                              )
                            })}
                          </div>
                        )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Fragment>
            )
          })}
        </div>
      )}

      {/* Read-only task detail — full editing stays on the dedicated Tasks page. Portaled to
          document.body (same fix as Casual Worker's board, 2026-08-01) — an ancestor between here
          and the page root has a completed `animation: ... both` fill-mode that leaves a non-none
          `transform` behind, which per the CSS spec becomes the containing block for
          `position:fixed` descendants; without the portal the overlay only ever covered this
          block, not the whole page. */}
      {detailTask && createPortal(
        <div
          onClick={() => setDetailTask(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20, animation: 'overlayFadeIn 0.18s ease-out' }}
        >
          <style>{modalKeyframes}</style>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(440px, 100%)', maxHeight: '100%', overflowY: 'auto', background: '#FFFFFF', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}
          >
            <ModalHeader
              title={detailTask.title}
              icon={<Layers size={15} color="#fff" />}
              onClose={() => setDetailTask(null)}
            />
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={modalLabelStyle}>Description</label>
                {detailTask.description
                  ? <div style={{ ...viewFieldValue, alignItems: 'flex-start', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{detailTask.description}</div>
                  : <div style={viewEmpty}>No description</div>}
              </div>

              <div>
                <label style={modalLabelStyle}>Assigned Time</label>
                <div style={viewFieldValue}>
                  {new Date(detailTask.created_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {detailTask.status === 'Complete' && (
                <div>
                  <label style={modalLabelStyle}>Completed Time</label>
                  <div style={viewFieldValue}>
                    {new Date(detailTask.completed_at ?? detailTask.updated_at ?? detailTask.created_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}

              {detailTask.rejection_reason && detailTask.status !== 'Complete' && (
                <div>
                  <label style={modalLabelStyle}>Rejected Reason</label>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 13, lineHeight: 1.5 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ whiteSpace: 'pre-wrap' }}>{detailTask.rejection_reason}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </ShowcaseCard>
    </div>
  )
}
