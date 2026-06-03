'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Pencil, Trash2, X, ChevronDown, Check, Copy,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'

// ─── Local page types (match API response shapes) ─────────────────────────────

type Department = {
  id: string
  name: string
  company_id: string
  created_at: string
}

type ManagerInfo = { id: string; full_name: string; department_id: string | null }

type ShiftBlock = {
  id: string
  date: string
  start_time: string
  end_time: string
  assigned_user_id: string | null
  department_id: string
  status: string
}

type TimelineRowItem = {
  user_id: string | null
  full_name: string
  role: string
  department_id: string
  department_name: string
  shifts: ShiftBlock[]
}

type CompanyMember = {
  id: string
  full_name: string
  role: string
  department_id: string | null
}

// ─── Date / time helpers ──────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
}

function getShiftBlockInStrip(
  shift: ShiftBlock,
  stripStartMin: number,
  stripEndMin: number,
): { left: number; width: number } | null {
  const startMin = timeToMinutes(shift.start_time)
  const endMin   = timeToMinutes(shift.end_time)
  const cStart   = Math.max(startMin, stripStartMin)
  const cEnd     = Math.min(endMin,   stripEndMin)
  if (cStart >= cEnd) return null
  const duration = stripEndMin - stripStartMin
  return {
    left:  ((cStart - stripStartMin) / duration) * 100,
    width: ((cEnd   - cStart)        / duration) * 100,
  }
}

// Department colour palette — deterministic hash so the same dept always gets the same colour
const DEPT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#F97316', '#EF4444']
function deptColor(deptId: string): string {
  let h = 0
  for (let i = 0; i < deptId.length; i++) h = deptId.charCodeAt(i) + ((h << 5) - h)
  return DEPT_COLORS[Math.abs(h) % DEPT_COLORS.length]
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ─── Modal helpers ────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 100,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '520px' }}>
        {children}
      </div>
    </div>
  )
}

function ModalBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '16px', padding: '32px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
    }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: '4px', borderRadius: '6px' }}>
        <X size={18} />
      </button>
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{
      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
      padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginTop: '12px', lineHeight: 1.5,
    }}>
      {message}
    </div>
  )
}

// ─── Invite-code display helpers ──────────────────────────────────────────────

function CodeBox({ code, loading }: { code: string; loading: boolean }) {
  return (
    <div style={{
      background: '#F8F9FA', border: '1px solid #E5E7EB', borderRadius: '12px',
      padding: '24px', textAlign: 'center', minHeight: '84px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {loading ? (
        <Spinner size={24} dark />
      ) : code ? (
        <span style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontWeight: 700, fontSize: '2rem', letterSpacing: '0.15em', color: '#1C1C1E' }}>
          {code}
        </span>
      ) : (
        <span style={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Select a department to generate a code</span>
      )}
    </div>
  )
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fyp-tasking.vercel.app'

