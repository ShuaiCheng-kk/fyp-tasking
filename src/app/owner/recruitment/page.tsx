'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  Archive, ArchiveRestore, Briefcase, Check, CheckCircle, ChevronLeft, ChevronRight, ClipboardList, Copy, Crown,
  FileText, MoreHorizontal, Pencil, Repeat, Send, Sparkles, Timer, Trash2, UserCheck, UserX,
  X, XCircle, Zap,
} from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import { CandidateRecommendation } from '@/types/AI'
import { JobApplicant, JobPostingPendingApproval, JobPostingSummary } from '@/types/Recruitment'

type Tab = 'jobs' | 'archived' | 'drafts' | 'review'
type Department = { id: string; name: string }

// ─── shared tiny styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E5E7EB',
  borderRadius: 8,
  fontSize: '0.9rem',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#FFFFFF',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 800,
  color: '#6B7280',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const cardShadow = '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)'

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ─── Custom dropdown matching Task modal DropdownField style ─────────────────
function RDrop({ value, options, onChange, placeholder, disabled = false }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) setOpen(false)
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
      <button ref={triggerRef} type="button" disabled={disabled} onClick={handleOpen}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8, background: disabled ? '#F9FAFB' : '#FAFAFA', cursor: canOpen ? 'pointer' : 'default', fontSize: '0.9375rem', color: selected ? '#111827' : '#9CA3AF', fontWeight: selected ? 500 : 400, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', fontFamily: 'inherit' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronRight size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(270deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 9999, maxHeight: 208, overflowY: 'auto', padding: '4px 0' }}>
          {options.map(opt => {
            const isSel = opt.value === value
            return (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: isSel ? '#FFF7ED' : 'transparent', color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    open:             { bg: '#ECFDF5', text: '#047857', label: 'Open' },
    active:           { bg: '#ECFDF5', text: '#047857', label: 'Active' },
    accepted:         { bg: '#ECFDF5', text: '#047857', label: 'Accepted' },
    archived:         { bg: '#F3F4F6', text: '#4B5563', label: 'Archived' },
    inactive:         { bg: '#F3F4F6', text: '#4B5563', label: 'Inactive' },
    closed:           { bg: '#F3F4F6', text: '#4B5563', label: 'Closed' },
    blocked:          { bg: '#FEF2F2', text: '#B91C1C', label: 'Blocked' },
    rejected:         { bg: '#FEF2F2', text: '#B91C1C', label: 'Rejected' },
    pending_approval: { bg: '#FFFBEB', text: '#B45309', label: 'Pending' },
    pending:          { bg: '#FFFBEB', text: '#B45309', label: 'Pending' },
    draft:            { bg: '#EFF6FF', text: '#1D4ED8', label: 'Draft' },
  }
  const c = map[status] ?? { bg: '#F3F4F6', text: '#6B7280', label: status }
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 999, padding: '2px 9px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0, letterSpacing: '0.03em' }}>
      {c.label}
    </span>
  )
}

// ─── page component ───────────────────────────────────────────────────────────

// ─── Time picker matching Shift page style ───────────────────────────────────
function RTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const hNum = parseInt(value.split(':')[0] ?? '9')
  const mNum = parseInt(value.split(':')[1] ?? '0')
  const derivedAmpm: 'AM' | 'PM' = hNum < 12 ? 'AM' : 'PM'
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>(derivedAmpm)

  useEffect(() => { setMeridiem(parseInt(value.split(':')[0]) < 12 ? 'AM' : 'PM') }, [value])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  useEffect(() => {
    if (open && listRef.current) {
      const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
      if (sel) sel.scrollIntoView({ block: 'center' })
    }
  }, [open, meridiem])

  const handleOpen = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const fitsBelow = r.bottom + 216 + 8 <= window.innerHeight
      setPos({ top: fitsBelow ? r.bottom + 4 : r.top - 216 - 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  const displayH = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum
  const displayLabel = `${displayH}:${String(mNum).padStart(2, '0')} ${derivedAmpm}`

  const times = useMemo(() => {
    const res: { value: string; label: string }[] = []
    const startH = meridiem === 'AM' ? 0 : 12
    const endH = meridiem === 'AM' ? 12 : 24
    for (let h = startH; h < endH; h++) {
      for (const m of [0, 30]) {
        const hh = String(h).padStart(2, '0')
        const mm = String(m).padStart(2, '0')
        const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
        res.push({ value: `${hh}:${mm}`, label: `${dh}:${mm}` })
      }
    }
    return res
  }, [meridiem])

  const dropdown = open ? (
    <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 8px 28px rgba(15,23,42,0.14)', display: 'flex', overflow: 'hidden', minWidth: Math.max(pos.width, 148) }}>
      <div ref={listRef} style={{ flex: 1, maxHeight: 192, overflowY: 'auto', padding: '4px 0' }}>
        {times.map(t => {
          const isSel = t.value === value
          return (
            <button key={t.value} type="button" data-selected={isSel ? 'true' : 'false'}
              onClick={() => { onChange(t.value); setOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '7px 16px', textAlign: 'left', border: 'none', background: isSel ? '#FFF7ED' : 'transparent', color: isSel ? '#F97316' : '#0F172A', fontWeight: isSel ? 700 : 400, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t.label}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: 8, borderLeft: '1px solid #E2E8F0' }}>
        {(['AM', 'PM'] as const).map(mp => (
          <button key={mp} type="button" onClick={() => {
            const [ch, cm] = value.split(':').map(Number)
            let newH = ch
            if (mp === 'AM' && ch >= 12) newH = ch - 12
            if (mp === 'PM' && ch < 12) newH = ch + 12
            onChange(`${String(newH).padStart(2, '0')}:${String(cm).padStart(2, '0')}`)
            setMeridiem(mp)
          }} style={{ borderRadius: 7, border: 'none', background: meridiem === mp ? '#F97316' : '#F1F5F9', color: meridiem === mp ? '#FFFFFF' : '#0F172A', fontWeight: 700, fontSize: 12, padding: '7px 10px', cursor: 'pointer', lineHeight: 1, fontFamily: 'inherit' }}>
            {mp}
          </button>
        ))}
      </div>
    </div>
  ) : null

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#FAFAFA', cursor: 'pointer', padding: '10px 12px', fontSize: '0.9375rem', fontWeight: 500, color: '#111827', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}>
        <span style={{ userSelect: 'none' }}>{displayLabel}</span>
        <ChevronRight size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(270deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }} />
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}

export default function OwnerRecruitmentPage() {
  const router = useRouter()

  // auth / company
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')

  // data
  const [departments, setDepartments] = useState<Department[]>([])
  const [livePostings, setLivePostings] = useState<JobPostingSummary[]>([])
  const [drafts, setDrafts] = useState<JobPostingSummary[]>([])
  const [pendingPostings, setPendingPostings] = useState<JobPostingPendingApproval[]>([])
  const [selectedLiveId, setSelectedLiveId] = useState('')
  const [applicants, setApplicants] = useState<JobApplicant[]>([])
  const [recommendations, setRecommendations] = useState<CandidateRecommendation[]>([])

  // ui state
  const [activeTab, setActiveTab] = useState<Tab>('jobs')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')

  // form modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editingDraft, setEditingDraft] = useState(false)
  // wizard step: 'type' | 'ai' | 'form'
  const [wizardStep, setWizardStep] = useState<'type' | 'ai' | 'form'>('type')
  const [formJobType, setFormJobType] = useState<'shift' | 'oneoff'>('oneoff')
  // shared fields
  const [formTitle, setFormTitle] = useState('')
  const [formDeptId, setFormDeptId] = useState('')
  const [formEmpType, setFormEmpType] = useState('casual')
  const [formLocation, setFormLocation] = useState('')
  const [formSalaryAmt, setFormSalaryAmt] = useState('')
  const [formSalaryType, setFormSalaryType] = useState('per hour')
  const [formDescription, setFormDescription] = useState('')
  const [formRequirements, setFormRequirements] = useState('')
  const [formIndustry, setFormIndustry] = useState('')
  const [formCompanyName, setFormCompanyName] = useState('')
  const [formBenefits, setFormBenefits] = useState('')
  const [formOpenings, setFormOpenings] = useState(1)
  const [formExpiryPreset, setFormExpiryPreset] = useState('none')
  const [formExpiresAt, setFormExpiresAt] = useState('')
  // shift-specific
  const [formShiftStart, setFormShiftStart] = useState('09:00')
  const [formShiftEnd, setFormShiftEnd] = useState('17:00')
  const [formBreakStart, setFormBreakStart] = useState('12:00')
  const [formBreakEnd, setFormBreakEnd] = useState('13:00')
  const [formShiftDays, setFormShiftDays] = useState<string[]>([])
  const [formIsRecurring, setFormIsRecurring] = useState(false)
  const [formRecurInterval, setFormRecurInterval] = useState(1)
  const [formRecurUnit, setFormRecurUnit] = useState('week')
  const [formShiftDate, setFormShiftDate] = useState('')
  const [formAssignedEmployeeId, setFormAssignedEmployeeId] = useState('')
  // shift cascade data
  const [shiftDeptEmployees, setShiftDeptEmployees] = useState<{ id: string; full_name: string; shift_start: string; shift_end: string }[]>([])
  const [shiftAvailableDates, setShiftAvailableDates] = useState<{ date: string; start_time: string; end_time: string }[]>([])
  const [shiftDateEmployees, setShiftDateEmployees] = useState<{ id: string; full_name: string; shift_start: string; shift_end: string }[]>([])
  // oneoff-specific
  const [formJobDate, setFormJobDate] = useState('')
  const [formJobEndDate, setFormJobEndDate] = useState('')
  const [formEstHours, setFormEstHours] = useState('')
  const [formUrgency, setFormUrgency] = useState('normal')
  // AI builder
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiPreview, setAiPreview] = useState<null | { title: string; description: string; requirements: string }>(null)
  const [formError, setFormError] = useState('')

  // detail / delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; isDraft?: boolean } | null>(null)
  const [archivedSelected, setArchivedSelected] = useState<Set<string>>(new Set())
  const [selectedArchivedId, setSelectedArchivedId] = useState('')
  const [archivedApplicants, setArchivedApplicants] = useState<JobApplicant[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [selectedPendingId, setSelectedPendingId] = useState('')
  const [jobsSelected, setJobsSelected] = useState<Set<string>>(new Set())

  // job action menu (... button)
  const [jobMenuOpen, setJobMenuOpen] = useState(false)
  const [jobMenuPos, setJobMenuPos] = useState({ top: 0, right: 0 })
  const jobMenuBtnRef = useRef<HTMLButtonElement>(null)
  const jobMenuDropRef = useRef<HTMLDivElement>(null)

  const selectedLive = useMemo(() => livePostings.find(p => p.id === selectedLiveId) ?? null, [livePostings, selectedLiveId])
  const selectedArchived = useMemo(() => livePostings.find(p => p.id === selectedArchivedId) ?? null, [livePostings, selectedArchivedId])
  const selectedDraft = useMemo(() => drafts.find(p => p.id === selectedDraftId) ?? null, [drafts, selectedDraftId])
  const selectedPending = useMemo(() => pendingPostings.find(p => p.id === selectedPendingId) ?? null, [pendingPostings, selectedPendingId])

  // ── data fetching ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async (cid: string, uid: string) => {
    if (!cid || !uid) return
    setLoading(true)
    setError('')
    try {
      const [liveRes, pendingRes, draftsRes, deptRes] = await Promise.all([
        fetch(`/api/recruitment?company_id=${cid}`),
        fetch(`/api/recruitment?company_id=${cid}&resource=pending_approval`),
        fetch(`/api/recruitment?company_id=${cid}&resource=drafts&user_id=${uid}`),
        fetch(`/api/company/departments?company_id=${cid}`),
      ])
      const [liveData, pendingData, draftsData, deptData] = await Promise.all([
        liveRes.json(), pendingRes.json(), draftsRes.json(), deptRes.json(),
      ])
      if (!liveData.success) throw new Error(liveData.message || 'Failed to fetch jobs')
      setLivePostings(liveData.postings ?? [])
      setPendingPostings(pendingData.pendingPostings ?? [])
      setDrafts(draftsData.drafts ?? [])
      if (deptData.success) setDepartments(deptData.departments ?? [])
      setSelectedLiveId(prev => {
        const list = liveData.postings ?? []
        if (prev && list.some((p: JobPostingSummary) => p.id === prev)) return prev
        return ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recruitment data')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchApplicants = useCallback(async (jobId: string) => {
    if (!jobId) { setApplicants([]); return }
    try {
      const res = await fetch(`/api/recruitment?resource=applicants&job_id=${jobId}`)
      const data = await res.json()
      if (data.success) setApplicants(data.applicants ?? [])
    } catch { setApplicants([]) }
  }, [])

  const fetchArchivedApplicants = useCallback(async (jobId: string) => {
    if (!jobId) { setArchivedApplicants([]); return }
    try {
      const res = await fetch(`/api/recruitment?resource=applicants&job_id=${jobId}`)
      const data = await res.json()
      if (data.success) setArchivedApplicants(data.applicants ?? [])
    } catch { setArchivedApplicants([]) }
  }, [])

  // initial auth + load
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let authId = localStorage.getItem('tasking_user_id')
      if (!authId) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) { authId = session.user.id; localStorage.setItem('tasking_user_id', authId) }
      }
      if (!authId) { router.replace('/signin'); return }
      if (cancelled) return

      const meRes = await fetch(`/api/user/me?user_id=${authId}`)
      const meData = await meRes.json()
      if (!meData.success) return
      const uid = meData.user.id
      setInternalUserId(uid)
      if (meData.user?.full_name) setOwnerName(meData.user.full_name)

      const storedCid = localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
      if (!storedCid) return
      setCompanyId(storedCid)

      const currentRes = await fetch(`/api/company/current?user_id=${authId}&company_id=${storedCid}`)
      const currentData = await currentRes.json()
      if (!cancelled && currentData.success) {
        setCompanyName(currentData.company?.name ?? '')
        setCurrentPlan(currentData.company?.plan ?? 'Free')
      }
      if (!cancelled) await fetchAll(storedCid, uid)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchAll])

  useEffect(() => {
    void fetchApplicants(selectedLiveId)
    setRecommendations([])
  }, [selectedLiveId, fetchApplicants])

  useEffect(() => {
    void fetchArchivedApplicants(selectedArchivedId)
  }, [selectedArchivedId, fetchArchivedApplicants])

  useEffect(() => {
    if (!jobMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (jobMenuBtnRef.current?.contains(e.target as Node)) return
      if (jobMenuDropRef.current?.contains(e.target as Node)) return
      setJobMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [jobMenuOpen])

  // ── form helpers ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setEditingId(''); setEditingDraft(false); setWizardStep('type'); setFormJobType('oneoff')
    setFormTitle(''); setFormDeptId(''); setFormEmpType('casual')
    setFormLocation(''); setFormSalaryAmt(''); setFormSalaryType('per hour')
    setFormDescription(''); setFormRequirements(''); setFormIndustry('')
    setFormCompanyName(''); setFormBenefits(''); setFormOpenings(1)
    setFormExpiryPreset('none'); setFormExpiresAt('')
    setFormShiftStart('09:00'); setFormShiftEnd('17:00'); setFormBreakStart('12:00'); setFormBreakEnd('13:00'); setFormShiftDays([])
    setFormIsRecurring(false); setFormRecurInterval(1); setFormRecurUnit('week')
    setFormShiftDate(''); setFormAssignedEmployeeId('')
    setShiftDeptEmployees([]); setShiftAvailableDates([]); setShiftDateEmployees([])
    setFormJobDate(''); setFormJobEndDate(''); setFormEstHours(''); setFormUrgency('normal')
    setAiPrompt(''); setAiPreview(null); setFormError('')
  }

  const openNewForm = () => { resetForm(); setFormOpen(true) }

  const openEditForm = (p: JobPostingSummary, isDraft = false) => {
    setEditingId(p.id); setEditingDraft(isDraft); setWizardStep('form')
    setFormTitle(p.title); setFormDeptId(p.department_id ?? '')
    setFormEmpType(p.employment_type ?? 'casual'); setFormLocation(p.location ?? '')
    setFormSalaryAmt(p.salary_amount?.toString() ?? ''); setFormSalaryType(p.salary_type ?? 'per hour')
    setFormDescription(p.description); setFormRequirements(p.requirements ?? '')
    setFormIndustry(''); setFormCompanyName(companyName); setFormBenefits('')
    setFormOpenings(1); setFormExpiryPreset('none'); setFormExpiresAt('')
    setFormShiftStart('09:00'); setFormShiftEnd('17:00'); setFormBreakStart('12:00'); setFormBreakEnd('13:00'); setFormShiftDays([])
    setFormIsRecurring(false); setFormRecurInterval(1); setFormRecurUnit('week')
    setFormShiftDate(''); setFormAssignedEmployeeId('')
    setShiftDeptEmployees([]); setShiftAvailableDates([]); setShiftDateEmployees([])
    setFormJobDate(''); setFormJobEndDate(''); setFormEstHours(''); setFormUrgency('normal')
    setAiPrompt(''); setAiPreview(null); setFormError(''); setFormOpen(true)
  }

  const buildBody = (status: 'open' | 'draft') => ({
    company_id: companyId,
    department_id: formDeptId || null,
    created_by: internalUserId,
    title: formTitle,
    description: formDescription,
    requirements: formRequirements || null,
    location: formLocation || null,
    employment_type: formEmpType || null,
    company_name: formCompanyName || companyName || null,
    salary_amount: formSalaryAmt ? Number(formSalaryAmt) : null,
    salary_type: formSalaryType || 'per hour',
    status,
  })

  const saveForm = async (status: 'open' | 'draft') => {
    if (!companyId || !internalUserId) return
    if (!formTitle.trim()) { setFormError('Title is required'); return }
    if (status === 'open' && !formDescription.trim()) { setFormError('Description is required to publish'); return }
    setActionLoading(true); setFormError('')
    try {
      const body = buildBody(status)
      let res: Response
      if (editingId) {
        res = await fetch('/api/recruitment', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, action: 'edit_posting', job_id: editingId }),
        })
        // if publishing a draft, also flip its status
        if (status === 'open' && editingDraft) {
          await fetch('/api/recruitment', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'publish_draft', job_id: editingId }),
          })
        }
      } else {
        res = await fetch('/api/recruitment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save job')
      setFormOpen(false); resetForm()
      await fetchAll(companyId, internalUserId)
      if (status === 'open') setActiveTab('jobs')
      else setActiveTab('drafts')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save job')
    } finally { setActionLoading(false) }
  }

  const generateJobDescription = async () => {
    if (!formTitle.trim()) { setFormError('Add a title before generating.'); return }
    setAiLoading(true); setFormError('')
    try {
      const deptName = departments.find(d => d.id === formDeptId)?.name ?? null
      const res = await fetch('/api/ai/job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle, company_name: companyName, department_name: deptName,
          location: formLocation, employment_type: formEmpType,
          pay: formSalaryAmt ? `${formSalaryAmt} ${formSalaryType}` : null,
          notes: formRequirements || formDescription || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to generate description')
      const draft = data.draft
      setFormTitle(draft.title || formTitle)
      setFormDescription(draft.description || formDescription)
      setFormRequirements([
        ...(draft.requirements ?? []),
        ...(draft.responsibilities ?? []).map((i: string) => `Responsibility: ${i}`),
        ...(draft.screening_questions ?? []).map((i: string) => `Screening: ${i}`),
      ].join('\n'))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to generate description')
    } finally { setAiLoading(false) }
  }

  // ── posting actions ──────────────────────────────────────────────────────────

  const runPostingAction = async (action: 'archive_posting' | 'duplicate_posting' | 'close_posting' | 'expire_posting' | 'reopen_posting', jobId?: string) => {
    const id = jobId ?? selectedLiveId
    if (!id) return
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, job_id: id, created_by: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed')
      await fetchAll(companyId, internalUserId)
      if (data.posting?.id) setSelectedLiveId(data.posting.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job')
    } finally { setActionLoading(false) }
  }

  const decideApplicant = async (applicantId: string, decision: 'accepted' | 'rejected') => {
    if (!internalUserId) return
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide_applicant', applicant_id: applicantId, decision, decided_by: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update applicant')
      await Promise.all([fetchApplicants(selectedLiveId), fetchAll(companyId, internalUserId)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update applicant')
    } finally { setActionLoading(false) }
  }

  const decidePosting = async (jobId: string, decision: 'approve_posting' | 'reject_posting') => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision, job_id: jobId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update posting')
      setSelectedPendingId('')
      await fetchAll(companyId, internalUserId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update posting')
    } finally { setActionLoading(false) }
  }

  const deleteDraft = async (id: string, isDraft = true) => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isDraft ? 'delete_draft' : 'delete_posting', job_id: id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete')
      setDeleteConfirm(null)
      setSelectedLiveId('')
      setSelectedArchivedId('')
      setSelectedDraftId('')
      await fetchAll(companyId, internalUserId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally { setActionLoading(false) }
  }

  const deleteArchivedSelected = async () => {
    if (archivedSelected.size === 0) return
    setActionLoading(true); setError('')
    try {
      await Promise.all([...archivedSelected].map(id =>
        fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_posting', job_id: id }),
        })
      ))
      setArchivedSelected(new Set())
      await fetchAll(companyId, internalUserId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally { setActionLoading(false) }
  }

  const unarchiveArchivedSelected = async () => {
    if (archivedSelected.size === 0) return
    setActionLoading(true); setError('')
    try {
      await Promise.all([...archivedSelected].map(id =>
        fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unarchive_posting', job_id: id }),
        })
      ))
      setArchivedSelected(new Set())
      await fetchAll(companyId, internalUserId)
      setActiveTab('jobs')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unarchive')
    } finally { setActionLoading(false) }
  }

  const archiveJobsSelected = async () => {
    if (jobsSelected.size === 0) return
    setActionLoading(true); setError('')
    try {
      await Promise.all([...jobsSelected].map(id =>
        fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive_posting', job_id: id }),
        })
      ))
      setJobsSelected(new Set())
      setSelectedLiveId('')
      await fetchAll(companyId, internalUserId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive')
    } finally { setActionLoading(false) }
  }

  const deleteJobsSelected = async () => {
    if (jobsSelected.size === 0) return
    setActionLoading(true); setError('')
    try {
      await Promise.all([...jobsSelected].map(id =>
        fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_posting', job_id: id }),
        })
      ))
      setJobsSelected(new Set())
      setSelectedLiveId('')
      await fetchAll(companyId, internalUserId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally { setActionLoading(false) }
  }

  const publishDraft = async (id: string) => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish_draft', job_id: id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to publish draft')
      setSelectedDraftId('')
      await fetchAll(companyId, internalUserId)
      setActiveTab('jobs')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish draft')
    } finally { setActionLoading(false) }
  }

  const recommendCandidates = async () => {
    if (!selectedLiveId) return
    setAiLoading(true); setError('')
    try {
      const res = await fetch(`/api/ai/candidates?job_id=${selectedLiveId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to recommend candidates')
      setRecommendations(data.recommendations ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recommend candidates')
    } finally { setAiLoading(false) }
  }

  // ── derived lists ────────────────────────────────────────────────────────────

  const openPostings    = useMemo(() => livePostings.filter(p => p.status === 'open'),     [livePostings])
  const closedPostings  = useMemo(() => livePostings.filter(p => p.status === 'closed'),   [livePostings])
  const expiredPostings = useMemo(() => livePostings.filter(p => p.status === 'expired'),  [livePostings])
  const jobsPostings    = useMemo(() => livePostings.filter(p => ['open','closed','expired'].includes(p.status)), [livePostings])
  const archivedPostings = useMemo(() => livePostings.filter(p => p.status === 'archived'), [livePostings])

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', scrollbarGutter: 'stable' }}>

        {/* ── Page header (keep untouched) ── */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Recruitment
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {ownerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#0F172A', color: '#FFFFFF', flexShrink: 0 }}>
                  <Crown size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ownerName}</span>
              </div>
            )}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* ── Card wrapper (tab bar + content) ── */}
        <div style={{ padding: '0 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Tab bar ── */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {([
              { key: 'jobs' as Tab,     label: 'Jobs',    Icon: Briefcase    },
              { key: 'archived' as Tab, label: 'Archived', Icon: Archive     },
              { key: 'drafts' as Tab,   label: 'Drafts',   Icon: FileText    },
              { key: 'review' as Tab,   label: 'Review',   Icon: ClipboardList },
            ]).map(tab => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedArchivedId(''); setArchivedSelected(new Set()); setSelectedDraftId(''); setSelectedPendingId(''); setJobsSelected(new Set()) }}
                  style={{
                    padding: '5px 13px', borderRadius: '99px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                    border: active ? '2px solid #F97316' : '1.5px solid #E5E7EB',
                    background: active ? '#F97316' : 'transparent',
                    color: active ? '#FFFFFF' : '#374151',
                    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  }}
                >
                  <tab.Icon size={13} />
                  {tab.label}
                </button>
              )
            })}
          </div>
          <button
            onClick={activeTab === 'review' ? () => {} : activeTab === 'archived' ? undefined : openNewForm}
            style={{
              height: 36, padding: '0 16px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 9,
              cursor: activeTab === 'archived' ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, flexShrink: 0,
              visibility: activeTab === 'archived' ? 'hidden' : 'visible',
            }}
            onMouseEnter={e => { if (activeTab !== 'archived') e.currentTarget.style.background = '#EA580C' }}
            onMouseLeave={e => { if (activeTab !== 'archived') e.currentTarget.style.background = '#F97316' }}
          >
            <Sparkles size={14} /> {activeTab === 'review' ? 'AI Review All' : 'AI Post Job'}
          </button>
        </div>

        {/* ── Tab content ── */}
        <div style={{ padding: '16px 20px 20px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {error && (
            <div style={{ marginBottom: 12, padding: '11px 14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.84rem', fontWeight: 600 }}>{error}</div>
          )}

          {/* ══ JOBS tab (Open / Closed / Expired) ════════════════════════════ */}
          {activeTab === 'jobs' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

              {/* Left: job list */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Briefcase size={15} style={{ color: '#F97316' }} />
                  </div>
                  <span className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px', flex: 1 }}>All Jobs</span>
                  {jobsSelected.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={archiveJobsSelected}
                        disabled={actionLoading}
                        title={`Archive ${jobsSelected.size} selected`}
                        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #FED7AA', background: '#FFF7ED', color: '#EA580C', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                        onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FFEDD5' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FFF7ED' }}
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={deleteJobsSelected}
                        disabled={actionLoading}
                        title={`Delete ${jobsSelected.size} selected`}
                        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                        onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                      >
                        {actionLoading ? <Spinner size={12} dark /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  )}
                </div>
                {loading ? (
                  <div style={{ padding: '24px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Spinner size={14} dark /> Loading...
                  </div>
                ) : jobsPostings.length === 0 ? (
                  <div style={{ margin: '12px 14px', padding: '28px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <Briefcase size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No job postings yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px' }}>
                  {jobsPostings.map(p => {
                  const isSelected = selectedLiveId === p.id
                  const checked = jobsSelected.has(p.id)
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedLiveId(p.id)}
                      style={{
                        border: (isSelected || checked) ? '2px solid #F97316' : '1.5px solid #E5E7EB',
                        borderRadius: 14,
                        padding: '14px 14px 12px',
                        background: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        boxShadow: (isSelected || checked) ? '0 0 0 3px rgba(249,115,22,0.10)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.12s, box-shadow 0.12s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                        <strong style={{ fontSize: '0.875rem', color: '#1C1C1E', lineHeight: 1.4, flex: 1, minWidth: 0 }}>{p.title}</strong>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setJobsSelected(prev => { const s = new Set(prev); checked ? s.delete(p.id) : s.add(p.id); return s }) }}
                          style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: checked ? '2px solid #F97316' : '1.5px solid #D1D5DB', background: checked ? '#F97316' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        >
                          {checked && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '0.725rem', color: '#C4C9D4' }}>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  )
                  })}
                  </div>
                )}
              </div>

              {/* Right: posting detail + applicants */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden' }}>
                {!selectedLive ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 24px' }}>
                    <div style={{ padding: '40px 48px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, width: '100%' }}>
                      <ClipboardList size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Select a job posting</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Posting header */}
                    <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: 700, lineHeight: 1.3 }}>{selectedLive.title}</h2>
                          {statusBadge(selectedLive.status)}
                        </div>
                        <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.8375rem' }}>
                          {[selectedLive.department_name ?? 'Any department', selectedLive.location, selectedLive.employment_type].filter(Boolean).join(' · ')}
                          {selectedLive.salary_amount ? ` · $${selectedLive.salary_amount} ${selectedLive.salary_type ?? ''}` : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        <button
                          ref={jobMenuBtnRef}
                          onClick={e => {
                            e.stopPropagation()
                            if (!jobMenuOpen) {
                              const r = e.currentTarget.getBoundingClientRect()
                              setJobMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                            }
                            setJobMenuOpen(o => !o)
                          }}
                          style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#374151', flexShrink: 0 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ padding: '16px 24px 0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {[
                          { label: 'Pay', value: selectedLive.salary_amount ? `$${selectedLive.salary_amount} ${selectedLive.salary_type ?? ''}` : '—' },
                          { label: 'Pending', value: selectedLive.pending_count },
                          { label: 'Total Applicants', value: selectedLive.applicant_count },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ padding: '11px 14px', background: '#F7F8FA', borderRadius: 10 }}>
                            <span style={labelStyle}>{label}</span>
                            <strong style={{ fontSize: '1.1rem', color: '#111827' }}>{value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Description */}
                      <div>
                        <span style={labelStyle}>Description</span>
                        <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem' }}>{selectedLive.description}</p>
                      </div>
                      {selectedLive.requirements && (
                        <div>
                          <span style={labelStyle}>Requirements</span>
                          <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{selectedLive.requirements}</p>
                        </div>
                      )}

                      {/* Applicants */}
                      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={labelStyle}>Applicants ({applicants.length})</span>
                          <button
                            onClick={recommendCandidates}
                            disabled={aiLoading || applicants.length === 0}
                            style={{ border: 'none', borderRadius: 7, background: '#111827', color: '#FFFFFF', padding: '6px 14px', display: 'flex', gap: 6, alignItems: 'center', cursor: aiLoading || applicants.length === 0 ? 'default' : 'pointer', opacity: aiLoading || applicants.length === 0 ? 0.5 : 1, fontSize: '0.775rem', fontWeight: 700 }}
                          >
                            {aiLoading ? <Spinner size={12} /> : <Sparkles size={12} />} AI Recommend
                          </button>
                        </div>

                        {applicants.length === 0 ? (
                          <div style={{ padding: '20px 16px', color: '#9CA3AF', background: '#F7F8FA', borderRadius: 10, textAlign: 'center', fontSize: '0.875rem' }}>No applicants yet.</div>
                        ) : applicants.map(applicant => {
                          const rec = recommendations.find(r => r.applicant_id === applicant.id)
                          return (
                            <div key={applicant.id} style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 12, background: '#FFFFFF' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}>
                                    {applicant.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                                  </div>
                                  <strong style={{ color: '#111827', fontSize: '0.9rem' }}>{applicant.full_name}</strong>
                                </div>
                                <p style={{ margin: '2px 0 0 36px', color: '#9CA3AF', fontSize: '0.775rem' }}>{applicant.email_address}</p>
                                {applicant.cover_letter && (
                                  <p style={{ margin: '8px 0 0', color: '#4B5563', fontSize: '0.8125rem', lineHeight: 1.5 }}>{applicant.cover_letter}</p>
                                )}
                                {rec && (
                                  <div style={{ marginTop: 10, padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: '0.78rem', lineHeight: 1.5 }}>
                                    <strong style={{ color: '#059669' }}>AI Score: {rec.score}/100 — {rec.recommendation}</strong>
                                    <p style={{ margin: '4px 0 0', color: '#374151' }}>{rec.reasons[0] ?? rec.suggested_next_step}</p>
                                    {rec.risks[0] && <p style={{ margin: '3px 0 0', color: '#B45309' }}>{rec.risks[0]}</p>}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                                {statusBadge(applicant.status)}
                                {applicant.status === 'pending' && (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => decideApplicant(applicant.id, 'accepted')} disabled={actionLoading}
                                      style={{ border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '6px 10px', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', fontSize: '0.775rem', fontWeight: 600 }}
                                    ><UserCheck size={13} /> Accept</button>
                                    <button onClick={() => decideApplicant(applicant.id, 'rejected')} disabled={actionLoading}
                                      style={{ border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '6px 10px', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', fontSize: '0.775rem', fontWeight: 600 }}
                                    ><UserX size={13} /> Reject</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ ARCHIVED tab ══════════════════════════════════════════════════ */}
          {activeTab === 'archived' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

              {/* Left: archived list */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Archive size={15} style={{ color: '#F97316' }} />
                  </div>
                  <span className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px', flex: 1 }}>Archived Jobs</span>
                  {archivedSelected.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={unarchiveArchivedSelected}
                        disabled={actionLoading}
                        title={`Unarchive ${archivedSelected.size} selected`}
                        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#059669', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                        onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#DCFCE7' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F0FDF4' }}
                      >
                        <ArchiveRestore size={14} />
                      </button>
                      <button
                        onClick={deleteArchivedSelected}
                        disabled={actionLoading}
                        title={`Delete ${archivedSelected.size} selected`}
                        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                        onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                      >
                        {actionLoading ? <Spinner size={12} dark /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  )}
                </div>
                {loading ? (
                  <div style={{ padding: '24px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Spinner size={14} dark /> Loading...
                  </div>
                ) : archivedPostings.length === 0 ? (
                  <div style={{ margin: '12px 14px', padding: '28px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <Archive size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No archived postings.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px' }}>
                  {archivedPostings.map(p => {
                  const isSelected = selectedArchivedId === p.id
                  const checked = archivedSelected.has(p.id)
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedArchivedId(p.id)}
                      style={{
                        border: (isSelected || checked) ? '2px solid #F97316' : '1.5px solid #E5E7EB',
                        borderRadius: 14,
                        padding: '14px 14px 12px',
                        background: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        boxShadow: (isSelected || checked) ? '0 0 0 3px rgba(249,115,22,0.10)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.12s, box-shadow 0.12s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                        <strong style={{ fontSize: '0.875rem', color: '#1C1C1E', lineHeight: 1.4, flex: 1, minWidth: 0 }}>{p.title}</strong>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setArchivedSelected(prev => { const s = new Set(prev); checked ? s.delete(p.id) : s.add(p.id); return s }) }}
                          style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: checked ? '2px solid #F97316' : '1.5px solid #D1D5DB', background: checked ? '#F97316' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        >
                          {checked && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '0.725rem', color: '#C4C9D4' }}>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  )
                  })}
                  </div>
                )}
              </div>

              {/* Right: archived detail (view-only) */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden' }}>
                {!selectedArchived ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 24px' }}>
                    <div style={{ padding: '40px 48px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, width: '100%' }}>
                      <Archive size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Select an archived job</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Job fields */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {selectedArchived.employment_type && (
                          <div style={{ padding: '11px 14px', background: '#F7F8FA', borderRadius: 10 }}>
                            <span style={labelStyle}>Employment Type</span>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#111827', fontWeight: 600 }}>{selectedArchived.employment_type}</p>
                          </div>
                        )}
                        {selectedArchived.location && (
                          <div style={{ padding: '11px 14px', background: '#F7F8FA', borderRadius: 10 }}>
                            <span style={labelStyle}>Location</span>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#111827', fontWeight: 600 }}>{selectedArchived.location}</p>
                          </div>
                        )}
                        {selectedArchived.salary_amount && (
                          <div style={{ padding: '11px 14px', background: '#F7F8FA', borderRadius: 10 }}>
                            <span style={labelStyle}>Pay</span>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#111827', fontWeight: 600 }}>${selectedArchived.salary_amount} {selectedArchived.salary_type ?? ''}</p>
                          </div>
                        )}
                        {selectedArchived.department_name && (
                          <div style={{ padding: '11px 14px', background: '#F7F8FA', borderRadius: 10 }}>
                            <span style={labelStyle}>Department</span>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#111827', fontWeight: 600 }}>{selectedArchived.department_name}</p>
                          </div>
                        )}
                      </div>
                      {selectedArchived.description && (
                        <div>
                          <span style={labelStyle}>Description</span>
                          <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem' }}>{selectedArchived.description}</p>
                        </div>
                      )}
                      {selectedArchived.requirements && (
                        <div>
                          <span style={labelStyle}>Requirements</span>
                          <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{selectedArchived.requirements}</p>
                        </div>
                      )}

                      {/* Applicants — view only, no accept/reject */}
                      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
                        <span style={labelStyle}>Applicants ({archivedApplicants.length})</span>
                        {archivedApplicants.length === 0 ? (
                          <div style={{ marginTop: 10, padding: '20px 16px', color: '#9CA3AF', background: '#F7F8FA', borderRadius: 10, textAlign: 'center', fontSize: '0.875rem' }}>No applicants.</div>
                        ) : archivedApplicants.map(applicant => (
                          <div key={applicant.id} style={{ marginTop: 10, padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, display: 'flex', justifyContent: 'space-between', gap: 12, background: '#FFFFFF' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}>
                                  {applicant.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                                </div>
                                <strong style={{ color: '#111827', fontSize: '0.9rem' }}>{applicant.full_name}</strong>
                              </div>
                              <p style={{ margin: '2px 0 0 36px', color: '#9CA3AF', fontSize: '0.775rem' }}>{applicant.email_address}</p>
                              {applicant.cover_letter && (
                                <p style={{ margin: '8px 0 0', color: '#4B5563', fontSize: '0.8125rem', lineHeight: 1.5 }}>{applicant.cover_letter}</p>
                              )}
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              {statusBadge(applicant.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ REVIEW tab ════════════════════════════════════════════════════ */}
          {activeTab === 'review' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

              {/* Left: pending list */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ClipboardList size={15} style={{ color: '#F97316' }} />
                  </div>
                  <span className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px', flex: 1 }}>Review Jobs</span>
                </div>
                {loading ? (
                  <div style={{ padding: '24px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Spinner size={14} dark /> Loading...
                  </div>
                ) : pendingPostings.length === 0 ? (
                  <div style={{ margin: '12px 14px', padding: '28px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <CheckCircle size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>All caught up.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px' }}>
                  {pendingPostings.map(p => {
                  const isSelected = selectedPendingId === p.id
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPendingId(p.id)}
                      style={{
                        border: isSelected ? '2px solid #F97316' : '1.5px solid #E5E7EB',
                        borderRadius: 14,
                        padding: '14px 14px 12px',
                        background: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 0 3px rgba(249,115,22,0.10)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.12s, box-shadow 0.12s',
                      }}
                    >
                      <strong style={{ fontSize: '0.875rem', color: '#1C1C1E', lineHeight: 1.4, display: 'block', marginBottom: 8 }}>{p.title}</strong>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '0.725rem', color: '#C4C9D4' }}>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  )
                  })}
                  </div>
                )}
              </div>

              {/* Right: pending detail */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden' }}>
                {!selectedPending ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 24px' }}>
                    <div style={{ padding: '40px 48px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, width: '100%' }}>
                      <ClipboardList size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Select a posting to review</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: 700, lineHeight: 1.3 }}>{selectedPending.title}</h2>
                          {statusBadge('pending_approval')}
                        </div>
                        <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.8375rem' }}>
                          {[selectedPending.department_name ?? 'Any department', selectedPending.employment_type].filter(Boolean).join(' · ')}
                          {' · '}Submitted by <strong style={{ color: '#374151' }}>{selectedPending.submitter_name ?? 'Manager'}</strong>
                          {' · '}{new Date(selectedPending.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        <button
                          onClick={() => decidePosting(selectedPending.id, 'approve_posting')}
                          disabled={actionLoading}
                          style={{ height: 34, padding: '0 14px', border: 'none', borderRadius: 9, background: '#059669', color: '#FFFFFF', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, opacity: actionLoading ? 0.6 : 1 }}
                        ><CheckCircle size={13} /> Approve</button>
                        <button
                          onClick={() => decidePosting(selectedPending.id, 'reject_posting')}
                          disabled={actionLoading}
                          style={{ height: 34, padding: '0 14px', border: 'none', borderRadius: 9, background: '#DC2626', color: '#FFFFFF', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, opacity: actionLoading ? 0.6 : 1 }}
                        ><XCircle size={13} /> Reject</button>
                      </div>
                    </div>
                    <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {selectedPending.description && (
                        <div>
                          <span style={labelStyle}>Description</span>
                          <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem' }}>{selectedPending.description}</p>
                        </div>
                      )}
                      {selectedPending.requirements && (
                        <div>
                          <span style={labelStyle}>Requirements</span>
                          <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{selectedPending.requirements}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ DRAFTS tab ════════════════════════════════════════════════════ */}
          {activeTab === 'drafts' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

              {/* Left: draft list */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={15} style={{ color: '#F97316' }} />
                  </div>
                  <span className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px', flex: 1 }}>Draft Jobs</span>
                </div>
                {loading ? (
                  <div style={{ padding: '24px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Spinner size={14} dark /> Loading...
                  </div>
                ) : drafts.length === 0 ? (
                  <div style={{ margin: '12px 14px', padding: '28px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <FileText size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No drafts saved.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px' }}>
                  {drafts.map(p => {
                  const isSelected = selectedDraftId === p.id
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedDraftId(p.id)}
                      style={{
                        border: isSelected ? '2px solid #F97316' : '1.5px solid #E5E7EB',
                        borderRadius: 14,
                        padding: '14px 14px 12px',
                        background: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 0 3px rgba(249,115,22,0.10)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.12s, box-shadow 0.12s',
                      }}
                    >
                      <strong style={{ fontSize: '0.875rem', color: '#1C1C1E', lineHeight: 1.4, display: 'block', marginBottom: 8 }}>{p.title}</strong>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '0.725rem', color: '#C4C9D4' }}>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  )
                  })}
                  </div>
                )}
              </div>

              {/* Right: draft detail */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden' }}>
                {!selectedDraft ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 24px' }}>
                    <div style={{ padding: '40px 48px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, width: '100%' }}>
                      <FileText size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Select a draft</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: 700, lineHeight: 1.3 }}>{selectedDraft.title}</h2>
                          {statusBadge('draft')}
                        </div>
                        <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.8375rem' }}>
                          {[selectedDraft.department_name ?? 'Any department', selectedDraft.location, selectedDraft.employment_type].filter(Boolean).join(' · ')}
                          {selectedDraft.salary_amount ? ` · $${selectedDraft.salary_amount} ${selectedDraft.salary_type ?? ''}` : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        <button
                          onClick={() => openEditForm(selectedDraft, true)}
                          style={{ height: 34, padding: '0 14px', border: '1.5px solid #E5E7EB', borderRadius: 9, background: '#FFFFFF', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                        ><Pencil size={13} /> Edit</button>
                        <button
                          onClick={() => publishDraft(selectedDraft.id)}
                          disabled={actionLoading || !selectedDraft.description?.trim()}
                          title={!selectedDraft.description?.trim() ? 'Add a description before publishing' : undefined}
                          style={{ height: 34, padding: '0 14px', border: 'none', borderRadius: 9, background: '#111827', color: '#FFFFFF', cursor: actionLoading || !selectedDraft.description?.trim() ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, opacity: actionLoading || !selectedDraft.description?.trim() ? 0.5 : 1 }}
                        ><Send size={13} /> Publish</button>
                        <button
                          onClick={() => setDeleteConfirm({ id: selectedDraft.id, title: selectedDraft.title, isDraft: true })}
                          disabled={actionLoading}
                          title="Delete draft"
                          style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', flexShrink: 0 }}
                          onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                        ><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {selectedDraft.description ? (
                        <div>
                          <span style={labelStyle}>Description</span>
                          <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem' }}>{selectedDraft.description}</p>
                        </div>
                      ) : (
                        <div style={{ padding: '20px 16px', color: '#9CA3AF', background: '#F7F8FA', borderRadius: 10, textAlign: 'center', fontSize: '0.875rem' }}>
                          No description yet. Click <strong style={{ color: '#111827' }}>Edit</strong> to add one before publishing.
                        </div>
                      )}
                      {selectedDraft.requirements && (
                        <div>
                          <span style={labelStyle}>Requirements</span>
                          <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{selectedDraft.requirements}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
        </div>
        </div>
      </main>

      {/* ══ Post Job / Edit modal — 3-step wizard ═════════════════════════════ */}
      {formOpen && (() => {
        const WIZARD_STEPS = ['type', 'ai', 'form'] as const
        const displayStep = wizardStep === 'form' ? 'ai' : wizardStep
        const stepIdx = WIZARD_STEPS.indexOf(displayStep)
        const modalTitle = editingId
          ? (editingDraft ? 'Edit Draft' : 'Edit Job Posting')
          : wizardStep === 'type' ? 'Choose Job Type'
          : 'Complete Job Description'

        const EXPIRY_PRESETS = [
          { value: 'none', label: 'No expiry' }, { value: '7d', label: '7 days' },
          { value: '14d', label: '14 days' },   { value: '30d', label: '30 days' },
          { value: '60d', label: '60 days' },   { value: 'custom', label: 'Custom date' },
        ]
        const addDaysLocal = (n: number) => {
          const d = new Date(); d.setDate(d.getDate() + n)
          return d.toISOString().split('T')[0]
        }
        const handleExpiryPreset = (v: string) => {
          setFormExpiryPreset(v)
          if (v === '7d')  setFormExpiresAt(addDaysLocal(7))
          if (v === '14d') setFormExpiresAt(addDaysLocal(14))
          if (v === '30d') setFormExpiresAt(addDaysLocal(30))
          if (v === '60d') setFormExpiresAt(addDaysLocal(60))
          if (v === 'none' || v === 'custom') setFormExpiresAt('')
        }

        const handleAIGenerate = async () => {
          if (!aiPrompt.trim()) return
          setAiLoading(true)
          try {
            const res = await fetch('/api/ai/job-description', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: aiPrompt, company_name: companyName }),
            })
            const data = await res.json()
            if (data.success && data.draft) {
              const draft = data.draft
              setAiPreview({ title: draft.title || aiPrompt, description: draft.description || '', requirements: [...(draft.requirements ?? []), ...(draft.responsibilities ?? []).map((i: string) => `Responsibility: ${i}`), ...(draft.screening_questions ?? []).map((i: string) => `Screening: ${i}`)].join('\n') })
            }
          } catch { /* silent */ }
          finally { setAiLoading(false) }
        }

        const handleUseAIDraft = () => {
          if (!aiPreview) return
          setFormTitle(aiPreview.title)
          setFormDescription(aiPreview.description)
          setFormRequirements(aiPreview.requirements)
          setAiPreview(null)
          setWizardStep('form')
        }

        const iStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9375rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FAFAFA', fontFamily: 'inherit', display: 'block' }
        const lStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 8 }
        const sectionLabel: React.CSSProperties = { margin: '4px 0 0', color: '#374151', fontSize: '0.875rem', fontWeight: 600 }
        const divider: React.CSSProperties = { borderTop: '1px dashed #E5E7EB', margin: '0' }

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 540, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

              {/* Header */}
              <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {!editingId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {(['type', 'ai', 'form'] as const).map((s, i) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: displayStep === s ? '#F97316' : stepIdx > i ? '#FFF7ED' : '#F3F4F6', color: displayStep === s ? '#FFF' : stepIdx > i ? '#C2410C' : '#9CA3AF', flexShrink: 0 }}>
                          {stepIdx > i ? <Check size={11} /> : i + 1}
                        </div>
                        {displayStep === s && (
                          <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>
                            {s === 'type' ? 'Job Type' : s === 'ai' ? 'Job Description' : 'Job Posted'}
                          </span>
                        )}
                        {i < 2 && <div style={{ width: 16, height: 1.5, background: '#E5E7EB', margin: '0 1px' }} />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>{modalTitle}</h2>
                )}
                <button onClick={() => { setFormOpen(false); resetForm() }} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: 6, borderRadius: 8, flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable body */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Back + Save Draft row */}
                {wizardStep !== 'type' && !editingId && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={() => setWizardStep('type')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontWeight: 600, fontSize: '0.8125rem', padding: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#111827' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#6B7280' }}>
                      <ChevronLeft size={15} />
                      Back
                    </button>
                    {wizardStep === 'form' && (
                      <button onClick={() => saveForm('draft')} disabled={actionLoading}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF', color: '#111827', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}>
                        {actionLoading ? <Spinner size={13} dark /> : <FileText size={13} />} Save Draft
                      </button>
                    )}
                  </div>
                )}

                {/* ── Step 1: Job Type ── */}
                {wizardStep === 'type' && (
                  <>
                    <button onClick={() => { setFormJobType('shift'); setFormEmpType('part-time'); setFormSalaryType('per hour'); setWizardStep('ai') }}
                      style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 12, background: '#FFFFFF', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#FFFBF7' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#FFFFFF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Repeat size={17} color="#F97316" />
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', margin: '0 0 2px' }}>Shift Job</p>
                          <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>Fixed schedule with a defined start and end time.</p>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => { setFormJobType('oneoff'); setFormEmpType('casual'); setFormSalaryType('flat rate'); setWizardStep('ai') }}
                      style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 12, background: '#FFFFFF', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#FFFBF7' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#FFFFFF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Zap size={17} color="#F97316" />
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', margin: '0 0 2px' }}>One-off Job</p>
                          <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>Complete a specific task with a fixed start time.</p>
                        </div>
                      </div>
                    </button>
                  </>
                )}

                {/* ── Step 2: AI Builder ── */}
                {wizardStep === 'ai' && (
                  <>
                    {aiPreview ? (
                      <>
                        <div style={{ background: '#FFFBF7', border: '1.5px solid #FED7AA', borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Sparkles size={14} color="#F97316" />
                            <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#C2410C' }}>AI Draft Ready</span>
                            <span style={{ fontSize: '0.78rem', color: '#9CA3AF', marginLeft: 'auto' }}>Review before posting</span>
                          </div>
                          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', margin: '0 0 4px' }}>{aiPreview.title}</p>
                          <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, lineHeight: 1.6 }}>{aiPreview.description.slice(0, 200)}{aiPreview.description.length > 200 ? '…' : ''}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => setAiPreview(null)} style={{ flex: 1, padding: 10, background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: 'pointer' }}>← Regenerate</button>
                          <button onClick={handleUseAIDraft} style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                            <FileText size={14} /> Use This Draft
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ background: '#FFFBF7', border: '1.5px solid #FED7AA', borderRadius: 12, padding: '16px 18px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 10 }}>
                            <Sparkles size={14} color="#F97316" /> AI Job Description Builder
                          </label>
                          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                            rows={5} style={{ ...iStyle, background: '#FFFFFF', border: '1.5px solid #E5E7EB', resize: 'none' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <button onClick={() => { setAiPreview(null); setWizardStep('form') }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF', color: '#111827', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            Fill Manually
                          </button>
                          <button onClick={handleAIGenerate} disabled={!aiPrompt.trim() || aiLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: !aiPrompt.trim() || aiLoading ? '#9CA3AF' : '#F97316', color: '#FFFFFF', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: !aiPrompt.trim() || aiLoading ? 'default' : 'pointer' }}>
                            {aiLoading ? <><Spinner size={13} /> Generating…</> : <><Sparkles size={13} /> Generate</>}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ── Step 3: Details form — single flat flex column so gap is identical everywhere ── */}
                {wizardStep === 'form' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={lStyle}>Job Title <span style={{ color: '#F97316' }}>*</span></label>
                      <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder={formJobType === 'shift' ? 'e.g. Weekend Cashier' : 'e.g. Event Setup Crew'} style={iStyle} />
                    </div>
                    <div>
                      <label style={lStyle}>{formJobType === 'shift' ? 'Job Scope' : 'Description'} <span style={{ color: '#F97316' }}>*</span></label>
                      <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={1} style={{ ...iStyle, resize: 'vertical', lineHeight: 1.55, verticalAlign: 'top' }} placeholder="Describe the role, responsibilities, and expectations…" />
                    </div>
                    <div>
                      <label style={lStyle}>Requirements</label>
                      <textarea value={formRequirements} onChange={e => setFormRequirements(e.target.value)} rows={1} style={{ ...iStyle, resize: 'vertical', lineHeight: 1.55, verticalAlign: 'top' }} placeholder="e.g. Must be available weekends, physically fit…" />
                    </div>
                    {formJobType === 'oneoff' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div><label style={lStyle}>Est. Hours</label><input value={formEstHours} onChange={e => setFormEstHours(e.target.value)} placeholder="e.g. 4–6 hours" style={iStyle} /></div>
                        <div>
                          <label style={lStyle}>Urgency</label>
                          <RDrop value={formUrgency}
                            options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]}
                            onChange={setFormUrgency} />
                        </div>
                      </div>
                    )}

                    {/* Shift Schedule */}
                    {formJobType === 'shift' && (
                      <>
                        <div style={divider} />
                        <div>
                          <label style={lStyle}>Department <span style={{ color: '#F97316' }}>*</span></label>
                          <RDrop value={formDeptId} placeholder="Select department"
                            options={departments.map(d => ({ value: d.id, label: d.name }))}
                            onChange={async (deptId) => {
                              setFormDeptId(deptId)
                              setFormShiftDate(''); setFormAssignedEmployeeId('')
                              setShiftAvailableDates([]); setShiftDateEmployees([])
                              if (!deptId) { setShiftDeptEmployees([]); return }
                              const res = await fetch(`/api/shifts/department-employees?company_id=${companyId}&department_id=${deptId}`)
                              const data = await res.json()
                              if (data.success) {
                                setShiftDeptEmployees(data.employees ?? [])
                                const dateMap = new Map<string, { start_time: string; end_time: string }>()
                                ;(data.employees ?? []).forEach((emp: { shifts?: { shift_date: string; start_time: string; end_time: string }[] }) => {
                                  (emp.shifts ?? []).forEach((s) => { if (!dateMap.has(s.shift_date)) dateMap.set(s.shift_date, { start_time: s.start_time, end_time: s.end_time }) })
                                })
                                setShiftAvailableDates(Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, t]) => ({ date, start_time: t.start_time, end_time: t.end_time })))
                              }
                            }} />
                        </div>
                        {formDeptId && (
                          <div>
                            <label style={lStyle}>Shift Date <span style={{ color: '#F97316' }}>*</span></label>
                            {shiftAvailableDates.length > 0 ? (
                              <RDrop value={formShiftDate} placeholder="Select date"
                                options={shiftAvailableDates.map(({ date, start_time, end_time }) => {
                                  const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(m).padStart(2,'0')} ${ap}` }
                                  const dateLabel = new Date(date).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                                  return { value: date, label: `${dateLabel} · ${fmt(start_time)} – ${fmt(end_time)}` }
                                })}
                                onChange={(date) => {
                                  setFormShiftDate(date); setFormAssignedEmployeeId('')
                                  setShiftDateEmployees(shiftDeptEmployees.filter(emp =>
                                    (emp as unknown as { shifts?: { shift_date: string }[] }).shifts?.some((s: { shift_date: string }) => s.shift_date === date)
                                  ))
                                }} />
                            ) : (
                              <div style={{ ...iStyle, color: '#94A3B8', background: '#F8FAFC' }}>No scheduled shifts found for this department</div>
                            )}
                          </div>
                        )}
                        {formShiftDate && (
                          <div>
                            <label style={lStyle}>Assigned Employee <span style={{ color: '#F97316' }}>*</span></label>
                            {shiftDateEmployees.length > 0 ? (
                              <RDrop value={formAssignedEmployeeId} placeholder="Select employee"
                                options={shiftDateEmployees.map(emp => ({ value: emp.id, label: emp.full_name }))}
                                onChange={(empId) => {
                                  setFormAssignedEmployeeId(empId)
                                  const emp = shiftDeptEmployees.find(em => em.id === empId) as unknown as { shifts?: { shift_date: string; start_time: string; end_time: string }[] } | undefined
                                  const shift = emp?.shifts?.find((s: { shift_date: string }) => s.shift_date === formShiftDate)
                                  if (shift) { setFormShiftStart(shift.start_time.slice(0, 5)); setFormShiftEnd(shift.end_time.slice(0, 5)) }
                                }} />
                            ) : (
                              <div style={{ ...iStyle, color: '#94A3B8', background: '#F8FAFC' }}>No employees scheduled on this date</div>
                            )}
                          </div>
                        )}
                        {formAssignedEmployeeId && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                              <div>
                                <label style={lStyle}>Start Time <span style={{ color: '#F97316' }}>*</span></label>
                                <RTimePicker value={formShiftStart || '09:00'} onChange={setFormShiftStart} />
                              </div>
                              <div>
                                <label style={lStyle}>End Time <span style={{ color: '#F97316' }}>*</span></label>
                                <RTimePicker value={formShiftEnd || '17:00'} onChange={setFormShiftEnd} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                              <div>
                                <label style={lStyle}>Break Start</label>
                                <RTimePicker value={formBreakStart || '12:00'} onChange={setFormBreakStart} />
                              </div>
                              <div>
                                <label style={lStyle}>Break End</label>
                                <RTimePicker value={formBreakEnd || '13:00'} onChange={setFormBreakEnd} />
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* One-off fields */}
                    {formJobType === 'oneoff' && (
                      <>
                        <div style={divider} />
                        <div>
                          <label style={lStyle}>Department <span style={{ color: '#F97316' }}>*</span></label>
                          <RDrop value={formDeptId} placeholder="Select department"
                            options={departments.map(d => ({ value: d.id, label: d.name }))}
                            onChange={async (deptId) => {
                              setFormDeptId(deptId)
                              setFormShiftDate(''); setFormAssignedEmployeeId('')
                              setShiftAvailableDates([]); setShiftDateEmployees([])
                              if (!deptId) { setShiftDeptEmployees([]); return }
                              const res = await fetch(`/api/shifts/department-employees?company_id=${companyId}&department_id=${deptId}`)
                              const data = await res.json()
                              if (data.success) {
                                setShiftDeptEmployees(data.employees ?? [])
                                const dateMap = new Map<string, { start_time: string; end_time: string }>()
                                ;(data.employees ?? []).forEach((emp: { shifts?: { shift_date: string; start_time: string; end_time: string }[] }) => {
                                  (emp.shifts ?? []).forEach((s) => { if (!dateMap.has(s.shift_date)) dateMap.set(s.shift_date, { start_time: s.start_time, end_time: s.end_time }) })
                                })
                                setShiftAvailableDates(Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, t]) => ({ date, start_time: t.start_time, end_time: t.end_time })))
                              }
                            }} />
                        </div>
                        {formDeptId && (
                          <div>
                            <label style={lStyle}>Shift Date <span style={{ color: '#F97316' }}>*</span></label>
                            {shiftAvailableDates.length > 0 ? (
                              <RDrop value={formShiftDate} placeholder="Select date"
                                options={shiftAvailableDates.map(({ date, start_time, end_time }) => {
                                  const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(m).padStart(2,'0')} ${ap}` }
                                  const dateLabel = new Date(date).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                                  return { value: date, label: `${dateLabel} · ${fmt(start_time)} – ${fmt(end_time)}` }
                                })}
                                onChange={(date) => {
                                  setFormShiftDate(date); setFormAssignedEmployeeId('')
                                  setShiftDateEmployees(shiftDeptEmployees.filter(emp =>
                                    (emp as unknown as { shifts?: { shift_date: string }[] }).shifts?.some((s: { shift_date: string }) => s.shift_date === date)
                                  ))
                                }} />
                            ) : (
                              <div style={{ ...iStyle, color: '#94A3B8', background: '#F8FAFC' }}>No scheduled shifts found for this department</div>
                            )}
                          </div>
                        )}
                        {formShiftDate && (
                          <div>
                            <label style={lStyle}>Assigned Employee <span style={{ color: '#F97316' }}>*</span></label>
                            {shiftDateEmployees.length > 0 ? (
                              <RDrop value={formAssignedEmployeeId} placeholder="Select employee"
                                options={shiftDateEmployees.map(emp => ({ value: emp.id, label: emp.full_name }))}
                                onChange={setFormAssignedEmployeeId} />
                            ) : (
                              <div style={{ ...iStyle, color: '#94A3B8', background: '#F8FAFC' }}>No employees scheduled on this date</div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Compensation */}
                    <div style={divider} />
                    <div>
                      <label style={lStyle}>Pay Amount <span style={{ color: '#9CA3AF', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{formJobType === 'shift' ? '(per hour)' : '(flat rate)'}</span></label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '0.9375rem', pointerEvents: 'none' }}>$</span>
                        <input type="number" min={0} step={0.5} value={formSalaryAmt} onChange={e => setFormSalaryAmt(e.target.value)} placeholder="0.00" style={{ ...iStyle, paddingLeft: 26 }} />
                      </div>
                    </div>
                    {/* Pay estimate — shift only */}
                    {formJobType === 'shift' && (() => {
                      const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
                      const workMins = toMins(formShiftEnd) - toMins(formShiftStart)
                      const breakMins = toMins(formBreakEnd) - toMins(formBreakStart)
                      const netMins = workMins - (breakMins > 0 ? breakMins : 0)
                      const rate = parseFloat(formSalaryAmt)
                      if (netMins <= 0 || !formSalaryAmt || isNaN(rate) || rate <= 0) return null
                      const total = (netMins / 60 * rate).toFixed(2)
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10 }}>
                          <span style={{ ...lStyle, marginBottom: 0 }}>Total Amount</span>
                          <strong style={{ fontSize: 15, color: '#059669' }}>${total}</strong>
                        </div>
                      )
                    })()}

                    {formError && <div style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 700 }}>{formError}</div>}
                  </div>
                )}

              </div>

              {/* Footer */}
              {wizardStep === 'form' && (
                <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
                  <button onClick={() => { setFormOpen(false); resetForm() }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF', color: '#111827', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  {editingId && (
                    <button onClick={() => saveForm('draft')} disabled={actionLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF', color: '#111827', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}>
                      {actionLoading ? <Spinner size={13} dark /> : <FileText size={13} />} Save Draft
                    </button>
                  )}
                  <button onClick={() => saveForm('open')} disabled={actionLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: actionLoading ? '#FDA060' : '#F97316', color: '#FFFFFF', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer' }}>
                    {actionLoading ? <Spinner size={13} /> : <Check size={13} />} {editingId ? 'Save Changes' : 'Post Job'}
                  </button>
                </div>
              )}

            </div>
          </div>
        )
      })()}

      {/* ══ Job action dropdown menu ══════════════════════════════════════════ */}
      {jobMenuOpen && selectedLive && typeof document !== 'undefined' && createPortal(
        <div
          ref={jobMenuDropRef}
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: jobMenuPos.top, right: jobMenuPos.right, zIndex: 9999, width: 170, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', padding: '8px 6px' }}
        >
          <p style={{ margin: '0 6px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>Job</p>
          <button
            type="button"
            onClick={() => { setJobMenuOpen(false); openEditForm(selectedLive) }}
            style={jobMenuItemStyle}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          ><Pencil size={13} style={{ color: '#F97316' }} /> Edit</button>
          <button
            type="button"
            onClick={() => { setJobMenuOpen(false); void runPostingAction('archive_posting') }}
            disabled={actionLoading}
            style={jobMenuItemStyle}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          ><Archive size={13} style={{ color: '#F97316' }} /> Archive</button>
          <div style={{ height: 1, background: '#F1F5F9', margin: '4px 6px' }} />
          <button
            type="button"
            onClick={() => { setJobMenuOpen(false); setDeleteConfirm({ id: selectedLive.id, title: selectedLive.title, isDraft: false }) }}
            style={{ ...jobMenuItemStyle, color: '#DC2626' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          ><Trash2 size={13} /> Delete</button>
        </div>,
        document.body
      )}

      {/* ══ Delete confirm modal (draft + live) ══════════════════════════════ */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', zIndex: 110, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 420, background: '#FFFFFF', borderRadius: 16, padding: '24px', boxShadow: '0 24px 70px rgba(15,23,42,0.28)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{deleteConfirm.isDraft === false ? 'Delete Job Posting' : 'Delete Draft'}</h2>
              <button onClick={() => setDeleteConfirm(null)} style={{ border: 'none', background: '#F9FAFB', color: '#6B7280', cursor: 'pointer', padding: '5px', borderRadius: 7, display: 'flex' }}><X size={15} /></button>
            </div>
            <p style={{ margin: '0 0 20px', color: '#6B7280', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Permanently delete <strong style={{ color: '#111827' }}>"{deleteConfirm.title}"</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#374151', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
              <button onClick={() => deleteDraft(deleteConfirm.id, deleteConfirm.isDraft !== false)} disabled={actionLoading}
                style={{ border: 'none', background: '#DC2626', color: '#FFFFFF', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', fontSize: '0.875rem', opacity: actionLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {actionLoading ? <Spinner size={13} /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const jobMenuItemStyle: React.CSSProperties = {
  width: '100%',
  border: 0,
  background: 'transparent',
  color: '#111827',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 10,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
}
