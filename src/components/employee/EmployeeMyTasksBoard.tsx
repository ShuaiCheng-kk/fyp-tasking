'use client'

// Employee Dashboard's "My Tasks" widget — same Kanban mechanics and card language as Manager's
// "My Tasks" tab on the Tasks page (src/components/tasks/TasksView.tsx renderMyTasksView): four
// status columns, drag exactly one column forward, same STATUS_CONFIG colors/icons and card
// badges (priority / sub-task count / rework), same "Drag cards to move" header hint. Built as
// its own lightweight widget (not the shared TaskCard, which carries Owner/Partner-only editing
// affordances this dashboard surface doesn't need) — click opens a read-only detail popup;
// full editing stays on the dedicated Tasks page.

import { Fragment, useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle, Clock, Eye, GitBranch, GripVertical, Layers } from 'lucide-react'
import { Task } from '@/types/Task'
import { ShowcaseCard } from '@/components/panel'
import { ModalHeader, modalLabelStyle, modalInputStyle } from '@/components/modal'
import { modalKeyframes } from '@/components/theme/tokens'
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
  internalUserId: string
}

export default function EmployeeMyTasksBoard({ companyId, internalUserId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Task['status'] | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const load = async () => {
    if (!companyId || !internalUserId) return
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

  useResourceInvalidation(['tasks'], () => { void load() })

  const canDragTask = (task: Task): boolean => task.status !== 'Review' && task.status !== 'Complete'

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

  const viewFieldValue: React.CSSProperties = { ...modalInputStyle, display: 'flex', alignItems: 'center' }
  const viewEmpty: React.CSSProperties = { ...viewFieldValue, color: '#9CA3AF', fontStyle: 'italic' }

  const subTaskCountByParent = new Map<string, number>()
  for (const t of tasks) {
    if (!t.parent_task_id) continue
    subTaskCountByParent.set(t.parent_task_id, (subTaskCountByParent.get(t.parent_task_id) ?? 0) + 1)
  }

  return (
    <div style={{ height: '100%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
    <ShowcaseCard
      icon={<Layers size={15} color="#F97316" />}
      title="My Tasks"
      rightContent={
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 600, color: '#9CA3AF', background: '#F3F4F6', padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
          <GripVertical size={11} /> Drag to move
        </span>
      }
      fillHeight
    >
      {loading ? (
        <p style={{ margin: 0, color: '#6B7280', fontSize: '0.875rem' }}>Loading tasks…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 0, height: '100%', boxSizing: 'border-box', minWidth: 640, overflowX: 'auto' }}>
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
                      const subTaskCount = subTaskCountByParent.get(task.id) ?? 0
                      return (
                        <div
                          key={task.id}
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
                          {(priority || needsRework || subTaskCount > 0) && (
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
                              {subTaskCount > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#F1F5F9', color: '#475569' }}>
                                  <GitBranch size={10} />
                                  {subTaskCount}
                                </span>
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
                      )
                    })}
                  </div>
                </div>
              </Fragment>
            )
          })}
        </div>
      )}

      {/* Read-only task detail — full editing stays on the dedicated Tasks page. Scoped to this
          block only (absolute, not fixed) so opening it never dims the rest of the Dashboard. */}
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
    </ShowcaseCard>
    </div>
  )
}