function CodeActions({ code, loading, copied, onCopy }: { code: string; loading: boolean; copied: boolean; onCopy: () => void }) {
  const disabled = !code || loading
  return (
    <button
      onClick={onCopy}
      disabled={disabled}
      style={{
        width: '100%', height: '48px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: '8px',
        background: copied ? '#059669' : '#F97316',
        color: '#FFFFFF', border: 'none', borderRadius: '10px',
        fontWeight: 600, fontSize: '0.9375rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1, transition: 'background 0.2s', whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled && !copied) e.currentTarget.style.background = '#EA6C0A' }}
      onMouseLeave={(e) => { if (!disabled && !copied) e.currentTarget.style.background = '#F97316' }}
    >
      {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Link</>}
    </button>
  )
}

// ─── Shared modal styles ──────────────────────────────────────────────────────

const modalInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: '8px', fontSize: '0.9375rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}

const modalLabelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.875rem',
  color: '#374151', marginBottom: '8px',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const router = useRouter()

  // Auth / company IDs
  const [userId,         setUserId]         = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId,      setCompanyId]      = useState('')

  // Top-bar
  const [companies,    setCompanies]    = useState<{ id: string; name: string; plan: string }[]>([])
  const [userRole,     setUserRole]     = useState<string>('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Departments
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptSearch,  setDeptSearch]  = useState('')

  // Department CRUD
  const [addModal,              setAddModal]              = useState(false)
  const [editModal,             setEditModal]             = useState<Department | null>(null)
  const [deleteModal,           setDeleteModal]           = useState<Department | null>(null)
  const [deptFormName,          setDeptFormName]          = useState('')
  const [deptLoading,           setDeptLoading]           = useState(false)
  const [deptError,             setDeptError]             = useState('')
  const [inviteLoading,         setInviteLoading]         = useState(false)
  const [inviteCode,            setInviteCode]            = useState('')
  const [inviteModal,           setInviteModal]           = useState<'owner' | 'manager' | 'employee' | null>(null)
  const [selectedDeptId,        setSelectedDeptId]        = useState('')
  const [copied,                setCopied]                = useState(false)
  const [ownerName,             setOwnerName]             = useState('')
  const [companyName,           setCompanyName]           = useState('')
  const [dashboardRole,         setDashboardRole]         = useState<string>('')
  const [userDeptId,            setUserDeptId]            = useState<string>('')
  const [initialReady,          setInitialReady]          = useState(false)
  const [headerTheme,           setHeaderTheme]           = useState<{ bg: string; text: string; border: string }>({ bg: '#1C1C1E', text: '#FFFFFF', border: 'none' })
  const [removalOverlay,        setRemovalOverlay]        = useState<{ companyName: string } | null>(null)
  const [deptManagerMap,        setDeptManagerMap]        = useState<Record<string, string>>({})
  const [allCompanyManagers,    setAllCompanyManagers]    = useState<ManagerInfo[]>([])
  const [editManagerModal,      setEditManagerModal]      = useState<Department | null>(null)
  const [editManagerSelectedId, setEditManagerSelectedId] = useState('')
  const [editManagerLoading,    setEditManagerLoading]    = useState(false)
  const [editManagerError,      setEditManagerError]      = useState('')

  // ── Timeline state ─────────────────────────────────────────────────────────
  const [selectedDate,   setSelectedDate]   = useState<string>(() => new Date().toISOString().split('T')[0])
  const [timelineRows,   setTimelineRows]   = useState<TimelineRowItem[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  // Shift modal
  type ShiftModalState = { mode: 'new' | 'edit'; shift?: ShiftBlock }
  const [shiftModal,       setShiftModal]       = useState<ShiftModalState | null>(null)
  const [shiftDeleteConfirm, setShiftDeleteConfirm] = useState<ShiftBlock | null>(null)
  const [shiftFormDeptId,  setShiftFormDeptId]  = useState('')
  const [shiftFormUserId,  setShiftFormUserId]  = useState('')
  const [shiftFormDate,    setShiftFormDate]    = useState('')
  const [shiftFormStart,   setShiftFormStart]   = useState('')
  const [shiftFormEnd,     setShiftFormEnd]     = useState('')
  const [shiftFormError,   setShiftFormError]   = useState('')
  const [shiftFormLoading, setShiftFormLoading] = useState(false)
  const [companyMembers,   setCompanyMembers]   = useState<CompanyMember[]>([])

  const canManageDepartments = dashboardRole === 'Owner' || dashboardRole === 'Partner'

  // ── Close all modals ───────────────────────────────────────────────────────

  const closeAll = useCallback(() => {
    setAddModal(false)
    setEditModal(null)
    setDeleteModal(null)
    setEditManagerModal(null)
    setShiftModal(null)
    setShiftDeleteConfirm(null)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeAll])

  // ── Header theme ───────────────────────────────────────────────────────────

  useEffect(() => {
    const role = localStorage.getItem('tasking_user_role')
    setHeaderTheme(role === 'Partner'
      ? { bg: '#FFFFFF', text: '#1C1C1E', border: '1px solid #E5E7EB' }
      : { bg: '#1C1C1E', text: '#FFFFFF', border: 'none' })
  }, [])

  // ── Click outside company dropdown ─────────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Removal detection ──────────────────────────────────────────────────────

  const handleRemovalDetected = useCallback((removedCompanyName: string, availableCompanies: { id: string; name: string; plan: string }[]) => {
    setRemovalOverlay({ companyName: removedCompanyName })
    setTimeout(() => {
      setRemovalOverlay(null)
      if (availableCompanies.length === 0) {
        fetch('/api/auth/signout', { method: 'POST' })
        window.location.href = '/signout'
      }
    }, 3000)
  }, [])

  // ── Mount: resolve session → company context ───────────────────────────────

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
      setUserId(userIdResolved)
      setUserRole(localStorage.getItem('tasking_user_role') || '')

      fetch(`/api/user/me?user_id=${userIdResolved}`)
        .then(r => r.json())
        .then(d => {
          if (!cancelled && d.success) {
            if (d.user?.full_name)    setOwnerName(d.user.full_name)
            if (d.user?.department_id) setUserDeptId(d.user.department_id)
            if (d.user?.id)           setInternalUserId(d.user.id)
          }
        })
        .catch(() => {})

      const storedCid = localStorage.getItem(`tasking_company_id_${userIdResolved}`)
      const qs = new URLSearchParams({ user_id: userIdResolved })
      if (storedCid) qs.set('company_id', storedCid)

      const res = await fetch(`/api/company/current?${qs}`)
      if (!res.ok) { if (!cancelled) setInitialReady(true); return }
      const data = await res.json()
      if (cancelled) return
      if (!data.success) { setInitialReady(true); return }

      setDashboardRole(data.role || '')
      const list = (data.companies || []).map((c: { id: string; name: string; plan: string }) => ({ id: c.id, name: c.name, plan: c.plan }))
      setCompanies(list)

      if (data.company) {
        const company = data.company
        if (storedCid && !list.some((c: { id: string }) => c.id === storedCid)) {
          const next = { id: company.id, name: company.name }
          localStorage.setItem(`tasking_company_id_${userIdResolved}`, next.id)
          setCompanyId(next.id); setCompanyName(next.name)
          await fetchDeptsById(next.id)
          setInitialReady(true)
          const removedName = localStorage.getItem(`tasking_last_company_name_${storedCid}`) || 'your previous company'
          handleRemovalDetected(removedName, list)
          return
        }
        localStorage.setItem(`tasking_company_id_${userIdResolved}`, company.id)
        localStorage.setItem(`tasking_last_company_name_${company.id}`, company.name)
        setCompanyId(company.id); setCompanyName(company.name)
        await fetchDeptsById(company.id)
      } else if (storedCid && list.length > 0) {
        const next = list[0] as { id: string; name: string }
        localStorage.setItem(`tasking_company_id_${userIdResolved}`, next.id)
        localStorage.setItem(`tasking_last_company_name_${next.id}`, next.name)
        setCompanyId(next.id); setCompanyName(next.name)
        await fetchDeptsById(next.id)
      } else {
        setCompanyId(''); setCompanyName(''); setDepartments([])
      }
      setInitialReady(true)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  // ── Timeline fetch ─────────────────────────────────────────────────────────

  const fetchTimelineShifts = useCallback(async (cid: string, date: string) => {
    if (!cid) return
    setTimelineLoading(true)
    try {
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${date}&date_to=${date}`)
      const data = await res.json()
      if (data.success) setTimelineRows(data.rows ?? [])
    } catch {}
    finally { setTimelineLoading(false) }
  }, [])

  useEffect(() => {
    if (companyId && selectedDate) fetchTimelineShifts(companyId, selectedDate)
  }, [companyId, selectedDate, fetchTimelineShifts])

  // ── Department data fetchers ───────────────────────────────────────────────

  const fetchManagersForCompany = async (cid: string) => {
    if (!cid) return
    try {
      const res = await fetch(`/api/company/managers?company_id=${cid}`)
      const data = await res.json()
      if (data.success) {
        setAllCompanyManagers(data.managers)
        const map: Record<string, string> = {}
        for (const mgr of data.managers as ManagerInfo[]) {
          if (mgr.department_id && !map[mgr.department_id]) map[mgr.department_id] = mgr.full_name
        }
        setDeptManagerMap(map)
      }
    } catch {}
  }

  const fetchDeptsById = async (cid: string) => {
    if (!cid) return
    try {
      const res = await fetch(`/api/company/departments?company_id=${cid}`)
      const data = await res.json()
      if (data.success) setDepartments(data.departments)
    } catch {}
    await fetchManagersForCompany(cid)
  }

  const fetchDepts = async () => { if (companyId) fetchDeptsById(companyId) }

  // ── Invite code ────────────────────────────────────────────────────────────

  const generateCode = async (role: 'Manager' | 'Employee' | 'Owner', deptId?: string) => {
    setInviteLoading(true); setInviteCode('')
    try {
      const res = await fetch('/api/invitation/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, department_id: deptId || null, role, generated_by: userId }),
      })
      const data = await res.json()
      if (data.success) setInviteCode(data.code)
    } finally { setInviteLoading(false) }
  }

  const openManagerModal  = () => { setCopied(false); setInviteCode(''); setSelectedDeptId(''); setInviteModal('manager') }
  const openEmployeeModal = () => { setCopied(false); setInviteCode(''); setSelectedDeptId(''); setInviteModal('employee') }
  const openOwnerModal    = () => { setCopied(false); setInviteCode(''); setInviteModal('owner') }
  const handleManagerDeptSelect  = (id: string) => { setSelectedDeptId(id); setCopied(false); setInviteCode('') }
  const handleEmployeeDeptSelect = (id: string) => { setSelectedDeptId(id); setCopied(false); setInviteCode('') }

  const copyLink = (role: 'Owner' | 'Manager' | 'Employee') => {
    if (!inviteCode) return
    navigator.clipboard.writeText(`Join ${ownerName}'s company as ${role} in Tasking with invitation code: ${inviteCode}\nGet started here: ${appUrl}/get-started`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Department CRUD ────────────────────────────────────────────────────────

  const handleAddDept = async () => {
    if (!deptFormName.trim()) return
    if (!companyId) { setDeptError('Company not found, please refresh'); return }
    setDeptLoading(true); setDeptError('')
    try {
      const res = await fetch('/api/company/create-department', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: deptFormName.trim(), company_id: companyId }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setAddModal(false); setDeptFormName(''); fetchDepts()
    } catch (err) { setDeptError(err instanceof Error ? err.message : 'Failed to add department') }
    finally { setDeptLoading(false) }
  }

  const handleEditDept = async () => {
    if (!deptFormName.trim() || !editModal) return
    setDeptLoading(true); setDeptError('')
    try {
      const res = await fetch('/api/company/update-department', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ department_id: editModal.id, name: deptFormName.trim() }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setEditModal(null); setDeptFormName(''); fetchDepts()
    } catch (err) { setDeptError(err instanceof Error ? err.message : 'Failed to update department') }
    finally { setDeptLoading(false) }
  }

  const handleDeleteDept = async () => {
    if (!deleteModal) return
    setDeptLoading(true); setDeptError('')
    try {
      const res = await fetch('/api/company/delete-department', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ department_id: deleteModal.id }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setDeleteModal(null); fetchDepts()
    } catch (err) { setDeptError(err instanceof Error ? err.message : 'Failed to delete department') }
    finally { setDeptLoading(false) }
  }

  const handleEditDeptManager = async () => {
    if (!editManagerModal || !editManagerSelectedId) return
    setEditManagerLoading(true); setEditManagerError('')
    try {
      const res = await fetch('/api/user/update-department', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: editManagerSelectedId, department_id: editManagerModal.id }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setEditManagerModal(null); setEditManagerSelectedId('')
      await fetchManagersForCompany(companyId)
    } catch (err) { setEditManagerError(err instanceof Error ? err.message : 'Failed to update manager') }
    finally { setEditManagerLoading(false) }
  }

  // ── Shift CRUD ─────────────────────────────────────────────────────────────

  const loadCompanyMembers = async () => {
    if (companyMembers.length > 0 || !companyId) return
    try {
      const res = await fetch(`/api/team/members?company_id=${companyId}`)
      const data = await res.json()
      if (data.success) setCompanyMembers((data.members as CompanyMember[]).filter(m => m.role !== 'Owner' && m.role !== 'Partner'))
    } catch {}
  }

  const openShiftModal = async (
    mode: 'new' | 'edit',
    shift?: ShiftBlock,
    prefillStart?: string,
    prefillEnd?: string,
    prefillDeptId?: string,
    prefillUserId?: string,
  ) => {
    await loadCompanyMembers()
    if (mode === 'edit' && shift) {
      setShiftFormDeptId(shift.department_id)
      setShiftFormUserId(shift.assigned_user_id ?? '')
      setShiftFormDate(shift.date)
      setShiftFormStart(shift.start_time.slice(0, 5))
      setShiftFormEnd(shift.end_time.slice(0, 5))
    } else {
      setShiftFormDeptId(prefillDeptId ?? '')
      setShiftFormUserId(prefillUserId ?? '')
      setShiftFormDate(selectedDate)
      setShiftFormStart(prefillStart ?? '09:00')
      setShiftFormEnd(prefillEnd ?? '17:00')
    }
    setShiftFormError('')
    setShiftModal({ mode, shift })
  }

  const handleCreateShift = async () => {
    if (!shiftFormDeptId || !shiftFormDate || !shiftFormStart || !shiftFormEnd) {
      setShiftFormError('Department, date, start and end time are required'); return
    }
    setShiftFormLoading(true); setShiftFormError('')
    try {
      const res = await fetch('/api/shift', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, department_id: shiftFormDeptId, date: shiftFormDate, start_time: shiftFormStart, end_time: shiftFormEnd, assigned_user_id: shiftFormUserId || null, created_by: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setShiftModal(null)
      await fetchTimelineShifts(companyId, selectedDate)
    } catch (err) { setShiftFormError(err instanceof Error ? err.message : 'Failed to create shift') }
    finally { setShiftFormLoading(false) }
  }

  const handleEditShift = async () => {
    if (!shiftModal?.shift || !shiftFormDeptId || !shiftFormDate || !shiftFormStart || !shiftFormEnd) {
      setShiftFormError('All fields are required'); return
    }
    setShiftFormLoading(true); setShiftFormError('')
    try {
      const res = await fetch(`/api/shift/${shiftModal.shift.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: shiftFormDeptId, date: shiftFormDate, start_time: shiftFormStart, end_time: shiftFormEnd, assigned_user_id: shiftFormUserId || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setShiftModal(null)
      await fetchTimelineShifts(companyId, selectedDate)
    } catch (err) { setShiftFormError(err instanceof Error ? err.message : 'Failed to update shift') }
    finally { setShiftFormLoading(false) }
  }

  const handleDeleteShift = async (shiftId: string) => {
    setShiftFormLoading(true)
    try {
      const res = await fetch(`/api/shift/${shiftId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setShiftDeleteConfirm(null); setShiftModal(null)
      await fetchTimelineShifts(companyId, selectedDate)
    } catch {}
    finally { setShiftFormLoading(false) }
  }

  // Compute start/end time from a click position within a strip
  const handleStripClick = (
    e: React.MouseEvent<HTMLDivElement>,
    stripStartMin: number,
    stripEndMin: number,
    row?: TimelineRowItem,
  ) => {
    const rect         = e.currentTarget.getBoundingClientRect()
    const fraction     = Math.max(0, Math.min(0.95, (e.clientX - rect.left) / rect.width))
    const stripDur     = stripEndMin - stripStartMin
    const rawMin       = stripStartMin + Math.round(fraction * stripDur / 30) * 30
    const clampedEnd   = Math.min(rawMin + 60, stripEndMin)
    const fmt          = (m: number) => `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`
    void openShiftModal('new', undefined, fmt(rawMin), fmt(clampedEnd), row?.department_id, row?.user_id ?? undefined)
  }

  // ── Date navigation ────────────────────────────────────────────────────────

  const todayStr = new Date().toISOString().split('T')[0]
  const minDate  = addDays(todayStr, -2)
  const maxDate  = addDays(todayStr, 7)

  // ── Derived department helpers ─────────────────────────────────────────────

  const departmentName = userDeptId ? departments.find(d => d.id === userDeptId)?.name ?? '' : ''
  const startsWithDigit = (s: string) => /^\d/.test(s)
  const visibleDepts = dashboardRole === 'Manager' && userDeptId ? departments.filter(d => d.id === userDeptId) : departments
  const filteredDepts = visibleDepts
    .filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase()))
    .sort((a, b) => {
      const aNum = startsWithDigit(a.name); const bNum = startsWithDigit(b.name)
      if (aNum !== bNum) return aNum ? 1 : -1
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })

  // ── Button style helpers ───────────────────────────────────────────────────

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
    flex: 1, padding: '10px', background: '#EF4444', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
    cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: loading ? 0.65 : 1,
  })

  // ── Timeline strip renderer ────────────────────────────────────────────────

  // Layout constants
  const PERSON_COL = 172   // px — fixed left person-info column
  const ROW_H      = 64    // px — comfortable row height

  function renderStrip(
    label: string,
    stripStartMin: number,
    stripEndMin: number,
    hours: number[],   // e.g. [7,8,...,15] — first and last are the boundary labels
  ) {
    const intervalCount = hours.length - 1   // 8 intervals for an 8-hour strip

    const rowsForStrip = timelineRows.filter(row =>
      row.shifts.some(s => {
        const start = timeToMinutes(s.start_time)
        const end   = timeToMinutes(s.end_time)
        return start < stripEndMin && end > stripStartMin
      }),
    )

    return (
      <div style={{ marginBottom: 28, borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

        {/* Strip header — dark Owner theme bar */}
        <div style={{ display: 'flex', background: '#1C1C1E' }}>
          <div style={{
            width: PERSON_COL, flexShrink: 0,
            padding: '10px 16px',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#FFFFFF', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {label}
            </span>
          </div>
          <div style={{ flex: 1, position: 'relative', height: 36 }}>
            {hours.map((h, i) => (
              <span
                key={h}
                style={{
                  position: 'absolute',
                  left: `${(i / intervalCount) * 100}%`,
                  top: '50%',
                  transform: i === 0
                    ? 'translateY(-50%)'
                    : i === intervalCount
                    ? 'translate(-100%, -50%)'
                    : 'translate(-50%, -50%)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.55)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {`${h}:00`}
              </span>
            ))}
          </div>
        </div>

        {/* Person rows */}
        <div style={{ background: '#FFFFFF' }}>
          {rowsForStrip.length === 0 ? (
            // Empty state row — click anywhere to create a shift
            <div
              style={{ display: 'flex', height: ROW_H, cursor: 'crosshair' }}
              onClick={(e) => handleStripClick(e, stripStartMin, stripEndMin)}
            >
              <div style={{
                width: PERSON_COL, flexShrink: 0,
                borderRight: '1px solid #E5E7EB',
                display: 'flex', alignItems: 'center', padding: '0 16px',
              }}>
                <span style={{ fontSize: '0.8125rem', color: '#CBD5E1', fontStyle: 'italic' }}>No shifts yet</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
                <span style={{ fontSize: '0.8125rem', color: '#CBD5E1', userSelect: 'none' }}>
                  Click to schedule a shift
                </span>
              </div>
            </div>
          ) : (
            rowsForStrip.map((row, idx) => (
              <div
                key={`${row.user_id ?? row.department_id}_${idx}`}
                style={{
                  display: 'flex',
                  height: ROW_H,
                  borderTop: idx === 0 ? 'none' : '1px solid #E5E7EB',
                  background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                }}
              >
                {/* Person info — left sticky column */}
                <div style={{
                  width: PERSON_COL, flexShrink: 0,
                  borderRight: '1px solid #E5E7EB',
                  padding: '8px 14px 8px 16px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3,
                  background: 'inherit',
                }}>
                  <span style={{
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: '#111827',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.full_name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                    {row.role && (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700,
                        color: '#6B7280',
                        background: '#F1F5F9',
                        padding: '1px 5px', borderRadius: 4,
                        flexShrink: 0, letterSpacing: '0.02em',
                        textTransform: 'uppercase',
                      }}>
                        {row.role}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.department_name}
                    </span>
                  </div>
                </div>

                {/* Time grid */}
                <div
                  style={{ flex: 1, position: 'relative', cursor: 'crosshair', background: 'inherit' }}
                  onClick={(e) => handleStripClick(e, stripStartMin, stripEndMin, row)}
                >
                  {/* Hour grid lines — subtle vertical markers */}
                  {Array.from({ length: intervalCount - 1 }, (_, i) => i + 1).map(i => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `${(i / intervalCount) * 100}%`,
                        top: 0, bottom: 0,
                        borderLeft: '1px solid #EEF2F7',
                        pointerEvents: 'none',
                      }}
                    />
                  ))}

                  {/* Shift blocks */}
                  {row.shifts.map(shift => {
                    const block = getShiftBlockInStrip(shift, stripStartMin, stripEndMin)
                    if (!block) return null
                    const color = deptColor(shift.department_id)
                    const blockTop = 8
                    const blockH   = ROW_H - blockTop * 2  // 48px
                    return (
                      <div
                        key={shift.id}
                        onClick={(e) => { e.stopPropagation(); void openShiftModal('edit', shift) }}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
                        style={{
                          position: 'absolute',
                          left: `calc(${block.left}% + 2px)`,
                          width: `calc(${Math.max(block.width, 1.5)}% - 4px)`,
                          top: blockTop,
                          height: blockH,
                          background: color,
                          borderRadius: 7,
                          padding: '6px 10px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                          zIndex: 1,
                          transition: 'filter 0.12s',
                        }}
                        title={`${row.full_name} · ${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`}
                      >
                        <span style={{
                          fontSize: '0.8125rem', fontWeight: 700,
                          color: '#FFFFFF',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          lineHeight: 1.3,
                        }}>
                          {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                        </span>
                        {block.width > 9 && (
                          <span style={{
                            fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.82)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            lineHeight: 1.2, marginTop: 1,
                          }}>
                            {row.department_name}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{
          padding: '18px 32px', background: headerTheme.bg, borderBottom: headerTheme.border,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          {dashboardRole !== 'Manager' && companies.length > 1 ? (
            <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={() => setDropdownOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, fontSize: '1.1875rem', color: headerTheme.text, userSelect: 'none' }}
              >
                {companyName ? `${companyName} — Overview` : 'Overview'}
                <ChevronDown size={16} strokeWidth={2.5} style={{ color: headerTheme.text, opacity: 0.6, transition: 'transform 0.15s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
              {dropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '6px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: '200px', zIndex: 50, overflow: 'hidden' }}>
                  {companies.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => {
                        if (!userId) return
                        localStorage.setItem(`tasking_company_id_${userId}`, c.id)
                        localStorage.setItem(`tasking_last_company_name_${c.id}`, c.name)
                        setDropdownOpen(false); setCompanyId(c.id); setCompanyName(c.name)
                        void fetchDeptsById(c.id)
                      }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: c.id === companyId ? '#FFF7ED' : 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: c.id === companyId ? '#EA580C' : '#374151', fontWeight: c.id === companyId ? 600 : 400, transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (c.id !== companyId) e.currentTarget.style.background = '#F3F4F6' }}
                      onMouseLeave={e => { if (c.id !== companyId) e.currentTarget.style.background = 'none' }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: headerTheme.text, margin: 0 }}>
              {dashboardRole === 'Manager' && departmentName ? `${companyName} — ${departmentName}` : companyName ? `${companyName} — Overview` : 'Overview'}
            </h1>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {ownerName && <span style={{ fontSize: '0.9rem', color: headerTheme.text, opacity: 0.85 }}>{ownerName}</span>}
            {userRole && (
              <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(128,128,128,0.15)', color: headerTheme.text }}>
                {userRole}
              </span>
            )}
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div style={{ padding: '28px 32px', flex: 1 }}>

          {initialReady && !companyId && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 18px', fontSize: '0.9rem', color: '#92400E', marginBottom: '24px' }}>
              No company is linked to your profile yet. If you just accepted an invitation, try signing out and signing in again, or contact your administrator.
            </div>
          )}

          {/* ═══════════════ DEPARTMENTS (top section) ═══════════════ */}
          {dashboardRole === 'Manager' ? (
            <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>Your team and schedule will appear here.</p>
          ) : (
            <div style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>Departments</h2>
                {canManageDepartments && (
                  <button
                    onClick={() => { setAddModal(true); setDeptFormName(''); setDeptError('') }}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', background: 'transparent', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', color: '#374151', cursor: 'pointer', transition: 'border-color 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#9CA3AF')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                  >
                    <Plus size={14} strokeWidth={2.5} /> Add Department
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', marginBottom: '18px', maxWidth: '320px' }}>
                <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                <input
                  placeholder="Search departments..."
                  value={deptSearch}
                  onChange={e => setDeptSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '34px', paddingRight: deptSearch ? '30px' : '12px', paddingTop: '8px', paddingBottom: '8px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '0.9rem', color: '#374151', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                />
                {deptSearch && (
                  <button onClick={() => setDeptSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 0 }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {filteredDepts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: '0.9375rem' }}>
                  {deptSearch ? 'No departments match your search.' : canManageDepartments ? 'No departments yet. Add your first one.' : 'No departments in this company yet.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                  {filteredDepts.map(dept => (
                    <div key={dept.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{dept.name}</p>
                        <p style={{ fontSize: '0.8125rem', color: deptManagerMap[dept.id] ? '#374151' : '#9CA3AF', margin: '4px 0 0' }}>
                          {deptManagerMap[dept.id] ?? 'No manager yet'}
                        </p>
                      </div>
                      {canManageDepartments && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => { setEditModal(dept); setDeptFormName(dept.name); setDeptError('') }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', border: '1px solid #E5E7EB', borderRadius: '6px', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500 }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#9CA3AF')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                          >
                            <Pencil size={11} strokeWidth={2} /> Edit
                          </button>
                          <button onClick={() => { setEditManagerModal(dept); setEditManagerSelectedId(''); setEditManagerError('') }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', border: '1px solid #E5E7EB', borderRadius: '6px', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500 }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#9CA3AF')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                          >
                            <Pencil size={11} strokeWidth={2} /> Mgr
                          </button>
                          <button onClick={() => { setDeleteModal(dept); setDeptError('') }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', border: '1px solid #E5E7EB', borderRadius: '6px', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#EF4444', fontWeight: 500 }}
                          >
                            <Trash2 size={11} strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ ALLOCATION TIMELINE (bottom section) ═══════════════ */}
          {dashboardRole !== 'Manager' && companyId && (
            <div>
              {/* Timeline title + New Shift button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>Allocation Timeline</h2>
                <button
                  onClick={() => void openShiftModal('new')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#F97316', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', color: '#fff', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#EA6C0A')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F97316')}
                >
                  <Plus size={14} strokeWidth={2.5} /> New Shift
                </button>
              </div>

              {/* Compact date navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                {/* Prev day */}
                <button
                  onClick={() => setSelectedDate(d => d > minDate ? addDays(d, -1) : d)}
                  disabled={selectedDate <= minDate}
                  style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: selectedDate <= minDate ? 'default' : 'pointer', opacity: selectedDate <= minDate ? 0.35 : 1, flexShrink: 0 }}
                  onMouseEnter={e => { if (selectedDate > minDate) e.currentTarget.style.borderColor = '#94A3B8' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
                >
                  <ChevronLeft size={16} color="#374151" />
                </button>

                {/* Date display */}
                <div style={{ minWidth: 148, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '0 14px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                    {formatDateLabel(selectedDate)}
                  </span>
                </div>

                {/* Next day */}
                <button
                  onClick={() => setSelectedDate(d => d < maxDate ? addDays(d, 1) : d)}
                  disabled={selectedDate >= maxDate}
                  style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: selectedDate >= maxDate ? 'default' : 'pointer', opacity: selectedDate >= maxDate ? 0.35 : 1, flexShrink: 0 }}
                  onMouseEnter={e => { if (selectedDate < maxDate) e.currentTarget.style.borderColor = '#94A3B8' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
                >
                  <ChevronRight size={16} color="#374151" />
                </button>

                {/* Today shortcut — only shown when not already on today */}
                {selectedDate !== todayStr && (
                  <button
                    onClick={() => setSelectedDate(todayStr)}
                    style={{ height: 34, padding: '0 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#374151' }}
                  >
                    Today
                  </button>
                )}

                {timelineLoading && (
                  <div style={{ marginLeft: 4 }}><Spinner size={14} dark /></div>
                )}
              </div>

              {/* Day strip  07:00–15:00 */}
              {renderStrip('Day · 07:00 – 15:00', 420, 900, [7, 8, 9, 10, 11, 12, 13, 14, 15])}

              {/* Evening strip  15:00–23:00 */}
              {renderStrip('Evening · 15:00 – 23:00', 900, 1380, [15, 16, 17, 18, 19, 20, 21, 22, 23])}
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════════ MODALS ═══════════════════════ */}

      {/* New / Edit Shift */}
      {shiftModal && (
        <ModalOverlay onClose={() => setShiftModal(null)}>
          <ModalBox>
            <ModalHeader title={shiftModal.mode === 'new' ? 'New Shift' : 'Edit Shift'} onClose={() => setShiftModal(null)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={modalLabelStyle}>Department *</label>
                <div style={{ position: 'relative' }}>
                  <select value={shiftFormDeptId} onChange={e => setShiftFormDeptId(e.target.value)}
                    style={{ ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer' }}>
                    <option value="">Select department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </div>
              <div>
                <label style={modalLabelStyle}>Assigned Person</label>
                <div style={{ position: 'relative' }}>
                  <select value={shiftFormUserId} onChange={e => setShiftFormUserId(e.target.value)}
                    style={{ ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer' }}>
                    <option value="">Open shift (unassigned)</option>
                    {companyMembers.map(m => <option key={m.id} value={m.id}>{m.full_name} · {m.role}</option>)}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </div>
              <div>
                <label style={modalLabelStyle}>Date *</label>
                <input type="date" value={shiftFormDate} onChange={e => setShiftFormDate(e.target.value)} min={minDate} max={maxDate} style={modalInputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={modalLabelStyle}>Start Time *</label>
                  <input type="time" value={shiftFormStart} onChange={e => setShiftFormStart(e.target.value)} style={modalInputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={modalLabelStyle}>End Time *</label>
                  <input type="time" value={shiftFormEnd} onChange={e => setShiftFormEnd(e.target.value)} style={modalInputStyle} />
                </div>
              </div>
            </div>
            <InlineError message={shiftFormError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {shiftModal.mode === 'edit' && (
                <button
                  onClick={() => setShiftDeleteConfirm(shiftModal.shift!)}
                  style={{ padding: '10px 16px', background: 'none', border: '1.5px solid #FECACA', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
              <button style={ghostBtn} onClick={() => setShiftModal(null)}>Cancel</button>
              <button style={primaryBtn(shiftFormLoading)} onClick={shiftModal.mode === 'new' ? handleCreateShift : handleEditShift} disabled={shiftFormLoading}>
                {shiftFormLoading && <Spinner size={14} />}
                {shiftModal.mode === 'new' ? 'Create Shift' : 'Save Changes'}
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Delete Shift Confirm */}
      {shiftDeleteConfirm && (
        <ModalOverlay onClose={() => setShiftDeleteConfirm(null)}>
          <ModalBox>
            <ModalHeader title="Delete Shift" onClose={() => setShiftDeleteConfirm(null)} />
            <p style={{ fontSize: '0.9375rem', color: '#374151', margin: 0, lineHeight: 1.6 }}>
              Delete the shift on <strong>{shiftDeleteConfirm.date}</strong> from{' '}
              <strong>{shiftDeleteConfirm.start_time.slice(0, 5)}</strong> to{' '}
              <strong>{shiftDeleteConfirm.end_time.slice(0, 5)}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button style={ghostBtn} onClick={() => setShiftDeleteConfirm(null)}>Cancel</button>
              <button style={dangerBtn(shiftFormLoading)} onClick={() => handleDeleteShift(shiftDeleteConfirm.id)} disabled={shiftFormLoading}>
                {shiftFormLoading && <Spinner size={14} />} Delete
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Invite Partner */}
      {inviteModal === 'owner' && (
        <ModalOverlay onClose={() => { setInviteModal(null); setInviteCode('') }}>
          <ModalBox>
            <ModalHeader title="Invite Partner" onClose={() => { setInviteModal(null); setInviteCode('') }} />
            <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>Share this code with someone you want to give full access to.</p>
            {inviteCode && <div style={{ marginBottom: 16 }}><CodeBox code={inviteCode} loading={false} /></div>}
            {inviteCode
              ? <CodeActions code={inviteCode} loading={inviteLoading} copied={copied} onCopy={() => copyLink('Owner')} />
              : <button onClick={() => generateCode('Owner')} disabled={inviteLoading} style={{ width: '100%', height: 48, background: '#F97316', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: '0.9375rem', cursor: inviteLoading ? 'not-allowed' : 'pointer', opacity: inviteLoading ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {inviteLoading && <Spinner size={14} />} Generate Invite Code
                </button>
            }
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Invite Manager */}
      {inviteModal === 'manager' && (
        <ModalOverlay onClose={() => { setInviteModal(null); setInviteCode('') }}>
          <ModalBox>
            <ModalHeader title="Invite Manager" onClose={() => { setInviteModal(null); setInviteCode('') }} />
            <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>Select a department and share the code with your new Manager.</p>
            {departments.length === 0
              ? <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', margin: '16px 0' }}>No departments found. Please add a department first.</p>
              : <>
                  <label style={modalLabelStyle}>Department</label>
                  <div style={{ position: 'relative' }}>
                    <select value={selectedDeptId} onChange={e => handleManagerDeptSelect(e.target.value)} style={{ ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer' }}>
                      <option value="">Select a department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </>
            }
            {inviteCode && <div style={{ marginTop: 16, marginBottom: 16 }}><CodeBox code={inviteCode} loading={false} /></div>}
            <div style={{ marginTop: 20 }}>
              {inviteCode
                ? <CodeActions code={inviteCode} loading={inviteLoading} copied={copied} onCopy={() => copyLink('Manager')} />
                : <button onClick={() => { if (selectedDeptId) generateCode('Manager', selectedDeptId) }} disabled={!selectedDeptId || inviteLoading || departments.length === 0} style={{ width: '100%', height: 48, background: '#F97316', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: '0.9375rem', cursor: (!selectedDeptId || departments.length === 0) ? 'not-allowed' : 'pointer', opacity: (!selectedDeptId || departments.length === 0) ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {inviteLoading && <Spinner size={14} />} Generate Invite Code
                  </button>
              }
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Invite Employee */}
      {inviteModal === 'employee' && (
        <ModalOverlay onClose={() => { setInviteModal(null); setInviteCode('') }}>
          <ModalBox>
            <ModalHeader title="Invite Employee" onClose={() => { setInviteModal(null); setInviteCode('') }} />
            <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>Select a department and share the code with your new employee.</p>
            {departments.length === 0
              ? <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', margin: '16px 0' }}>No departments found. Please add a department first.</p>
              : <>
                  <label style={modalLabelStyle}>Department</label>
                  <div style={{ position: 'relative' }}>
                    <select value={selectedDeptId} onChange={e => handleEmployeeDeptSelect(e.target.value)} style={{ ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer' }}>
                      <option value="">Select a department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </>
            }
            {inviteCode && <div style={{ marginTop: 16, marginBottom: 16 }}><CodeBox code={inviteCode} loading={false} /></div>}
            <div style={{ marginTop: 20 }}>
              {inviteCode
                ? <CodeActions code={inviteCode} loading={inviteLoading} copied={copied} onCopy={() => copyLink('Employee')} />
                : <button onClick={() => { if (selectedDeptId) generateCode('Employee', selectedDeptId) }} disabled={!selectedDeptId || inviteLoading || departments.length === 0} style={{ width: '100%', height: 48, background: '#F97316', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: '0.9375rem', cursor: (!selectedDeptId || departments.length === 0) ? 'not-allowed' : 'pointer', opacity: (!selectedDeptId || departments.length === 0) ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {inviteLoading && <Spinner size={14} />} Generate Invite Code
                  </button>
              }
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Add Department */}
      {addModal && (
        <ModalOverlay onClose={() => setAddModal(false)}>
          <ModalBox>
            <ModalHeader title="Add Department" onClose={() => setAddModal(false)} />
            <label style={modalLabelStyle}>Department Name</label>
            <input autoFocus type="text" placeholder="e.g. Operations" value={deptFormName} onChange={e => setDeptFormName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddDept() }} style={modalInputStyle} />
            <InlineError message={deptError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={ghostBtn} onClick={() => setAddModal(false)}>Cancel</button>
              <button style={primaryBtn(deptLoading)} onClick={handleAddDept} disabled={deptLoading}>
                {deptLoading && <Spinner size={14} />} Add Department
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Edit Department */}
      {editModal && (
        <ModalOverlay onClose={() => setEditModal(null)}>
          <ModalBox>
            <ModalHeader title="Edit Department" onClose={() => setEditModal(null)} />
            <label style={modalLabelStyle}>Department Name</label>
            <input autoFocus type="text" value={deptFormName} onChange={e => setDeptFormName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleEditDept() }} style={modalInputStyle} />
            <InlineError message={deptError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={ghostBtn} onClick={() => setEditModal(null)}>Cancel</button>
              <button style={primaryBtn(deptLoading)} onClick={handleEditDept} disabled={deptLoading}>
                {deptLoading && <Spinner size={14} />} Save Changes
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Delete Department */}
      {deleteModal && (
        <ModalOverlay onClose={() => setDeleteModal(null)}>
          <ModalBox>
            <ModalHeader title="Delete Department" onClose={() => setDeleteModal(null)} />
            <p style={{ fontSize: '0.9375rem', color: '#374151', margin: 0, lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>{deleteModal.name}</strong>? This cannot be undone.
            </p>
            <InlineError message={deptError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button style={ghostBtn} onClick={() => setDeleteModal(null)}>Cancel</button>
              <button style={dangerBtn(deptLoading)} onClick={handleDeleteDept} disabled={deptLoading}>
                {deptLoading && <Spinner size={14} />} Delete
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Edit Department Manager */}
      {editManagerModal && (
        <ModalOverlay onClose={() => { setEditManagerModal(null); setEditManagerSelectedId(''); setEditManagerError('') }}>
          <ModalBox>
            <ModalHeader title="Edit Department Manager" onClose={() => { setEditManagerModal(null); setEditManagerSelectedId(''); setEditManagerError('') }} />
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
              Assign a manager to <strong>{editManagerModal.name}</strong>.
            </p>
            {allCompanyManagers.length === 0
              ? <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', margin: '8px 0 16px' }}>No managers in this company yet.</p>
              : <>
                  <label style={modalLabelStyle}>Manager</label>
                  <div style={{ position: 'relative' }}>
                    <select value={editManagerSelectedId} onChange={e => setEditManagerSelectedId(e.target.value)} style={{ ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer' }}>
                      <option value="">Select a manager</option>
                      {allCompanyManagers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                    <ChevronDown size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </>
            }
            <InlineError message={editManagerError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={ghostBtn} onClick={() => { setEditManagerModal(null); setEditManagerSelectedId(''); setEditManagerError('') }}>Cancel</button>
              <button style={primaryBtn(editManagerLoading)} onClick={handleEditDeptManager} disabled={editManagerLoading || !editManagerSelectedId}>
                {editManagerLoading && <Spinner size={14} />} Save
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Removal overlay */}
      {removalOverlay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '40px 48px', boxShadow: '0 8px 48px rgba(0,0,0,0.18)', maxWidth: '460px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="9" stroke="#EF4444" strokeWidth="2" />
              </svg>
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: '0 0 12px' }}>You have been removed</h2>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 20px' }}>
              You have been removed from <strong style={{ color: '#111827' }}>{removalOverlay.companyName}</strong> by the Owner. Switching you to your other company…
            </p>
            <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#F97316', borderRadius: 2, animation: 'removal-progress 3s linear forwards' }} />
            </div>
            <style>{`@keyframes removal-progress { from { width: 0% } to { width: 100% } }`}</style>
          </div>
        </div>
      )}

    </div>
  )
}
