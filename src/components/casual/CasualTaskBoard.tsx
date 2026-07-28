'use client'

// Casual Worker's task board — scoped to exactly one job (shift_id), the same Kanban mechanics
// the Owner/Manager/Employee boards use: drag exactly one column forward, locked once in Review
// (only the supervising Employee's approve/reject can move it from there). A Casual Worker is
// never the assigner, so there is no create/assign/approve UI here — only drag-to-progress and a
// read-only detail view.
// Visual language mirrors the Owner Task board's Kanban (column header pill + arrow connectors +
// card layout) so the same board reads consistently across roles.

import { Fragment, useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, CheckCircle, ChevronDown, Clock, ClipboardList, Eye, GitBranch, GripVertical, Layers, RefreshCw } from 'lucide-react'
import { Task } from '@/types/Task'
import { TitledBlock } from '@/components/panel'
import { ModalHeader, modalLabelStyle, modalInputStyle } from '@/components/modal'
import { modalKeyframes } from '@/components/theme/tokens'
import { useIsCompactContainer } from '@/hooks/useIsCompactContainer'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'

const COLUMNS: Task['status'][] = ['Assigned', 'In Progress', 'Review', 'Complete']

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
  shiftId: string
  userId: string
}

export default function CasualTaskBoard({ companyId, shiftId, userId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Task['status'] | null>(null)
  // The board sits beside the Message panel in the Dashboard's row (roughly half the row width)
  // — narrow enough that "Tasks · Drag cards to move · refresh" doesn't fit on one line, so the
  // hint text drops to icon-only below this breakpoint (see useIsCompactContainer's doc: this is
  // a panel-width, not a window-width, squeeze).
  const [titleRowRef, isNarrow] = useIsCompactContainer<HTMLDivElement>(380)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())

  const load = async () => {
    const res = await fetch(`/api/task?company_id=${companyId}&shift_id=${shiftId}`)
    const data = await res.json()
    if (data.success) {
      const mine = (data.tasks as Task[]).filter(t =>
        t.assigned_user_id === userId || (t.assigned_user_ids ?? []).includes(userId)
      )
      setTasks(mine)
    }
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, shiftId, userId])

  // Live-updates the board when the assigning Employee rejects/approves a task or edits its
  // sub-tasks, so a rework notice appears without the Casual Worker refreshing the page.
  useResourceInvalidation(['tasks'], () => { void load() })

  const canDragTask = (task: Task): boolean =>
    task.status !== 'Review' && task.status !== 'Complete'

  const handleDrop = async (task: Task, targetStatus: Task['status']) => {
    setDragOverCol(null)
    setDraggingTaskId(null)
    if (!canDragTask(task)) return
    const currentIdx = COLUMNS.indexOf(task.status)
    const targetIdx = COLUMNS.indexOf(targetStatus)
    if (targetIdx !== currentIdx + 1) return

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
  // order while the parent is In Progress; there is no un-ticking. Ticking the last one promotes
  // the parent (and its siblings) to Review, so a full reload after success keeps everything —
  // parent status, sibling percentages — in sync rather than hand-patching local state.
  const canToggleSubTask = (sub: Task): boolean => {
    if (sub.is_completed) return false
    const parent = tasks.find(t => t.id === sub.parent_task_id)
    if (!parent || parent.status !== 'In Progress') return false
    const siblings = tasks.filter(t => t.parent_task_id === sub.parent_task_id)
    return !siblings.some(s => (s.sequence_order ?? 0) < (sub.sequence_order ?? 0) && !s.is_completed)
  }

  const toggleSubTask = async (sub: Task) => {
    if (!canToggleSubTask(sub)) return
    setTasks(prev => prev.map(t => t.id === sub.id ? { ...t, is_completed: true } : t))
    try {
      const res = await fetch('/api/task', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sub.id, action: 'complete_subtask', assigned_by: userId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error()
      void load()
    } catch {
      void load()
    }
  }

  const viewFieldValue: React.CSSProperties = { ...modalInputStyle, display: 'flex', alignItems: 'center' }
  const viewEmpty: React.CSSProperties = { ...viewFieldValue, color: '#9CA3AF', fontStyle: 'italic' }

  // Sub-tasks nest under their parent card wherever the parent renders — regardless of the
  // sub-task's own status — so a Casual Worker always sees their full checklist in one place.
  const subTasksByParent = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.parent_task_id) continue
    const arr = subTasksByParent.get(t.parent_task_id) ?? []
    arr.push(t)
    subTasksByParent.set(t.parent_task_id, arr)
  }
  for (const arr of subTasksByParent.values()) arr.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))

  const toggleExpanded = (taskId: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  // The block stretches to whatever height its host gives it (the Dashboard pins it to the
  // bottom of the viewport); the Kanban columns fill that height and the body scrolls if the
  // cards outgrow it.
  return (
    <div ref={titleRowRef} style={{ height: '100%', minWidth: 0, minHeight: 0 }}>
    <TitledBlock
      icon={<ClipboardList size={15} color="#F97316" />}
      title="Tasks"
      titleHint={
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 600, color: '#9CA3AF', background: '#F3F4F6', padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
          <GripVertical size={11} />{!isNarrow && ' Drag to move'}
        </span>
      }
      containerStyle={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', position: 'relative' }}
      bodyStyle={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      headerRight={
        <button type="button" onClick={() => { setLoading(true); void load() }} title="Refresh"
          style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={14} />
        </button>
      }
    >
      {loading ? (
        <p style={{ margin: 0, color: '#6B7280', fontSize: '0.875rem' }}>Loading tasks…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 0, height: '100%', boxSizing: 'border-box', minWidth: 640 }}>
          {COLUMNS.map((col, colIdx) => {
            const cfg = STATUS_CONFIG[col]
            const items = tasks.filter(t => t.status === col && !t.parent_task_id)
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
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col) }}
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
                  <div style={{ padding: '10px 12px 9px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, borderBottom: '1px solid #ECEEF1' }}>
                    <div style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>{cfg.icon}</div>
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: cfg.color, flex: 1 }}>{cfg.label}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 999 }}>{items.length}</span>
                  </div>

                  <div style={{ flex: 1, minHeight: 96, overflowY: 'auto', padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {items.map(task => {
                      const draggable = canDragTask(task)
                      const priority = task.priority ? PRIORITY_COLORS[task.priority] : null
                      const needsRework = !!task.rejection_reason && task.status === 'In Progress'
                      const subTasks = subTasksByParent.get(task.id) ?? []
                      const expanded = expandedTaskIds.has(task.id)
                      return (
                        <div key={task.id}>
                        <div
                          draggable={draggable}
                          onDragStart={() => draggable && setDraggingTaskId(task.id)}
                          onDragEnd={() => { setDraggingTaskId(null); setDragOverCol(null) }}
                          onClick={() => setDetailTask(task)}
                          style={{
                            position: 'relative',
                            background: '#FFFFFF',
                            border: '1px solid #E5E7EB',
                            borderRadius: 10,
                            padding: '16px',
                            cursor: draggable ? 'grab' : 'pointer',
                            opacity: draggingTaskId === task.id ? 0.5 : 1,
                            boxSizing: 'border-box',
                          }}
                        >
                          {(priority || needsRework || subTasks.length > 0) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                              {priority && task.priority && (
                                <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: priority.bg, color: priority.text, letterSpacing: '0.01em' }}>
                                  {task.priority}
                                </span>
                              )}
                              {needsRework && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: '#FEF2F2', color: '#DC2626', letterSpacing: '0.01em' }}>
                                  <AlertTriangle size={10} /> Rework
                                </span>
                              )}
                              {subTasks.length > 0 && (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); toggleExpanded(task.id) }}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#F1F5F9', color: '#475569', border: 'none', cursor: 'pointer' }}
                                >
                                  <GitBranch size={10} />
                                  {subTasks.length}
                                  <ChevronDown size={10} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                </button>
                              )}
                            </div>
                          )}

                          <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>{task.title}</p>

                          {task.due_at && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: '0.7rem', fontWeight: 600, color: '#9CA3AF' }}>
                              <Clock size={11} />
                              {new Date(task.due_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {expanded && subTasks.length > 0 && (
                          <div style={{ marginTop: 8, paddingLeft: 14 }}>
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
                                  onClick={() => setDetailTask(sub)}
                                  style={{ flex: 1, minWidth: 0, marginBottom: 8, padding: '9px 12px', borderRadius: 8, background: '#FAFAFA', border: '1px solid #EEF0F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                                >
                                  <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: '0.75rem', fontWeight: 600, color: done ? '#9CA3AF' : '#111827', textDecoration: done ? 'line-through' : 'none' }}>
                                    {sub.title}
                                  </p>
                                  <button
                                    type="button"
                                    disabled={!canToggle}
                                    onClick={e => { e.stopPropagation(); void toggleSubTask(sub) }}
                                    title={toggleTitle}
                                    style={{
                                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                      border: done ? 'none' : '1.5px solid #D1D5DB',
                                      background: done ? '#16A34A' : '#FFFFFF',
                                      color: '#FFFFFF',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: canToggle ? 'pointer' : 'not-allowed',
                                      opacity: !done && !canToggle ? 0.5 : 1,
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

      {/* Read-only task detail — Casual Worker is never the assigner, so no edit affordances here.
          Scoped to this block only (absolute, not fixed) so opening it never dims the rest of the
          Dashboard's blocks — just the Tasks card it belongs to. */}
      {detailTask && (
        <div
          onClick={() => setDetailTask(null)}
          style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, padding: 20, animation: 'overlayFadeIn 0.18s ease-out' }}
        >
          <style>{modalKeyframes}</style>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(400px, 100%)', maxHeight: '100%', overflowY: 'auto', background: '#FFFFFF', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}
          >
            <ModalHeader
              title={detailTask.title}
              icon={<ClipboardList size={15} color="#fff" />}
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
                <label style={modalLabelStyle}>Deadline</label>
                {detailTask.due_at
                  ? <div style={viewFieldValue}>{new Date(detailTask.due_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  : <div style={viewEmpty}>No deadline</div>}
              </div>

              <div>
                <label style={modalLabelStyle}>Assigned By</label>
                <div style={viewFieldValue}>
                  {detailTask.assigned_by_name ?? 'Unknown'}
                </div>
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
        </div>
      )}
    </TitledBlock>
    </div>
  )
}
