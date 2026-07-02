'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  Archive, ArchiveRestore, Briefcase, Building2, CalendarDays, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, Clock, Coffee, Copy, Crown, DollarSign, Filter, FileText, LayoutGrid, MapPin,
  MoreHorizontal, Pencil, Repeat, Send, Sparkles, Timer, Trash2, UserCheck, UserX, Users,
  X, XCircle, Zap,
} from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import {
  ModalOverlay, ModalBox, ModalHeader,
  modalInputStyle, modalLabelStyle, modalErrorBoxStyle,
  modalGhostButtonStyle, modalPrimaryButtonStyle, modalDestructiveButtonStyle,
} from '@/components/modal'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import { CandidateRecommendation } from '@/types/AI'
import { JobApplicant, JobPostingPendingApproval, JobPostingSummary } from '@/types/Recruitment'
import { JobTemplate } from '@/types/JobTemplate'
import { deptColor, setDeptColorOverrides } from '@/lib/deptColor'
import DepartmentBadge from '@/components/DepartmentBadge'
import RoleAvatar from '@/components/RoleAvatar'

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

const PANEL_BORDER = '#E2E8F0'
const cardShadow = '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.04)'

// Posted/submitted timestamp shown on job posting cards, e.g. "Thu, 2 Jul, 10:59AM"
function formatPostedAt(iso: string): string {
  const d = new Date(iso)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' })
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  const hours24 = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 || 12
  return `${weekday}, ${d.getDate()} ${month}, ${hours12}:${minutes}${ampm}`
}

