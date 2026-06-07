'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, ChevronDown, Calendar, AlertCircle,
  CheckCircle, Clock, Eye, Layers, Users, MoreHorizontal,
  Copy,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import ManagerSidebar from '@/components/ManagerSidebar'
import { Task, TaskInput, KanbanGroup } from '@/types/Task'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'

// ─── Local page types ─────────────────────────────────────────────────────────

type Department = { id: string; name: string }
type Member = { id: string; full_name: string; role: string; department_id: string | null }
type ManagerInfo = { id: string; full_name: string; department_id: string | null }
type ShiftOption = TimelineShiftBlock & {
  assignee_name: string
}

type DeptTaskStats = {
  department_id: string
  department_name: string
  assigned: number
  inProgress: number
  review: number
  complete: number
}

type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent'
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Low:    { bg: '#F1F5F9', text: '#475569' },
  Medium: { bg: '#EFF6FF', text: '#2563EB' },
  High:   { bg: '#FFF7ED', text: '#EA580C' },
  Urgent: { bg: '#FEF2F2', text: '#DC2626' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; colBg: string; icon: React.ReactNode }> = {
  'Assigned':    { label: 'Assigned',    color: '#475569', bg: '#E2E8F0', colBg: '#F4F4F5', icon: <Layers size={13} /> },
  'In Progress': { label: 'In Progress', color: '#2563EB', bg: '#DBEAFE', colBg: '#F4F4F5', icon: <Clock size={13} /> },
  'Review':      { label: 'Review',      color: '#EA580C', bg: '#FED7AA', colBg: '#F4F4F5', icon: <Eye size={13} /> },
  'Complete':    { label: 'Complete',    color: '#16A34A', bg: '#BBF7D0', colBg: '#F4F4F5', icon: <CheckCircle size={13} /> },
}

