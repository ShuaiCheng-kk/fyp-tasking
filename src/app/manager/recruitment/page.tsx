'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  Archive, ArchiveRestore, Briefcase, Building2, CalendarDays, Check, ChevronLeft, ChevronRight,
  ClipboardList, Clock, Coffee, Copy, Crown, DollarSign, FileText, LayoutGrid, MapPin,
  MoreHorizontal, Pencil, Repeat, Send, Sparkles, Timer, Trash2, UserCheck, UserX,
  X, XCircle, Zap,
} from 'lucide-react'
import ManagerSidebar from '@/components/ManagerSidebar'
import {
  ModalOverlay, ModalBox, ModalHeader,
  modalInputStyle, modalLabelStyle, modalErrorBoxStyle,
  modalGhostButtonStyle, modalPrimaryButtonStyle, modalDestructiveButtonStyle,
} from '@/components/modal'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import { CandidateRecommendation } from '@/types/AI'
import { JobApplicant, JobPostingSummary } from '@/types/Recruitment'
import { JobTemplate } from '@/types/JobTemplate'

type Tab = 'jobs' | 'archived' | 'drafts'
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

// Manager's role accent is blue, not the modal template's default orange — same shape/spacing
// as modalPrimaryButtonStyle, just re-colored to match every other button on this page.
function managerPrimaryButtonStyle(disabled = false): React.CSSProperties {
  return {
    padding: '7px 18px',
    background: disabled ? '#93C5FD' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: '0.8125rem',
    color: '#FFFFFF',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    opacity: disabled ? 0.65 : 1,
  }
}

const pageKeyframes = `
  @keyframes blockSlideUp  { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
`

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
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: `1.5px solid ${open ? '#2563EB' : '#E5E7EB'}`, borderRadius: 8, background: disabled ? '#F9FAFB' : '#FAFAFA', cursor: canOpen ? 'pointer' : 'default', fontSize: '0.9375rem', color: selected ? '#111827' : '#9CA3AF', fontWeight: selected ? 500 : 400, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', fontFamily: 'inherit' }}>
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
                style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: isSel ? '#EFF6FF' : 'transparent', color: isSel ? '#1D4ED8' : '#374151', fontWeight: isSel ? 700 : 400, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
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
              style={{ display: 'block', width: '100%', padding: '7px 16px', textAlign: 'left', border: 'none', background: isSel ? '#EFF6FF' : 'transparent', color: isSel ? '#2563EB' : '#0F172A', fontWeight: isSel ? 700 : 400, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
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
          }} style={{ borderRadius: 7, border: 'none', background: meridiem === mp ? '#2563EB' : '#F1F5F9', color: meridiem === mp ? '#FFFFFF' : '#0F172A', fontWeight: 700, fontSize: 12, padding: '7px 10px', cursor: 'pointer', lineHeight: 1, fontFamily: 'inherit' }}>
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

