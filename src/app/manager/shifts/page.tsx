'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Briefcase, CalendarDays, ChevronLeft, ChevronRight, ChevronDown,
  Clock, Plus, Trash2, Pencil, X, Users, Check, UserCog,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import ManagerSidebar from '@/components/ManagerSidebar'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'

// ─── Theme ────────────────────────────────────────────────────────────────────
const BLUE  = '#2563EB'
const APP_BG = '#F1F5F9'
const PANEL  = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT   = '#0F172A'
const MUTED  = '#64748B'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function weekStart(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - day)
  return r
}

function prettyDay(dateKey: string): { weekday: string; num: number } {
  const d = new Date(`${dateKey}T00:00:00`)
  return { weekday: d.toLocaleDateString('en-AU', { weekday: 'short' }), num: d.getDate() }
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

const TIME_OPTS = (() => {
  const opts: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, '0'); const mm = String(m).padStart(2, '0')
      const ampm = h < 12 ? 'AM' : 'PM'; const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
      opts.push({ value: `${hh}:${mm}`, label: `${dh}:${mm} ${ampm}` })
    }
  }
  return opts
})()

type Department = { id: string; name: string }
type TeamMember = { id: string; full_name: string; role: string; department_id: string | null }

// ─── TimePicker ───────────────────────────────────────────────────────────────

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const trigRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const hNum = parseInt(value.split(':')[0] ?? '0')
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>(hNum < 12 ? 'AM' : 'PM')
  useEffect(() => { setMeridiem(parseInt(value.split(':')[0]) < 12 ? 'AM' : 'PM') }, [value])
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (trigRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  useEffect(() => {
    if (open && listRef.current) {
      const sel = listRef.current.querySelector('[data-sel="true"]') as HTMLElement | null
      sel?.scrollIntoView({ block: 'center' })
    }
  }, [open, meridiem])
  const mNum = parseInt(value.split(':')[1] ?? '0')
  const derivedAP = hNum < 12 ? 'AM' : 'PM'
  const dh = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum
  const times = TIME_OPTS.filter(t => {
    const h = parseInt(t.value.split(':')[0])
    return meridiem === 'AM' ? h < 12 : h >= 12
  })
  const dropdown = open ? (
    <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 8px 28px rgba(15,23,42,0.14)', display: 'flex', overflow: 'hidden', minWidth: Math.max(pos.width, 148) }}>
      <div ref={listRef} style={{ flex: 1, maxHeight: 192, overflowY: 'auto', padding: '4px 0' }}>
        {times.map(t => {
          const isSel = t.value === value
          return (
            <button key={t.value} type="button" data-sel={isSel ? 'true' : 'false'}
              onClick={() => { onChange(t.value); setOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '7px 16px', textAlign: 'left', border: 'none', background: isSel ? '#EFF6FF' : 'transparent', color: isSel ? BLUE : TEXT, fontWeight: isSel ? 700 : 400, fontSize: 13, cursor: 'pointer' }}
            >{t.label}</button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '8px', borderLeft: `1px solid ${BORDER}` }}>
        {(['AM', 'PM'] as const).map(mp => (
          <button key={mp} type="button"
            onClick={() => {
              const [ch, cm] = value.split(':').map(Number)
              let nh = ch
              if (mp === 'AM' && ch >= 12) nh = ch - 12
              if (mp === 'PM' && ch < 12) nh = ch + 12
              onChange(`${String(nh).padStart(2, '0')}:${String(cm).padStart(2, '0')}`)
              setMeridiem(mp)
            }}
            style={{ borderRadius: 7, border: 'none', background: meridiem === mp ? BLUE : '#F1F5F9', color: meridiem === mp ? '#FFFFFF' : TEXT, fontWeight: 700, fontSize: 12, padding: '7px 10px', cursor: 'pointer', lineHeight: 1 }}
          >{mp}</button>
        ))}
      </div>
    </div>
  ) : null
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button ref={trigRef} type="button"
        onClick={() => {
          if (trigRef.current) {
            const r = trigRef.current.getBoundingClientRect()
            const fitsBelow = r.bottom + 212 + 8 <= window.innerHeight
            setPos({ top: fitsBelow ? r.bottom + 4 : r.top - 212 - 4, left: r.left, width: r.width })
          }
          setOpen(o => !o)
        }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, border: `1px solid ${BORDER}`, borderRadius: 8, background: PANEL, cursor: 'pointer', padding: '8px 12px', fontSize: 13, fontWeight: 500, color: TEXT, minHeight: 38 }}
      >
        <span style={{ userSelect: 'none' }}>{`${dh}:${String(mNum).padStart(2, '0')} ${derivedAP}`}</span>
        <ChevronDown size={12} color={MUTED} style={{ flexShrink: 0 }} />
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}

// ─── Shift block ──────────────────────────────────────────────────────────────

function ShiftBlock({ shift, onClick }: { shift: TimelineShiftBlock; onClick: () => void }) {
  const isDraft = shift.publication_status === 'draft'
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 9px',
        background: isDraft ? '#F1F5F9' : '#EFF6FF',
        border: `1.5px solid ${isDraft ? '#CBD5E1' : '#BFDBFE'}`,
        borderLeft: `3px solid ${isDraft ? '#94A3B8' : BLUE}`,
        borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'box-shadow 0.15s ease, transform 0.12s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: isDraft ? '#64748B' : BLUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {shift.title || 'Shift'}
      </span>
      <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>
        {fmtTime(shift.start_time)}–{fmtTime(shift.end_time)}
      </span>
      {isDraft && (
        <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Draft</span>
      )}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerShiftsPage() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  const [managerId, setManagerId] = useState('')
  const [managerName, setManagerName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  const todayStr = isoDate(new Date())
  const [weekAnchor, setWeekAnchor] = useState(() => isoDate(weekStart(new Date())))
  const [rows, setRows] = useState<TimelineRow[]>([])
  const [loading, setLoading] = useState(false)

  // Assign drawer
  const [assignOpen, setAssignOpen] = useState(false)
  const [editShift, setEditShift] = useState<TimelineShiftBlock | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [fDate, setFDate] = useState(todayStr)
  const [fStart, setFStart] = useState('09:00')
  const [fEnd, setFEnd]   = useState('17:00')
  const [fTitle, setFTitle] = useState('')
  const [fInstr, setFInstr] = useState('')
  const [fUserId, setFUserId] = useState('')
  const [fDeptId, setFDeptId] = useState('')
  const [fStatus, setFStatus] = useState<'draft' | 'published'>('published')

  // Week dates
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekAnchor}T00:00:00`)
    d.setDate(d.getDate() + i)
    return isoDate(d)
  })
  const dateFrom = weekDates[0]
  const dateTo   = weekDates[6]

  // ── Auth init ──
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let uid = localStorage.getItem('tasking_user_id')
      if (!uid) {
        const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await sb.auth.getSession()
        if (session?.user?.id) { uid = session.user.id; localStorage.setItem('tasking_user_id', uid) }
      }
      if (!uid) { router.replace('/signin'); return }
      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (cancelled || !meData.success) return
      const { id, full_name, company_id } = meData.user
      if (full_name) setManagerName(full_name)
      if (id) setManagerId(id)
      const cid = localStorage.getItem(`tasking_company_id_${uid}`) || company_id || ''
      if (!cid) return
      setCompanyId(cid)
      const [compRes, deptRes] = await Promise.all([
        fetch(`/api/company/current?user_id=${uid}&company_id=${cid}`),
        fetch(`/api/manager/departments?manager_id=${id}&company_id=${cid}`),
      ])
      const compData = await compRes.json()
      const deptData = await deptRes.json()
      if (cancelled) return
      if (compData.success) setCompanyName(compData.company?.name ?? '')
      const depts: Department[] = deptData.success
        ? (deptData.departments ?? []).map((d: { department_id: string; department_name: string }) => ({ id: d.department_id, name: d.department_name }))
        : []
      setDepartments(depts)
      if (depts.length > 0 && !selectedDeptId) setSelectedDeptId(depts[0].id)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  // ── Fetch team members for assign dropdown ──
  useEffect(() => {
    if (!companyId || !selectedDeptId) return
    fetch(`/api/team/members?company_id=${companyId}&department_id=${selectedDeptId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setTeamMembers(d.members ?? []) })
      .catch(() => {})
  }, [companyId, selectedDeptId])

  // ── Fetch timeline ──
  const fetchTimeline = useCallback(async () => {
    if (!companyId || !dateFrom || !dateTo) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ company_id: companyId, date_from: dateFrom, date_to: dateTo })
      if (selectedDeptId) params.set('department_id', selectedDeptId)
      const res = await fetch(`/api/shift?${params}`)
      const data = await res.json()
      if (data.success) setRows(data.rows ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [companyId, dateFrom, dateTo, selectedDeptId])

  useEffect(() => { void fetchTimeline() }, [fetchTimeline])

  // ── Assign form init ──
  function openAssign() {
    setEditShift(null)
    setFDate(todayStr >= dateFrom ? (todayStr <= dateTo ? todayStr : dateFrom) : dateFrom)
    setFStart('09:00')
    setFEnd('17:00')
    setFTitle('')
    setFInstr('')
    setFUserId('')
    setFDeptId(selectedDeptId || departments[0]?.id || '')
    setFStatus('published')
    setFormError('')
    setAssignOpen(true)
  }

  function openEdit(shift: TimelineShiftBlock) {
    setEditShift(shift)
    setFDate(shift.shift_date)
    setFStart(shift.start_time.slice(0, 5))
    setFEnd(shift.end_time.slice(0, 5))
    setFTitle(shift.title ?? '')
    setFInstr(shift.instruction ?? '')
    setFUserId('')
    setFDeptId(shift.department_id)
    setFStatus(shift.publication_status)
    setFormError('')
    setAssignOpen(true)
  }

  async function handleSave() {
    if (!fDate || !fStart || !fEnd || !fDeptId || !companyId) {
      setFormError('Please fill in all required fields.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editShift) {
        // PATCH
        const res = await fetch(`/api/shift/${editShift.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shift_date: fDate, start_time: fStart, end_time: fEnd, title: fTitle || null, instruction: fInstr || null, publication_status: fStatus }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message ?? 'Failed to update shift')
      } else {
        // POST
        if (!fUserId) { setFormError('Please select a team member.'); setSaving(false); return }
        const res = await fetch('/api/shift', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId, department_id: fDeptId, title: fTitle || null,
            instruction: fInstr || null, shift_date: fDate, start_time: fStart, end_time: fEnd,
            created_by: managerId, publication_status: fStatus, assigned_user_id: fUserId,
          }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message ?? 'Failed to create shift')
      }
      setAssignOpen(false)
      await fetchTimeline()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/shift/${deleteId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message ?? 'Failed to delete')
      setDeleteId(null)
      await fetchTimeline()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally { setDeleting(false) }
  }

  const prevWeek = () => { const d = new Date(`${weekAnchor}T00:00:00`); d.setDate(d.getDate() - 7); setWeekAnchor(isoDate(d)) }
  const nextWeek = () => { const d = new Date(`${weekAnchor}T00:00:00`); d.setDate(d.getDate() + 7); setWeekAnchor(isoDate(d)) }
  const goToday  = () => setWeekAnchor(isoDate(weekStart(new Date())))

  const assignableMembers = teamMembers.filter(m => ['Employee', 'Casual Worker'].includes(m.role) && (!fDeptId || m.department_id === fDeptId || m.role === 'Casual Worker'))

  // Only show the manager's own row + rows belonging to their assigned dept(s)
  const assignedDeptIds = new Set(departments.map(d => d.id))
  const visibleRows = rows.filter(row =>
    row.user_id === managerId ||
    (selectedDeptId ? row.department_id === selectedDeptId : assignedDeptIds.has(row.department_id))
  )

  const weekLabel = (() => {
    const s = new Date(`${weekDates[0]}T00:00:00`)
    const e = new Date(`${weekDates[6]}T00:00:00`)
    return `${s.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
  })()

  const isCurrentWeek = weekDates.includes(todayStr)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: APP_BG, fontFamily: 'inherit' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .mgr-shift-row:hover td { background: #EFF6FF !important; }
      `}</style>
      <ManagerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', scrollbarGutter: 'stable' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TEXT, letterSpacing: '-0.4px' }}>
              {(() => { const n = departments.find(d => d.id === selectedDeptId)?.name; return n ? `Shift Planning · ${n}` : 'Shift Planning' })()}
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: MUTED, fontWeight: 500 }}>
              Schedule and manage shifts for your department
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {managerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#1E3A5F', color: '#FFFFFF', flexShrink: 0 }}>
                  <UserCog size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{managerName}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '0 28px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Controls bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Dept filter */}
            {departments.length > 1 && (
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedDeptId}
                  onChange={e => setSelectedDeptId(e.target.value)}
                  style={{ height: 36, padding: '0 28px 0 10px', border: `1px solid ${BORDER}`, borderRadius: 8, background: PANEL, color: TEXT, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none' }}
                >
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }} />
              </div>
            )}
            {departments.length === 1 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', borderRadius: 8, background: '#EFF6FF', border: `1px solid ${BLUE}33`, color: BLUE, fontSize: 12, fontWeight: 700 }}>
                <Users size={12} /> {departments[0]?.name}
              </div>
            )}

            {/* Week nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 9, overflow: 'hidden' }}>
              <button onClick={prevWeek} style={{ width: 34, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, padding: '0 6px', whiteSpace: 'nowrap' }}>{weekLabel}</span>
              <button onClick={nextWeek} style={{ width: 34, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
                <ChevronRight size={14} />
              </button>
            </div>
            {!isCurrentWeek && (
              <button onClick={goToday} style={{ height: 36, padding: '0 12px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: MUTED, cursor: 'pointer' }}>
                Today
              </button>
            )}

            <div style={{ flex: 1 }} />

            <button
              onClick={openAssign}
              style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', background: BLUE, color: '#FFFFFF', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              <Plus size={14} /> Assign Shift
            </button>
          </div>

          {/* Timeline grid */}
          <div style={{ background: PANEL, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', animation: 'fadeSlideUp 0.3s ease both' }}>
            {/* Date headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', borderBottom: `1px solid ${BORDER}`, background: '#F8FAFC' }}>
              <div style={{ padding: '12px 16px', borderRight: `1px solid ${BORDER}` }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Team Member</p>
              </div>
              {weekDates.map(date => {
                const { weekday, num } = prettyDay(date)
                const isToday = date === todayStr
                return (
                  <div key={date} style={{ padding: '10px 8px', borderRight: `1px solid ${BORDER}`, textAlign: 'center', background: isToday ? '#EFF6FF' : undefined }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: isToday ? BLUE : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{weekday}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: isToday ? BLUE : TEXT }}>{num}</p>
                    {isToday && <div style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE, margin: '3px auto 0' }} />}
                  </div>
                )
              })}
            </div>

            {/* Rows */}
            {loading ? (
              <div style={{ padding: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: MUTED }}>
                <svg className="animate-spin" width={18} height={18} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(37,99,235,0.2)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Loading shifts…</span>
              </div>
            ) : visibleRows.length === 0 ? (
              <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#9CA3AF' }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLUE }}>
                  <CalendarDays size={22} strokeWidth={1.5} />
                </div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>No shifts this week</p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>Use "Assign Shift" to schedule your team</p>
              </div>
            ) : visibleRows.map((row, ri) => (
              <div key={row.user_id ?? `u-${ri}`} style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', borderBottom: `1px solid ${BORDER}` }}>
                {/* Name cell */}
                <div style={{ padding: '12px 14px', borderRight: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: BLUE, fontWeight: 800, fontSize: 12, letterSpacing: '-0.3px' }}>
                    {row.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.full_name}</p>
                    <p style={{ margin: 0, fontSize: 10.5, color: MUTED, fontWeight: 500 }}>{row.role}</p>
                  </div>
                </div>
                {/* Day cells */}
                {weekDates.map(date => {
                  const dayShifts = row.shifts.filter(s => s.shift_date === date)
                  const isToday = date === todayStr
                  return (
                    <div key={date} style={{ padding: '8px 6px', borderRight: `1px solid ${BORDER}`, verticalAlign: 'top', minHeight: 64, background: isToday ? '#F0F9FF' : undefined, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {dayShifts.map(shift => (
                        <ShiftBlock key={shift.id} shift={shift} onClick={() => openEdit(shift)} />
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* ── Assign / Edit Drawer ── */}
      {assignOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 480, maxWidth: '94vw', maxHeight: '90vh', background: PANEL, borderRadius: 18, boxShadow: '0 24px 70px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
            {/* Modal header */}
            <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid #F0F4F8`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#EFF6FF', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarDays size={16} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '0.9375rem', color: TEXT, margin: 0 }}>
                  {editShift ? 'Edit Shift' : 'Assign Shift'}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {editShift && (
                  <button
                    onClick={() => { setAssignOpen(false); setDeleteId(editShift.id) }}
                    style={{ width: 32, height: 32, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                <button onClick={() => setAssignOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>

              {/* Title */}
              <div>
                <label style={labelSt}>Title</label>
                <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="e.g. Morning shift" style={inputSt} />
              </div>

              {/* Date + Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelSt}>Date *</label>
                  <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Status</label>
                  <select value={fStatus} onChange={e => setFStatus(e.target.value as 'draft' | 'published')} style={inputSt}>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              {/* Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelSt}>Start time *</label>
                  <TimePicker value={fStart} onChange={setFStart} />
                </div>
                <div>
                  <label style={labelSt}>End time *</label>
                  <TimePicker value={fEnd} onChange={setFEnd} />
                </div>
              </div>

              {/* Department (only if multiple depts) */}
              {departments.length > 1 && (
                <div>
                  <label style={labelSt}>Department *</label>
                  <select value={fDeptId} onChange={e => setFDeptId(e.target.value)} style={inputSt}>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}

              {/* Assign to (only for new shifts) */}
              {!editShift && (
                <div>
                  <label style={labelSt}>Assign to *</label>
                  <select value={fUserId} onChange={e => setFUserId(e.target.value)} style={inputSt}>
                    <option value="">— Select team member —</option>
                    {assignableMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Instructions */}
              <div>
                <label style={labelSt}>Instructions</label>
                <textarea value={fInstr} onChange={e => setFInstr(e.target.value)} placeholder="Optional notes for this shift…" rows={3}
                  style={{ ...inputSt, resize: 'vertical', lineHeight: 1.55, fontFamily: 'inherit' }} />
              </div>

              {formError && (
                <div style={{ fontSize: 12.5, color: '#DC2626', background: '#FEF2F2', padding: '9px 12px', borderRadius: 8, fontWeight: 600 }}>
                  {formError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid #F0F4F8` }}>
              <button onClick={() => setAssignOpen(false)} disabled={saving} style={cancelBtnSt}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...primaryBtnSt, background: BLUE, opacity: saving ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {saving
                  ? <><svg className="animate-spin" width={13} height={13} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg> Saving…</>
                  : <><Check size={13} /> {editShift ? 'Save Changes' : 'Assign Shift'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: PANEL, borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'fadeSlideUp 0.2s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={17} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', color: TEXT, margin: 0 }}>Delete Shift</h3>
            </div>
            <p style={{ fontSize: 13.5, color: MUTED, margin: '0 0 20px', lineHeight: 1.6 }}>
              This will remove the shift and all its assignments. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} disabled={deleting} style={cancelBtnSt}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, height: 40, background: '#DC2626', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {deleting
                  ? <><svg className="animate-spin" width={13} height={13} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg> Deleting…</>
                  : 'Delete'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 700, color: '#374151',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em',
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 9,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#FAFBFC',
  color: TEXT, fontWeight: 500,
}

const cancelBtnSt: React.CSSProperties = {
  flex: 1, height: 40, background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 10,
  fontWeight: 700, fontSize: 13, color: MUTED, cursor: 'pointer',
}

const primaryBtnSt: React.CSSProperties = {
  flex: 1, height: 40, border: 'none', borderRadius: 10,
  fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer',
}