const COLUMNS: Task['status'][] = ['Assigned', 'In Progress', 'Review', 'Complete']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function formatDueDate(due: string): string {
  const d = new Date(due)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isDueOverdue(due: string): boolean {
  return new Date(due) < new Date()
}

function formatShiftOptionLabel(shift: ShiftOption): string {
  const date = new Date(`${shift.shift_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = `${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`
  return `${date} · ${time} · ${shift.assignee_name}`
}

const DEPT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#F97316', '#EF4444']
function deptColor(deptId: string): string {
  let h = 0
  for (let i = 0; i < deptId.length; i++) h = deptId.charCodeAt(i) + ((h << 5) - h)
  return DEPT_COLORS[Math.abs(h) % DEPT_COLORS.length]
}

// ─── Modal helpers ────────────────────────────────────────────────────────────

const modalInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: '8px', fontSize: '0.9375rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}
const modalLabelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '8px',
}
const modalSelectStyle: React.CSSProperties = {
  ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer',
}

function InlineError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginTop: '12px' }}>
      {message}
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, members, departments, shiftOptions, onClick,
}: {
  task: Task
  members: Member[]
  departments: Department[]
  shiftOptions: ShiftOption[]
  onClick: () => void
}) {
  const assignee = members.find(m => m.id === task.assigned_user_id)
  const dept = departments.find(d => d.id === task.department_id)
  const shift = task.shift_id ? shiftOptions.find(s => s.id === task.shift_id) : null
  const priority = task.priority ? PRIORITY_COLORS[task.priority] : null
  const overdue = task.due_at && task.status !== 'Complete' && isDueOverdue(task.due_at)

  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        border: '1.5px solid #E5E7EB',
        borderRadius: '10px',
        padding: '14px 16px',
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.12s, transform 0.12s',
        marginBottom: 8,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none' }}
    >
      {/* Priority + dept */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {priority && task.priority && (
          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: priority.bg, color: priority.text }}>
            {task.priority}
          </span>
        )}
        {dept && (
          <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: '99px', background: '#F8FAFC', color: '#6B7280', border: '1px solid #E5E7EB' }}>
            {dept.name}
          </span>
        )}
      </div>

      {/* Title */}
      <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', margin: '0 0 10px', lineHeight: 1.4 }}>
        {task.title}
      </p>

      {/* Progress bar */}
      {task.percentage_complete > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 500 }}>Progress</span>
            <span style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 700 }}>{task.percentage_complete}%</span>
          </div>
          <div style={{ height: 4, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${task.percentage_complete}%`, background: task.percentage_complete === 100 ? '#10B981' : '#3B82F6', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {shift && (
        <div style={{ marginBottom: 10, fontSize: '0.72rem', color: '#6B7280', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {formatShiftOptionLabel(shift)}
        </div>
      )}

      {/* Footer: assignee + due date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {assignee ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: '0.65rem', flexShrink: 0 }}>
              {assignee.full_name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {assignee.full_name}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#9CA3AF', background: '#F1F5F9', padding: '1px 5px', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
              {assignee.role}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#CBD5E1', fontStyle: 'italic' }}>No assignee</span>
        )}
        {task.due_at && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {overdue && <AlertCircle size={11} color="#EF4444" />}
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: overdue ? '#EF4444' : '#9CA3AF' }}>
              {formatDueDate(task.due_at)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Department Info Card ─────────────────────────────────────────────────────

function DeptInfoCard({
  dept,
  members,
  deptStats,
  deptManagerMap,
  onAssignTask,
  canManage,
  onEditName,
  onChangeManager,
  onDelete,
}: {
  dept: Department
  members: Member[]
  deptStats: DeptTaskStats | undefined
  deptManagerMap: Record<string, string>
  onAssignTask: (memberId: string, deptId: string) => void
  canManage: boolean
  onEditName: () => void
  onChangeManager: () => void
  onDelete: () => void
}) {
  const deptMembers = members.filter(m => m.department_id === dept.id && m.role !== 'Owner' && m.role !== 'Partner')
  const managerName = deptManagerMap[dept.id]
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: deptColor(dept.id) }} />
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>{dept.name}</h3>
            <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: '2px 0 0' }}>
              {managerName ?? 'No manager'} · {deptMembers.length} member{deptMembers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {canManage && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
              aria-label="department-menu"
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer', color: '#6B7280' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  border: '1px solid #E5E7EB',
                  minWidth: '160px',
                  zIndex: 30,
                  overflow: 'hidden',
                  animation: 'dropdownFadeIn 0.15s ease',
                }}
              >
                <button
                  onClick={() => { setMenuOpen(false); onEditName() }}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F4F4F5')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >Edit Name</button>
                <button
                  onClick={() => { setMenuOpen(false); onChangeManager() }}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F4F4F5')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >Change Manager</button>
                <div style={{ height: 1, background: '#E5E7EB', margin: '2px 0' }} />
                <button
                  onClick={() => { setMenuOpen(false); onDelete() }}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#EF4444', fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >Delete</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mini task stats */}
      {deptStats && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Assigned', count: deptStats.assigned, bg: '#E2E8F0', color: '#475569' },
            { label: 'In Progress', count: deptStats.inProgress, bg: '#DBEAFE', color: '#2563EB' },
            { label: 'Review', count: deptStats.review, bg: '#FED7AA', color: '#EA580C' },
            { label: 'Complete', count: deptStats.complete, bg: '#BBF7D0', color: '#16A34A' },
          ].map(({ label, count, bg, color }) => (
            <div key={label} style={{ padding: '5px 10px', background: bg, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 800, fontSize: '0.875rem', color }}>{count}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color, opacity: 0.75 }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Members list */}
      {deptMembers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Members</p>
          {deptMembers.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#F8FAFC', borderRadius: '8px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', color: '#374151', flexShrink: 0 }}>
                  {m.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#111827', margin: 0 }}>{m.full_name}</p>
                  <p style={{ fontSize: '0.7rem', color: '#9CA3AF', margin: 0 }}>{m.role}</p>
                </div>
              </div>
              <button
                onClick={() => onAssignTask(m.id, dept.id)}
                style={{ padding: '5px 10px', background: '#F97316', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', color: '#FFFFFF', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#EA6C0A')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F97316')}
              >
                Assign Task
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerTasksPage() {
  const router = useRouter()

  const [internalUserId, setInternalUserId] = useState('')
  const [companyId,      setCompanyId]      = useState('')
  const [ownerName,      setOwnerName]      = useState('')
  const [userRole,       setUserRole]       = useState('')
  const [companyName,    setCompanyName]    = useState('')
  const [headerTheme] = useState<{ bg: string; text: string; border: string }>(() => {
    if (typeof window === 'undefined') return { bg: '#1C1C1E', text: '#FFFFFF', border: 'none' }
    const role = localStorage.getItem('tasking_user_role')
    return role === 'Partner'
      ? { bg: '#FFFFFF', text: '#1C1C1E', border: '1px solid #E5E7EB' }
      : role === 'Manager'
        ? { bg: '#1E3A5F', text: '#FFFFFF', border: '1px solid #163050' }
      : { bg: '#1C1C1E', text: '#FFFFFF', border: 'none' }
  })
  const [initialReady,   setInitialReady]   = useState(false)

  const [departments, setDepartments] = useState<Department[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([])

  // Department selector
  const [selectedDeptId,  setSelectedDeptId]  = useState('') // '' = All
  const [deptTaskStats,   setDeptTaskStats]    = useState<DeptTaskStats[]>([])
  const [deptManagerMap,  setDeptManagerMap]   = useState<Record<string, string>>({})
  const [allManagers,     setAllManagers]      = useState<ManagerInfo[]>([])

  // Department CRUD modals
  const [editDeptModal,         setEditDeptModal]         = useState<Department | null>(null)
  const [editDeptName,          setEditDeptName]          = useState('')
  const [editDeptLoading,       setEditDeptLoading]       = useState(false)
  const [editDeptError,         setEditDeptError]         = useState('')
  const [deleteDeptModal,       setDeleteDeptModal]       = useState<Department | null>(null)
  const [deleteDeptLoading,     setDeleteDeptLoading]     = useState(false)
  const [deleteDeptError,       setDeleteDeptError]       = useState('')
  const [editManagerModal,      setEditManagerModal]      = useState<Department | null>(null)
  const [editManagerSelectedId, setEditManagerSelectedId] = useState('')
  const [editManagerLoading,    setEditManagerLoading]    = useState(false)
  const [editManagerError,      setEditManagerError]      = useState('')

  const [kanban,        setKanban]        = useState<KanbanGroup | null>(null)
  const [kanbanLoading, setKanbanLoading] = useState(false)

  // Task detail/edit panel
  const [selectedTask,  setSelectedTask]  = useState<Task | null>(null)
  const [editLoading,   setEditLoading]   = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [duplicateLoading, setDuplicateLoading] = useState(false)
  const [panelError,    setPanelError]    = useState('')
  const [editTitle,       setEditTitle]       = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPriority,    setEditPriority]    = useState('')
  const [editDueAt,       setEditDueAt]       = useState('')
  const [editAssignee,    setEditAssignee]    = useState('')
  const [editShiftId,     setEditShiftId]     = useState('')
  const [editStatus,      setEditStatus]      = useState<Task['status']>('Assigned')
  const [editPercent,     setEditPercent]     = useState(0)
  const [deleteConfirm,   setDeleteConfirm]   = useState(false)
  const [subTaskTitle,    setSubTaskTitle]    = useState('')
  const [subTaskLoading,  setSubTaskLoading]  = useState(false)

  // New task modal
  const [newTaskModal,    setNewTaskModal]    = useState(false)
  const [newTitle,        setNewTitle]        = useState('')
  const [newDescription,  setNewDescription]  = useState('')
  const [newDeptId,       setNewDeptId]       = useState('')
  const [newAssigneeId,   setNewAssigneeId]   = useState('')
  const [newShiftId,      setNewShiftId]      = useState('')
  const [newPriority,     setNewPriority]     = useState('')
  const [newDueAt,        setNewDueAt]        = useState('')
  const [newLoading,      setNewLoading]      = useState(false)
  const [newError,        setNewError]        = useState('')

  const panelRef = useRef<HTMLDivElement>(null)

  const canManageDepartments = userRole === 'Owner' || userRole === 'Partner'

  // ── Header theme ──────────────────────────────────────────────────────────

  // ── Mount: resolve session ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let userIdResolved = localStorage.getItem('tasking_user_id')
      if (!userIdResolved) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) { userIdResolved = session.user.id; localStorage.setItem('tasking_user_id', userIdResolved) }
      }
      if (!userIdResolved) { router.replace('/signin'); return }
      if (cancelled) return
      const role = localStorage.getItem('tasking_user_role') || ''
      setUserRole(role)

      fetch(`/api/user/me?user_id=${userIdResolved}`)
        .then(r => r.json())
        .then(d => {
          if (!cancelled && d.success) {
            if (d.user?.full_name) setOwnerName(d.user.full_name)
            if (d.user?.id)        setInternalUserId(d.user.id)
          }
        })
        .catch(() => {})

      const storedCid = localStorage.getItem(`tasking_company_id_${userIdResolved}`)
      const qs = new URLSearchParams({ user_id: userIdResolved })
      if (storedCid) qs.set('company_id', storedCid)

      const res = await fetch(`/api/company/current?${qs}`)
      if (!res.ok) { if (!cancelled) setInitialReady(true); return }
      const data = await res.json()
      if (cancelled || !data.success) { setInitialReady(true); return }

      if (data.company) {
        const cid = data.company.id
        if (!cancelled) {
          setCompanyId(cid)
          setCompanyName(data.company.name)
          setInitialReady(true)
        }
      } else {
        setInitialReady(true)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  // ── Fetch departments + members + managers ─────────────────────────────────

  useEffect(() => {
    if (!companyId || !internalUserId) return
    Promise.all([
      fetch(`/api/company/departments?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/team/members?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/company/managers?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/task?company_id=${companyId}&dept_stats=true`).then(r => r.json()),
      fetch(`/api/manager/departments?manager_id=${internalUserId}&company_id=${companyId}`).then(r => r.json()),
    ]).then(([deptData, memberData, mgrData, statsData, managerDeptData]) => {
      const managerDeptIds = new Set((managerDeptData.success ? managerDeptData.departments : []).map((dept: { department_id: string }) => dept.department_id))
      if (deptData.success) setDepartments(deptData.departments.filter((dept: Department) => managerDeptIds.has(dept.id)))
      if (memberData.success) setMembers(memberData.members.filter((member: Member) => member.department_id && managerDeptIds.has(member.department_id)))
      if (mgrData.success) {
        setAllManagers(mgrData.managers)
        const map: Record<string, string> = {}
        for (const mgr of mgrData.managers as ManagerInfo[]) {
          if (mgr.department_id && !map[mgr.department_id]) map[mgr.department_id] = mgr.full_name
        }
        setDeptManagerMap(map)
      }
      if (statsData.success) setDeptTaskStats((statsData.dept_stats ?? []).filter((stat: DeptTaskStats) => managerDeptIds.has(stat.department_id)))
    }).catch(() => {})
  }, [companyId, internalUserId])

  // ── Fetch kanban ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId) return
    const today = new Date()
    const dateFrom = formatDateKey(addDays(today, -2))
    const dateTo = formatDateKey(addDays(today, 7))

    fetch(`/api/shift?company_id=${companyId}&date_from=${dateFrom}&date_to=${dateTo}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) return
        const options: ShiftOption[] = (data.rows ?? []).flatMap((row: TimelineRow) =>
          row.shifts.map(shift => ({
            ...shift,
            assignee_name: row.full_name,
          })),
        )
        setShiftOptions(options)
      })
      .catch(() => setShiftOptions([]))
  }, [companyId])

  const fetchKanban = useCallback(async (cid: string) => {
    if (!cid) return
    setKanbanLoading(true)
    try {
      const res = await fetch(`/api/task?company_id=${cid}&kanban=true`)
      const data = await res.json()
      if (data.success) setKanban(data.groups)
    } catch {}
    finally { setKanbanLoading(false) }
  }, [])

  useEffect(() => {
    if (!companyId) return
    void Promise.resolve().then(() => fetchKanban(companyId))
  }, [companyId, fetchKanban])

  // ── Open task panel ────────────────────────────────────────────────────────

  const openTask = (task: Task) => {
    setSelectedTask(task)
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditPriority(task.priority ?? '')
    setEditDueAt(task.due_at ? task.due_at.slice(0, 10) : '')
    setEditAssignee(task.assigned_user_id ?? '')
    setEditShiftId(task.shift_id ?? '')
    setEditStatus(task.status)
    setEditPercent(task.percentage_complete)
    setPanelError('')
    setDeleteConfirm(false)
    setSubTaskTitle('')
  }

  const closePanel = () => { setSelectedTask(null); setDeleteConfirm(false); setPanelError(''); setSubTaskTitle('') }

  // ── Save task ─────────────────────────────────────────────────────────────

  const handleSaveTask = async () => {
    if (!selectedTask || !editTitle.trim()) return
    setEditLoading(true); setPanelError('')
    try {
      const res = await fetch('/api/task', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTask.id,
          title: editTitle.trim(),
          description: editDescription || null,
          priority: editPriority || null,
          due_at: editDueAt ? new Date(editDueAt).toISOString() : null,
          assigned_user_id: editAssignee || null,
          shift_id: editShiftId || null,
          status: editStatus,
          percentage_complete: editPercent,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      closePanel()
      fetchKanban(companyId)
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to save') }
    finally { setEditLoading(false) }
  }

  // ── Delete task ────────────────────────────────────────────────────────────

  const handleDeleteTask = async () => {
    if (!selectedTask) return
    setDeleteLoading(true); setPanelError('')
    try {
      const res = await fetch(`/api/task?id=${selectedTask.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      closePanel()
      fetchKanban(companyId)
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to delete') }
    finally { setDeleteLoading(false) }
  }

  const handleDuplicateTask = async () => {
    if (!selectedTask) return
    setDuplicateLoading(true); setPanelError('')
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id: selectedTask.id, assigned_by: internalUserId || undefined }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      closePanel()
      fetchKanban(companyId)
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to duplicate task') }
    finally { setDuplicateLoading(false) }
  }

  // ── Create task ────────────────────────────────────────────────────────────

  const handleCreateSubTask = async () => {
    if (!selectedTask || !subTaskTitle.trim()) return
    setSubTaskLoading(true); setPanelError('')
    try {
      const input: Partial<TaskInput> & { company_id: string; department_id: string; title: string } = {
        company_id: selectedTask.company_id,
        department_id: selectedTask.department_id,
        shift_id: editShiftId || selectedTask.shift_id,
        parent_task_id: selectedTask.id,
        title: subTaskTitle.trim(),
        assigned_user_id: editAssignee || selectedTask.assigned_user_id,
        assigned_by: internalUserId || null,
        status: 'Assigned',
        percentage_complete: 0,
      }
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setSubTaskTitle('')
      fetchKanban(companyId)
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to create sub-task') }
    finally { setSubTaskLoading(false) }
  }

  const handleCreateTask = async () => {
    if (!newTitle.trim() || !newDeptId) { setNewError('Title and department are required'); return }
    setNewLoading(true); setNewError('')
    try {
      const input: Partial<TaskInput> & { company_id: string; department_id: string; title: string } = {
        company_id: companyId,
        department_id: newDeptId,
        title: newTitle.trim(),
        description: newDescription || null,
        assigned_user_id: newAssigneeId || null,
        assigned_by: internalUserId || null,
        shift_id: newShiftId || null,
        priority: newPriority || null,
        due_at: newDueAt ? new Date(newDueAt).toISOString() : null,
        status: 'Assigned',
        percentage_complete: 0,
      }
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setNewTaskModal(false)
      setNewTitle(''); setNewDescription(''); setNewDeptId(''); setNewAssigneeId(''); setNewShiftId(''); setNewPriority(''); setNewDueAt('')
      fetchKanban(companyId)
    } catch (err) { setNewError(err instanceof Error ? err.message : 'Failed to create task') }
    finally { setNewLoading(false) }
  }

  // Open new task modal pre-filled with dept + assignee
  const openNewTaskFor = (memberId: string, deptId: string) => {
    setNewDeptId(deptId)
    setNewAssigneeId(memberId)
    setNewShiftId('')
    setNewTitle(''); setNewDescription(''); setNewPriority(''); setNewDueAt(''); setNewError('')
    setNewTaskModal(true)
  }

  // ── Department CRUD ────────────────────────────────────────────────────────

  const handleEditDept = async () => {
    if (!editDeptModal || !editDeptName.trim()) return
    setEditDeptLoading(true); setEditDeptError('')
    try {
      const res = await fetch('/api/company/update-department', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ department_id: editDeptModal.id, name: editDeptName.trim() }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setEditDeptModal(null)
      const deptRes = await fetch(`/api/company/departments?company_id=${companyId}`)
      const deptData = await deptRes.json()
      if (deptData.success) setDepartments(deptData.departments)
    } catch (err) { setEditDeptError(err instanceof Error ? err.message : 'Failed to update') }
    finally { setEditDeptLoading(false) }
  }

  const handleDeleteDept = async () => {
    if (!deleteDeptModal) return
    setDeleteDeptLoading(true); setDeleteDeptError('')
    try {
      const res = await fetch('/api/company/delete-department', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ department_id: deleteDeptModal.id }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setDeleteDeptModal(null)
      if (selectedDeptId === deleteDeptModal.id) setSelectedDeptId('')
      const deptRes = await fetch(`/api/company/departments?company_id=${companyId}`)
      const deptData = await deptRes.json()
      if (deptData.success) setDepartments(deptData.departments)
    } catch (err) { setDeleteDeptError(err instanceof Error ? err.message : 'Failed to delete') }
    finally { setDeleteDeptLoading(false) }
  }

  const handleEditDeptManager = async () => {
    if (!editManagerModal || !editManagerSelectedId) return
    setEditManagerLoading(true); setEditManagerError('')
    try {
      const res = await fetch('/api/user/update-department', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: editManagerSelectedId, department_id: editManagerModal.id }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setEditManagerModal(null); setEditManagerSelectedId('')
      const mgrRes = await fetch(`/api/company/managers?company_id=${companyId}`)
      const mgrData = await mgrRes.json()
      if (mgrData.success) {
        setAllManagers(mgrData.managers)
        const map: Record<string, string> = {}
        for (const mgr of mgrData.managers as ManagerInfo[]) {
          if (mgr.department_id && !map[mgr.department_id]) map[mgr.department_id] = mgr.full_name
        }
        setDeptManagerMap(map)
      }
    } catch (err) { setEditManagerError(err instanceof Error ? err.message : 'Failed to update manager') }
    finally { setEditManagerLoading(false) }
  }

  // ── Filtered tasks per column ──────────────────────────────────────────────

  const filteredTasks = (col: Task['status']): Task[] => {
    if (!kanban) return []
    const visibleDeptIds = new Set(departments.map(dept => dept.id))
    return (kanban[col] ?? []).filter(t => {
      if (!visibleDeptIds.has(t.department_id)) return false
      if (selectedDeptId && t.department_id !== selectedDeptId) return false
      return true
    })
  }

  const assignableMembers = members.filter(m => m.role === 'Employee')
  const newTaskDeptMembers = newDeptId ? assignableMembers.filter(m => m.department_id === newDeptId) : assignableMembers
  const newTaskShiftOptions = newDeptId ? shiftOptions.filter(shift => shift.department_id === newDeptId) : shiftOptions
  const editTaskShiftOptions = selectedTask ? shiftOptions.filter(shift => shift.department_id === selectedTask.department_id) : shiftOptions
  const selectedSubTasks = selectedTask && kanban
    ? COLUMNS.flatMap(col => kanban[col]).filter(task => task.parent_task_id === selectedTask.id)
    : []

  const visibleDepts = departments.filter(d =>
    selectedDeptId === '' ? true : d.id === selectedDeptId
  )

  // ── Button helpers ────────────────────────────────────────────────────────

  const primaryBtn = (loading: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', background: '#111827', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
    cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: loading ? 0.65 : 1,
  })
  const ghostBtn: React.CSSProperties = {
    flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB',
    borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: 'pointer',
  }
  const dangerBtn = (loading: boolean): React.CSSProperties => ({
    padding: '8px 16px', background: '#EF4444', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.875rem', color: '#FFFFFF',
    cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: loading ? 0.65 : 1,
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ManagerSidebar />

      {/* Dropdown animation */}
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{ padding: '18px 32px', background: headerTheme.bg, borderBottom: headerTheme.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: headerTheme.text, margin: 0 }}>
            {companyName ? `${companyName} — Tasks` : 'Tasks'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {ownerName && <span style={{ fontSize: '0.9rem', color: headerTheme.text, opacity: 0.85 }}>{ownerName}</span>}
            {userRole && (
              <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(128,128,128,0.15)', color: headerTheme.text }}>
                {userRole}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 32px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* ── DEPARTMENT SELECTOR STRIP ─────────────────────────────────── */}
          {departments.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', flexShrink: 0 }}>
                  <Users size={14} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Dept:</span>
                </div>
                {/* All pill */}
                <button
                  onClick={() => setSelectedDeptId('')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '99px',
                    border: selectedDeptId === '' ? '2px solid #111827' : '1.5px solid #E5E7EB',
                    background: selectedDeptId === '' ? '#111827' : '#FFFFFF',
                    color: selectedDeptId === '' ? '#FFFFFF' : '#374151',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    flexShrink: 0,
                  }}
                >
                  All
                </button>
                {departments.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDeptId(selectedDeptId === d.id ? '' : d.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '99px',
                      border: selectedDeptId === d.id ? `2px solid ${deptColor(d.id)}` : '1.5px solid #E5E7EB',
                      background: selectedDeptId === d.id ? deptColor(d.id) : '#FFFFFF',
                      color: selectedDeptId === d.id ? '#FFFFFF' : '#374151',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedDeptId === d.id ? 'rgba(255,255,255,0.7)' : deptColor(d.id), flexShrink: 0 }} />
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── DEPARTMENT INFO CARDS (when a dept is selected) ──────────── */}
          {selectedDeptId && (
            <div style={{ marginBottom: 24 }}>
              {visibleDepts.map(dept => (
                <DeptInfoCard
                  key={dept.id}
                  dept={dept}
                  members={members}
                  deptStats={deptTaskStats.find(s => s.department_id === dept.id)}
                  deptManagerMap={deptManagerMap}
                  onAssignTask={openNewTaskFor}
                  canManage={canManageDepartments}
                  onEditName={() => { setEditDeptModal(dept); setEditDeptName(dept.name); setEditDeptError('') }}
                  onChangeManager={() => { setEditManagerModal(dept); setEditManagerSelectedId(''); setEditManagerError('') }}
                  onDelete={() => { setDeleteDeptModal(dept); setDeleteDeptError('') }}
                />
              ))}
            </div>
          )}

          {/* ── KANBAN HEADER ROW ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>
              {selectedDeptId
                ? `${departments.find(d => d.id === selectedDeptId)?.name ?? ''} Tasks`
                : 'All Tasks'}
            </h2>
            <button
              onClick={() => { setNewTaskModal(true); setNewError(''); if (selectedDeptId) setNewDeptId(selectedDeptId) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#F97316', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', color: '#fff', cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#EA6C0A')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F97316')}
            >
              <Plus size={14} strokeWidth={2.5} /> New Task
            </button>
          </div>

          {/* ── KANBAN BOARD ─────────────────────────────────────────────── */}
          {!initialReady || kanbanLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Spinner size={24} dark />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flex: 1, minHeight: 0 }}>
              {COLUMNS.map(col => {
                const cfg = STATUS_CONFIG[col]
                const tasks = filteredTasks(col)
                return (
                  <div
                    key={col}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      background: cfg.colBg,
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                      overflow: 'hidden',
                      minHeight: 0,
                    }}
                  >
                    {/* Column header */}
                    <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                      <div style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>{cfg.icon}</div>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: cfg.color, flex: 1 }}>{cfg.label}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: '99px' }}>{tasks.length}</span>
                    </div>

                    {/* Scrollable card area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 12px' }}>
                      {tasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 12px', color: '#CBD5E1', fontSize: '0.8125rem' }}>
                          No tasks
                        </div>
                      ) : (
                        tasks.map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            members={members}
                            departments={departments}
                            shiftOptions={shiftOptions}
                            onClick={() => openTask(task)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════ TASK DETAIL PANEL ═══════════════ */}
      {selectedTask && (
        <div onClick={closePanel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 50 }}>
          <div
            ref={panelRef}
            onClick={e => e.stopPropagation()}
            data-testid="task-detail-panel"
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '480px', background: '#FFFFFF', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
          >
            <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: STATUS_CONFIG[selectedTask.status].color }}>{STATUS_CONFIG[selectedTask.status].icon}</div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: STATUS_CONFIG[selectedTask.status].color, background: STATUS_CONFIG[selectedTask.status].bg, padding: '3px 9px', borderRadius: '99px' }}>
                  {selectedTask.status}
                </span>
              </div>
              <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: '4px', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: '0 0 -10px' }}>{selectedTask.title}</h2>
              <div>
                <label style={modalLabelStyle}>Title *</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={modalInputStyle} />
              </div>
              <div>
                <label style={modalLabelStyle}>Description</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabelStyle}>Status</label>
                  <div style={{ position: 'relative' }}>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value as Task['status'])} style={{ ...modalInputStyle, paddingRight: 32, appearance: 'none', cursor: 'pointer' }}>
                      {COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={modalLabelStyle}>Priority</label>
                  <div style={{ position: 'relative' }}>
                    <select value={editPriority} onChange={e => setEditPriority(e.target.value)} style={{ ...modalInputStyle, paddingRight: 32, appearance: 'none', cursor: 'pointer' }}>
                      <option value="">None</option>
                      {(['Low', 'Medium', 'High', 'Urgent'] as PriorityLevel[]).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
              <div>
                <label style={modalLabelStyle}>Assignee</label>
                <div style={{ position: 'relative' }}>
                  <select value={editAssignee} onChange={e => setEditAssignee(e.target.value)} style={{ ...modalInputStyle, paddingRight: 32, appearance: 'none', cursor: 'pointer' }}>
                    <option value="">Unassigned</option>
                    {assignableMembers.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </div>
              <div>
                <label style={modalLabelStyle}>Shift</label>
                <div style={{ position: 'relative' }}>
                  <select value={editShiftId} onChange={e => setEditShiftId(e.target.value)} style={{ ...modalInputStyle, paddingRight: 32, appearance: 'none', cursor: 'pointer' }}>
                    <option value="">No shift</option>
                    {editTaskShiftOptions.map(shift => <option key={shift.id} value={shift.id}>{formatShiftOptionLabel(shift)}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </div>
              <div>
                <label style={modalLabelStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={13} /> Due Date</div></label>
                <input type="date" value={editDueAt} onChange={e => setEditDueAt(e.target.value)} style={modalInputStyle} />
              </div>
              <div>
                <label style={modalLabelStyle}>Progress — {editPercent}%</label>
                <input type="range" min={0} max={100} step={5} value={editPercent} onChange={e => setEditPercent(Number(e.target.value))} style={{ width: '100%', accentColor: '#F97316', cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>0%</span>
                  <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>100%</span>
                </div>
              </div>
              <div>
                <label style={modalLabelStyle}>Sub-tasks</label>
                {selectedSubTasks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {selectedSubTasks.map(task => (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                        <span style={{ fontSize: '0.82rem', color: '#111827', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                        <span style={{ fontSize: '0.7rem', color: STATUS_CONFIG[task.status].color, fontWeight: 700, flexShrink: 0 }}>{task.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={subTaskTitle} onChange={e => setSubTaskTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateSubTask() }} placeholder="Add a sub-task" style={modalInputStyle} />
                  <button onClick={handleCreateSubTask} disabled={subTaskLoading || !subTaskTitle.trim()} style={{ padding: '0 12px', border: 'none', borderRadius: 8, background: '#F97316', color: '#FFFFFF', fontWeight: 700, fontSize: '0.82rem', cursor: subTaskLoading || !subTaskTitle.trim() ? 'default' : 'pointer', opacity: subTaskLoading || !subTaskTitle.trim() ? 0.6 : 1 }}>
                    Add
                  </button>
                </div>
              </div>
              <InlineError message={panelError} />
            </div>

            <div style={{ padding: '18px 28px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              {!deleteConfirm ? (
                <>
                  <button onClick={() => setDeleteConfirm(true)} style={{ padding: '8px 14px', background: 'none', border: '1.5px solid #FECACA', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', color: '#DC2626', cursor: 'pointer' }}>
                    Delete
                  </button>
                  <button
                    onClick={handleDuplicateTask}
                    disabled={duplicateLoading}
                    style={{ padding: '8px 14px', background: '#FFFFFF', border: '1.5px solid #D1D5DB', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', color: '#374151', cursor: duplicateLoading ? 'default' : 'pointer', opacity: duplicateLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {duplicateLoading ? <Spinner size={13} dark /> : <Copy size={13} />}
                    Duplicate
                  </button>
                  <div style={{ flex: 1, display: 'flex', gap: 10 }}>
                    <button style={ghostBtn} onClick={closePanel}>Cancel</button>
                    <button style={primaryBtn(editLoading)} onClick={handleSaveTask} disabled={editLoading}>
                      {editLoading && <Spinner size={14} />} Save Changes
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '0.875rem', color: '#374151', flex: 1 }}>Delete this task?</span>
                  <button style={ghostBtn} onClick={() => setDeleteConfirm(false)}>No</button>
                  <button style={dangerBtn(deleteLoading)} onClick={handleDeleteTask} disabled={deleteLoading}>
                    {deleteLoading && <Spinner size={14} />} Yes, Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ NEW TASK MODAL ═══════════════ */}
      {newTaskModal && (
        <div onClick={() => setNewTaskModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '540px', background: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>New Task</h2>
              <button onClick={() => setNewTaskModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: '4px', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={modalLabelStyle}>Title *</label>
                <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title..." style={modalInputStyle} onKeyDown={e => { if (e.key === 'Enter') handleCreateTask() }} />
              </div>
              <div>
                <label style={modalLabelStyle}>Description</label>
                <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2} placeholder="Optional description..." style={{ ...modalInputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabelStyle}>Department *</label>
                  <div style={{ position: 'relative' }}>
                    <select value={newDeptId} onChange={e => { setNewDeptId(e.target.value); setNewAssigneeId(''); setNewShiftId('') }} style={modalSelectStyle}>
                      <option value="">Select department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={modalLabelStyle}>Priority</label>
                  <div style={{ position: 'relative' }}>
                    <select value={newPriority} onChange={e => setNewPriority(e.target.value)} style={modalSelectStyle}>
                      <option value="">None</option>
                      {(['Low', 'Medium', 'High', 'Urgent'] as PriorityLevel[]).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabelStyle}>Assign To (Employee)</label>
                  <div style={{ position: 'relative' }}>
                    <select value={newAssigneeId} onChange={e => setNewAssigneeId(e.target.value)} style={modalSelectStyle}>
                      <option value="">Unassigned</option>
                      {newTaskDeptMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={modalLabelStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={13} /> Due Date</div></label>
                  <input type="date" value={newDueAt} onChange={e => setNewDueAt(e.target.value)} style={modalInputStyle} />
                </div>
              </div>
              <div>
                <label style={modalLabelStyle}>Shift</label>
                <div style={{ position: 'relative' }}>
                  <select value={newShiftId} onChange={e => setNewShiftId(e.target.value)} style={modalSelectStyle}>
                    <option value="">No shift</option>
                    {newTaskShiftOptions.map(shift => <option key={shift.id} value={shift.id}>{formatShiftOptionLabel(shift)}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            <InlineError message={newError} />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={ghostBtn} onClick={() => setNewTaskModal(false)}>Cancel</button>
              <button style={primaryBtn(newLoading)} onClick={handleCreateTask} disabled={newLoading}>
                {newLoading && <Spinner size={14} />} Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ EDIT DEPT NAME MODAL ═══════════════ */}
      {editDeptModal && (
        <div onClick={() => setEditDeptModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '480px', background: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>Edit Department Name</h2>
              <button onClick={() => setEditDeptModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4 }}><X size={18} /></button>
            </div>
            <label style={modalLabelStyle}>Department Name</label>
            <input autoFocus value={editDeptName} onChange={e => setEditDeptName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleEditDept() }} style={modalInputStyle} />
            <InlineError message={editDeptError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={ghostBtn} onClick={() => setEditDeptModal(null)}>Cancel</button>
              <button style={primaryBtn(editDeptLoading)} onClick={handleEditDept} disabled={editDeptLoading}>
                {editDeptLoading && <Spinner size={14} />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DELETE DEPT MODAL ═══════════════ */}
      {deleteDeptModal && (
        <div onClick={() => setDeleteDeptModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '480px', background: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>Delete Department</h2>
              <button onClick={() => setDeleteDeptModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4 }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.9375rem', color: '#374151', margin: 0, lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>{deleteDeptModal.name}</strong>? This cannot be undone.
            </p>
            <InlineError message={deleteDeptError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button style={ghostBtn} onClick={() => setDeleteDeptModal(null)}>Cancel</button>
              <button style={dangerBtn(deleteDeptLoading)} onClick={handleDeleteDept} disabled={deleteDeptLoading}>
                {deleteDeptLoading && <Spinner size={14} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ EDIT DEPT MANAGER MODAL ═══════════════ */}
      {editManagerModal && (
        <div onClick={() => { setEditManagerModal(null); setEditManagerSelectedId('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '480px', background: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>Change Manager</h2>
              <button onClick={() => { setEditManagerModal(null); setEditManagerSelectedId('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4 }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
              Assign a manager to <strong>{editManagerModal.name}</strong>.
            </p>
            {allManagers.length === 0
              ? <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', margin: '8px 0 16px' }}>No managers in this company yet.</p>
              : (
                <>
                  <label style={modalLabelStyle}>Manager</label>
                  <div style={{ position: 'relative' }}>
                    <select value={editManagerSelectedId} onChange={e => setEditManagerSelectedId(e.target.value)} style={{ ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer' }}>
                      <option value="">Select a manager</option>
                      {allManagers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                    <ChevronDown size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </>
              )
            }
            <InlineError message={editManagerError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={ghostBtn} onClick={() => { setEditManagerModal(null); setEditManagerSelectedId('') }}>Cancel</button>
              <button style={primaryBtn(editManagerLoading)} onClick={handleEditDeptManager} disabled={editManagerLoading || !editManagerSelectedId}>
                {editManagerLoading && <Spinner size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