const pageKeyframes = `
  @keyframes blockSlideUp  { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes tabContentIn  { from { opacity: 0; transform: translateY(8px) scale(0.99) } to { opacity: 1; transform: translateY(0) scale(1) } }
  @keyframes deptCardIn    { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
  .recruitment-panel { border: 1px solid ${PANEL_BORDER}; }
  .recruitment-grid { display: grid; grid-template-columns: 440px minmax(0, 1fr); gap: 16px; align-items: start; }
  @media (max-width: 1100px) {
    .recruitment-grid { grid-template-columns: minmax(0, 1fr); }
  }
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
  const [companyLocation, setCompanyLocation] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
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
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // department filter dropdowns — Jobs tab + Review tab (each panel filters independently)
  const [jobsDeptFilter, setJobsDeptFilter] = useState<string>('all')
  const [jobsDeptDropdownOpen, setJobsDeptDropdownOpen] = useState(false)
  const jobsDeptDropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!jobsDeptDropdownOpen) return
    const handler = (e: MouseEvent) => { if (!jobsDeptDropdownRef.current?.contains(e.target as Node)) setJobsDeptDropdownOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [jobsDeptDropdownOpen])

  const [reviewDeptFilter, setReviewDeptFilter] = useState<string>('all')
  const [reviewDeptDropdownOpen, setReviewDeptDropdownOpen] = useState(false)
  const reviewDeptDropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!reviewDeptDropdownOpen) return
    const handler = (e: MouseEvent) => { if (!reviewDeptDropdownRef.current?.contains(e.target as Node)) setReviewDeptDropdownOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [reviewDeptDropdownOpen])

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
  const [formJobStartTime, setFormJobStartTime] = useState('09:00')
  const [formEstHours, setFormEstHours] = useState('')
  const [formUrgency, setFormUrgency] = useState('normal')
  // AI builder
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiPreview, setAiPreview] = useState<null | { title: string; description: string; requirements: string }>(null)
  const [formError, setFormError] = useState('')

  // job templates (UC36)
  const [templates, setTemplates] = useState<JobTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
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
  const [selectedPendingId, setSelectedPendingId] = useState('')
  const [jobsSelected, setJobsSelected] = useState<Set<string>>(new Set())
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [pendingRejectId, setPendingRejectId] = useState('')

  // draft action menu (... button)
  const [draftMenuOpen, setDraftMenuOpen] = useState(false)
  const [draftMenuPos, setDraftMenuPos] = useState({ top: 0, right: 0 })
  const draftMenuBtnRef = useRef<HTMLButtonElement>(null)
  const draftMenuDropRef = useRef<HTMLDivElement>(null)

  const selectedLive = useMemo(() => livePostings.find(p => p.id === selectedLiveId) ?? null, [livePostings, selectedLiveId])
  const selectedArchived = useMemo(() => livePostings.find(p => p.id === selectedArchivedId) ?? null, [livePostings, selectedArchivedId])
  const selectedDraft = useMemo(() => drafts.find(p => p.id === selectedDraftId) ?? null, [drafts, selectedDraftId])
  const selectedPending = useMemo(() => pendingPostings.find(p => p.id === selectedPendingId) ?? null, [pendingPostings, selectedPendingId])

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
      const [liveRes, pendingRes, draftsRes, deptRes, templatesRes] = await Promise.all([
        fetch(`/api/recruitment?company_id=${cid}`),
        fetch(`/api/recruitment?company_id=${cid}&resource=pending_approval`),
        fetch(`/api/recruitment?company_id=${cid}&resource=drafts&user_id=${uid}`),
        fetch(`/api/company/departments?company_id=${cid}`),
        fetch(`/api/job-template?company_id=${cid}`),
      ])
      const [liveData, pendingData, draftsData, deptData, templatesData] = await Promise.all([
        liveRes.json(), pendingRes.json(), draftsRes.json(), deptRes.json(), templatesRes.json(),
      ])
      if (!liveData.success) throw new Error(liveData.message || 'Failed to fetch jobs')
      setLivePostings(liveData.postings ?? [])
      setPendingPostings(pendingData.pendingPostings ?? [])
      setDrafts(draftsData.drafts ?? [])
      if (deptData.success) { setDepartments(deptData.departments ?? []); setDeptColorOverrides(deptData.departments ?? []) }
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
      if (meData.user?.full_name) setOwnerName(meData.user.full_name)

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
    setFormJobDate(''); setFormJobEndDate(''); setFormEstHours(''); setFormUrgency('normal'); setFormJobStartTime('09:00')
    setAiPrompt(''); setAiPreview(null); setFormError('')
  }

  const openEditForm = async (p: JobPostingSummary, isDraft = false) => {
    const raw = p as unknown as Record<string, unknown>
    setEditingId(p.id); setEditingDraft(isDraft); setWizardStep('form')
    const isShift = p.is_recurring
    setFormJobType(isShift ? 'shift' : 'oneoff')
    setFormTitle(p.title); setFormDeptId(p.department_id ?? '')
    setFormEmpType(p.employment_type ?? 'casual'); setFormLocation(p.location ?? '')
    setFormSalaryAmt(p.salary_amount?.toString() ?? ''); setFormSalaryType(p.salary_type ?? (isShift ? 'per hour' : 'flat rate'))
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
    salary_type: formJobType === 'shift' ? 'per hour' : 'flat rate',
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
    setShowTemplates(false)
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

  const saveForm = async (status: 'open' | 'draft') => {
    if (!companyId || !internalUserId) return
    if (!formTitle.trim()) { setFormError('Title is required'); return }
    if (status === 'open' && !formDescription.trim()) { setFormError('Description is required to publish'); return }
    if (status === 'open' && formJobType === 'oneoff' && !formJobStartTime) { setFormError('Start time is required to publish'); return }
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
      if (status === 'open') { setActiveTab('jobs'); showToast(editingId ? 'Job updated' : 'Job posted') }
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

  const decidePosting = async (jobId: string, decision: 'approve_posting' | 'reject_posting', rejection_reason?: string) => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision, job_id: jobId, rejection_reason: rejection_reason ?? '' }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update posting')

      // notify Manager who submitted the posting
      const posting = pendingPostings.find(p => p.id === jobId)
      if (posting?.created_by) {
        try {
          const jobTitle = posting.title ?? 'your job posting'
          const content = decision === 'approve_posting'
            ? `Your job posting "${jobTitle}" has been approved and is now live.`
            : `Your job posting "${jobTitle}" has been rejected${rejection_reason ? `: ${rejection_reason}` : '.'}`
          await fetch('/api/inbox/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from_user_id: internalUserId,
              to_user_id: posting.created_by,
              company_id: companyId,
              content,
            }),
          })
        } catch { /* notification failure is non-fatal */ }
      }

      setSelectedPendingId('')
      setRejectModalOpen(false); setRejectReason(''); setPendingRejectId('')
      await fetchAll(companyId, internalUserId)
      if (decision === 'approve_posting') {
        setActiveTab('jobs')
        setSelectedLiveId(jobId)
        showToast('Job approved and moved to Jobs')
      } else {
        showToast('Job rejected')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update posting')
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
          location: draft.location ?? null,
          employment_type: draft.employment_type ?? null,
          department_id: draft.department_id ?? null,
          salary_amount: draft.salary_amount ?? null,
          salary_type: draft.salary_type ?? null,
          urgency: draft.urgency ?? null,
          estimated_hours: draft.estimated_hours ?? null,
          is_recurring: draft.is_recurring ?? false,
          recurrence_interval: draft.recurrence_interval ?? null,
          recurrence_unit: draft.recurrence_unit ?? null,
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
      showToast(`${archivedSelected.size} job${archivedSelected.size === 1 ? '' : 's'} deleted`)
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
      showToast('Jobs unarchived')
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
      showToast('Jobs archived')
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
          body: JSON.stringify({ action: 'publish_draft', job_id: id }),
        })
      ))
      setDraftsSelected(new Set()); setSelectedDraftId('')
      await fetchAll(companyId, internalUserId)
      setActiveTab('jobs')
      showToast('Drafts published')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish drafts')
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
        body: JSON.stringify({ action: 'publish_draft', job_id: id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to publish draft')
      setSelectedDraftId('')
      await fetchAll(companyId, internalUserId)
      setActiveTab('jobs')
      showToast('Draft published')
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
  const jobsPostings    = useMemo(() => livePostings.filter(p => ['open','closed'].includes(p.status)), [livePostings])
  const archivedPostings = useMemo(() => livePostings.filter(p => p.status === 'archived'), [livePostings])

  const jobsDepts = useMemo(() => ['all', ...Array.from(new Set(jobsPostings.map(p => p.department_name).filter(Boolean)))] as string[], [jobsPostings])
  const filteredJobsPostings = useMemo(() => jobsDeptFilter === 'all' ? jobsPostings : jobsPostings.filter(p => p.department_name === jobsDeptFilter), [jobsPostings, jobsDeptFilter])

  const reviewDepts = useMemo(() => ['all', ...Array.from(new Set(pendingPostings.map(p => p.department_name).filter(Boolean)))] as string[], [pendingPostings])
  const filteredPendingPostings = useMemo(() => reviewDeptFilter === 'all' ? pendingPostings : pendingPostings.filter(p => p.department_name === reviewDeptFilter), [pendingPostings, reviewDeptFilter])

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F1F5F9' }}>
      <style>{pageKeyframes}</style>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', scrollbarGutter: 'stable', animation: 'blockSlideUp 0.38s ease both 0.04s' }}>

        {/* ── Page header ── */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Recruitment
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* ── Card wrapper (tab bar + content) ── */}
        <div style={{ padding: '0 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ── Tab bar ── */}
        <div style={{ padding: '0 0 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: 4, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            {([
              { key: 'jobs' as Tab,   label: 'Posted Jobs' },
              { key: 'review' as Tab, label: 'Review Requests' },
            ]).map(tab => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedArchivedId(''); setArchivedSelected(new Set()); setSelectedDraftId(''); setSelectedPendingId(''); setJobsSelected(new Set()) }}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: '99px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8125rem',
                    border: 'none',
                    background: active ? 'linear-gradient(180deg, #0F172A 0%, #111827 100%)' : 'transparent',
                    color: active ? '#FFFFFF' : '#475569',
                    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    position: 'relative',
                    boxShadow: active ? '0 6px 18px rgba(15,23,42,0.18)' : 'none',
                  }}
                >
                  {tab.label}
                  {tab.key === 'review' && pendingPostings.length > 0 && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div style={{ padding: 0, flex: 1, minHeight: 0, overflowY: 'auto', animation: 'tabContentIn 0.22s ease-out both' }}>
          {error && (
            <div style={{ marginBottom: 12, padding: '11px 14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.84rem', fontWeight: 600 }}>{error}</div>
          )}

          {/* ══ JOBS tab (Open / Closed / Expired) ════════════════════════════ */}
          {activeTab === 'jobs' && (
            <div className="recruitment-grid">

              {/* Left: job list */}
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Briefcase size={15} style={{ color: '#F97316' }} />
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1 }}>All Jobs</span>
                  {jobsSelected.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={archiveJobsSelected}
                        disabled={actionLoading}
                        title={`Archive ${jobsSelected.size} selected`}
                        style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid #FED7AA', background: '#FFF7ED', color: '#EA580C', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                        onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FFEDD5' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FFF7ED' }}
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
                  )}
                  {jobsSelected.size === 0 && (
                    <div ref={jobsDeptDropdownRef} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setJobsDeptDropdownOpen(o => !o)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, height: 36, padding: '0 10px', border: `1.5px solid ${jobsDeptDropdownOpen ? '#F97316' : '#E5E7EB'}`, borderRadius: 8, background: '#FFFFFF', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: jobsDeptDropdownOpen ? '0 0 0 3px rgba(249,115,22,0.10)' : 'none', transition: 'border-color 0.15s' }}
                      >
                        <Filter size={11} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                        {jobsDeptFilter === 'all' ? 'All Departments' : jobsDeptFilter}
                        <ChevronDown size={11} style={{ color: '#9CA3AF', flexShrink: 0, transform: jobsDeptDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                      </button>
                      {jobsDeptDropdownOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 160, background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 50, padding: '4px 0', overflow: 'hidden' }}>
                          {jobsDepts.map(dept => {
                            const active = jobsDeptFilter === dept
                            return (
                              <button key={dept} type="button"
                                onClick={() => { setJobsDeptFilter(dept); setJobsDeptDropdownOpen(false) }}
                                style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: active ? '#FFF7ED' : 'transparent', color: active ? '#EA580C' : '#374151', fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer' }}
                                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                              >
                                {dept === 'all' ? 'All Departments' : dept}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px 14px' }}>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: '#9CA3AF', fontSize: '0.875rem' }}>
                    <Spinner size={14} dark /> Loading...
                  </div>
                ) : filteredJobsPostings.length === 0 ? (
                  <div style={{ padding: '28px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <Briefcase size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{jobsDeptFilter === 'all' ? 'No job postings yet.' : `No job postings for ${jobsDeptFilter}.`}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredJobsPostings.map((p, idx) => {
                  const isSelected = selectedLiveId === p.id
                  const checked = jobsSelected.has(p.id)
                  const active = isSelected || checked
                  const dc = p.department_id ? deptColor(p.department_id) : '#94A3B8'
                  return (
                    <article
                      key={p.id}
                      onClick={() => setSelectedLiveId(p.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 12,
                        border: `1px solid ${active ? dc : PANEL_BORDER}`,
                        borderRadius: 10, padding: '16px 18px',
                        background: active ? `${dc}0d` : '#F9FAFB',
                        cursor: 'pointer', overflow: 'hidden',
                        transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s, background 0.18s',
                        animation: `deptCardIn 0.28s ease both ${idx * 55}ms`,
                        boxShadow: active ? `0 4px 16px ${dc}22` : undefined,
                      }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.11)'; e.currentTarget.style.borderColor = dc } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = PANEL_BORDER } }}
                    >
                      {/* Department + job type badge row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <DepartmentBadge departmentId={p.department_id} departmentName={p.department_name} />
                          {p.is_recurring
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
                            : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>One-Off Job</span>
                          }
                        </div>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setJobsSelected(prev => { const s = new Set(prev); checked ? s.delete(p.id) : s.add(p.id); return s }) }}
                          style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: checked ? '2px solid #F97316' : '2px solid #D1D5DB', background: checked ? '#F97316' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        >
                          {checked && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                        </button>
                      </div>
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{p.title}</h3>
                        {p.pending_count > 0 && (
                          <span
                            title={`${p.pending_count} new application${p.pending_count > 1 ? 's' : ''}`}
                            style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }}
                          />
                        )}
                      </div>
                      {/* Applicant / confirmed count + posted date row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} title="Applicants">
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
                              <Users size={15} />
                            </span>
                            <span style={{ color: '#111827', fontSize: 15, fontWeight: 700 }}>{p.applicant_count}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} title="Confirmed">
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#ECFDF5', color: '#059669', flexShrink: 0 }}>
                              <UserCheck size={15} />
                            </span>
                            <span style={{ color: '#111827', fontSize: 15, fontWeight: 700 }}>{p.accepted_count}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.78rem', color: '#94A3B8', flexShrink: 0 }}>{formatPostedAt(p.created_at)}</span>
                      </div>
                    </article>
                  )
                  })}
                  </div>
                )}
                </div>
              </div>

              {/* Right: posting detail + applicants */}
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {!selectedLive ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 24px' }}>
                    <div style={{ padding: '40px 48px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, width: '100%' }}>
                      <ClipboardList size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Select a job posting</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Posting header — split to mirror the two-column body */}
                    <div style={{ borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center' }}>
                      {/* Left section: title + badge + action buttons */}
                      <div style={{ flex: '0 0 min(860px, 62%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'nowrap' }}>
                          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: 700, lineHeight: 1, alignSelf: 'center' }}>{selectedLive.title}</h2>
                          {selectedLive.is_recurring ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              Shift Job
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              One-Off Job
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={() => void runPostingAction('archive_posting')}
                            disabled={actionLoading}
                            title="Archive job"
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #FED7AA', background: '#FFF7ED', color: '#EA580C', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                            onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FFEDD5' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#FFF7ED' }}
                          ><Archive size={14} /></button>
                          <button
                            onClick={() => setDeleteConfirm({ id: selectedLive.id, title: selectedLive.title, isDraft: false })}
                            disabled={actionLoading}
                            title="Delete job"
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', display: 'grid', placeItems: 'center', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.65 : 1 }}
                            onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                          ><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {/* Right section: empty — applicants header is inside the column */}
                      <div style={{ flex: 1 }} />
                    </div>

                    {/* ── Two-column body ── */}
                    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                      {/* LEFT: job details */}
                      {(() => {
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
                          <div style={{ flex: '0 0 min(860px, 62%)', borderRight: '1px solid #F0F4F8', overflowY: 'auto', padding: '20px 24px 24px' }}>

                            {/* ── Key Stats ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                              {/* Pay */}
                              {selectedLive.salary_amount != null ? (
                                <div style={{ ...statCard, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                  <div style={statLabel}>
                                    <DollarSign size={11} style={{ color: '#F97316' }} />
                                    <span style={statLabelText('#F97316')}>{isShiftJob ? 'Pay' : 'Flat Rate'}</span>
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
                                      <FileText size={13} style={{ color: '#F97316' }} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75 }}>{selectedLive.description}</p>
                                  </div>
                                )}
                                {selectedLive.requirements && (
                                  <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                      <ClipboardList size={13} style={{ color: '#F97316' }} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requirements</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{selectedLive.requirements}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* RIGHT: applicants */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 24px', background: '#FAFAFA', borderRadius: '0 0 16px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Applicants</p>
                          </div>
                          <button
                            onClick={recommendCandidates}
                            disabled={aiLoading || applicants.length === 0}
                            style={{ height: 36, padding: '0 16px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 9, cursor: aiLoading || applicants.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, flexShrink: 0 }}
                            onMouseEnter={e => { if (!aiLoading && applicants.length > 0) e.currentTarget.style.background = '#EA580C' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#F97316' }}
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
                              {applicant.status === 'pending' && (
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
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ ARCHIVED tab ══════════════════════════════════════════════════ */}
          {activeTab === 'archived' && (
            <div className="recruitment-grid">

              {/* Left: archived list */}
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
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
                  {archivedPostings.map((p, idx) => {
                  const isSelected = selectedArchivedId === p.id
                  const checked = archivedSelected.has(p.id)
                  return (
                    <div
                      key={p.id}
                      className="dept-card"
                      onClick={() => setSelectedArchivedId(p.id)}
                      style={{
                        animationDelay: `${idx * 55}ms`,
                        border: (isSelected || checked) ? '2px solid #F97316' : '2px solid #E5E7EB',
                        borderRadius: 14,
                        padding: '14px 14px 12px',
                        background: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        boxShadow: (isSelected || checked) ? '0 0 0 3px rgba(249,115,22,0.10)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (isSelected || checked) return
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.10)'
                        e.currentTarget.style.borderColor = '#FDBA74'
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
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setArchivedSelected(prev => { const s = new Set(prev); checked ? s.delete(p.id) : s.add(p.id); return s }) }}
                          style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: checked ? '2px solid #F97316' : '2px solid #D1D5DB', background: checked ? '#F97316' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        >
                          {checked && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '0.725rem', color: '#C4C9D4' }}>{formatPostedAt(p.created_at)}</span>
                      </div>
                    </div>
                  )
                  })}
                  </div>
                )}
              </div>

              {/* Right: archived detail (view-only) */}
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>One-Off Job</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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
                        </div>
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
                                <div style={{ ...statCard, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                  <div style={statLabel}><DollarSign size={11} style={{ color: '#F97316' }} /><span style={statLabelText('#F97316')}>{isShiftJob ? 'Pay' : 'Flat Rate'}</span></div>
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
                                      <FileText size={13} style={{ color: '#F97316' }} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75 }}>{selectedArchived.description}</p>
                                  </div>
                                )}
                                {selectedArchived.requirements && (
                                  <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                      <ClipboardList size={13} style={{ color: '#F97316' }} />
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

          {/* ══ REVIEW tab ════════════════════════════════════════════════════ */}
          {activeTab === 'review' && (
            <div className="recruitment-grid">

              {/* Left: pending list */}
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ClipboardList size={15} style={{ color: '#F97316' }} />
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1 }}>Review Jobs</span>
                  <div ref={reviewDeptDropdownRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setReviewDeptDropdownOpen(o => !o)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, height: 36, padding: '0 10px', border: `1.5px solid ${reviewDeptDropdownOpen ? '#F97316' : '#E5E7EB'}`, borderRadius: 8, background: '#FFFFFF', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: reviewDeptDropdownOpen ? '0 0 0 3px rgba(249,115,22,0.10)' : 'none', transition: 'border-color 0.15s' }}
                    >
                      <Filter size={11} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                      {reviewDeptFilter === 'all' ? 'All Departments' : reviewDeptFilter}
                      <ChevronDown size={11} style={{ color: '#9CA3AF', flexShrink: 0, transform: reviewDeptDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>
                    {reviewDeptDropdownOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 160, background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 50, padding: '4px 0', overflow: 'hidden' }}>
                        {reviewDepts.map(dept => {
                          const active = reviewDeptFilter === dept
                          return (
                            <button key={dept} type="button"
                              onClick={() => { setReviewDeptFilter(dept); setReviewDeptDropdownOpen(false) }}
                              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: active ? '#FFF7ED' : 'transparent', color: active ? '#EA580C' : '#374151', fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer' }}
                              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                            >
                              {dept === 'all' ? 'All Departments' : dept}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: '#9CA3AF', fontSize: '0.875rem' }}>
                    <Spinner size={14} dark /> Loading...
                  </div>
                ) : filteredPendingPostings.length === 0 ? (
                  <div style={{ padding: '28px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <CheckCircle size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{reviewDeptFilter === 'all' ? 'All caught up.' : `No pending reviews for ${reviewDeptFilter}.`}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredPendingPostings.map((p, idx) => {
                  const isSelected = selectedPendingId === p.id
                  const dc = p.department_id ? deptColor(p.department_id) : '#94A3B8'
                  return (
                    <article
                      key={p.id}
                      onClick={() => setSelectedPendingId(p.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 12,
                        border: `1px solid ${isSelected ? dc : PANEL_BORDER}`,
                        borderRadius: 10, padding: '16px 18px',
                        background: isSelected ? `${dc}0d` : '#F9FAFB',
                        cursor: 'pointer', overflow: 'hidden',
                        transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s, background 0.18s',
                        animation: `deptCardIn 0.28s ease both ${idx * 55}ms`,
                        boxShadow: isSelected ? `0 4px 16px ${dc}22` : undefined,
                      }}
                      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.11)'; e.currentTarget.style.borderColor = dc } }}
                      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = PANEL_BORDER } }}
                    >
                      {/* Department + job type badge row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <DepartmentBadge departmentId={p.department_id} departmentName={p.department_name} />
                        {p.is_recurring
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>One-Off Job</span>
                        }
                      </div>
                      {/* Title row */}
                      <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</h3>
                      {/* Submitter + posted date row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <RoleAvatar role="Manager" size={22} photoUrl={p.submitter_photo_url} />
                          <span style={{ color: '#111827', fontSize: 13, fontWeight: 600 }}>{p.submitter_name ?? 'Manager'}</span>
                        </div>
                        <span style={{ fontSize: '0.78rem', color: '#94A3B8', flexShrink: 0 }}>{formatPostedAt(p.created_at)}</span>
                      </div>
                    </article>
                  )
                  })}
                  </div>
                )}
                </div>
              </div>

              {/* Right: pending detail */}
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden' }}>
                {!selectedPending ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 24px' }}>
                    <div style={{ padding: '40px 48px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, width: '100%' }}>
                      <ClipboardList size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Select a posting to review</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'nowrap' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: 700, lineHeight: 1, alignSelf: 'center' }}>{selectedPending.title}</h2>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {selectedPending.submitter_name ?? 'Manager'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => decidePosting(selectedPending.id, 'approve_posting')} disabled={actionLoading}
                          style={{ height: 34, padding: '0 14px', border: 'none', borderRadius: 9, background: '#059669', color: '#FFFFFF', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, opacity: actionLoading ? 0.6 : 1 }}
                        ><CheckCircle size={13} /> Approve</button>
                        <button onClick={() => { setPendingRejectId(selectedPending.id); setRejectReason(''); setRejectModalOpen(true) }} disabled={actionLoading}
                          style={{ height: 34, padding: '0 14px', border: 'none', borderRadius: 9, background: '#DC2626', color: '#FFFFFF', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, opacity: actionLoading ? 0.6 : 1 }}
                        ><XCircle size={13} /> Reject</button>
                      </div>
                    </div>

                    {/* Body — same layout as All Jobs detail */}
                    {(() => {
                      const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(m).padStart(2, '0')} ${ap}` }
                      const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
                      const fmtShort = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}` }
                      const isShiftJob = selectedPending.is_recurring
                      const shiftDate = selectedPending.shift_date
                      const shiftStart = selectedPending.shift_start_time
                      const shiftEnd = selectedPending.shift_end_time
                      const breakStart = selectedPending.break_start_time
                      const breakEnd = selectedPending.break_end_time
                      const estimatedHours = selectedPending.estimated_hours
                      const urgency = selectedPending.urgency ?? 'normal'
                      const urgencyLabel = urgency === 'urgent' ? 'Urgent' : urgency === 'high' ? 'High' : 'Normal'
                      let totalAmt: number | null = null
                      if (isShiftJob && selectedPending.salary_amount != null && shiftStart && shiftEnd) {
                        let worked = toMins(shiftEnd) - toMins(shiftStart)
                        if (breakStart && breakEnd) worked -= (toMins(breakEnd) - toMins(breakStart))
                        if (worked > 0) totalAmt = Math.round(selectedPending.salary_amount * (worked / 60) * 100) / 100
                      }
                      const statCard: React.CSSProperties = { borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 72 }
                      const statLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }
                      const statLabelText = (color: string): React.CSSProperties => ({ fontSize: '0.75rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' })
                      const statValue: React.CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#374151', lineHeight: 1.3 }
                      return (
                        <div style={{ padding: '20px 24px 24px', overflowY: 'auto' }}>
                          {/* Stat cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                            {selectedPending.salary_amount != null ? (
                              <div style={{ ...statCard, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                <div style={statLabel}><DollarSign size={11} style={{ color: '#F97316' }} /><span style={statLabelText('#F97316')}>{isShiftJob ? 'Pay' : 'Flat Rate'}</span></div>
                                <p style={statValue}>{isShiftJob ? `$${selectedPending.salary_amount}/Hr${totalAmt != null ? ` ($${totalAmt % 1 === 0 ? totalAmt.toFixed(0) : totalAmt.toFixed(2)})` : ''}` : `$${selectedPending.salary_amount}`}</p>
                              </div>
                            ) : (
                              <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No pay set</span>
                              </div>
                            )}
                            {shiftDate ? (
                              <div style={{ ...statCard, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                                <div style={statLabel}><CalendarDays size={11} style={{ color: '#0284C7' }} /><span style={statLabelText('#0284C7')}>Date</span></div>
                                <p style={statValue}>{new Date(shiftDate).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                              </div>
                            ) : (
                              <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No date set</span>
                              </div>
                            )}
                            {isShiftJob ? ((shiftStart || shiftEnd) ? (
                              <div style={{ ...statCard, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                <div style={statLabel}><Clock size={11} style={{ color: '#059669' }} /><span style={statLabelText('#059669')}>Hours</span></div>
                                <p style={statValue}>{shiftStart ? fmtShort(shiftStart) : '—'} – {shiftEnd ? fmtShort(shiftEnd) : '—'}</p>
                              </div>
                            ) : (
                              <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No hours set</span>
                              </div>
                            )) : (estimatedHours ? (
                              <div style={{ ...statCard, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                <div style={statLabel}><Clock size={11} style={{ color: '#059669' }} /><span style={statLabelText('#059669')}>Estimation</span></div>
                                <p style={statValue}>{estimatedHours} Hours</p>
                              </div>
                            ) : (
                              <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No hours set</span>
                              </div>
                            ))}
                            {isShiftJob ? ((breakStart || breakEnd) ? (
                              <div style={{ ...statCard, background: '#FDF4FF', border: '1px solid #E9D5FF' }}>
                                <div style={statLabel}><Coffee size={11} style={{ color: '#9333EA' }} /><span style={statLabelText('#9333EA')}>Break</span></div>
                                <p style={statValue}>{breakStart ? fmtShort(breakStart) : '—'} – {breakEnd ? fmtShort(breakEnd) : '—'}</p>
                              </div>
                            ) : (
                              <div style={{ ...statCard, background: '#F9FAFB', border: '1px solid #E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No break</span>
                              </div>
                            )) : (
                              <div style={{ ...statCard, background: '#FFF1F2', border: '1px solid #FECDD3' }}>
                                <div style={statLabel}><Zap size={11} style={{ color: '#E11D48' }} /><span style={statLabelText('#E11D48')}>Urgency</span></div>
                                <p style={statValue}>{urgencyLabel}</p>
                              </div>
                            )}
                          </div>
                          {/* Department row */}
                          {(selectedPending.department_name || selectedPending.assigned_employee_name) && (
                            <div style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRight: selectedPending.assigned_employee_name ? '1px solid #E5E7EB' : undefined, background: '#FAFAFA' }}>
                                <LayoutGrid size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.875rem', color: '#374151' }}>{selectedPending.department_name ?? '—'}</span>
                              </div>
                              {selectedPending.assigned_employee_name && (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: '#FAFAFA' }}>
                                  <UserCheck size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>{selectedPending.assigned_employee_name}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {/* Scope & Requirements */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {selectedPending.description && (
                              <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                  <FileText size={13} style={{ color: '#F97316' }} />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75 }}>{selectedPending.description}</p>
                              </div>
                            )}
                            {selectedPending.requirements && (
                              <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                  <ClipboardList size={13} style={{ color: '#F97316' }} />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requirements</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{selectedPending.requirements}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ DRAFTS tab ════════════════════════════════════════════════════ */}
          {activeTab === 'drafts' && (
            <div className="recruitment-grid">

              {/* Left: draft list */}
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={15} style={{ color: '#F97316' }} />
                  </div>
                  <span className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px', flex: 1 }}>Draft Jobs</span>
                  {draftsSelected.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={publishDraftsSelected}
                        disabled={actionLoading}
                        title={`Post ${draftsSelected.size} selected`}
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
                        border: (isSelected || checked) ? '2px solid #F97316' : '2px solid #E5E7EB',
                        borderRadius: 14,
                        padding: '14px 14px 12px',
                        background: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        boxShadow: (isSelected || checked) ? '0 0 0 3px rgba(249,115,22,0.10)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (isSelected || checked) return
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.10)'
                        e.currentTarget.style.borderColor = '#FDBA74'
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
                          style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: checked ? '2px solid #F97316' : '2px solid #D1D5DB', background: checked ? '#F97316' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        >
                          {checked && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                        </button>
                      </div>
                      {/* Title + date row */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                        <strong style={{ fontSize: '0.9rem', color: '#1C1C1E', lineHeight: 1.4, flex: 1, minWidth: 0 }}>{p.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#C4C9D4', flexShrink: 0 }}>{formatPostedAt(p.created_at)}</span>
                      </div>
                    </div>
                  )
                  })}
                  </div>
                )}
              </div>

              {/* Right: draft detail */}
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
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
                                <div style={{ ...statCard, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                  <div style={statLabel}><DollarSign size={11} style={{ color: '#F97316' }} /><span style={statLabelText('#F97316')}>{isShiftJob ? 'Pay' : 'Flat Rate'}</span></div>
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
                                  <FileText size={13} style={{ color: '#F97316' }} />
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
                                  <ClipboardList size={13} style={{ color: '#F97316' }} />
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

      {/* ══ Reject reason modal ════════════════════════════════════════════════ */}
      {rejectModalOpen && createPortal(
        <ModalOverlay onClose={() => { setRejectModalOpen(false); setRejectReason(''); setPendingRejectId('') }} maxWidth="420px">
          <ModalBox>
            <ModalHeader
              title="Reject Job Posting"
              icon={<Trash2 size={15} color="#fff" strokeWidth={2.5} />}
              iconBg="linear-gradient(135deg, #EF4444, #DC2626)"
              onClose={() => { setRejectModalOpen(false); setRejectReason(''); setPendingRejectId('') }}
            />
            <div style={{ padding: '20px 24px 0' }}>
              <p style={{ margin: '0 0 14px', color: '#6B7280', fontSize: '0.9rem', lineHeight: 1.55 }}>
                Provide a reason so the manager can understand what needs to be fixed.
              </p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Salary range is missing, please add before resubmitting."
                rows={4}
                style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
              />
            </div>
            {error && <div style={modalErrorBoxStyle}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '20px 24px' }}>
              <button onClick={() => { setRejectModalOpen(false); setRejectReason(''); setPendingRejectId('') }} style={modalGhostButtonStyle}>
                Cancel
              </button>
              <button onClick={() => decidePosting(pendingRejectId, 'reject_posting', rejectReason)} disabled={actionLoading || !rejectReason.trim()} style={modalDestructiveButtonStyle(actionLoading || !rejectReason.trim())}>
                {actionLoading ? <Spinner size={13} /> : <Trash2 size={13} />} Reject
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>,
        document.body
      )}

      {/* ══ Save as Template modal ═════════════════════════════════════════════ */}
      {saveTemplateModalOpen && createPortal(
        <ModalOverlay onClose={() => { setSaveTemplateModalOpen(false); setNewTemplateName('') }} maxWidth="420px">
          <ModalBox>
            <ModalHeader
              title="Save as Template"
              icon={<ClipboardList size={15} color="#fff" strokeWidth={2.5} />}
              iconBg="linear-gradient(135deg, #F97316, #EA580C)"
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
                onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
              />
            </div>
            {formError && <div style={modalErrorBoxStyle}>{formError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '20px 24px' }}>
              <button onClick={() => { setSaveTemplateModalOpen(false); setNewTemplateName('') }} style={modalGhostButtonStyle}>
                Cancel
              </button>
              <button onClick={saveAsTemplate} disabled={templateActionLoading || !newTemplateName.trim()} style={modalPrimaryButtonStyle(templateActionLoading || !newTemplateName.trim())}>
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
                    {!editingId && templates.length > 0 && (
                      <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                        <button onClick={() => setShowTemplates(v => !v)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F9FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ClipboardList size={15} color="#6B7280" />
                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#374151' }}>My Templates</span>
                            <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 400 }}>Start from a saved template</span>
                          </div>
                          <ChevronRight size={14} color="#9CA3AF" style={{ transform: showTemplates ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                        </button>
                        {showTemplates && (
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
                    <div>
                      <label style={lStyle}>Application Deadline</label>
                      <RDrop value={formExpiryPreset} options={EXPIRY_PRESETS} onChange={handleExpiryPreset} />
                      {formExpiryPreset === 'custom' && (
                        <input type="date" value={formExpiresAt} min={new Date().toISOString().slice(0, 10)}
                          onChange={e => setFormExpiresAt(e.target.value)} style={{ ...iStyle, marginTop: 8 }} />
                      )}
                    </div>
                    <button onClick={() => { setNewTemplateName(formTitle); setFormError(''); setSaveTemplateModalOpen(true) }} disabled={!formTitle.trim()}
                      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, color: formTitle.trim() ? '#F97316' : '#D1D5DB', fontSize: '0.8125rem', fontWeight: 700, cursor: formTitle.trim() ? 'pointer' : 'default' }}>
                      <ClipboardList size={13} /> Save as Template
                    </button>
                    {formJobType === 'oneoff' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div><label style={lStyle}>Est. Hours</label><input value={formEstHours} onChange={e => setFormEstHours(e.target.value)} placeholder="e.g. 4–6 hours" style={iStyle} /></div>
                        <div>
                          <label style={lStyle}>Start Time <span style={{ color: '#F97316' }}>*</span></label>
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
                                setShiftAvailableDates(Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).filter(([date]) => date >= new Date().toISOString().slice(0, 10)).map(([date, t]) => ({ date, start_time: t.start_time, end_time: t.end_time })))
                              }
                            }} />
                        </div>
                        {(formDeptId || editingId) && (
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
                        {(formShiftDate || editingId) && (
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
                        {(formAssignedEmployeeId || editingId) && (
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
                                setShiftAvailableDates(Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).filter(([date]) => date >= new Date().toISOString().slice(0, 10)).map(([date, t]) => ({ date, start_time: t.start_time, end_time: t.end_time })))
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
                  <button onClick={() => saveForm(editingDraft ? 'draft' : 'open')} disabled={actionLoading} style={modalPrimaryButtonStyle(actionLoading)}>
                    {actionLoading ? <Spinner size={13} /> : <Check size={13} />} {editingDraft ? 'Save Changes' : editingId ? 'Save Changes' : 'Post Job'}
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
          ><Copy size={13} style={{ color: '#F97316' }} /> Duplicate</button>
          <button
            type="button"
            onClick={() => { setDraftMenuOpen(false); openEditForm(selectedDraft, true) }}
            style={jobMenuItemStyle}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          ><Pencil size={13} style={{ color: '#F97316' }} /> Edit</button>
          <button
            type="button"
            onClick={() => { setDraftMenuOpen(false); publishDraft(selectedDraft.id) }}
            disabled={actionLoading || !selectedDraft.description?.trim()}
            title={!selectedDraft.description?.trim() ? 'Add a description before publishing' : undefined}
            style={{ ...jobMenuItemStyle, opacity: !selectedDraft.description?.trim() ? 0.45 : 1 }}
            onMouseEnter={e => { if (selectedDraft.description?.trim()) e.currentTarget.style.background = '#F9FAFB' }}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          ><Send size={13} style={{ color: '#F97316' }} /> Publish</button>
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
