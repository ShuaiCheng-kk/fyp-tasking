'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, ChevronDown, Calendar, AlertCircle,
  CheckCircle, Clock, Eye, Layers, Users, MoreHorizontal,
  Copy, UserCog, Pencil, Trash2,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import { Task, TaskInput, KanbanGroup } from '@/types/Task'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'

// ─── Local page types ─────────────────────────────────────────────────────────

type Department = { id: string; name: string }
type Member = { id: string; full_name: string; role: string; department_id: string | null }
type ManagerInfo = { id: string; full_name: string; department_id: string | null }
type ShiftOption = TimelineShiftBlock & {
  assignee_name: string
  user_id: string | null
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
function deptCardBg(deptId: string): string {
  const hex = deptColor(deptId)
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.06)`
}
function deptCardBorder(deptId: string): string {
  const hex = deptColor(deptId)
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.22)`
}

const PRIORITY_ORDER: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 }

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

// ─── Custom Dropdown Field ────────────────────────────────────────────────────

function DropdownField({ value, options, onChange, placeholder, disabled = false }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const selected = options.find(o => o.value === value)
  const canOpen = !disabled && options.length > 0

  const handleOpen = () => {
    if (!canOpen) return
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const DROPDOWN_H = Math.min(options.length * 37 + 8, 208)
      const fitsBelow = r.bottom + DROPDOWN_H + 4 <= window.innerHeight
      setPos({ top: fitsBelow ? r.bottom + 4 : r.top - DROPDOWN_H - 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" disabled={disabled}
        onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: disabled ? '#F9FAFB' : '#FAFAFA', cursor: canOpen ? 'pointer' : 'default',
          fontSize: '0.9375rem', color: selected ? '#111827' : '#9CA3AF',
          fontWeight: selected ? 500 : 400, outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronDown size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div ref={dropdownRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 9999, maxHeight: 208, overflowY: 'auto',
          padding: '4px 0',
        }}>
          {options.map(opt => {
            const isSel = opt.value === value
            return (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left',
                  border: 'none', background: isSel ? '#FFF7ED' : 'transparent',
                  color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400,
                  fontSize: 13, cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >{opt.label}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Deadline Time Picker ─────────────────────────────────────────────────────

function DeadlineTimePicker({ value, onChange, shiftStart, shiftEnd }: {
  value: string
  onChange: (v: string) => void
  shiftStart: string
  shiftEnd: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  useEffect(() => {
    if (open && listRef.current) {
      const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
      if (sel) sel.scrollIntoView({ block: 'center' })
    }
  }, [open])

  const times = useMemo(() => {
    const [sh, sm] = shiftStart.split(':').map(Number)
    const [eh, em] = shiftEnd.split(':').map(Number)
    const startMins = sh * 60 + (sm || 0)
    const endMins = eh * 60 + (em || 0)
    const res: { value: string; label: string }[] = []
    for (let mins = startMins; mins <= endMins; mins += 30) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
      const ampm = h < 12 ? 'AM' : 'PM'
      res.push({ value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${dh}:${String(m).padStart(2, '0')} ${ampm}` })
    }
    return res
  }, [shiftStart, shiftEnd])

  const hNum = value ? parseInt(value.split(':')[0]) : -1
  const mNum = value ? parseInt(value.split(':')[1]) : 0
  const displayLabel = value
    ? `${hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum}:${String(mNum).padStart(2, '0')} ${hNum < 12 ? 'AM' : 'PM'}`
    : 'Select time'

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const DROPDOWN_H = 200
      const fitsBelow = r.bottom + DROPDOWN_H + 4 <= window.innerHeight
      setPos({ top: fitsBelow ? r.bottom + 4 : r.top - DROPDOWN_H - 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: '#FAFAFA', cursor: 'pointer', fontSize: '0.9375rem',
          color: value ? '#111827' : '#9CA3AF', fontWeight: value ? 500 : 400,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
        }}>
        <span>{displayLabel}</span>
        <ChevronDown size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div ref={dropdownRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 9999, overflow: 'hidden',
        }}>
          <div ref={listRef} style={{ maxHeight: 196, overflowY: 'auto', padding: '4px 0' }}>
            {times.map(t => {
              const isSel = t.value === value
              return (
                <button key={t.value} type="button" data-selected={isSel ? 'true' : 'false'}
                  onClick={() => { onChange(t.value); setOpen(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left',
                    border: 'none', background: isSel ? '#FFF7ED' : 'transparent',
                    color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400,
                    fontSize: 13, cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                >{t.label}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, members, shiftOptions, onClick, onEdit, onDelete, onDuplicate,
}: {
  task: Task
  members: Member[]
  shiftOptions: ShiftOption[]
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const assignee = members.find(m => m.id === task.assigned_user_id)
  const shift = task.shift_id ? shiftOptions.find(s => s.id === task.shift_id) : null
  const priority = task.priority ? PRIORITY_COLORS[task.priority] : null
  const overdue = task.due_at && task.status !== 'Complete' && isDueOverdue(task.due_at)
  const accentColor = task.department_id ? deptColor(task.department_id) : '#E5E7EB'

  const MENU_ITEMS = [
    { label: 'Edit',      icon: <Pencil size={13} />,  action: onEdit,      color: '#111827' },
    { label: 'Duplicate', icon: <Copy size={13} />,    action: onDuplicate, color: '#374151' },
    { label: 'Delete',    icon: <Trash2 size={13} />,  action: onDelete,    color: '#DC2626' },
  ]

  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: '10px',
        padding: '12px 14px',
        cursor: 'pointer',
        position: 'relative',
        zIndex: menuOpen ? 100 : undefined,
        transition: 'box-shadow 0.12s',
        marginBottom: 8,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.09)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Top row: priority badge + ... menu */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 7 }}>
        <div>
          {priority && task.priority && (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: priority.bg, color: priority.text }}>
              {task.priority}
            </span>
          )}
        </div>
        {/* ... menu */}
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={menuBtnRef}
            onClick={e => {
              e.stopPropagation()
              if (!menuOpen && menuBtnRef.current) {
                const r = menuBtnRef.current.getBoundingClientRect()
                setMenuPos({ top: r.bottom + 4, left: r.right - 148 })
              }
              setMenuOpen(o => !o)
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 5, color: '#9CA3AF', display: 'flex', alignItems: 'center', lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.07)'; e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF' }}
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.14)', zIndex: 9999, minWidth: 148, padding: '4px 0', overflow: 'hidden' }}>
              {MENU_ITEMS.map(item => (
                <button key={item.label} type="button"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); item.action() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'transparent', color: item.color, fontWeight: item.label === 'Delete' ? 600 : 500, fontSize: 13, cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = item.label === 'Delete' ? '#FEF2F2' : '#F9FAFB' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: '0 0 10px', lineHeight: 1.4 }}>
        {task.title}
      </p>

      {/* Shift chip */}
      {shift && (
        <div style={{ marginBottom: 10, fontSize: '0.72rem', color: '#6B7280', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 7, padding: '5px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
        </div>
      )}

      {/* Footer: assignee + due date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {assignee ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FFF3E8', border: '1.5px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserCog size={12} color="#F97316" strokeWidth={2} />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {assignee.full_name}
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
    <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)', marginBottom: 16 }}>
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

export default function OwnerTasksPage() {
  const router = useRouter()

  const [internalUserId, setInternalUserId] = useState('')
  const [companyId,      setCompanyId]      = useState('')
  const [ownerName,      setOwnerName]      = useState('')
  const [userRole,       setUserRole]       = useState('')
  const [companyName,    setCompanyName]    = useState('')
  const [currentPlan,    setCurrentPlan]    = useState('Free')
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
  const [taskViewMode,    setTaskViewMode]    = useState(false)

  // New task modal
  const [newTaskModal,    setNewTaskModal]    = useState(false)
  const [newTitle,        setNewTitle]        = useState('')
  const [newDescription,  setNewDescription]  = useState('')
  const [newDeptId,       setNewDeptId]       = useState('')
  const [newAssigneeId,   setNewAssigneeId]   = useState('')
  const [newShiftId,        setNewShiftId]        = useState('')
  const [newPriority,       setNewPriority]       = useState('')
  const [newDeadlineTime,   setNewDeadlineTime]   = useState('')
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
          setCurrentPlan(data.company.plan ?? 'Free')
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
    if (!companyId) return
    Promise.all([
      fetch(`/api/company/departments?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/team/members?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/company/managers?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/task?company_id=${companyId}&dept_stats=true`).then(r => r.json()),
    ]).then(([deptData, memberData, mgrData, statsData]) => {
      if (deptData.success) setDepartments(deptData.departments)
      if (memberData.success) setMembers(memberData.members)
      if (mgrData.success) {
        setAllManagers(mgrData.managers)
        const map: Record<string, string> = {}
        for (const mgr of mgrData.managers as ManagerInfo[]) {
          if (mgr.department_id && !map[mgr.department_id]) map[mgr.department_id] = mgr.full_name
        }
        setDeptManagerMap(map)
      }
      if (statsData.success) setDeptTaskStats(statsData.dept_stats ?? [])
    }).catch(() => {})
  }, [companyId])

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
            user_id: row.user_id,
          })),
        )
        setShiftOptions(options)
      })
      .catch(() => setShiftOptions([]))
  }, [companyId])

  // ── Auto-select nearest shift when assignee changes ──────────────────────

  useEffect(() => {
    if (!newAssigneeId || !newTaskModal) { return }
    const todayStr = formatDateKey(new Date())
    const assigneeShifts = shiftOptions
      .filter(s => s.user_id === newAssigneeId && s.shift_date >= todayStr)
      .sort((a, b) => a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time))
    const todayShifts = assigneeShifts.filter(s => s.shift_date === todayStr)
    const firstShift = todayShifts[0] ?? assigneeShifts[0] ?? null
    if (firstShift) {
      setNewShiftId(firstShift.id)
      setNewDeadlineTime(firstShift.end_time.slice(0, 5))
    } else {
      setNewShiftId('')
      setNewDeadlineTime('')
    }
  }, [newAssigneeId, newTaskModal, shiftOptions])

  const fetchKanban = useCallback(async (cid: string, silent = false) => {
    if (!cid) return
    if (!silent) setKanbanLoading(true)
    try {
      const res = await fetch(`/api/task?company_id=${cid}&kanban=true`)
      const data = await res.json()
      if (data.success) setKanban(data.groups)
    } catch {}
    finally { if (!silent) setKanbanLoading(false) }
  }, [])

  useEffect(() => {
    if (!companyId) return
    void Promise.resolve().then(() => fetchKanban(companyId))
  }, [companyId, fetchKanban])

  // ── Open task panel ────────────────────────────────────────────────────────

  const openTask = (task: Task, viewOnly = false) => {
    setTaskViewMode(viewOnly)
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
    setDeleteLoading(true)
    const taskId = selectedTask.id
    // Optimistic: remove task from kanban immediately
    setKanban(prev => {
      if (!prev) return prev
      const next = { ...prev } as KanbanGroup
      for (const col of COLUMNS) next[col] = (prev[col] ?? []).filter(t => t.id !== taskId)
      return next
    })
    closePanel()
    try {
      const res = await fetch(`/api/task?id=${taskId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) fetchKanban(companyId, true)
    } catch { fetchKanban(companyId, true) }
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
      fetchKanban(companyId, true)
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to duplicate task') }
    finally { setDuplicateLoading(false) }
  }

  const handleQuickDuplicate = async (task: Task) => {
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id: task.id, assigned_by: internalUserId || undefined }),
      })
      const data = await res.json()
      if (data.success) fetchKanban(companyId, true)
    } catch {}
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
        due_at: (() => { const sel = newTaskShiftOptions.find(s => s.id === newShiftId); return sel && newDeadlineTime ? new Date(`${sel.shift_date}T${newDeadlineTime}:00`).toISOString() : null })(),
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
      setNewTitle(''); setNewDescription(''); setNewDeptId(''); setNewAssigneeId(''); setNewShiftId(''); setNewPriority(''); setNewDeadlineTime('')
      fetchKanban(companyId)
    } catch (err) { setNewError(err instanceof Error ? err.message : 'Failed to create task') }
    finally { setNewLoading(false) }
  }

  // Open new task modal pre-filled with dept + assignee
  const openNewTaskFor = (memberId: string, deptId: string) => {
    setNewDeptId(deptId)
    setNewAssigneeId(memberId)
    setNewShiftId('')
    setNewTitle(''); setNewDescription(''); setNewPriority(''); setNewDeadlineTime(''); setNewError('')
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
    return (kanban[col] ?? [])
      .filter(t => !selectedDeptId || t.department_id === selectedDeptId)
      .sort((a, b) => (PRIORITY_ORDER[a.priority ?? ''] ?? 4) - (PRIORITY_ORDER[b.priority ?? ''] ?? 4))
  }

  const assignableMembers = members.filter(m => m.role === 'Manager')
  const newTaskDeptMembers = newDeptId ? assignableMembers.filter(m => m.department_id === newDeptId) : assignableMembers
  const _todayStr = formatDateKey(new Date())
  const newTaskShiftOptions = (newAssigneeId
    ? shiftOptions.filter(s => s.user_id === newAssigneeId)
    : newDeptId
      ? shiftOptions.filter(s => s.department_id === newDeptId)
      : shiftOptions
  ).filter(s => s.shift_date >= _todayStr)
  const selectedShiftForDeadline = newTaskShiftOptions.find(s => s.id === newShiftId) ?? null
  const deptDropdownOptions = departments.map(d => ({ value: d.id, label: d.name }))
  const assigneeDropdownOptions = newTaskDeptMembers.map(m => ({ value: m.id, label: m.full_name }))
  const shiftDropdownOptions = newTaskShiftOptions.map(s => ({
    value: s.id,
    label: `${new Date(`${s.shift_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`,
  }))
  const priorityDropdownOptions: { value: string; label: string }[] = [
    { value: '', label: 'None' },
    ...(['Low', 'Medium', 'High', 'Urgent'] as PriorityLevel[]).map(p => ({ value: p, label: p })),
  ]
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
    <div style={{ display: 'flex', height: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <OwnerSidebar />

      {/* Dropdown animation */}
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Page header — matches Dashboard style */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              {companyName ? `Tasks for ${companyName}` : 'Tasks'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {ownerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ width: 26, height: 26, borderRadius: 999, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{ownerName.charAt(0).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ownerName}</span>
              </div>
            )}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* Content — single card like Shifts/Communication */}
        <div style={{ padding: '0 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

            {/* ── CARD TOP BAR: dept filter + title + New Task ───────────── */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
              {/* Dept pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6B7280', flexShrink: 0 }}>
                  <Users size={13} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Dept:</span>
                </div>
                <button
                  onClick={() => setSelectedDeptId('')}
                  style={{ padding: '5px 13px', borderRadius: '99px', border: selectedDeptId === '' ? '2px solid #111827' : '1.5px solid #E5E7EB', background: selectedDeptId === '' ? '#111827' : 'transparent', color: selectedDeptId === '' ? '#FFFFFF' : '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0 }}
                >
                  All
                </button>
                {departments.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDeptId(selectedDeptId === d.id ? '' : d.id)}
                    style={{ padding: '5px 13px', borderRadius: '99px', border: selectedDeptId === d.id ? `2px solid ${deptColor(d.id)}` : '1.5px solid #E5E7EB', background: selectedDeptId === d.id ? deptColor(d.id) : 'transparent', color: selectedDeptId === d.id ? '#FFFFFF' : '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedDeptId === d.id ? 'rgba(255,255,255,0.7)' : deptColor(d.id), flexShrink: 0 }} />
                    {d.name}
                  </button>
                ))}
              </div>
              {/* New Task button */}
              <button
                onClick={() => { setNewTaskModal(true); setNewError(''); if (selectedDeptId) setNewDeptId(selectedDeptId) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#F97316', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#fff', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#EA6C0A')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F97316')}
              >
                <Plus size={13} strokeWidth={2.5} /> New Task
              </button>
            </div>

            {/* ── DEPARTMENT INFO CARDS (when a dept is selected) ──────────── */}
            {selectedDeptId && (
              <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
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

            {/* ── KANBAN BOARD ─────────────────────────────────────────────── */}
            {!initialReady || kanbanLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <Spinner size={24} dark />
              </div>
            ) : (
              <div style={{ padding: '16px 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flex: 1, minHeight: 0 }}>
                {COLUMNS.map(col => {
                  const cfg = STATUS_CONFIG[col]
                  const tasks = filteredTasks(col)
                  return (
                    <div
                      key={col}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        background: '#F7F8FA',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        minHeight: 0,
                        border: '1px solid #F0F1F3',
                      }}
                    >
                      {/* Column header */}
                      <div style={{ padding: '11px 14px 10px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, borderBottom: '1px solid #ECEEF1' }}>
                        <div style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>{cfg.icon}</div>
                        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: cfg.color, flex: 1 }}>{cfg.label}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: '99px' }}>{tasks.length}</span>
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
                              shiftOptions={shiftOptions}
                              onClick={() => openTask(task, false)}
                              onEdit={() => openTask(task, false)}
                              onDelete={() => { openTask(task, false); setDeleteConfirm(true) }}
                              onDuplicate={() => handleQuickDuplicate(task)}
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
        </div>
      </main>

      {/* ═══════════════ TASK DETAIL PANEL ═══════════════ */}
      {selectedTask && (
        <div onClick={closePanel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div
            ref={panelRef}
            onClick={e => e.stopPropagation()}
            data-testid="task-detail-panel"
            style={{ width: 520, maxHeight: '90vh', background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16)', display: 'flex', flexDirection: 'column' }}
          >
            {/* Modal header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: STATUS_CONFIG[selectedTask.status].color }}>{STATUS_CONFIG[selectedTask.status].icon}</div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: STATUS_CONFIG[selectedTask.status].color, background: STATUS_CONFIG[selectedTask.status].bg, padding: '3px 9px', borderRadius: '99px' }}>
                  {selectedTask.status}
                </span>
                {taskViewMode && (
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontStyle: 'italic' }}>View only</span>
                )}
              </div>
              <button onClick={closePanel} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* ─── VIEW mode body ─── */}
            {taskViewMode ? (
              <>
                <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
                  <h2 style={{ fontWeight: 700, fontSize: '1.1rem', color: '#111827', margin: 0, lineHeight: 1.35 }}>{selectedTask.title}</h2>
                  {selectedTask.description && (
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#4B5563', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedTask.description}</p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Priority', value: selectedTask.priority || '—' },
                      { label: 'Assignee', value: (() => { const m = assignableMembers.find(x => x.id === selectedTask.assigned_user_id); return m ? m.full_name : '—' })() },
                      { label: 'Shift', value: (() => { const s = editTaskShiftOptions.find(x => x.id === selectedTask.shift_id); return s ? `${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}` : '—' })() },
                      { label: 'Due Date', value: selectedTask.due_at ? new Date(selectedTask.due_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
                    ].map(row => (
                      <div key={row.label} style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px', border: '1px solid #F0F1F3' }}>
                        <div style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{row.label}</div>
                        <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>{row.value}</div>
                      </div>
                    ))}
                  </div>
                  {selectedTask.percentage_complete > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>Progress</span>
                        <span style={{ fontSize: '0.75rem', color: '#F97316', fontWeight: 700 }}>{selectedTask.percentage_complete}%</span>
                      </div>
                      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${selectedTask.percentage_complete}%`, background: 'linear-gradient(90deg, #F97316, #EA580C)', borderRadius: 99 }} />
                      </div>
                    </div>
                  )}
                  {selectedSubTasks.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Sub-tasks ({selectedSubTasks.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {selectedSubTasks.map(t => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                            <span style={{ fontSize: '0.82rem', color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                            <span style={{ fontSize: '0.7rem', color: STATUS_CONFIG[t.status].color, fontWeight: 700, flexShrink: 0 }}>{t.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
                  <button style={ghostBtn} onClick={closePanel}>Close</button>
                  <button
                    style={{ padding: '9px 20px', background: '#111827', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
                    onClick={() => setTaskViewMode(false)}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1F2937' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#111827' }}
                  >
                    <Pencil size={13} /> Edit Task
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ─── EDIT mode body ─── */}
                <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
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

                <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ NEW TASK MODAL ═══════════════ */}
      {newTaskModal && (
        <div onClick={() => setNewTaskModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 540, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={15} color="#fff" strokeWidth={2.5} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>New Task</h2>
              </div>
              <button onClick={() => setNewTaskModal(false)} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Title */}
              <div>
                <label style={modalLabelStyle}>Title <span style={{ color: '#F97316' }}>*</span></label>
                <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title..." style={{ ...modalInputStyle, background: '#FAFAFA' }} onKeyDown={e => { if (e.key === 'Enter') handleCreateTask() }} />
              </div>

              {/* Description */}
              <div>
                <label style={modalLabelStyle}>Description <span style={{ color: '#D1D5DB', fontWeight: 400 }}>(optional)</span></label>
                <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2} placeholder="Add more context..." style={{ ...modalInputStyle, resize: 'vertical', background: '#FAFAFA', lineHeight: 1.55 }} />
              </div>

              {/* Department + Assign To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabelStyle}>Department <span style={{ color: '#F97316' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={newDeptId}
                      onChange={e => { setNewDeptId(e.target.value); setNewAssigneeId(''); setNewShiftId(''); setNewDeadlineTime('') }}
                      style={{ ...modalInputStyle, paddingRight: 32, appearance: 'none', cursor: 'pointer' }}
                    >
                      <option value="">Select department</option>
                      {deptDropdownOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={modalLabelStyle}>Assign To</label>
                  <DropdownField
                    value={newAssigneeId}
                    options={assigneeDropdownOptions}
                    onChange={v => setNewAssigneeId(v)}
                    placeholder="Unassigned"
                    disabled={!newDeptId}
                  />
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px dashed #E5E7EB' }} />

              {/* Shift + Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabelStyle}>
                    Shift
                    {newAssigneeId && newTaskShiftOptions.length === 0 && (
                      <span style={{ fontWeight: 400, color: '#F97316', marginLeft: 8, fontSize: '0.78rem' }}>no upcoming shifts</span>
                    )}
                  </label>
                  <DropdownField
                    value={newShiftId}
                    options={shiftDropdownOptions}
                    onChange={v => {
                      setNewShiftId(v)
                      const s = newTaskShiftOptions.find(x => x.id === v)
                      if (s) setNewDeadlineTime(s.end_time.slice(0, 5))
                    }}
                    placeholder={newAssigneeId ? 'Select shift' : 'Select assignee first'}
                    disabled={!newAssigneeId}
                  />
                </div>
                <div>
                  <label style={modalLabelStyle}>Priority</label>
                  <DropdownField
                    value={newPriority}
                    options={priorityDropdownOptions}
                    onChange={v => setNewPriority(v)}
                    placeholder="None"
                  />
                </div>
              </div>

              {/* Deadline — time only, constrained to shift hours */}
              <div>
                <label style={modalLabelStyle}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={12} color="#F97316" />
                    Deadline
                    {selectedShiftForDeadline && (
                      <span style={{ color: '#9CA3AF', fontWeight: 400, fontSize: '0.78rem' }}>
                        — {new Date(`${selectedShiftForDeadline.shift_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </span>
                </label>
                {selectedShiftForDeadline ? (
                  <DeadlineTimePicker
                    value={newDeadlineTime}
                    onChange={setNewDeadlineTime}
                    shiftStart={selectedShiftForDeadline.start_time.slice(0, 5)}
                    shiftEnd={selectedShiftForDeadline.end_time.slice(0, 5)}
                  />
                ) : (
                  <div style={{ padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', fontSize: '0.9375rem', color: '#9CA3AF' }}>
                    Select a shift first
                  </div>
                )}
              </div>

            </div>

            <InlineError message={newError} />

            {/* Footer */}
            <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10 }}>
              <button style={ghostBtn} onClick={() => setNewTaskModal(false)}>Cancel</button>
              <button
                style={{ ...primaryBtn(newLoading), background: newLoading ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none' }}
                onClick={handleCreateTask}
                disabled={newLoading}
              >
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