export default function ManagerRecruitmentPage() {
  const router = useRouter()

  // auth / company
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyLocation, setCompanyLocation] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [managerName, setmanagerName] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')

  // data
  const [departments, setDepartments] = useState<Department[]>([])
  const [managerDeptId, setManagerDeptId] = useState('')
  const [livePostings, setLivePostings] = useState<JobPostingSummary[]>([])
  const [drafts, setDrafts] = useState<JobPostingSummary[]>([])
  const [selectedLiveId, setSelectedLiveId] = useState('')
  const [applicants, setApplicants] = useState<JobApplicant[]>([])
  const [recommendations, setRecommendations] = useState<CandidateRecommendation[]>([])

  // ui state
  const [activeTab, setActiveTab] = useState<Tab>('jobs')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // form modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editingDraft, setEditingDraft] = useState(false)
  const [editingRejected, setEditingRejected] = useState(false)
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
  const [formJobStartTime, setFormJobStartTime] = useState('09:00')
  const [formEstHours, setFormEstHours] = useState('')
  const [formUrgency, setFormUrgency] = useState('normal')
  // AI builder
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiPreview, setAiPreview] = useState<null | { title: string; description: string; requirements: string }>(null)
  const [formError, setFormError] = useState('')

  // quick-fill starter templates (hardcoded presets)
  const [showTemplates, setShowTemplates] = useState(false)

  // saved job templates (UC36)
  const [templates, setTemplates] = useState<JobTemplate[]>([])
  const [showMyTemplates, setShowMyTemplates] = useState(false)
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [templateActionLoading, setTemplateActionLoading] = useState(false)

  // detail / delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; isDraft?: boolean } | null>(null)
  const [archivedSelected, setArchivedSelected] = useState<Set<string>>(new Set())
  const [selectedArchivedId, setSelectedArchivedId] = useState('')
  const [archivedApplicants, setArchivedApplicants] = useState<JobApplicant[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [draftsSelected, setDraftsSelected] = useState<Set<string>>(new Set())
  const [jobsSelected, setJobsSelected] = useState<Set<string>>(new Set())

  // draft action menu (... button)
  const [draftMenuOpen, setDraftMenuOpen] = useState(false)
  const [draftMenuPos, setDraftMenuPos] = useState({ top: 0, right: 0 })
  const draftMenuBtnRef = useRef<HTMLButtonElement>(null)
  const draftMenuDropRef = useRef<HTMLDivElement>(null)

  const selectedLive = useMemo(() => livePostings.find(p => p.id === selectedLiveId) ?? null, [livePostings, selectedLiveId])
  const selectedArchived = useMemo(() => livePostings.find(p => p.id === selectedArchivedId) ?? null, [livePostings, selectedArchivedId])
  const selectedDraft = useMemo(() => drafts.find(p => p.id === selectedDraftId) ?? null, [drafts, selectedDraftId])
  const formDepartmentName = useMemo(() => {
    const deptId = formDeptId || managerDeptId
    return departments.find(d => d.id === deptId)?.name ?? 'Assigned department'
  }, [departments, formDeptId, managerDeptId])

  // ── helpers ──────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setSuccessToast(msg)
    toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
  }, [])

  // ── data fetching ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async (cid: string, uid: string) => {
    if (!cid || !uid) return
    setLoading(true)
    setError('')
    try {
      const [liveRes, draftsRes, deptRes, templatesRes] = await Promise.all([
        fetch(`/api/recruitment?company_id=${cid}&manager_id=${uid}`),
        fetch(`/api/recruitment?company_id=${cid}&resource=drafts&user_id=${uid}`),
        fetch(`/api/company/departments?company_id=${cid}`),
        fetch(`/api/job-template?company_id=${cid}`),
      ])
      const [liveData, draftsData, deptData, templatesData] = await Promise.all([
        liveRes.json(), draftsRes.json(), deptRes.json(), templatesRes.json(),
      ])
      if (!liveData.success) throw new Error(liveData.message || 'Failed to fetch jobs')
      setLivePostings(liveData.postings ?? [])
      setDrafts(draftsData.drafts ?? [])
      if (deptData.success) setDepartments(deptData.departments ?? [])
      if (templatesData.success) setTemplates(templatesData.templates ?? [])
      setSelectedLiveId(prev => {
        const list = liveData.postings ?? []
        if (prev && list.some((p: JobPostingSummary) => p.id === prev)) return prev
        return ''
      })
      setLastRefreshed(new Date())
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
      const assignedDeptId = meData.user?.department_id ?? ''
      setManagerDeptId(assignedDeptId)
      setFormDeptId(prev => prev || assignedDeptId)
      if (meData.user?.full_name) setmanagerName(meData.user.full_name)

      let storedCid = localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
      if (!storedCid) {
        const byOwnerRes = await fetch(`/api/company/by-owner?owner_id=${authId}`)
        const byOwnerData = await byOwnerRes.json()
        if (byOwnerData.success && byOwnerData.company?.id) {
          storedCid = byOwnerData.company.id
          localStorage.setItem(`tasking_company_id_${authId}`, storedCid)
        }
      }
      if (!storedCid) return
      setCompanyId(storedCid)

      const currentRes = await fetch(`/api/company/current?user_id=${authId}&company_id=${storedCid}`)
      const currentData = await currentRes.json()
      if (!cancelled && currentData.success) {
        setCompanyName(currentData.company?.name ?? '')
        setCompanyLocation(currentData.company?.location ?? '')
        setCompanyAddress(currentData.company?.address ?? '')
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
    if (!draftMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (draftMenuBtnRef.current?.contains(e.target as Node)) return
      if (draftMenuDropRef.current?.contains(e.target as Node)) return
      setDraftMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [draftMenuOpen])

  // ── form helpers ─────────────────────────────────────────────────────────────

  const loadDepartmentShiftData = useCallback(async (deptId: string, savedDate = '') => {
    setFormDeptId(deptId)
    setShiftDeptEmployees([])
    setShiftAvailableDates([])
    setShiftDateEmployees([])
    if (!deptId || !companyId) return

    const res = await fetch(`/api/shifts/department-employees?company_id=${companyId}&department_id=${deptId}`)
    const data = await res.json()
    if (!data.success) return

    const employees = data.employees ?? []
    setShiftDeptEmployees(employees)
    const dateMap = new Map<string, { start_time: string; end_time: string }>()
    employees.forEach((emp: { shifts?: { shift_date: string; start_time: string; end_time: string }[] }) => {
      (emp.shifts ?? []).forEach((s) => {
        if (!dateMap.has(s.shift_date)) dateMap.set(s.shift_date, { start_time: s.start_time, end_time: s.end_time })
      })
    })
    setShiftAvailableDates(Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).filter(([date]) => date >= new Date().toISOString().slice(0, 10)).map(([date, t]) => ({ date, start_time: t.start_time, end_time: t.end_time })))
    if (savedDate) {
      setShiftDateEmployees(employees.filter((emp: { shifts?: { shift_date: string }[] }) =>
        emp.shifts?.some((s: { shift_date: string }) => s.shift_date === savedDate)
      ))
    }
  }, [companyId])

  const resetForm = () => {
    setEditingId(''); setEditingDraft(false); setEditingRejected(false); setWizardStep('type'); setFormJobType('oneoff')
    setFormTitle(''); setFormDeptId(managerDeptId); setFormEmpType('casual')
    setFormLocation(''); setFormSalaryAmt(''); setFormSalaryType('per hour')
    setFormDescription(''); setFormRequirements(''); setFormIndustry('')
    setFormCompanyName(''); setFormBenefits(''); setFormOpenings(1)
    setFormExpiryPreset('none'); setFormExpiresAt('')
    setFormShiftStart('09:00'); setFormShiftEnd('17:00'); setFormBreakStart('12:00'); setFormBreakEnd('13:00'); setFormShiftDays([])
    setFormIsRecurring(false); setFormRecurInterval(1); setFormRecurUnit('week')
    setFormShiftDate(''); setFormAssignedEmployeeId('')
    setShiftDeptEmployees([]); setShiftAvailableDates([]); setShiftDateEmployees([])
    setFormJobDate(''); setFormJobEndDate(''); setFormEstHours(''); setFormUrgency('normal'); setFormJobStartTime('09:00')
    setAiPrompt(''); setAiPreview(null); setFormError('')
  }

  const openNewForm = () => {
    resetForm()
    if (managerDeptId) void loadDepartmentShiftData(managerDeptId)
    setFormOpen(true)
  }

  const openEditForm = async (p: JobPostingSummary, isDraft = false) => {
    const raw = p as unknown as Record<string, unknown>
    setEditingId(p.id); setEditingDraft(isDraft); setEditingRejected(p.status === 'rejected'); setWizardStep('form')
    const isShift = p.is_recurring
    setFormJobType(isShift ? 'shift' : 'oneoff')
    setFormTitle(p.title); setFormDeptId(p.department_id ?? '')
    setFormEmpType(p.employment_type ?? 'casual'); setFormLocation('')
    setFormSalaryAmt(p.salary_amount?.toString() ?? ''); setFormSalaryType(isShift ? 'per hour' : 'flat rate')
    setFormDescription(p.description); setFormRequirements(p.requirements ?? '')
    setFormIndustry(''); setFormCompanyName(companyName); setFormBenefits('')
    setFormOpenings(1)
    setFormExpiryPreset(typeof raw.expiry_preset === 'string' && raw.expiry_preset ? raw.expiry_preset : 'none')
    setFormExpiresAt(typeof raw.expires_at === 'string' && raw.expires_at ? raw.expires_at.slice(0, 10) : '')
    setFormIsRecurring(false); setFormRecurInterval(1); setFormRecurUnit('week')
    setFormJobDate(''); setFormJobEndDate('')
    setAiPrompt(''); setAiPreview(null); setFormError('')
    const savedShiftDate = typeof raw.shift_date === 'string' ? raw.shift_date : ''
    const savedShiftStart = typeof raw.shift_start_time === 'string' ? raw.shift_start_time.slice(0, 5) : '09:00'
    const savedShiftEnd = typeof raw.shift_end_time === 'string' ? raw.shift_end_time.slice(0, 5) : '17:00'
    const savedBreakStart = typeof raw.break_start_time === 'string' ? raw.break_start_time.slice(0, 5) : '12:00'
    const savedBreakEnd = typeof raw.break_end_time === 'string' ? raw.break_end_time.slice(0, 5) : '13:00'
    const savedEmployeeId = typeof raw.assigned_employee_id === 'string' ? raw.assigned_employee_id : ''
    const savedEstHours = typeof raw.estimated_hours === 'string' ? raw.estimated_hours : ''
    const savedUrgency = typeof raw.urgency === 'string' ? raw.urgency : 'normal'
    const savedJobStartTime = typeof raw.job_start_time === 'string' ? raw.job_start_time.slice(0, 5) : '09:00'
    setFormEstHours(savedEstHours)
    setFormUrgency(savedUrgency)
    setFormJobStartTime(savedJobStartTime)

    if (p.department_id) {
      setShiftDeptEmployees([]); setShiftAvailableDates([]); setShiftDateEmployees([])
      const res = await fetch(`/api/shifts/department-employees?company_id=${companyId}&department_id=${p.department_id}`)
      const data = await res.json()
      if (data.success) {
        const employees = data.employees ?? []
        setShiftDeptEmployees(employees)
        const dateMap = new Map<string, { start_time: string; end_time: string }>()
        employees.forEach((emp: { shifts?: { shift_date: string; start_time: string; end_time: string }[] }) => {
          (emp.shifts ?? []).forEach((s) => { if (!dateMap.has(s.shift_date)) dateMap.set(s.shift_date, { start_time: s.start_time, end_time: s.end_time }) })
        })
        // Ensure the saved shift date is always an option even if the shift no longer exists
        if (savedShiftDate && !dateMap.has(savedShiftDate)) {
          dateMap.set(savedShiftDate, { start_time: savedShiftStart, end_time: savedShiftEnd })
        }
        setShiftAvailableDates(Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).filter(([date]) => date >= new Date().toISOString().slice(0, 10)).map(([date, t]) => ({ date, start_time: t.start_time, end_time: t.end_time })))

        setFormShiftDate(savedShiftDate)
        if (savedShiftDate) {
          let dateEmps = employees.filter((emp: { shifts?: { shift_date: string }[] }) =>
            emp.shifts?.some((s: { shift_date: string }) => s.shift_date === savedShiftDate)
          )
          // If saved employee isn't in the filtered list, inject them from dept employees or as a placeholder
          if (savedEmployeeId && !dateEmps.some((e: { id: string }) => e.id === savedEmployeeId)) {
            const found = employees.find((e: { id: string }) => e.id === savedEmployeeId)
            dateEmps = found ? [...dateEmps, found] : [...dateEmps, { id: savedEmployeeId, full_name: 'Previously assigned employee', shifts: [] }]
          }
          setShiftDateEmployees(dateEmps)
        }
      }
      setFormShiftStart(isShift ? savedShiftStart : '09:00')
      setFormShiftEnd(isShift ? savedShiftEnd : '17:00')
      setFormBreakStart(isShift ? savedBreakStart : '12:00')
      setFormBreakEnd(isShift ? savedBreakEnd : '13:00')
      setFormAssignedEmployeeId(savedEmployeeId)
    } else {
      setFormShiftStart('09:00'); setFormShiftEnd('17:00'); setFormBreakStart('12:00'); setFormBreakEnd('13:00')
      setFormShiftDate(''); setFormAssignedEmployeeId('')
      setShiftDeptEmployees([]); setShiftAvailableDates([]); setShiftDateEmployees([])
    }
    setFormShiftDays([])
    setFormOpen(true)
  }

  const buildBody = (status: 'pending_approval' | 'draft') => ({
    company_id: companyId,
    department_id: formDeptId || managerDeptId || null,
    created_by: internalUserId,
    title: formTitle,
    description: formDescription,
    requirements: formRequirements || null,
    location: formLocation || null,
    employment_type: formEmpType || null,
    company_name: formCompanyName || companyName || null,
    salary_amount: formSalaryAmt ? Number(formSalaryAmt) : null,
    urgency: formJobType === 'oneoff' ? (formUrgency || 'normal') : null,
    estimated_hours: formJobType === 'oneoff' ? (formEstHours || null) : null,
    is_recurring: formJobType === 'shift',
    formType: formJobType,
    shift_date: formShiftDate || null,
    shift_start_time: formJobType === 'shift' ? (formShiftStart || null) : null,
    shift_end_time: formJobType === 'shift' ? (formShiftEnd || null) : null,
    break_start_time: formJobType === 'shift' ? (formBreakStart || null) : null,
    break_end_time: formJobType === 'shift' ? (formBreakEnd || null) : null,
    job_start_time: formJobType === 'oneoff' ? (formJobStartTime || null) : null,
    assigned_employee_id: formAssignedEmployeeId || null,
    openings: formOpenings,
    expires_at: formExpiresAt || null,
    expiry_preset: formExpiryPreset || 'none',
    status,
  })

  // ── job templates (UC36) ─────────────────────────────────────────────────────

  const applyTemplate = (t: JobTemplate) => {
    setFormJobType(t.form_type === 'shift' ? 'shift' : 'oneoff')
    setFormEmpType(t.employment_type ?? 'casual')
    setFormTitle(t.title)
    setFormDescription(t.description ?? '')
    setFormRequirements(t.requirements ?? '')
    setShowMyTemplates(false)
    setWizardStep('form')
  }

  const saveAsTemplate = async () => {
    if (!companyId || !internalUserId || !newTemplateName.trim()) return
    setTemplateActionLoading(true)
    try {
      const res = await fetch('/api/job-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId, created_by: internalUserId, name: newTemplateName.trim(),
          title: formTitle, description: formDescription || null, requirements: formRequirements || null,
          employment_type: formEmpType || null, form_type: formJobType,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save template')
      setTemplates(prev => [...prev, data.template])
      setSaveTemplateModalOpen(false); setNewTemplateName('')
      showToast('Template saved')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setTemplateActionLoading(false)
    }
  }

  const deleteTemplateById = async (id: string) => {
    setTemplateActionLoading(true)
    try {
      const res = await fetch(`/api/job-template/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete template')
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setTemplateActionLoading(false)
    }
  }

  const saveForm = async (status: 'pending_approval' | 'draft') => {
    if (!companyId || !internalUserId) return
    if (!formTitle.trim()) { setFormError('Title is required'); return }
    if (status === 'pending_approval' && formJobType === 'oneoff' && !formJobStartTime) { setFormError('Start time is required to submit for approval'); return }
    if (status === 'pending_approval' && !formDescription.trim()) { setFormError('Description is required to send for review'); return }
    if (status === 'pending_approval' && !formAssignedEmployeeId) { setFormError('Supervisor is required to submit for approval'); return }
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
        // flip status to pending_approval when submitting a draft or a rejected job for review
        if (status === 'pending_approval' && (editingDraft || editingRejected)) {
          await fetch('/api/recruitment', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'submit_for_review', job_id: editingId }),
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

      // notify Owner when submitting for review
      if (status === 'pending_approval') {
        try {
          const ownerRes = await fetch(`/api/company/owner?company_id=${companyId}`)
          const ownerData = await ownerRes.json()
          if (ownerData.success && ownerData.owner_id) {
            await fetch('/api/inbox/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from_user_id: internalUserId,
                to_user_id: ownerData.owner_id,
                company_id: companyId,
                content: `New job posting "${formTitle.trim()}" has been submitted for your review.`,
              }),
            })
          }
        } catch { /* notification failure is non-fatal */ }
      }

      setFormOpen(false); resetForm()
      await fetchAll(companyId, internalUserId)
      if (status === 'pending_approval') { setActiveTab('jobs'); showToast(editingId ? 'Job updated and sent for review' : 'Sent for review') }
      else { setActiveTab('drafts'); showToast(editingId ? 'Draft saved' : 'Saved as draft') }
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
    const posting = livePostings.find(p => p.id === id)
    if (!canManagePosting(posting)) {
      setError('Managers can only modify jobs they posted.')
      return
    }
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
      showToast(action === 'archive_posting' ? 'Job archived' : 'Job updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job')
    } finally { setActionLoading(false) }
  }

  const runArchivedAction = async (action: 'unarchive_posting' | 'delete_posting', jobId: string) => {
    if (!jobId) return
    const posting = livePostings.find(p => p.id === jobId)
    if (!canManagePosting(posting)) {
      setError('Managers can only modify jobs they posted.')
      return
    }
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, job_id: jobId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed')
      setSelectedArchivedId('')
      setArchivedSelected(new Set())
      await fetchAll(companyId, internalUserId)
      showToast(action === 'unarchive_posting' ? 'Job unarchived' : 'Job deleted')
      if (action === 'unarchive_posting') setActiveTab('jobs')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update archived job')
    } finally { setActionLoading(false) }
  }

  const decideApplicant = async (applicantId: string, decision: 'accepted' | 'rejected') => {
    if (!internalUserId) return
    if (!canManagePosting(selectedLive)) {
      setError('Managers can only update applicants for jobs they posted.')
      return
    }
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide_applicant', applicant_id: applicantId, decision, decided_by: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update applicant')
      await Promise.all([fetchApplicants(selectedLiveId), fetchAll(companyId, internalUserId)])
      showToast(decision === 'accepted' ? 'Applicant accepted' : 'Applicant rejected')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update applicant')
    } finally { setActionLoading(false) }
  }

  const duplicateDraft = async (draft: typeof selectedDraft) => {
    if (!draft || !companyId || !internalUserId) return
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          created_by: internalUserId,
          title: `${draft.title} (copy)`,
          description: draft.description ?? '',
          requirements: draft.requirements ?? null,
          employment_type: draft.employment_type ?? null,
          department_id: draft.department_id ?? null,
          salary_amount: draft.salary_amount ?? null,
          urgency: draft.urgency ?? null,
          estimated_hours: draft.estimated_hours ?? null,
          is_recurring: draft.is_recurring ?? false,
          shift_date: draft.shift_date ?? null,
          shift_start_time: draft.shift_start_time ?? null,
          shift_end_time: draft.shift_end_time ?? null,
          break_start_time: draft.break_start_time ?? null,
          break_end_time: draft.break_end_time ?? null,
          assigned_employee_id: draft.assigned_employee_id ?? null,
          status: 'draft',
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to duplicate')
      await fetchAll(companyId, internalUserId)
      if (data.posting?.id) setSelectedDraftId(data.posting.id)
      showToast('Draft duplicated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate draft')
    } finally { setActionLoading(false) }
  }

  const deleteDraft = async (id: string, isDraft = true) => {
    const posting = isDraft ? drafts.find(p => p.id === id) : livePostings.find(p => p.id === id)
    if (posting && !canManagePosting(posting)) {
      setError('Managers can only delete jobs they posted.')
      return
    }
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
      showToast('Deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally { setActionLoading(false) }
  }

  const deleteArchivedSelected = async () => {
    const ownedIds = selectedOwnedJobIds(archivedSelected, archivedPostings)
    if (ownedIds.length === 0) return
    setActionLoading(true); setError('')
    try {
      await Promise.all(ownedIds.map(id =>
        fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_posting', job_id: id }),
        })
      ))
      setArchivedSelected(new Set())
      await fetchAll(companyId, internalUserId)
      showToast(`${ownedIds.length} job${ownedIds.length === 1 ? '' : 's'} deleted`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally { setActionLoading(false) }
  }

  const unarchiveArchivedSelected = async () => {
    const ownedIds = selectedOwnedJobIds(archivedSelected, archivedPostings)
    if (ownedIds.length === 0) return
    setActionLoading(true); setError('')
    try {
      await Promise.all(ownedIds.map(id =>
        fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unarchive_posting', job_id: id }),
        })
      ))
      setArchivedSelected(new Set())
      await fetchAll(companyId, internalUserId)
      setActiveTab('jobs')
      showToast('Jobs unarchived')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unarchive')
    } finally { setActionLoading(false) }
  }

  const archiveJobsSelected = async () => {
    const ownedIds = selectedOwnedJobIds(jobsSelected, jobsPostings)
    if (ownedIds.length === 0) return
    setActionLoading(true); setError('')
    try {
      await Promise.all(ownedIds.map(id =>
        fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive_posting', job_id: id }),
        })
      ))
      setJobsSelected(new Set())
      setSelectedLiveId('')
      await fetchAll(companyId, internalUserId)
      showToast('Jobs archived')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive')
    } finally { setActionLoading(false) }
  }

  const deleteJobsSelected = async () => {
    const ownedIds = selectedOwnedJobIds(jobsSelected, jobsPostings)
    if (ownedIds.length === 0) return
    setActionLoading(true); setError('')
    try {
      await Promise.all(ownedIds.map(id =>
        fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_posting', job_id: id }),
        })
      ))
      setJobsSelected(new Set())
      setSelectedLiveId('')
      await fetchAll(companyId, internalUserId)
      showToast('Jobs deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally { setActionLoading(false) }
  }

  const publishDraftsSelected = async () => {
    if (draftsSelected.size === 0) return
    setActionLoading(true); setError('')
    try {
      await Promise.all([...draftsSelected].map(id =>
        fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'submit_for_review', job_id: id }),
        })
      ))
      setDraftsSelected(new Set()); setSelectedDraftId('')
      await fetchAll(companyId, internalUserId)
      setActiveTab('jobs')
      showToast('Sent for review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send for review')
    } finally { setActionLoading(false) }
  }

  const deleteDraftsSelected = async () => {
    if (draftsSelected.size === 0) return
    setActionLoading(true); setError('')
    try {
      await Promise.all([...draftsSelected].map(id =>
        fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_posting', job_id: id }),
        })
      ))
      setDraftsSelected(new Set()); setSelectedDraftId('')
      await fetchAll(companyId, internalUserId)
      showToast('Drafts deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete drafts')
    } finally { setActionLoading(false) }
  }

  const publishDraft = async (id: string) => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_for_review', job_id: id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to send for review')
      setSelectedDraftId('')
      await fetchAll(companyId, internalUserId)
      setActiveTab('jobs')
      showToast('Sent for review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send for review')
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
  const jobsPostings    = useMemo(() => livePostings.filter(p => ['open','closed','pending_approval','rejected'].includes(p.status)), [livePostings])
  const archivedPostings = useMemo(
    () => livePostings.filter(p => p.status === 'archived' && p.created_by === internalUserId),
    [livePostings, internalUserId],
  )
  const canManagePosting = (posting: { created_by?: string | null } | null | undefined) =>
    Boolean(posting && internalUserId && posting.created_by === internalUserId)
  const selectedOwnedJobIds = (ids: Set<string>, postings: JobPostingSummary[]) =>
    [...ids].filter(id => canManagePosting(postings.find(posting => posting.id === id)))

  useEffect(() => {
    setJobsSelected(prev => {
      const owned = new Set(selectedOwnedJobIds(prev, jobsPostings))
      return owned.size === prev.size ? prev : owned
    })
  }, [jobsPostings, internalUserId])

  useEffect(() => {
    setArchivedSelected(prev => {
      const owned = new Set(selectedOwnedJobIds(prev, archivedPostings))
      return owned.size === prev.size ? prev : owned
    })
  }, [archivedPostings, internalUserId])

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{pageKeyframes}</style>
      <ManagerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', scrollbarGutter: 'stable' }}>

        {/* ── Page header ── */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Recruitment
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {managerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#0F172A', color: '#FFFFFF', flexShrink: 0 }}>
                  <Crown size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{managerName}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Card wrapper (tab bar + content) ── */}
        <div style={{ padding: '0 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, animation: 'blockSlideUp 0.38s ease both 0.06s' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Tab bar ── */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {([
              { key: 'jobs' as Tab,     label: 'Jobs',    Icon: Briefcase    },
              { key: 'archived' as Tab, label: 'Archived', Icon: Archive     },
              { key: 'drafts' as Tab,   label: 'Drafts',   Icon: FileText    },
            ]).map(tab => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedArchivedId(''); setArchivedSelected(new Set()); setSelectedDraftId(''); setJobsSelected(new Set()) }}
                  style={{
                    padding: '5px 13px', borderRadius: '99px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                    border: active ? '2px solid #2563EB' : '2px solid #E5E7EB',
                    background: active ? '#2563EB' : 'transparent',
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
        </div>

        {/* ── Tab content ── */}
        <div style={{ padding: '16px 20px 20px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {error && (
            <div style={{ marginBottom: 12, padding: '11px 14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.84rem', fontWeight: 600 }}>{error}</div>
          )}

          {/* ══ JOBS tab (Open / Closed / Expired) ════════════════════════════ */}
          {activeTab === 'jobs' && (
            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>

              {/* Left: job list */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Briefcase size={15} style={{ color: '#2563EB' }} />
                  </div>
                  <span className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px', flex: 1 }}>All Jobs</span>
                  {jobsSelected.size > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={archiveJobsSelected}
                        disabled={actionLoading}
                        title={`Archive ${jobsSelected.size} selected`}
                        style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                        onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FFEDD5' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF' }}
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={deleteJobsSelected}
                        disabled={actionLoading}
                        title={`Delete ${jobsSelected.size} selected`}
                        style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                        onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                      >
                        {actionLoading ? <Spinner size={12} dark /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={openNewForm}
                      style={{
                        height: 36, padding: '0 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 9,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#2563EB' }}
                    >
                      <Sparkles size={14} /> AI Post Job
                    </button>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px' }}>
                  {jobsPostings.map((p, idx) => {
                  const isSelected = selectedLiveId === p.id
                  const canManage = canManagePosting(p)
                  const checked = jobsSelected.has(p.id)
                  return (
                    <div
                      key={p.id}
                      className="dept-card"
                      onClick={() => setSelectedLiveId(p.id)}
                      style={{
                        animationDelay: `${idx * 55}ms`,
                        border: (isSelected || checked) ? '2px solid #2563EB' : '2px solid #E5E7EB',
                        borderRadius: 14,
                        padding: '16px 16px 14px',
                        background: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        boxShadow: (isSelected || checked) ? '0 0 0 3px rgba(37,99,235,0.10)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (isSelected || checked) return
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.10)'
                        e.currentTarget.style.borderColor = '#93C5FD'
                      }}
                      onMouseLeave={e => {
                        if (isSelected || checked) return
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
                        e.currentTarget.style.borderColor = '#E5E7EB'
                      }}
                    >
                      {/* Badge row above title */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        {statusBadge(p.status)}
                        {canManage && p.status !== 'rejected' && p.status !== 'pending_approval' && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setJobsSelected(prev => { const s = new Set(prev); checked ? s.delete(p.id) : s.add(p.id); return s }) }}
                            style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: checked ? '2px solid #2563EB' : '2px solid #D1D5DB', background: checked ? '#2563EB' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                          >
                            {checked && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                          </button>
                        )}
                      </div>
                      {/* Title + date row */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                        <strong style={{ fontSize: '0.9rem', color: '#1C1C1E', lineHeight: 1.4, flex: 1, minWidth: 0 }}>{p.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#C4C9D4', flexShrink: 0 }}>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  )
                  })}
                  </div>
                )}
              </div>

              {/* Right: posting detail + applicants */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                    {(() => {
                      const isPendingJob = selectedLive.status === 'pending_approval'
                      const isRejectedJob = selectedLive.status === 'rejected'
                      const isFullWidth = isPendingJob || isRejectedJob
                      return (
                        <div style={{ borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center' }}>
                          <div style={{ flex: isFullWidth ? 1 : '0 0 min(860px, 62%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'nowrap' }}>
                              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: 700, lineHeight: 1, alignSelf: 'center' }}>{selectedLive.title}</h2>
                              {isPendingJob ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {managerName || 'Manager'}
                                </span>
                              ) : selectedLive.is_recurring ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  Shift Job
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  One-Off Job
                                </span>
                              )}
                            </div>
                            {canManagePosting(selectedLive) && (
                              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                {!isPendingJob && !isRejectedJob && (
                                  <button
                                    onClick={() => void runPostingAction('archive_posting')}
                                    disabled={actionLoading}
                                    title="Archive job"
                                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                                    onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FFEDD5' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF' }}
                                  ><Archive size={14} /></button>
                                )}
                                {isRejectedJob && (
                                  <button
                                    onClick={() => openEditForm(selectedLive, false)}
                                    disabled={actionLoading}
                                    title="Edit job"
                                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                                    onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#DBEAFE' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF' }}
                                  ><Pencil size={14} /></button>
                                )}
                                <button
                                  onClick={() => setDeleteConfirm({ id: selectedLive.id, title: selectedLive.title, isDraft: false })}
                                  disabled={actionLoading}
                                  title="Delete job"
                                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                                  onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                                ><Trash2 size={14} /></button>
                              </div>
                            )}
                          </div>
                          {!isFullWidth && <div style={{ flex: 1 }} />}
                        </div>
                      )
                    })()}

                    {/* ── Two-column body (single column for pending) ── */}
                    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                      {/* LEFT: job details */}
                      {(() => {
                        const isPendingJob = selectedLive.status === 'pending_approval'
                        const isRejectedJob = selectedLive.status === 'rejected'
                        const isFullWidth = isPendingJob || isRejectedJob
                        const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(m).padStart(2, '0')} ${ap}` }
                        const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
                        const isShiftJob = selectedLive.is_recurring
                        const shiftDate = selectedLive.shift_date
                        const shiftStart = selectedLive.shift_start_time
                        const shiftEnd = selectedLive.shift_end_time
                        const breakStart = selectedLive.break_start_time
                        const breakEnd = selectedLive.break_end_time
                        const estimatedHours = selectedLive.estimated_hours
                        const urgency = selectedLive.urgency ?? 'normal'
                        const urgencyLabel = urgency === 'urgent' ? 'Urgent' : urgency === 'high' ? 'High' : 'Normal'
                        let totalAmt: number | null = null
                        if (isShiftJob && selectedLive.salary_amount != null && shiftStart && shiftEnd) {
                          let worked = toMins(shiftEnd) - toMins(shiftStart)
                          if (breakStart && breakEnd) worked -= (toMins(breakEnd) - toMins(breakStart))
                          if (worked > 0) totalAmt = Math.round(selectedLive.salary_amount * (worked / 60) * 100) / 100
                        }
                        const fmtShort = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}` }
                        const infoRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }
                        const statCard: React.CSSProperties = { borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 72 }
                        const statLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }
                        const statLabelText = (color: string): React.CSSProperties => ({ fontSize: '0.75rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' })
                        const statValue: React.CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#374151', lineHeight: 1.3 }
                        const statSub: React.CSSProperties = { margin: '3px 0 0', fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 400 }
                        return (
                          <div style={{ flex: isFullWidth ? 1 : '0 0 min(860px, 62%)', borderRight: isFullWidth ? 'none' : '1px solid #F0F4F8', overflowY: 'auto', padding: '20px 24px 24px' }}>

                            {/* ── Key Stats ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                              {/* Pay */}
                              {selectedLive.salary_amount != null ? (
                                <div style={{ ...statCard, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                  <div style={statLabel}>
                                    <DollarSign size={11} style={{ color: '#2563EB' }} />
                                    <span style={statLabelText('#2563EB')}>{isShiftJob ? 'Pay' : 'Flat Rate'}</span>
                                  </div>
                                  <p style={statValue}>
                                    {isShiftJob
                                      ? `$${selectedLive.salary_amount}/Hr${totalAmt != null ? ` ($${totalAmt % 1 === 0 ? totalAmt.toFixed(0) : totalAmt.toFixed(2)})` : ''}`
                                      : `$${selectedLive.salary_amount}`}
                                  </p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No pay set</span>
                                </div>
                              )}
                              {/* Date */}
                              {shiftDate ? (
                                <div style={{ ...statCard, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                                  <div style={statLabel}>
                                    <CalendarDays size={11} style={{ color: '#0284C7' }} />
                                    <span style={statLabelText('#0284C7')}>Date</span>
                                  </div>
                                  <p style={statValue}>{new Date(shiftDate).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No date set</span>
                                </div>
                              )}
                              {/* Hours */}
                              {isShiftJob ? ((shiftStart || shiftEnd) ? (
                                <div style={{ ...statCard, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                  <div style={statLabel}>
                                    <Clock size={11} style={{ color: '#059669' }} />
                                    <span style={statLabelText('#059669')}>Hours</span>
                                  </div>
                                  <p style={statValue}>{shiftStart ? fmtShort(shiftStart) : '—'} – {shiftEnd ? fmtShort(shiftEnd) : '—'}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No hours set</span>
                                </div>
                              )) : (estimatedHours ? (
                                <div style={{ ...statCard, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                  <div style={statLabel}>
                                    <Clock size={11} style={{ color: '#059669' }} />
                                    <span style={statLabelText('#059669')}>Estimation</span>
                                  </div>
                                  <p style={statValue}>{estimatedHours} Hours</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No hours set</span>
                                </div>
                              ))}
                              {/* Break / Urgency */}
                              {isShiftJob ? ((breakStart || breakEnd) ? (
                                <div style={{ ...statCard, background: '#FDF4FF', border: '1px solid #E9D5FF' }}>
                                  <div style={statLabel}>
                                    <Coffee size={11} style={{ color: '#9333EA' }} />
                                    <span style={statLabelText('#9333EA')}>Break</span>
                                  </div>
                                  <p style={statValue}>{breakStart ? fmtShort(breakStart) : '—'} – {breakEnd ? fmtShort(breakEnd) : '—'}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No break</span>
                                </div>
                              )) : (
                                <div style={{ ...statCard, background: '#FFF1F2', border: '1px solid #FECDD3' }}>
                                  <div style={statLabel}>
                                    <Zap size={11} style={{ color: '#E11D48' }} />
                                    <span style={statLabelText('#E11D48')}>Urgency</span>
                                  </div>
                                  <p style={statValue}>{urgencyLabel}</p>
                                </div>
                              )}
                            </div>

                            {/* ── Secondary info rows ── */}
                            {(selectedLive.department_name || selectedLive.assigned_employee_name) && (
                              <div style={{ display: 'flex', borderTop: '1px solid #F3F4F6', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginTop: 4 }}>
                                {/* Left half — Department */}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRight: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                                  <LayoutGrid size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>{selectedLive.department_name ?? '—'}</span>
                                </div>
                                {/* Right half — Employee */}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: '#FAFAFA' }}>
                                  <UserCheck size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>{selectedLive.assigned_employee_name ?? '—'}</span>
                                </div>
                              </div>
                            )}

                            {/* ── Scope & Requirements ── */}
                            {(selectedLive.description || selectedLive.requirements) && (
                              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {selectedLive.description && (
                                  <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                      <FileText size={13} style={{ color: '#2563EB' }} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75 }}>{selectedLive.description}</p>
                                  </div>
                                )}
                                {selectedLive.requirements && (
                                  <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                      <ClipboardList size={13} style={{ color: '#2563EB' }} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requirements</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{selectedLive.requirements}</p>
                                  </div>
                                )}
                                {selectedLive.status === 'rejected' && selectedLive.rejection_reason && (
                                  <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '14px 16px', border: '1px solid #FECACA' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                      <XCircle size={13} style={{ color: '#DC2626' }} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rejection Reason</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#7F1D1D', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{selectedLive.rejection_reason}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* RIGHT: applicants — hidden for pending and rejected jobs */}
                      {selectedLive.status !== 'pending_approval' && selectedLive.status !== 'rejected' && <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 24px', background: '#FAFAFA', borderRadius: '0 0 16px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Applicants</p>
                          </div>
                          <button
                            onClick={recommendCandidates}
                            disabled={aiLoading || applicants.length === 0}
                            style={{ height: 36, padding: '0 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 9, cursor: aiLoading || applicants.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, flexShrink: 0 }}
                            onMouseEnter={e => { if (!aiLoading && applicants.length > 0) e.currentTarget.style.background = '#1D4ED8' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#2563EB' }}
                          >
                            {aiLoading ? <Spinner size={14} /> : <Sparkles size={14} />} AI Recommend
                          </button>
                        </div>
                        {applicants.length === 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px dashed #E5E7EB' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                              <UserX size={22} style={{ color: '#D1D5DB' }} />
                            </div>
                            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#6B7280' }}>No applicants yet</p>
                          </div>
                        ) : applicants.map(applicant => {
                          const rec = recommendations.find(r => r.applicant_id === applicant.id)
                          return (
                            <div key={applicant.id} style={{ padding: '13px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, marginBottom: 10, background: '#FFFFFF' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                                    {applicant.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                                  </div>
                                  <div>
                                    <strong style={{ color: '#111827', fontSize: '0.875rem', display: 'block', lineHeight: 1.3 }}>{applicant.full_name}</strong>
                                    <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{applicant.email_address}</span>
                                  </div>
                                </div>
                                {statusBadge(applicant.status)}
                              </div>
                              {applicant.cover_letter && (
                                <p style={{ margin: '8px 0 0', color: '#4B5563', fontSize: '0.8rem', lineHeight: 1.55, paddingLeft: 41 }}>{applicant.cover_letter}</p>
                              )}
                              {rec && (
                                <div style={{ marginTop: 10, padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: '0.775rem', lineHeight: 1.5 }}>
                                  <strong style={{ color: '#059669' }}>AI Score: {rec.score}/100 — {rec.recommendation}</strong>
                                  <p style={{ margin: '4px 0 0', color: '#374151' }}>{rec.reasons[0] ?? rec.suggested_next_step}</p>
                                  {rec.risks[0] && <p style={{ margin: '3px 0 0', color: '#B45309' }}>{rec.risks[0]}</p>}
                                </div>
                              )}
                              {canManagePosting(selectedLive) && applicant.status === 'pending' && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                  <button onClick={() => decideApplicant(applicant.id, 'accepted')} disabled={actionLoading}
                                    style={{ flex: 1, border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '6px 10px', display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.775rem', fontWeight: 600 }}
                                  ><UserCheck size={13} /> Accept</button>
                                  <button onClick={() => decideApplicant(applicant.id, 'rejected')} disabled={actionLoading}
                                    style={{ flex: 1, border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '6px 10px', display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.775rem', fontWeight: 600 }}
                                  ><UserX size={13} /> Reject</button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ ARCHIVED tab ══════════════════════════════════════════════════ */}
          {activeTab === 'archived' && (
            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>

              {/* Left: archived list */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Archive size={15} style={{ color: '#2563EB' }} />
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
                  {archivedPostings.map((p, idx) => {
                  const isSelected = selectedArchivedId === p.id
                  const canManage = canManagePosting(p)
                  const checked = archivedSelected.has(p.id)
                  return (
                    <div
                      key={p.id}
                      className="dept-card"
                      onClick={() => setSelectedArchivedId(p.id)}
                      style={{
                        animationDelay: `${idx * 55}ms`,
                        border: (isSelected || checked) ? '2px solid #2563EB' : '2px solid #E5E7EB',
                        borderRadius: 14,
                        padding: '14px 14px 12px',
                        background: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        boxShadow: (isSelected || checked) ? '0 0 0 3px rgba(37,99,235,0.10)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (isSelected || checked) return
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.10)'
                        e.currentTarget.style.borderColor = '#93C5FD'
                      }}
                      onMouseLeave={e => {
                        if (isSelected || checked) return
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
                        e.currentTarget.style.borderColor = '#E5E7EB'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                        <strong style={{ fontSize: '0.875rem', color: '#1C1C1E', lineHeight: 1.4, flex: 1, minWidth: 0 }}>{p.title}</strong>
                        {canManage && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setArchivedSelected(prev => { const s = new Set(prev); checked ? s.delete(p.id) : s.add(p.id); return s }) }}
                            style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: checked ? '2px solid #2563EB' : '2px solid #D1D5DB', background: checked ? '#2563EB' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                          >
                            {checked && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                          </button>
                        )}
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
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {!selectedArchived ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 24px' }}>
                    <div style={{ padding: '40px 48px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, width: '100%' }}>
                      <Archive size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Select an archived job</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div style={{ borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center' }}>
                      <div style={{ flex: '0 0 min(860px, 62%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'nowrap' }}>
                          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: 700, lineHeight: 1, alignSelf: 'center' }}>{selectedArchived.title}</h2>
                          {selectedArchived.is_recurring ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>One-Off Job</span>
                          )}
                        </div>
                        {canManagePosting(selectedArchived) && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={() => void runArchivedAction('unarchive_posting', selectedArchived.id)}
                            disabled={actionLoading}
                            title="Unarchive job"
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#059669', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                            onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#DCFCE7' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#F0FDF4' }}
                          ><ArchiveRestore size={14} /></button>
                          <button
                            onClick={() => setDeleteConfirm({ id: selectedArchived.id, title: selectedArchived.title, isDraft: false })}
                            disabled={actionLoading}
                            title="Delete job"
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                            onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                          ><Trash2 size={14} /></button>
                        </div>}
                      </div>
                      <div style={{ flex: 1 }} />
                    </div>

                    {/* Two-column body */}
                    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                      {/* LEFT: job details */}
                      {(() => {
                        const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
                        const isShiftJob = selectedArchived.is_recurring
                        const shiftDate = selectedArchived.shift_date
                        const shiftStart = selectedArchived.shift_start_time
                        const shiftEnd = selectedArchived.shift_end_time
                        const breakStart = selectedArchived.break_start_time
                        const breakEnd = selectedArchived.break_end_time
                        const estimatedHours = selectedArchived.estimated_hours
                        const urgency = selectedArchived.urgency ?? 'normal'
                        const urgencyLabel = urgency === 'urgent' ? 'Urgent' : urgency === 'high' ? 'High' : 'Normal'
                        let totalAmt: number | null = null
                        if (isShiftJob && selectedArchived.salary_amount != null && shiftStart && shiftEnd) {
                          let worked = toMins(shiftEnd) - toMins(shiftStart)
                          if (breakStart && breakEnd) worked -= (toMins(breakEnd) - toMins(breakStart))
                          if (worked > 0) totalAmt = Math.round(selectedArchived.salary_amount * (worked / 60) * 100) / 100
                        }
                        const fmtShort = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}` }
                        const statCard: React.CSSProperties = { borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 72 }
                        const statLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }
                        const statLabelText = (color: string): React.CSSProperties => ({ fontSize: '0.75rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' })
                        const statValue: React.CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#374151', lineHeight: 1.3 }
                        return (
                          <div style={{ flex: '0 0 min(860px, 62%)', borderRight: '1px solid #F0F4F8', overflowY: 'auto', padding: '20px 24px 24px' }}>
                            {/* Stat cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                              {/* Pay */}
                              {selectedArchived.salary_amount != null ? (
                                <div style={{ ...statCard, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                  <div style={statLabel}><DollarSign size={11} style={{ color: '#2563EB' }} /><span style={statLabelText('#2563EB')}>{isShiftJob ? 'Pay' : 'Flat Rate'}</span></div>
                                  <p style={statValue}>{isShiftJob ? `$${selectedArchived.salary_amount}/Hr${totalAmt != null ? ` ($${totalAmt % 1 === 0 ? totalAmt.toFixed(0) : totalAmt.toFixed(2)})` : ''}` : `$${selectedArchived.salary_amount}`}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No pay set</span></div>
                              )}
                              {/* Date */}
                              {shiftDate ? (
                                <div style={{ ...statCard, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                                  <div style={statLabel}><CalendarDays size={11} style={{ color: '#0284C7' }} /><span style={statLabelText('#0284C7')}>Date</span></div>
                                  <p style={statValue}>{new Date(shiftDate).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No date set</span></div>
                              )}
                              {/* Hours / Estimation */}
                              {isShiftJob ? ((shiftStart || shiftEnd) ? (
                                <div style={{ ...statCard, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                  <div style={statLabel}><Clock size={11} style={{ color: '#059669' }} /><span style={statLabelText('#059669')}>Hours</span></div>
                                  <p style={statValue}>{shiftStart ? fmtShort(shiftStart) : '—'} – {shiftEnd ? fmtShort(shiftEnd) : '—'}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No hours set</span></div>
                              )) : (estimatedHours ? (
                                <div style={{ ...statCard, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                  <div style={statLabel}><Clock size={11} style={{ color: '#059669' }} /><span style={statLabelText('#059669')}>Estimation</span></div>
                                  <p style={statValue}>{estimatedHours} Hours</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No hours set</span></div>
                              ))}
                              {/* Break / Urgency */}
                              {isShiftJob ? ((breakStart || breakEnd) ? (
                                <div style={{ ...statCard, background: '#FDF4FF', border: '1px solid #E9D5FF' }}>
                                  <div style={statLabel}><Coffee size={11} style={{ color: '#9333EA' }} /><span style={statLabelText('#9333EA')}>Break</span></div>
                                  <p style={statValue}>{breakStart ? fmtShort(breakStart) : '—'} – {breakEnd ? fmtShort(breakEnd) : '—'}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No break</span></div>
                              )) : (
                                <div style={{ ...statCard, background: '#FFF1F2', border: '1px solid #FECDD3' }}>
                                  <div style={statLabel}><Zap size={11} style={{ color: '#E11D48' }} /><span style={statLabelText('#E11D48')}>Urgency</span></div>
                                  <p style={statValue}>{urgencyLabel}</p>
                                </div>
                              )}
                            </div>

                            {/* Department + Employee row */}
                            {(selectedArchived.department_name || selectedArchived.assigned_employee_name) && (
                              <div style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginTop: 4 }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRight: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                                  <LayoutGrid size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>{selectedArchived.department_name ?? '—'}</span>
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: '#FAFAFA' }}>
                                  <UserCheck size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>{selectedArchived.assigned_employee_name ?? '—'}</span>
                                </div>
                              </div>
                            )}

                            {/* Scope & Requirements */}
                            {(selectedArchived.description || selectedArchived.requirements) && (
                              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {selectedArchived.description && (
                                  <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                      <FileText size={13} style={{ color: '#2563EB' }} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75 }}>{selectedArchived.description}</p>
                                  </div>
                                )}
                                {selectedArchived.requirements && (
                                  <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                      <ClipboardList size={13} style={{ color: '#2563EB' }} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requirements</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{selectedArchived.requirements}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* RIGHT: applicants (view-only) */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 24px', background: '#FAFAFA', borderRadius: '0 0 16px 0' }}>
                        <p style={{ margin: '0 0 16px', fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Applicants</p>
                        {archivedApplicants.length === 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px dashed #E5E7EB' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                              <UserX size={22} style={{ color: '#D1D5DB' }} />
                            </div>
                            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#6B7280' }}>No applicants yet</p>
                          </div>
                        ) : archivedApplicants.map(applicant => (
                          <div key={applicant.id} style={{ padding: '13px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, marginBottom: 10, background: '#FFFFFF' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                                  {applicant.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                                </div>
                                <div>
                                  <strong style={{ color: '#111827', fontSize: '0.875rem', display: 'block', lineHeight: 1.3 }}>{applicant.full_name}</strong>
                                  <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{applicant.email_address}</span>
                                </div>
                              </div>
                              {statusBadge(applicant.status)}
                            </div>
                            {applicant.cover_letter && (
                              <p style={{ margin: '8px 0 0', color: '#4B5563', fontSize: '0.8rem', lineHeight: 1.55, paddingLeft: 41 }}>{applicant.cover_letter}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ DRAFTS tab ════════════════════════════════════════════════════ */}
          {activeTab === 'drafts' && (
            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>

              {/* Left: draft list */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={15} style={{ color: '#2563EB' }} />
                  </div>
                  <span className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px', flex: 1 }}>Draft Jobs</span>
                  {draftsSelected.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={publishDraftsSelected}
                        disabled={actionLoading}
                        title={`Send ${draftsSelected.size} selected for review`}
                        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#059669', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                        onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#DCFCE7' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F0FDF4' }}
                      >
                        {actionLoading ? <Spinner size={12} dark /> : <Send size={14} />}
                      </button>
                      <button
                        onClick={deleteDraftsSelected}
                        disabled={actionLoading}
                        title={`Delete ${draftsSelected.size} selected`}
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
                ) : drafts.length === 0 ? (
                  <div style={{ margin: '12px 14px', padding: '28px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <FileText size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No drafts saved.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px' }}>
                  {drafts.map((p, idx) => {
                  const isSelected = selectedDraftId === p.id
                  const checked = draftsSelected.has(p.id)
                  return (
                    <div
                      key={p.id}
                      className="dept-card"
                      onClick={() => setSelectedDraftId(p.id)}
                      style={{
                        animationDelay: `${idx * 55}ms`,
                        border: (isSelected || checked) ? '2px solid #2563EB' : '2px solid #E5E7EB',
                        borderRadius: 14,
                        padding: '14px 14px 12px',
                        background: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        boxShadow: (isSelected || checked) ? '0 0 0 3px rgba(37,99,235,0.10)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (isSelected || checked) return
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.10)'
                        e.currentTarget.style.borderColor = '#93C5FD'
                      }}
                      onMouseLeave={e => {
                        if (isSelected || checked) return
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
                        e.currentTarget.style.borderColor = '#E5E7EB'
                      }}
                    >
                      {/* Badge row: department badge + checkbox */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        {p.department_name ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', whiteSpace: 'nowrap' }}>
                            <LayoutGrid size={10} />{p.department_name}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #E5E7EB' }}>No dept</span>
                        )}
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setDraftsSelected(prev => { const s = new Set(prev); checked ? s.delete(p.id) : s.add(p.id); return s }) }}
                          style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: checked ? '2px solid #2563EB' : '2px solid #D1D5DB', background: checked ? '#2563EB' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        >
                          {checked && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                        </button>
                      </div>
                      {/* Title + date row */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                        <strong style={{ fontSize: '0.9rem', color: '#1C1C1E', lineHeight: 1.4, flex: 1, minWidth: 0 }}>{p.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#C4C9D4', flexShrink: 0 }}>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  )
                  })}
                  </div>
                )}
              </div>

              {/* Right: draft detail */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {!selectedDraft ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 24px' }}>
                    <div style={{ padding: '40px 48px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, width: '100%' }}>
                      <FileText size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Select a draft</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div style={{ borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'nowrap' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: 700, lineHeight: 1, alignSelf: 'center' }}>{selectedDraft.title}</h2>
                        {selectedDraft.is_recurring ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>One-Off Job</span>
                        )}
                      </div>
                      <button
                        ref={draftMenuBtnRef}
                        onClick={e => { e.stopPropagation(); if (!draftMenuOpen) { const r = e.currentTarget.getBoundingClientRect(); setDraftMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right }) } setDraftMenuOpen(o => !o) }}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#374151', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                      ><MoreHorizontal size={16} /></button>
                    </div>

                    {/* Two-column body */}
                    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                      {/* LEFT: job details */}
                      {(() => {
                        const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
                        const isShiftJob = selectedDraft.is_recurring
                        const shiftDate = selectedDraft.shift_date
                        const shiftStart = selectedDraft.shift_start_time
                        const shiftEnd = selectedDraft.shift_end_time
                        const breakStart = selectedDraft.break_start_time
                        const breakEnd = selectedDraft.break_end_time
                        const estimatedHours = selectedDraft.estimated_hours
                        const urgency = selectedDraft.urgency ?? 'normal'
                        const urgencyLabel = urgency === 'urgent' ? 'Urgent' : urgency === 'high' ? 'High' : 'Normal'
                        let totalAmt: number | null = null
                        if (isShiftJob && selectedDraft.salary_amount != null && shiftStart && shiftEnd) {
                          let worked = toMins(shiftEnd) - toMins(shiftStart)
                          if (breakStart && breakEnd) worked -= (toMins(breakEnd) - toMins(breakStart))
                          if (worked > 0) totalAmt = Math.round(selectedDraft.salary_amount * (worked / 60) * 100) / 100
                        }
                        const fmtShort = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}` }
                        const statCard: React.CSSProperties = { borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 72 }
                        const statLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }
                        const statLabelText = (color: string): React.CSSProperties => ({ fontSize: '0.75rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' })
                        const statValue: React.CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#374151', lineHeight: 1.3 }
                        return (
                          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
                            {/* Stat cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                              {/* Pay */}
                              {selectedDraft.salary_amount != null ? (
                                <div style={{ ...statCard, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                  <div style={statLabel}><DollarSign size={11} style={{ color: '#2563EB' }} /><span style={statLabelText('#2563EB')}>{isShiftJob ? 'Pay' : 'Flat Rate'}</span></div>
                                  <p style={statValue}>{isShiftJob ? `$${selectedDraft.salary_amount}/Hr${totalAmt != null ? ` ($${totalAmt % 1 === 0 ? totalAmt.toFixed(0) : totalAmt.toFixed(2)})` : ''}` : `$${selectedDraft.salary_amount}`}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No pay set</span></div>
                              )}
                              {/* Date */}
                              {shiftDate ? (
                                <div style={{ ...statCard, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                                  <div style={statLabel}><CalendarDays size={11} style={{ color: '#0284C7' }} /><span style={statLabelText('#0284C7')}>Date</span></div>
                                  <p style={statValue}>{new Date(shiftDate).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No date set</span></div>
                              )}
                              {/* Hours / Estimation */}
                              {isShiftJob ? ((shiftStart || shiftEnd) ? (
                                <div style={{ ...statCard, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                  <div style={statLabel}><Clock size={11} style={{ color: '#059669' }} /><span style={statLabelText('#059669')}>Hours</span></div>
                                  <p style={statValue}>{shiftStart ? fmtShort(shiftStart) : '—'} – {shiftEnd ? fmtShort(shiftEnd) : '—'}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No hours set</span></div>
                              )) : (estimatedHours ? (
                                <div style={{ ...statCard, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                  <div style={statLabel}><Clock size={11} style={{ color: '#059669' }} /><span style={statLabelText('#059669')}>Estimation</span></div>
                                  <p style={statValue}>{estimatedHours} Hours</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No hours set</span></div>
                              ))}
                              {/* Break / Urgency */}
                              {isShiftJob ? ((breakStart || breakEnd) ? (
                                <div style={{ ...statCard, background: '#FDF4FF', border: '1px solid #E9D5FF' }}>
                                  <div style={statLabel}><Coffee size={11} style={{ color: '#9333EA' }} /><span style={statLabelText('#9333EA')}>Break</span></div>
                                  <p style={statValue}>{breakStart ? fmtShort(breakStart) : '—'} – {breakEnd ? fmtShort(breakEnd) : '—'}</p>
                                </div>
                              ) : (
                                <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No break</span></div>
                              )) : (
                                <div style={{ ...statCard, background: '#FFF1F2', border: '1px solid #FECDD3' }}>
                                  <div style={statLabel}><Zap size={11} style={{ color: '#E11D48' }} /><span style={statLabelText('#E11D48')}>Urgency</span></div>
                                  <p style={statValue}>{urgencyLabel}</p>
                                </div>
                              )}
                            </div>

                            {/* Department + Employee row */}
                            {(selectedDraft.department_name || selectedDraft.assigned_employee_name) && (
                              <div style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginTop: 4 }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRight: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                                  <LayoutGrid size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>{selectedDraft.department_name ?? '—'}</span>
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: '#FAFAFA' }}>
                                  <UserCheck size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>{selectedDraft.assigned_employee_name ?? '—'}</span>
                                </div>
                              </div>
                            )}

                            {/* Scope & Requirements */}
                            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                  <FileText size={13} style={{ color: '#2563EB' }} />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</span>
                                </div>
                                {selectedDraft.description ? (
                                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75 }}>{selectedDraft.description}</p>
                                ) : (
                                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#9CA3AF', fontStyle: 'italic' }}>Not set</p>
                                )}
                              </div>
                              <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                  <ClipboardList size={13} style={{ color: '#2563EB' }} />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requirements</span>
                                </div>
                                {selectedDraft.requirements ? (
                                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{selectedDraft.requirements}</p>
                                ) : (
                                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#9CA3AF', fontStyle: 'italic' }}>Not set</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })()}

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

      {/* ── Success toast ── */}
      <Toast message={successToast ?? ''} />

      {/* ══ Save as Template modal ═════════════════════════════════════════════ */}
      {saveTemplateModalOpen && createPortal(
        <ModalOverlay onClose={() => { setSaveTemplateModalOpen(false); setNewTemplateName('') }} maxWidth="420px">
          <ModalBox>
            <ModalHeader
              title="Save as Template"
              icon={<ClipboardList size={15} color="#fff" strokeWidth={2.5} />}
              iconBg="linear-gradient(135deg, #2563EB, #1D4ED8)"
              onClose={() => { setSaveTemplateModalOpen(false); setNewTemplateName('') }}
            />
            <div style={{ padding: '20px 24px 0' }}>
              <p style={{ margin: '0 0 14px', color: '#6B7280', fontSize: '0.9rem', lineHeight: 1.55 }}>
                Save this job's title, description, and requirements so you can reuse them next time.
              </p>
              <label style={modalLabelStyle}>Template Name</label>
              <input
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="e.g. Weekend Cashier"
                style={modalInputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#2563EB' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
              />
            </div>
            {formError && <div style={modalErrorBoxStyle}>{formError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '20px 24px' }}>
              <button onClick={() => { setSaveTemplateModalOpen(false); setNewTemplateName('') }} style={modalGhostButtonStyle}>
                Cancel
              </button>
              <button onClick={saveAsTemplate} disabled={templateActionLoading || !newTemplateName.trim()} style={managerPrimaryButtonStyle(templateActionLoading || !newTemplateName.trim())}>
                {templateActionLoading ? <Spinner size={13} /> : <ClipboardList size={13} />} Save Template
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>,
        document.body
      )}

      {/* ══ Post Job / Edit modal — 3-step wizard ═════════════════════════════ */}
      {formOpen && (() => {
        const WIZARD_STEPS = ['type', 'ai', 'form'] as const
        const displayStep = wizardStep === 'form' ? 'ai' : wizardStep
        const stepIdx = WIZARD_STEPS.indexOf(displayStep)
        const modalTitle = editingId
          ? (editingDraft && !editingRejected ? 'Edit Draft' : 'Edit Job Posting')
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

        const iStyle: React.CSSProperties = modalInputStyle
        const lStyle: React.CSSProperties = modalLabelStyle
        const sectionLabel: React.CSSProperties = { margin: '4px 0 0', color: '#374151', fontSize: '0.875rem', fontWeight: 600 }
        const divider: React.CSSProperties = { borderTop: '1px dashed #E5E7EB', margin: '0' }

        return createPortal(
          <ModalOverlay onClose={() => { setFormOpen(false); resetForm() }} maxWidth="540px">
            <ModalBox>

              {/* Header */}
              <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {!editingId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {(['type', 'ai', 'form'] as const).map((s, i) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: displayStep === s ? '#2563EB' : stepIdx > i ? '#EFF6FF' : '#F3F4F6', color: displayStep === s ? '#FFF' : stepIdx > i ? '#1D4ED8' : '#9CA3AF', flexShrink: 0 }}>
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
                <button onClick={() => { setFormOpen(false); resetForm() }} aria-label="Close" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: 6, borderRadius: 8, flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable body */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Back row */}
                {wizardStep !== 'type' && !editingId && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={() => setWizardStep('type')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontWeight: 600, fontSize: '0.8125rem', padding: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#111827' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#6B7280' }}>
                      <ChevronLeft size={15} />
                      Back
                    </button>
                  </div>
                )}

                {/* ── Step 1: Job Type ── */}
                {wizardStep === 'type' && (
                  <>
                    {/* Job Templates */}
                    <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                      <button onClick={() => setShowTemplates(v => !v)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F9FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ClipboardList size={15} color="#6B7280" />
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#374151' }}>Quick Templates</span>
                          <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 400 }}>Start from a pre-filled template</span>
                        </div>
                        <ChevronRight size={14} color="#9CA3AF" style={{ transform: showTemplates ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                      </button>
                      {showTemplates && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderTop: '1px solid #E5E7EB' }}>
                          {([
                            { label: 'Shift Worker', type: 'shift', empType: 'part-time', title: 'Shift Worker', description: 'We are looking for reliable shift workers to join our team. You will be responsible for completing assigned duties during your scheduled shift, following workplace procedures, and maintaining a high standard of work throughout your time on site.', requirements: 'Available for flexible shift hours\nPhysically fit and able to stand for extended periods\nReliable and punctual\nAbility to work as part of a team\nPrior experience in a similar role preferred but not essential' },
                            { label: 'Event Staff', type: 'oneoff', empType: 'casual', title: 'Event Staff', description: 'We are seeking enthusiastic event staff to assist with the setup, operations, and pack-down of our upcoming event. You will help ensure a smooth and welcoming experience for all attendees by managing registration, directing guests, and maintaining the event area.', requirements: 'Strong communication and interpersonal skills\nAble to remain calm and professional in a busy environment\nComfortable being on your feet for extended periods\nPrevious event or hospitality experience is a plus\nMust be available for the full event duration' },
                            { label: 'Customer Service', type: 'oneoff', empType: 'casual', title: 'Customer Service Representative', description: 'We are looking for a friendly and professional customer service representative to interact with our customers. You will handle inquiries, resolve issues, and provide a positive experience to every customer you interact with in person, by phone, or via email.', requirements: 'Excellent verbal and written communication skills\nPatient and empathetic approach to customer concerns\nAbility to multitask and work in a fast-paced environment\nBasic computer literacy\nExperience in retail, hospitality, or customer-facing roles is desirable' },
                            { label: 'Kitchen Helper', type: 'shift', empType: 'part-time', title: 'Kitchen Helper', description: 'We are looking for a dependable kitchen helper to support our kitchen team during busy service periods. Duties include food preparation, cleaning, dishwashing, and ensuring that the kitchen remains safe and hygienic at all times.', requirements: 'Basic food handling knowledge or willingness to learn\nAble to work in a fast-paced, hot kitchen environment\nStrong attention to hygiene and cleanliness\nPhysically fit and able to lift moderate loads\nFood handler certificate or equivalent (preferred)' },
                            { label: 'Warehouse Assistant', type: 'shift', empType: 'part-time', title: 'Warehouse Assistant', description: 'We are seeking a hardworking warehouse assistant to help with receiving, storing, and dispatching goods. You will operate within a team to ensure accurate stock management, timely order fulfilment, and a safe working environment.', requirements: 'Experience in a warehouse or logistics environment preferred\nForklift licence advantageous but not required\nPhysically fit and capable of heavy lifting\nGood attention to detail for stock accuracy\nWillingness to work early morning or late shifts' },
                          ] as { label: string; type: 'shift' | 'oneoff'; empType: string; title: string; description: string; requirements: string }[]).map((tpl, i) => (
                            <button key={tpl.label}
                              onClick={() => {
                                setFormJobType(tpl.type)
                                setFormEmpType(tpl.empType)
                                setFormSalaryType(tpl.type === 'shift' ? 'per hour' : 'flat rate')
                                setFormTitle(tpl.title)
                                setFormDescription(tpl.description)
                                setFormRequirements(tpl.requirements)
                                setShowTemplates(false)
                                setWizardStep('form')
                              }}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#FFFFFF', border: 'none', borderTop: i === 0 ? 'none' : '1px solid #F3F4F6', cursor: 'pointer', textAlign: 'left' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{tpl.label}</span>
                                <span style={{ fontSize: '0.75rem', color: '#9CA3AF', background: '#F3F4F6', borderRadius: 6, padding: '2px 7px' }}>{tpl.type === 'shift' ? 'Shift' : 'One-off'}</span>
                              </div>
                              <ChevronRight size={13} color="#D1D5DB" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {templates.length > 0 && (
                      <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                        <button onClick={() => setShowMyTemplates(v => !v)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F9FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ClipboardList size={15} color="#6B7280" />
                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#374151' }}>My Templates</span>
                            <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 400 }}>Start from a saved template</span>
                          </div>
                          <ChevronRight size={14} color="#9CA3AF" style={{ transform: showMyTemplates ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                        </button>
                        {showMyTemplates && (
                          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #E5E7EB' }}>
                            {templates.map((t, i) => (
                              <div key={t.id}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#FFFFFF', borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                                <button onClick={() => applyTemplate(t)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', flex: 1 }}>
                                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{t.name}</span>
                                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF', background: '#F3F4F6', borderRadius: 6, padding: '2px 7px' }}>{t.form_type === 'shift' ? 'Shift' : 'One-off'}</span>
                                </button>
                                <button onClick={() => void deleteTemplateById(t.id)} disabled={templateActionLoading}
                                  style={{ background: 'none', border: 'none', cursor: templateActionLoading ? 'default' : 'pointer', padding: 4, display: 'flex', color: '#9CA3AF' }}
                                  title="Delete template">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
                      <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500 }}>or start from scratch</span>
                      <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
                    </div>

                    <button onClick={() => { setFormJobType('shift'); setFormEmpType('part-time'); setFormSalaryType('per hour'); setWizardStep('ai') }}
                      style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 12, background: '#FFFFFF', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#F8FAFC' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#FFFFFF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Repeat size={17} color="#2563EB" />
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', margin: '0 0 2px' }}>Shift Job</p>
                          <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>Fixed schedule with a defined start and end time.</p>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => { setFormJobType('oneoff'); setFormEmpType('casual'); setFormSalaryType('flat rate'); setWizardStep('ai') }}
                      style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 12, background: '#FFFFFF', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#F8FAFC' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#FFFFFF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Zap size={17} color="#2563EB" />
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
                        <div style={{ background: '#F8FAFC', border: '1.5px solid #BFDBFE', borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Sparkles size={14} color="#2563EB" />
                            <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1D4ED8' }}>AI Draft Ready</span>
                            <span style={{ fontSize: '0.78rem', color: '#9CA3AF', marginLeft: 'auto' }}>Review before posting</span>
                          </div>
                          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', margin: '0 0 4px' }}>{aiPreview.title}</p>
                          <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, lineHeight: 1.6 }}>{aiPreview.description.slice(0, 200)}{aiPreview.description.length > 200 ? '…' : ''}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => setAiPreview(null)} style={{ flex: 1, padding: 10, background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: 'pointer' }}>← Regenerate</button>
                          <button onClick={handleUseAIDraft} style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#FFFFFF', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                            <FileText size={14} /> Use This Draft
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ background: '#F8FAFC', border: '1.5px solid #BFDBFE', borderRadius: 12, padding: '16px 18px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 10 }}>
                            <Sparkles size={14} color="#2563EB" /> AI Job Description Builder
                          </label>
                          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                            rows={5} style={{ ...iStyle, background: '#FFFFFF', border: '1.5px solid #E5E7EB', resize: 'none' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <button onClick={() => { setAiPreview(null); setWizardStep('form') }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF', color: '#111827', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            Fill Manually
                          </button>
                          <button onClick={handleAIGenerate} disabled={!aiPrompt.trim() || aiLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: !aiPrompt.trim() || aiLoading ? '#9CA3AF' : '#2563EB', color: '#FFFFFF', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: !aiPrompt.trim() || aiLoading ? 'default' : 'pointer' }}>
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
                      <label style={lStyle}>Job Title <span style={{ color: '#2563EB' }}>*</span></label>
                      <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder={formJobType === 'shift' ? 'e.g. Weekend Cashier' : 'e.g. Event Setup Crew'} style={iStyle} />
                    </div>
                    <div>
                      <label style={lStyle}>{formJobType === 'shift' ? 'Job Scope' : 'Description'} <span style={{ color: '#2563EB' }}>*</span></label>
                      <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={1} style={{ ...iStyle, resize: 'vertical', lineHeight: 1.55, verticalAlign: 'top' }} placeholder="Describe the role, responsibilities, and expectations…" />
                    </div>
                    <div>
                      <label style={lStyle}>Requirements</label>
                      <textarea value={formRequirements} onChange={e => setFormRequirements(e.target.value)} rows={1} style={{ ...iStyle, resize: 'vertical', lineHeight: 1.55, verticalAlign: 'top' }} placeholder="e.g. Must be available weekends, physically fit…" />
                    </div>
                    <div>
                      <label style={lStyle}>Application Deadline</label>
                      <RDrop value={formExpiryPreset} options={EXPIRY_PRESETS} onChange={handleExpiryPreset} />
                      {formExpiryPreset === 'custom' && (
                        <input type="date" value={formExpiresAt} min={new Date().toISOString().slice(0, 10)}
                          onChange={e => setFormExpiresAt(e.target.value)} style={{ ...iStyle, marginTop: 8 }} />
                      )}
                    </div>
                    <button onClick={() => { setNewTemplateName(formTitle); setFormError(''); setSaveTemplateModalOpen(true) }} disabled={!formTitle.trim()}
                      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, color: formTitle.trim() ? '#2563EB' : '#D1D5DB', fontSize: '0.8125rem', fontWeight: 700, cursor: formTitle.trim() ? 'pointer' : 'default' }}>
                      <ClipboardList size={13} /> Save as Template
                    </button>
                    {formJobType === 'oneoff' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div><label style={lStyle}>Est. Hours</label><input value={formEstHours} onChange={e => setFormEstHours(e.target.value)} placeholder="e.g. 4–6 hours" style={iStyle} /></div>
                        <div>
                          <label style={lStyle}>Start Time <span style={{ color: '#2563EB' }}>*</span></label>
                          <input type="time" value={formJobStartTime} onChange={e => setFormJobStartTime(e.target.value)} style={iStyle} />
                        </div>
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
                          <label style={lStyle}>Department <span style={{ color: '#2563EB' }}>*</span></label>
                          <div style={{ ...iStyle, color: '#111827', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{formDepartmentName}</span>
                          </div>
                        </div>
                        {(formDeptId || editingId) && (
                          <div>
                            <label style={lStyle}>Shift Date <span style={{ color: '#2563EB' }}>*</span></label>
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
                        {(formShiftDate || editingId) && (
                          <div>
                            <label style={lStyle}>Assigned Employee <span style={{ color: '#2563EB' }}>*</span></label>
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
                        {(formAssignedEmployeeId || editingId) && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                              <div>
                                <label style={lStyle}>Start Time <span style={{ color: '#2563EB' }}>*</span></label>
                                <RTimePicker value={formShiftStart || '09:00'} onChange={setFormShiftStart} />
                              </div>
                              <div>
                                <label style={lStyle}>End Time <span style={{ color: '#2563EB' }}>*</span></label>
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
                          <label style={lStyle}>Department <span style={{ color: '#2563EB' }}>*</span></label>
                          <div style={{ ...iStyle, color: '#111827', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{formDepartmentName}</span>
                          </div>
                        </div>
                        {formDeptId && (
                          <div>
                            <label style={lStyle}>Shift Date <span style={{ color: '#2563EB' }}>*</span></label>
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
                            <label style={lStyle}>Assigned Employee <span style={{ color: '#2563EB' }}>*</span></label>
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

                  </div>
                )}

              </div>

              {formError && <div style={modalErrorBoxStyle}>{formError}</div>}

              {/* Footer */}
              {wizardStep === 'form' && (
                <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
                  {!editingId && (
                    <button onClick={() => saveForm('draft')} disabled={actionLoading} style={modalGhostButtonStyle}>
                      {actionLoading ? <Spinner size={13} dark /> : <FileText size={13} />} Save Draft
                    </button>
                  )}
                  <button onClick={() => saveForm('pending_approval')} disabled={actionLoading} style={managerPrimaryButtonStyle(actionLoading)}>
                    {actionLoading ? <Spinner size={13} /> : <Send size={13} />} {editingId && !editingDraft && !editingRejected ? 'Save Changes' : 'Send For Review'}
                  </button>
                </div>
              )}

            </ModalBox>
          </ModalOverlay>,
          document.body
        )
      })()}



      {/* ══ Draft action dropdown menu ════════════════════════════════════════ */}
      {draftMenuOpen && selectedDraft && typeof document !== 'undefined' && createPortal(
        <div
          ref={draftMenuDropRef}
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: draftMenuPos.top, right: draftMenuPos.right, zIndex: 9999, width: 170, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', padding: '8px 6px' }}
        >
          <p style={{ margin: '0 6px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>Draft</p>
          <button
            type="button"
            onClick={() => { setDraftMenuOpen(false); duplicateDraft(selectedDraft) }}
            disabled={actionLoading}
            style={jobMenuItemStyle}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          ><Copy size={13} style={{ color: '#2563EB' }} /> Duplicate</button>
          <button
            type="button"
            onClick={() => { setDraftMenuOpen(false); openEditForm(selectedDraft, true) }}
            style={jobMenuItemStyle}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          ><Pencil size={13} style={{ color: '#2563EB' }} /> Edit</button>
          <button
            type="button"
            onClick={() => { setDraftMenuOpen(false); publishDraft(selectedDraft.id) }}
            disabled={actionLoading || !selectedDraft.description?.trim()}
            title={!selectedDraft.description?.trim() ? 'Add a description before publishing' : undefined}
            style={{ ...jobMenuItemStyle, opacity: !selectedDraft.description?.trim() ? 0.45 : 1 }}
            onMouseEnter={e => { if (selectedDraft.description?.trim()) e.currentTarget.style.background = '#F9FAFB' }}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          ><Send size={13} style={{ color: '#2563EB' }} /> Send For Review</button>
          <div style={{ height: 1, background: '#F1F5F9', margin: '4px 6px' }} />
          <button
            type="button"
            onClick={() => { setDraftMenuOpen(false); setDeleteConfirm({ id: selectedDraft.id, title: selectedDraft.title, isDraft: true }) }}
            style={{ ...jobMenuItemStyle, color: '#DC2626' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          ><Trash2 size={13} /> Delete</button>
        </div>,
        document.body
      )}

      {/* ══ Delete confirm modal (draft + live) ══════════════════════════════ */}
      {deleteConfirm && (
        <ModalOverlay onClose={() => setDeleteConfirm(null)} maxWidth="420px">
          <ModalBox>
            <ModalHeader
              title={deleteConfirm.isDraft === false ? 'Delete Job Posting' : 'Delete Draft'}
              icon={<Trash2 size={15} color="#fff" strokeWidth={2.5} />}
              iconBg="linear-gradient(135deg, #EF4444, #DC2626)"
              onClose={() => setDeleteConfirm(null)}
            />
            <div style={{ padding: '20px 24px 0' }}>
              <p style={{ margin: 0, color: '#6B7280', fontSize: '0.9rem', lineHeight: 1.55 }}>
                Permanently delete <strong style={{ color: '#111827' }}>"{deleteConfirm.title}"</strong>? This cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '20px 24px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={modalGhostButtonStyle}>Cancel</button>
              <button onClick={() => deleteDraft(deleteConfirm.id, deleteConfirm.isDraft !== false)} disabled={actionLoading} style={modalDestructiveButtonStyle(actionLoading)}>
                {actionLoading ? <Spinner size={13} /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
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



