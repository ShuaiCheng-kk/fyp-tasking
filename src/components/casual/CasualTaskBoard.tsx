'use client'

// Casual Worker's task board — scoped to exactly one job (shift_id), the same Kanban mechanics
// the Owner/Manager/Employee boards use: drag exactly one column forward, locked once in Review
// (only the supervising Employee's approve/reject can move it from there). A Casual Worker is
// never the assigner, so there is no create/assign/approve UI here — only drag-to-progress.

import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardList, ListTodo, RefreshCw } from 'lucide-react'
import { Task } from '@/types/Task'

const COLUMNS: Task['status'][] = ['Assigned', 'In Progress', 'Review', 'Complete']
const STATUS_PERCENT: Record<Task['status'], number> = { Assigned: 0, 'In Progress': 33, Review: 66, Complete: 100 }

const COLUMN_META: Record<Task['status'], { label: string; bg: string; text: string }> = {
  Assigned: { label: 'Assigned', bg: '#F1F5F9', text: '#334155' },
  'In Progress': { label: 'In Progress', bg: '#FFF7ED', text: '#C2410C' },
  Review: { label: 'In Review', bg: '#EFF6FF', text: '#1D4ED8' },
  Complete: { label: 'Complete', bg: '#F0FDF4', text: '#15803D' },
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
      affectedIds.has(t.id) ? { ...t, status: targetStatus, percentage_complete: STATUS_PERCENT[targetStatus] } : t
    ))

    try {
      const results = await Promise.all([...affectedIds].map(id => fetch('/api/task', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: targetStatus, percentage_complete: STATUS_PERCENT[targetStatus] }),
      }).then(r => r.json())))
      if (results.some(r => !r.success)) throw new Error()
    } catch {
      void load()
    }
  }

  if (loading) {
    return <div style={cardStyle}><p style={{ margin: 0, color: '#6B7280', fontSize: '0.875rem' }}>Loading tasks…</p></div>
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ClipboardList size={16} color="#EA580C" />
        </div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>Tasks for this Job</p>
        <button type="button" onClick={() => { setLoading(true); void load() }} title="Refresh"
          style={{ marginLeft: 'auto', width: 28, height: 28, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {tasks.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#9CA3AF' }}>No tasks assigned for this job yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          {COLUMNS.map(col => {
            const meta = COLUMN_META[col]
            const items = tasks.filter(t => t.status === col && !t.parent_task_id)
            const isOver = dragOverCol === col
            return (
              <div
                key={col}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col) }}
                onDragLeave={() => setDragOverCol(prev => (prev === col ? null : prev))}
                onDrop={e => {
                  e.preventDefault()
                  const task = tasks.find(t => t.id === draggingTaskId)
                  if (task) void handleDrop(task, col)
                }}
                style={{
                  background: isOver ? '#FFF7ED' : '#F9FAFB',
                  border: `1.5px dashed ${isOver ? '#F97316' : '#E5E7EB'}`,
                  borderRadius: 10,
                  padding: 8,
                  minHeight: 96,
                  transition: 'background 0.12s, border-color 0.12s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: meta.text, background: meta.bg, borderRadius: 999, padding: '2px 8px' }}>
                    {meta.label}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 700 }}>{items.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(task => {
                    const draggable = canDragTask(task)
                    return (
                      <div
                        key={task.id}
                        draggable={draggable}
                        onDragStart={() => draggable && setDraggingTaskId(task.id)}
                        onDragEnd={() => { setDraggingTaskId(null); setDragOverCol(null) }}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E5E7EB',
                          borderRadius: 8,
                          padding: '8px 10px',
                          cursor: draggable ? 'grab' : 'default',
                          opacity: draggingTaskId === task.id ? 0.5 : 1,
                        }}
                      >
                        <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827' }}>{task.title}</p>
                        {task.status === 'Complete' && (
                          <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#15803D', fontWeight: 700 }}>
                            <CheckCircle2 size={12} /> Approved
                          </p>
                        )}
                        {task.rejection_reason && task.status === 'In Progress' && (
                          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#B91C1C' }}>
                            Sent back: {task.rejection_reason}
                          </p>
                        )}
                        {draggable && (
                          <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#9CA3AF' }}>
                            <ListTodo size={11} /> Drag to {COLUMNS[COLUMNS.indexOf(task.status) + 1]}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 14,
  border: '1.5px solid #E5E7EB',
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}
