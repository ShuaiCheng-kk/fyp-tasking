'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  Archive, ArchiveRestore, ArrowRight, Briefcase, Building2, Cake, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, Clock, Copy, Crown, DollarSign, Eye, FileText, LayoutGrid, MapPin, MousePointerClick,
  Pencil, Plus, Repeat, Send, Shirt, Sparkles, Timer, Trash2, UserCheck, UserX, Users,
  X, XCircle, Zap,
} from 'lucide-react'
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
import { JobApplicant, JobPostingPendingApproval, JobPostingSummary, PoolInviteResult, PoolWorker } from '@/types/Recruitment'
import { JobTemplate, JobTemplateUsageStats } from '@/types/JobTemplate'
import { deptColor, setDeptColorOverrides } from '@/lib/deptColor'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import { useIsCompactContainer } from '@/hooks/useIsCompactContainer'
import DepartmentBadge from '@/components/DepartmentBadge'
import RoleAvatar from '@/components/RoleAvatar'
import DatePickerField from '@/components/DatePickerField'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'

type Tab = 'jobs' | 'closed' | 'post'
type Department = { id: string; name: string }

// ─── shared tiny styles ──────────────────────────────────────────────────────

// number inputs natively accept e/E (scientific notation) and +/- — block them
const blockNonNumericKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
}

// List-aware typing for Responsibilities / Skills textareas: Enter continues a
// "• " or "N. " list (empty item exits it); "- " or "* " at line start becomes "• ".
// execCommand keeps the controlled value in sync (fires onChange) and preserves undo.
const handleListKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  const el = e.currentTarget
  const { selectionStart, selectionEnd, value } = el
  if (selectionStart !== selectionEnd) return
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
  const line = value.slice(lineStart, selectionStart)
  if (e.key === 'Enter' && !e.shiftKey) {
    const bullet = line.match(/^(\s*)•\s?(.*)$/)
    const numbered = line.match(/^(\s*)(\d+)[.)]\s?(.*)$/)
    if (bullet) {
      e.preventDefault()
      if (bullet[2].trim()) document.execCommand('insertText', false, `\n${bullet[1]}• `)
      else { el.setSelectionRange(lineStart, selectionStart); document.execCommand('delete') }
    } else if (numbered) {
      e.preventDefault()
      if (numbered[3].trim()) document.execCommand('insertText', false, `\n${numbered[1]}${parseInt(numbered[2], 10) + 1}. `)
      else { el.setSelectionRange(lineStart, selectionStart); document.execCommand('delete') }
    }
  } else if (e.key === ' ' && /^(\s*)[-*]$/.test(line)) {
    e.preventDefault()
    el.setSelectionRange(selectionStart - 1, selectionStart)
    document.execCommand('insertText', false, '• ')
  }
}

// How long until a posting's application deadline auto-closes it — shown as a header pill
// instead of buried in the Schedule list. null = no deadline set, nothing to show.
const deadlineCountdown = (expiresAt: string | null): { label: string; expired: boolean } | null => {
  if (!expiresAt) return null
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  if (diffMs <= 0) return { label: 'Application Closed', expired: true }
  const totalMins = Math.floor(diffMs / 60000)
  const days = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days >= 1) return { label: `Closes in ${days}d ${hours}h`, expired: false }
  if (hours >= 1) return { label: `Closes in ${hours}h ${mins}m`, expired: false }
  return { label: `Closes in ${Math.max(1, mins)}m`, expired: false }
}

const fmt12Time = (t: string) => {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// Shared by every job-detail panel. salary_amount is always the PER-PERSON rate. withTotal
// controls whether the label also computes per-person earnings × openings: Pending Approval
// shows the total (the Owner is deciding budget), while Active/Closed/Archived pass false —
// their detail body is a preview of the public Job Board post, which only shows the plain rate.
function buildPayLabel(p: {
  job_type: string | null
  salary_amount: number | null
  job_start_time: string | null
  job_end_time: string | null
  break_start_time: string | null
  break_end_time: string | null
  openings: number | null
}, withTotal: boolean = true): string | null {
  if (p.salary_amount == null) return null
  const isShift = p.job_type === 'shift'
  if (!withTotal) return isShift ? `$${p.salary_amount}/hr` : `$${p.salary_amount} flat rate`
  const positions = Math.max(1, p.openings ?? 1)
  const fmtAmt = (n: number) => (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2))
  if (isShift) {
    if (!p.job_start_time || !p.job_end_time) return `$${p.salary_amount}/hr`
    const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    let worked = toMins(p.job_end_time) - toMins(p.job_start_time)
    if (p.break_start_time && p.break_end_time) worked -= (toMins(p.break_end_time) - toMins(p.break_start_time))
    if (worked <= 0) return `$${p.salary_amount}/hr`
    const perPerson = Math.round(p.salary_amount * (worked / 60) * 100) / 100
    const total = Math.round(perPerson * positions * 100) / 100
    return positions > 1
      ? `$${p.salary_amount}/hr ($${fmtAmt(perPerson)} × ${positions} = $${fmtAmt(total)})`
      : `$${p.salary_amount}/hr ($${fmtAmt(perPerson)})`
  }
  const total = Math.round(p.salary_amount * positions * 100) / 100
  return positions > 1
    ? `$${p.salary_amount}/person flat rate × ${positions} = $${fmtAmt(total)} total`
    : `$${p.salary_amount} flat rate`
}

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
// Shared header-row height for every panel's title bar (Job Sources, Active Jobs, Review Jobs,
// Detail, Applicants) — locks them to Job Sources' natural height (17px padding + its 36px
// button) so every panel header's bottom divider lines up, whatever that panel's own content is.
const LIST_HEADER_HEIGHT = 70

const EXPERIENCE_REQUIRED_OPTIONS = [
  { value: 'Not Required', label: 'Not Required' },
  { value: 'Preferred', label: 'Preferred' },
  { value: '6+ Months', label: '6+ Months' },
  { value: '1+ Year', label: '1+ Year' },
  { value: '2+ Years', label: '2+ Years' },
]

// Applicant avatar — profile photo if set, else a dark circle with the initial.
function ApplicantAvatar({ applicant, size = 46 }: { applicant: JobApplicant; size?: number }) {
  if (applicant.profile_photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={applicant.profile_photo_url} alt={applicant.full_name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#F3F4F6', display: 'block' }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: size * 0.34 }}>
      {applicant.full_name?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  )
}

// AI fit gauge — a single glance beats "Score: 60/100 — review": the filled (green) portion is
// the match strength, the pink remainder reads as the gap. No caption text underneath — the two
// segments carry their explanation as a hover tooltip (why it's justified / what argues against
// it), so the row stays just a clean bar. A custom tooltip rather than the native `title`
// attribute, which is unreliably slow/silent across browsers.
function AiFitGauge({ score, reason, risk }: { score: number; reason?: string; risk?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)))
  const [hovered, setHovered] = useState<'reason' | 'risk' | null>(null)
  const activeText = hovered === 'reason' ? reason : hovered === 'risk' ? risk : null
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 16, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
          <div
            onMouseEnter={() => { if (reason) setHovered('reason') }}
            onMouseLeave={() => setHovered(h => h === 'reason' ? null : h)}
            style={{ width: `${pct}%`, height: '100%', background: '#10B981', cursor: reason ? 'help' : 'default' }}
          />
          <div
            onMouseEnter={() => { if (risk) setHovered('risk') }}
            onMouseLeave={() => setHovered(h => h === 'risk' ? null : h)}
            style={{ width: `${100 - pct}%`, height: '100%', background: '#FECDD3', cursor: risk ? 'help' : 'default' }}
          />
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', flexShrink: 0, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
      </div>
      {activeText && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, maxWidth: 320,
          background: '#111827', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.5,
          padding: '8px 10px', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.2)', zIndex: 30,
          pointerEvents: 'none',
        }}>
          {activeText}
        </div>
      )}
    </div>
  )
}

// Outlined status/action pill — same treatment as the Off Day request card's Approve/Modify and
// status pills (rounded, 1.5px border, 6×16 padding).
function ApplicantPill({ tone, label, icon }: {
  tone: { bg: string; border: string; text: string }
  label: string
  icon?: React.ReactNode
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: tone.text, background: tone.bg, border: `1.5px solid ${tone.border}`, borderRadius: 999, padding: '6px 16px', whiteSpace: 'nowrap' }}>
      {icon}{label}
    </span>
  )
}

// Compact applicant card: avatar (with the name beneath it) opens a detail modal on click, the
// Applied timestamp sits next to it, and the per-context actions are on the right. Skills /
// certificates / resume / phone all live in the modal, so the card stays narrow. `children` is an
// optional full-width footer (the AI verdict).
function ApplicantCard({ applicant, actions, onOpenDetail, children, dateLabel = 'Applied', dateValue }: {
  applicant: JobApplicant
  actions?: React.ReactNode
  onOpenDetail: () => void
  children?: React.ReactNode
  // The middle timestamp — defaults to the applied-at time, but the Confirmed panel overrides it
  // with the confirmation time.
  dateLabel?: string
  dateValue?: string | null
}) {
  const isCompactCard = useIsCompactViewport(1400)
  const sectionLabel: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: 0 }
  const divider = <div style={{ width: 1, alignSelf: 'stretch', background: '#E5E7EB', flexShrink: 0 }} />
  return (
    <div style={{ background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 16, padding: '14px 16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: isCompactCard ? 8 : 14, flexWrap: 'wrap' }}>
        {/* Avatar + name — fixed-width column so the divider lines up across every card no matter
            how long the name is. Clicking opens the full detail modal. Narrower below the compact
            breakpoint so the date + actions columns still have room instead of squishing. */}
        <button type="button" onClick={onOpenDetail} title="View applicant details"
          style={{ width: isCompactCard ? 76 : 132, flexShrink: 0, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ApplicantAvatar applicant={applicant} size={54} />
          <strong style={{ color: '#111827', fontSize: '0.82rem', lineHeight: 1.25, textAlign: 'center', wordBreak: 'break-word' }}>{applicant.full_name}</strong>
        </button>

        {divider}

        {/* Applied timestamp — vertically centred, but the label + time are LEFT-aligned so they
            start at the same x (right after the divider) on every card, independent of the name
            length on the left or the action width on the right. */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 6 }}>
          <label style={sectionLabel}>{dateLabel}</label>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{formatCompactAt(dateValue ?? applicant.applied_at)}</span>
        </div>

        {actions && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{actions}</div>}
      </div>
      {children}
    </div>
  )
}

// Full applicant profile in a modal — opened from the compact card's avatar. Certificate and
// resume names are links the Owner clicks to open the uploaded file.
function ApplicantDetailModal({ applicant, onClose }: { applicant: JobApplicant; onClose: () => void }) {
  const certs = applicant.certificates ?? []
  const rowLabel: React.CSSProperties = { ...modalLabelStyle, margin: '0 0 4px' }
  const rowValue: React.CSSProperties = { margin: 0, fontSize: '0.9rem', color: '#111827', lineHeight: 1.5 }
  // Same size/weight as the plain text rows — just orange + underlined to signal "clickable".
  const linkStyle: React.CSSProperties = { ...rowValue, color: '#EA580C', textDecoration: 'underline' }
  return (
    <ModalOverlay onClose={onClose} maxWidth="440px">
      <ModalBox>
        <ModalHeader title="Applicant" icon={<Users size={15} color="#fff" strokeWidth={2.5} />} onClose={onClose} />
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ApplicantAvatar applicant={applicant} size={56} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{applicant.full_name}</p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>Applied {formatCompactAt(applicant.applied_at)}</p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 14 }}>
            <p style={rowLabel}>Email</p>
            <p style={rowValue}>{applicant.email_address || '—'}</p>
          </div>
          <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 14 }}>
            <p style={rowLabel}>Phone</p>
            <p style={rowValue}>{applicant.phone_number ?? '—'}</p>
          </div>
          <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 14 }}>
            <p style={rowLabel}>Skills</p>
            <p style={rowValue}>{applicant.skills || '—'}</p>
          </div>
          {certs.length > 0 && (
            <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 14 }}>
              <p style={rowLabel}>Certificates</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {certs.map((c, i) => (
                  c.file_url
                    ? <a key={i} href={c.file_url} target="_blank" rel="noreferrer" style={linkStyle}>{c.name}</a>
                    : <p key={i} style={rowValue}>{c.name}</p>
                ))}
              </div>
            </div>
          )}
          {applicant.resume && (
            <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 14 }}>
              <p style={rowLabel}>Resume</p>
              <a href={applicant.resume} target="_blank" rel="noreferrer" style={linkStyle}>View Resume</a>
            </div>
          )}
          {applicant.additional_note && (
            <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 14 }}>
              <p style={rowLabel}>Additional note</p>
              <p style={{ ...rowValue, whiteSpace: 'pre-line' }}>{applicant.additional_note}</p>
            </div>
          )}
        </div>
      </ModalBox>
    </ModalOverlay>
  )
}

// Right-side status pill for a non-actionable applicant state (the Accept/Reject buttons cover
// 'pending'; the Confirmed + Remove Worker row covers a fully-confirmed hire). Returns null when
// the state is handled by dedicated controls instead.
function applicantStatusPill(applicant: JobApplicant): React.ReactNode {
  if (applicant.status === 'pending') return null
  if (applicant.status === 'accepted') {
    if (applicant.invitation_status === 'accepted') return null
    return <ApplicantPill tone={{ bg: '#FFFBEB', border: '#FDE68A', text: '#B45309' }} icon={<Clock size={13} />} label="Pending" />
  }
  const tone = ({
    rejected: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', label: 'Rejected' },
    job_closed: { bg: '#F3F4F6', border: '#E5E7EB', text: '#4B5563', label: 'Job Closed' },
    cancelled_by_employer: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', label: 'Removed' },
  } as Record<string, { bg: string; border: string; text: string; label: string }>)[applicant.status]
    ?? { bg: '#F3F4F6', border: '#E5E7EB', text: '#6B7280', label: applicant.status }
  return <ApplicantPill tone={tone} label={tone.label} />
}

// Values are plain numbers (stored as integer in the DB) so the age gate can compare them
// against an applicant's date of birth; the "+" is display-only.
const MINIMUM_AGE_OPTIONS = [
  { value: '16', label: '16+' },
  { value: '18', label: '18+' },
  { value: '21', label: '21+' },
]
// 3-way uniform mode: makes it clear to applicants whether the company provides the
// uniform ('company') or they must dress themselves to a code ('dress_code').
const UNIFORM_TYPE_OPTIONS = [
  { value: 'none', label: 'Not Required' },
  { value: 'company', label: 'Company Uniform Provided' },
  { value: 'dress_code', label: 'Specific Dress Code' },
]
type UniformType = 'none' | 'company' | 'dress_code'
function uniformTypeOf(row: { uniform_type?: string | null }): UniformType | '' {
  if (row.uniform_type === 'company' || row.uniform_type === 'dress_code' || row.uniform_type === 'none') return row.uniform_type
  return ''
}

// Local calendar-date key (not UTC) — used to hydrate the deadline date input from a stored
// expires_at timestamp without shifting a day when the local timezone is behind/ahead of UTC.
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Compact list-card timestamp matching the Communication page, e.g. "02 Jul, 10:59AM"
function formatCompactAt(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString('en-AU', { month: 'short' })
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '')
  return `${day} ${month}, ${time}`
}



const pageKeyframes = `
  @keyframes blockSlideUp  { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes tabContentIn  { from { opacity: 0; transform: translateY(8px) scale(0.99) } to { opacity: 1; transform: translateY(0) scale(1) } }
  @keyframes deptCardIn    { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
  .recruitment-panel { border: 1px solid ${PANEL_BORDER}; min-height: 0; }
  .recruitment-grid { display: grid; grid-template-columns: 440px minmax(0, 1fr); gap: 16px; align-items: stretch; min-height: 0; height: 100%; overflow: hidden; }
  .recruitment-scroll-region { scrollbar-gutter: stable; overscroll-behavior: contain; }
  @media (max-width: 1100px) {
    .recruitment-grid { grid-template-columns: minmax(0, 1fr); align-items: start; overflow-y: auto; padding-right: 4px; }
  }
  /* Active/Closed detail + applicants: left detail, an orange flow arrow, then applicants —
     mirroring the template Edit → Preview layout. Detail is the narrower column so it doesn't
     leave a wide band of whitespace beside its left-aligned content. */
  /* Detail | arrow | Applicants | arrow | Confirmed. Applicants and Confirmed share the same
     column width; Detail is a touch narrower so both arrows fit. */
  .jobs-detail-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) 64px minmax(0, 0.85fr) 64px minmax(0, 0.85fr); align-items: stretch; row-gap: 16px; min-height: 0; height: 100%; overflow: hidden; }
  @media (max-width: 1400px) {
    .jobs-detail-grid { grid-template-columns: minmax(0, 1fr); align-items: start; overflow-y: auto; padding-right: 4px; }
    .jobs-flow-arrow { display: none; }
  }
  .template-edit-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.95fr); gap: 64px; align-items: start; max-width: 1800px; margin: 0 auto; width: 100%; }
  /* Edit → Preview arrow sits on the gap between column 1 and 2 (fr ratio 1 : 1 : 0.95 → total 2.95) */
  .flow-arrow-mid { left: calc((100% - 128px) / 2.95 + 32px); transform: translateX(-50%); }
  /* Preview → Template Information arrow: gap between column 2 and 3 */
  .flow-arrow-end { left: calc((100% - 128px) / 2.95 * 2 + 96px); transform: translateX(-50%); }
  @media (max-width: 1500px) {
    .template-edit-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .template-info-panel { grid-column: 1 / -1; }
    .flow-arrow-mid { left: 50%; }
    .flow-arrow-end { display: none; }
  }
  @media (max-width: 900px) {
    .template-edit-grid { grid-template-columns: minmax(0, 1fr); max-width: 640px; }
  }
  /* Flow arrows between the template hub panels — vertically aligned with the "Template" menu card */
  .flow-arrow { position: absolute; top: 296px; width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #F97316, #EA580C); color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(249,115,22,0.35); z-index: 2; }
  @media (max-width: 1100px) {
    .flow-arrow { display: none; }
  }
`

// ─── Custom dropdown matching Task modal DropdownField style ─────────────────
function RDrop({ value, options, onChange, placeholder, disabled = false, autoFocus = false }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus()
  }, [autoFocus])

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
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: `1.5px solid ${open || focused ? '#F97316' : '#E5E7EB'}`, borderRadius: 8, background: disabled ? '#F9FAFB' : '#FFFFFF', cursor: canOpen ? 'pointer' : 'default', fontSize: '0.9375rem', color: selected ? '#111827' : '#9CA3AF', fontWeight: 400, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronRight size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(270deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  )
}

// Est. Hours input (one-off jobs only) — whole field is clickable, "hours" suffix rendered after the number
function HoursField({ value, onChange, placeholder = 'e.g. 5' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1.5px solid ${focused ? '#F97316' : '#E5E7EB'}`, borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box', cursor: 'text', transition: 'border-color 0.15s' }}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, '')
          const parts = cleaned.split('.')
          onChange(parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned)
        }}
        style={{ width: `${Math.max((value || placeholder).length, 1)}ch`, minWidth: 10, border: 'none', outline: 'none', padding: 0, fontSize: '0.9375rem', color: '#111827', background: 'transparent', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
      />
      <span style={{ fontSize: '0.9375rem', color: '#111827' }}>hours</span>
    </label>
  )
}

// Two-option segmented control (Job Type / Attire Required in the Edit Template panel)
function SegToggle({ value, options, onChange }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 8 }}>
      {options.map(opt => {
        const isSel = opt.value === value
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            style={{
              padding: '10px 12px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${isSel ? '#F97316' : '#E5E7EB'}`,
              background: isSel ? '#FFF7ED' : '#FFFFFF',
              color: isSel ? '#EA580C' : '#374151',
              transition: 'border-color 0.15s, background 0.15s, color 0.15s',
            }}
          >{opt.label}</button>
        )
      })}
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
// min / max (both "HH:MM" 24h, inclusive) constrain the selectable slots — used to keep a casual
// worker's times inside the supervising employee's own shift window.
function RTimePicker({ value, onChange, min, max }: { value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  const inRange = (v: string) => (!min || v >= min) && (!max || v <= max)
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
        const v = `${hh}:${mm}`
        if (!inRange(v)) continue
        const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
        res.push({ value: v, label: `${dh}:${mm}` })
      }
    }
    return res
  }, [meridiem, min, max])

  // AM / PM buttons: disable a half-day that has no slot inside the range
  const meridiemHasSlots = useMemo(() => {
    const has = (mp: 'AM' | 'PM') => {
      const s = mp === 'AM' ? 0 : 12
      const e = mp === 'AM' ? 12 : 24
      for (let h = s; h < e; h++) for (const m of [0, 30]) {
        if (inRange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)) return true
      }
      return false
    }
    return { AM: has('AM'), PM: has('PM') }
  }, [min, max])

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
        {(['AM', 'PM'] as const).map(mp => {
          const disabled = !meridiemHasSlots[mp]
          return (
          <button key={mp} type="button" disabled={disabled} onClick={() => {
            const [ch, cm] = value.split(':').map(Number)
            let newH = ch
            if (mp === 'AM' && ch >= 12) newH = ch - 12
            if (mp === 'PM' && ch < 12) newH = ch + 12
            let nv = `${String(newH).padStart(2, '0')}:${String(cm).padStart(2, '0')}`
            // Naive hour-flip may land outside the range — snap to the first valid slot in that half-day
            if (!inRange(nv)) {
              const s = mp === 'AM' ? 0 : 12
              const e = mp === 'AM' ? 12 : 24
              for (let h = s; h < e && !inRange(nv); h++) for (const m of [0, 30]) {
                const cand = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                if (inRange(cand)) { nv = cand; break }
              }
            }
            onChange(nv)
            setMeridiem(mp)
          }} style={{ borderRadius: 7, border: 'none', background: meridiem === mp ? '#F97316' : '#F1F5F9', color: disabled ? '#CBD5E1' : meridiem === mp ? '#FFFFFF' : '#0F172A', fontWeight: 700, fontSize: 12, padding: '7px 10px', cursor: disabled ? 'not-allowed' : 'pointer', lineHeight: 1, fontFamily: 'inherit' }}>
            {mp}
          </button>
          )
        })}
      </div>
    </div>
  ) : null

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8, background: '#FFFFFF', cursor: 'pointer', padding: '10px 12px', fontSize: '0.9375rem', fontWeight: 500, color: '#111827', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}>
        <span style={{ userSelect: 'none' }}>{displayLabel}</span>
        <ChevronRight size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(270deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }} />
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}

export default function RecruitmentView({ sidebar, canApprovePostings = true, canArchivePostings = true, scopeToManagerDepartments = false }: {
  sidebar: React.ReactNode
  // UC42 approve/reject a submitted posting is O/P-only; Managers still see their submissions' status.
  canApprovePostings?: boolean
  // UC38 archive job opening is O/P-only (hides the whole Archived source too).
  canArchivePostings?: boolean
  // Manager role scope: postings limited to the viewer's own departments.
  scopeToManagerDepartments?: boolean
}) {
  const router = useRouter()
  // The Applicants panel is one of three columns sharing a row (Detail | Applicants |
  // Confirmed) — its real width is a fraction of the window, not the window itself, so the
  // button-label collapse must react to the panel's own rendered width (see
  // useIsCompactContainer), not a window-width breakpoint.
  const [applicantsPanelRef, isCompactApplicantActions] = useIsCompactContainer<HTMLDivElement>(480)

  // auth / company
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyLocation, setCompanyLocation] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [companyIndustry, setCompanyIndustry] = useState('')
  const [companyDescription, setCompanyDescription] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')

  // data
  const [departments, setDepartments] = useState<Department[]>([])
  // Manager's own department(s) — resolved alongside the Job Visibility scope in fetchAll.
  // `departments` above is company-wide (every department, for Owner/Partner's picker), so a
  // Manager needs this separately to auto-fill (and lock) the Department field on their own form.
  const [managerDeptIds, setManagerDeptIds] = useState<string[]>([])
  // Manager's "your submission just got approved, come look" dot on Active Jobs — a job's own
  // `status === 'open'` doesn't tell you whether that's brand new or has been open for weeks, so
  // this tracks which of the Manager's own now-open postings they've actually opened at least
  // once, persisted per-Manager (mirrors TasksView's seenMyTaskSigs for the exact same reason).
  const [seenApprovedJobIds, setSeenApprovedJobIds] = useState<Set<string>>(new Set())
  const approvedJobsSeenKey = companyId && internalUserId ? `manager_approved_jobs_seen_${companyId}_${internalUserId}` : null
  useEffect(() => {
    if (!approvedJobsSeenKey) return
    try {
      const raw = localStorage.getItem(approvedJobsSeenKey)
      if (raw) setSeenApprovedJobIds(new Set(JSON.parse(raw)))
    } catch {}
  }, [approvedJobsSeenKey])
  const markApprovedJobSeen = useCallback((jobId: string) => {
    if (!approvedJobsSeenKey) return
    setSeenApprovedJobIds(prev => {
      if (prev.has(jobId)) return prev
      const next = new Set(prev); next.add(jobId)
      try { localStorage.setItem(approvedJobsSeenKey, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [approvedJobsSeenKey])
  const [livePostings, setLivePostings] = useState<JobPostingSummary[]>([])
  // livePostings starts as [] before fetchAll's first response lands — without this guard, the
  // prune effect below would run against that empty placeholder, conclude every seen id is "no
  // longer live", and wipe them from localStorage before the real data ever arrives. Set once,
  // right after fetchAll's setLivePostings call, and never unset.
  const hasFetchedLivePostingsRef = useRef(false)
  // Garbage-collect approved-jobs-seen ids no longer open (closed/archived/deleted) so the stored
  // set doesn't grow forever.
  useEffect(() => {
    if (!approvedJobsSeenKey || !hasFetchedLivePostingsRef.current) return
    const liveIds = new Set(livePostings.filter(p => p.status === 'open').map(p => p.id))
    setSeenApprovedJobIds(prev => {
      const pruned = new Set([...prev].filter(id => liveIds.has(id)))
      if (pruned.size === prev.size) return prev
      try { localStorage.setItem(approvedJobsSeenKey, JSON.stringify([...pruned])) } catch {}
      return pruned
    })
  }, [livePostings, approvedJobsSeenKey])
  const [drafts, setDrafts] = useState<JobPostingSummary[]>([])
  const [pendingPostings, setPendingPostings] = useState<JobPostingPendingApproval[]>([])
  const [selectedLiveId, setSelectedLiveId] = useState('')
  // deep link: /owner/recruitment?job=<id> — jump straight to that posting (e.g. from an
  // Attendance record's Job Title link); consumed once after the first postings load
  const deepLinkJobIdRef = useRef<string | null>(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('job') : null,
  )
  const [applicants, setApplicants] = useState<JobApplicant[]>([])
  const [recommendations, setRecommendations] = useState<CandidateRecommendation[]>([])
  // Confirmed = both sides accepted (employer accepted + worker confirmed the invitation); they get
  // their own panel. Applicants only shows people still in play: those awaiting the Owner's decision
  // (pending → Accept/Reject) and those the Owner accepted who haven't confirmed yet (awaiting the
  // worker). Terminal states — rejected, confirmed, removed (cancelled_by_employer), job_closed,
  // withdrawn — are dropped from Applicants (Confirmed hires live in their own panel).
  const isConfirmedApplicant = (a: JobApplicant) => a.status === 'accepted' && a.invitation_status === 'accepted'
  const confirmedApplicants = useMemo(() => applicants.filter(isConfirmedApplicant), [applicants])
  const pendingApplicants = useMemo(() => {
    // Recommendations is empty until AI Assessment has been run, so scoreFor returns -1 for
    // everyone and the secondary sort key is a no-op (Array.sort is stable) — applicants stay in
    // API order until AI Assessment ranks them by score, highest first.
    const scoreFor = (a: JobApplicant) => {
      const rec = recommendations.find(r => r.applicant_id === a.id)
      return !rec || rec.insufficient ? -1 : rec.score
    }
    return applicants
      .filter(a => a.status === 'pending' || (a.status === 'accepted' && a.invitation_status !== 'accepted'))
      .sort((a, b) => {
        // Already-accepted (awaiting the worker's reply) float to the top — we've committed to
        // them and are just waiting on their side, so they should be seen first.
        const groupDiff = (a.status === 'accepted' ? 0 : 1) - (b.status === 'accepted' ? 0 : 1)
        return groupDiff !== 0 ? groupDiff : scoreFor(b) - scoreFor(a)
      })
  }, [applicants, recommendations])
  // ui state
  const [activeTab, setActiveTab] = useState<Tab>('jobs')
  const [postView, setPostView] = useState<'none' | 'archived' | 'template' | 'pending'>('none')
  // Job Sources accordion: which card's dropdown is expanded. Template opens by default;
  // opening one automatically closes the others — never more than one open at a time.
  const [openSource, setOpenSource] = useState<'none' | 'pending' | 'drafts' | 'archived' | 'templates'>('none')
  // ?view=pending deep-links from the dashboard's Review Job Postings card straight to
  // the Post tab with the Pending Approval source expanded.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'pending') {
      setActiveTab('post')
      setOpenSource('pending')
    }
  }, [])
  // ?highlight=<id,id,…> deep-links from the dashboard's Recruitment Overview cards: the named
  // postings are pinned to the top of the Active Jobs list and visually highlighted.
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('highlight')
    if (raw) setHighlightIds(new Set(raw.split(',').filter(Boolean)))
  }, [])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // department filter dropdown — Jobs tab (Pending Approval now lives in the Job Sources
  // accordion as a plain card list, matching Drafts/Archived/Template, so it has no filter of its own)
  const [jobsDeptFilter, setJobsDeptFilter] = useState<string>('all')
  const [jobsDeptDropdownOpen, setJobsDeptDropdownOpen] = useState(false)
  const jobsDeptDropdownRef = useRef<HTMLDivElement>(null)

  // Panel height for the Jobs/Closed layout — viewport minus the grid's real offset from the
  // top of the page, so the three panels (list / detail / applicants) all end inside one screen
  // and scroll internally. A hardcoded 100vh figure ignores the tab bar above and leaves the
  // page itself with a residual scrollbar. Measured through a callback ref: a mount-time effect
  // is too early (the grid only renders after the auth/loading gate) and would never re-fire.
  const jobsGridNode = useRef<HTMLDivElement | null>(null)
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | null>(null)
  const measurePanelHeight = useCallback(() => {
    const el = jobsGridNode.current
    if (!el) return
    // The page scrolls inside <main> (100vh, overflowY auto), not the window — take the grid's
    // offset within that container. The card wrapper below the grid adds 28px bottom padding,
    // so the panels must stop 28px short of the viewport or <main> itself grows a scrollbar.
    const mainEl = el.closest('main')
    const scrollTop = mainEl ? mainEl.scrollTop : window.scrollY
    const topInContainer = el.getBoundingClientRect().top + scrollTop
    setPanelMaxHeight(Math.max(320, window.innerHeight - topInContainer - 28))
  }, [])
  const jobsGridRef = useCallback((el: HTMLDivElement | null) => {
    jobsGridNode.current = el
    if (el) measurePanelHeight()
  }, [measurePanelHeight])
  useEffect(() => {
    window.addEventListener('resize', measurePanelHeight)
    return () => window.removeEventListener('resize', measurePanelHeight)
  }, [measurePanelHeight])
  useEffect(() => {
    if (!jobsDeptDropdownOpen) return
    const handler = (e: MouseEvent) => { if (!jobsDeptDropdownRef.current?.contains(e.target as Node)) setJobsDeptDropdownOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [jobsDeptDropdownOpen])

  // form modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editingDraft, setEditingDraft] = useState(false)
  // A rejected posting reopened for edit — "Save Changes" must resubmit it for approval
  // (submit_for_review) instead of publishing it directly, matching the Manager approval workflow.
  const [editingRejected, setEditingRejected] = useState(false)
  // wizard step: 'type' | 'ai' | 'form'
  const [wizardStep, setWizardStep] = useState<'type' | 'ai' | 'form'>('type')
  const [formJobType, setFormJobType] = useState<'shift' | 'oneoff'>('oneoff')
  // shared fields
  const [formTemplateId, setFormTemplateId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDeptId, setFormDeptId] = useState('')
  const [formSalaryAmt, setFormSalaryAmt] = useState('')
  const [formSalaryType, setFormSalaryType] = useState('per hour')
  const [formResponsibilities, setFormResponsibilities] = useState('')
  const [formSkills, setFormSkills] = useState('')
  const [formExperienceRequired, setFormExperienceRequired] = useState('')
  const [formMinimumAge, setFormMinimumAge] = useState('')
  // '' = not chosen yet — the Uniform dropdown must be an explicit choice, never defaulted
  const [formUniformType, setFormUniformType] = useState<UniformType | ''>('')
  const [formUniformDetails, setFormUniformDetails] = useState('')
  const [formIndustry, setFormIndustry] = useState('')
  const [formBenefits, setFormBenefits] = useState('')
  const [formOpenings, setFormOpenings] = useState('')
  // Deadline is a mandatory choice: '' = not chosen yet, 'never' = open until filled, 'date' = expires at a set date/time
  const [formDeadlineChoice, setFormDeadlineChoice] = useState<'' | 'never' | 'date'>('')
  const [formExpiresAt, setFormExpiresAt] = useState('')
  const [formDeadlineTime, setFormDeadlineTime] = useState('23:59')
  // shift-specific
  const [formJobStart, setFormJobStart] = useState('09:00')
  const [formJobEnd, setFormJobEnd] = useState('17:00')
  const [formBreakStart, setFormBreakStart] = useState('12:00')
  const [formBreakEnd, setFormBreakEnd] = useState('13:00')
  const [formShiftDays, setFormShiftDays] = useState<string[]>([])
  const [formIsRecurring, setFormIsRecurring] = useState(false)
  const [formRecurInterval, setFormRecurInterval] = useState(1)
  const [formRecurUnit, setFormRecurUnit] = useState('week')
  const [formJobDate, setFormJobDate] = useState('')
  const [formAssignedEmployeeId, setFormAssignedEmployeeId] = useState('')
  // shift cascade data
  const [shiftDeptEmployees, setShiftDeptEmployees] = useState<{ id: string; full_name: string; shift_start: string; shift_end: string }[]>([])
  const [shiftAvailableDates, setShiftAvailableDates] = useState<{ date: string; start_time: string; end_time: string }[]>([])
  const [shiftDateEmployees, setShiftDateEmployees] = useState<{ id: string; full_name: string; shift_start: string; shift_end: string }[]>([])
  // oneoff-specific
  const [formJobEndDate, setFormJobEndDate] = useState('')
  const [formJobStartTime, setFormJobStartTime] = useState('09:00')
  const [formEstHours, setFormEstHours] = useState('')
  const [formUrgency, setFormUrgency] = useState('normal')
  // AI builder
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiPreview, setAiPreview] = useState<null | { title: string; responsibilities: string; skills: string }>(null)
  const [formError, setFormError] = useState('')

  // job templates (UC36)
  const [templates, setTemplates] = useState<JobTemplate[]>([])
  // Apply Template wizard step — mirrors the New Template steps (1 Job Information, 2 Requirements
  // & Payment) plus step 3 (Schedule & Post). Applying a template opens directly at step 3;
  // steps 1–2 hold the template-derived fields and stay reachable via the back circles.
  const [applyStep, setApplyStep] = useState<1 | 2 | 3>(3)
  // Create Job wizard sub-step after the AI generator: 3 = Requirements, 4 = Schedule & Payment
  const [createStep, setCreateStep] = useState<3 | 4>(3)
  // Draft saved in the background via Save Draft while the wizard stays open —
  // later saves update this posting instead of creating duplicates. Reopening a saved draft
  // from the Drafts list loads it back into this same wizard under this id.
  const [draftId, setDraftId] = useState('')
  // Whether the wizard's "Schedule & Payment" fields hold real, user-chosen values rather than
  // resetForm()'s UI defaults — true once the user reaches step 4, or once a reopened draft is
  // loaded with schedule data already saved on it. buildBody() only persists those fields when set.
  const [scheduleSeen, setScheduleSeen] = useState(false)
  const [shiftOptionsLoading, setShiftOptionsLoading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateActionLoading, setTemplateActionLoading] = useState(false)
  // Snapshot of the last template saved from the wizard — while the form still matches it,
  // Save as Template shows a saved state instead of creating a duplicate.
  const [savedTplSnapshot, setSavedTplSnapshot] = useState('')
  const [newTemplateModalOpen, setNewTemplateModalOpen] = useState(false)
  const [tplJobType, setTplJobType] = useState<'shift' | 'oneoff' | ''>('')
  const [tplTitle, setTplTitle] = useState('')
  const [tplResponsibilities, setTplResponsibilities] = useState('')
  const [tplSkills, setTplSkills] = useState('')
  const [tplUniformType, setTplUniformType] = useState<UniformType | ''>('')
  const [tplUniformDetails, setTplUniformDetails] = useState('')
  const [tplUsage, setTplUsage] = useState<JobTemplateUsageStats | null>(null)
  const [tplExperienceRequired, setTplExperienceRequired] = useState('')
  const [tplMinimumAge, setTplMinimumAge] = useState('')
  const [tplEstimatedHours, setTplEstimatedHours] = useState('')
  const [tplUrgency, setTplUrgency] = useState('normal')
  const [tplDepartmentId, setTplDepartmentId] = useState('')
  const [tplSalaryAmt, setTplSalaryAmt] = useState('')
  const [tplError, setTplError] = useState('')

  // New Template modal — deliberately separate state from the tpl* fields above (which back
  // the Edit Template panel) so opening "New Template" while a template is being edited can't
  // clobber the in-progress edit sitting behind the modal.
  const [ntplStep, setNtplStep] = useState<1 | 2>(1)
  const [ntplJobType, setNtplJobType] = useState<'shift' | 'oneoff' | ''>('')
  const [ntplTitle, setNtplTitle] = useState('')
  const [ntplResponsibilities, setNtplResponsibilities] = useState('')
  const [ntplSkills, setNtplSkills] = useState('')
  const [ntplUniformType, setNtplUniformType] = useState<UniformType | ''>('')
  const [ntplUniformDetails, setNtplUniformDetails] = useState('')
  const [ntplExperienceRequired, setNtplExperienceRequired] = useState('')
  const [ntplMinimumAge, setNtplMinimumAge] = useState('')
  const [ntplEstimatedHours, setNtplEstimatedHours] = useState('')
  const [ntplUrgency, setNtplUrgency] = useState('normal')
  const [ntplDepartmentId, setNtplDepartmentId] = useState('')
  const [ntplSalaryAmt, setNtplSalaryAmt] = useState('')
  const [ntplError, setNtplError] = useState('')

  // detail / delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; isDraft?: boolean } | null>(null)
  const [archivedSelected, setArchivedSelected] = useState<Set<string>>(new Set())
  const [selectedArchivedId, setSelectedArchivedId] = useState('')
  const [archivedApplicants, setArchivedApplicants] = useState<JobApplicant[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedPendingId, setSelectedPendingId] = useState('')
  const [jobsSelected, setJobsSelected] = useState<Set<string>>(new Set())
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [pendingRejectId, setPendingRejectId] = useState('')

  // Worker pool — Casual Workers who already completed a shift for this company. The Owner can hand
  // a posting straight to them instead of waiting for strangers on the public board.
  const [poolModalOpen, setPoolModalOpen] = useState(false)
  const [poolWorkers, setPoolWorkers] = useState<PoolWorker[]>([])
  const [poolLoading, setPoolLoading] = useState(false)
  const [poolSelected, setPoolSelected] = useState<Set<string>>(new Set())
  const [poolInviting, setPoolInviting] = useState(false)
  const [poolResults, setPoolResults] = useState<PoolInviteResult[]>([])
  const [poolError, setPoolError] = useState('')

  const selectedLive = useMemo(() => livePostings.find(p => p.id === selectedLiveId) ?? null, [livePostings, selectedLiveId])
  const selectedArchived = useMemo(() => livePostings.find(p => p.id === selectedArchivedId) ?? null, [livePostings, selectedArchivedId])
  // Candidate Management is Recruitment-Owner-only: Job Visibility (scopeToManagerDepartments)
  // already lets a Manager see every posting in their department, but only the job's own creator
  // may view/manage its applicants. Owner/Partner (scopeToManagerDepartments=false) are never
  // restricted — they own everything below them.
  const canManageApplicants = useCallback(
    (job: { created_by: string } | null | undefined) => !scopeToManagerDepartments || !job || job.created_by === internalUserId,
    [scopeToManagerDepartments, internalUserId],
  )
  const selectedPending = useMemo(() => pendingPostings.find(p => p.id === selectedPendingId) ?? null, [pendingPostings, selectedPendingId])
  const selectedTemplate = useMemo(() => templates.find(t => t.id === selectedTemplateId) ?? null, [templates, selectedTemplateId])

  // A job can only be archived once every application on it is resolved — nothing still pending the
  // Owner's decision, and nobody accepted who hasn't answered their invitation yet (the service
  // enforces the same rule). The bulk Archive action only appears when every selected job qualifies.
  const isArchivable = (p: JobPostingSummary) => p.pending_count === 0 && p.awaiting_confirmation_count === 0
  const selectedJobsArchivable = useMemo(
    () => [...jobsSelected].every(id => { const p = livePostings.find(job => job.id === id); return p ? isArchivable(p) : false }),
    [jobsSelected, livePostings],
  )

  // ── helpers ──────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setSuccessToast(msg)
    toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
  }, [])

  // ── data fetching ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async (cid: string, uid: string) => {
    if (!cid || !uid) return
    // BUG-028: only show the full-list "Loading..." placeholder on the true first load. Once data
    // has been fetched once, background refetches — e.g. the useResourceInvalidation(['recruitment'])
    // callback firing because AI Assessment just wrote job_applicants.ai_computed_at (a cache
    // write, not a real posting change) — must update the list silently, or the whole Active Jobs
    // card list blanks out to a spinner and pops back with unchanged data every time, which is the
    // visible "flicker" this was chasing.
    if (!hasFetchedLivePostingsRef.current) setLoading(true)
    setError('')
    try {
      const [liveRes, pendingRes, draftsRes, deptRes, templatesRes] = await Promise.all([
        fetch(`/api/recruitment?company_id=${cid}`),
        fetch(`/api/recruitment?company_id=${cid}&resource=pending_approval${scopeToManagerDepartments ? '&include_rejected=true' : ''}`),
        fetch(`/api/recruitment?company_id=${cid}&resource=drafts${scopeToManagerDepartments && uid ? `&manager_scope_id=${encodeURIComponent(uid)}` : ''}`),
        fetch(`/api/company/departments?company_id=${cid}`),
        fetch(`/api/job-template?company_id=${cid}${scopeToManagerDepartments && uid ? `&manager_scope_id=${encodeURIComponent(uid)}` : ''}`),
      ])
      const [liveData, pendingData, draftsData, deptData, templatesData] = await Promise.all([
        liveRes.json(), pendingRes.json(), draftsRes.json(), deptRes.json(), templatesRes.json(),
      ])
      if (!liveData.success) throw new Error(liveData.message || 'Failed to fetch jobs')
      let scopeIds: Set<string> | null = null
      if (scopeToManagerDepartments && uid) {
        try {
          const scopeRes = await fetch(`/api/manager/departments?manager_id=${uid}&company_id=${cid}`)
          const scopeData = await scopeRes.json()
          if (scopeData.success) scopeIds = new Set((scopeData.departments as { department_id: string }[]).map(x => x.department_id))
        } catch {}
      }
      setManagerDeptIds(scopeIds ? [...scopeIds] : [])
      const inScope = (row: { department_id?: string | null }) => !scopeIds || (row.department_id != null && scopeIds.has(row.department_id))
      setLivePostings((liveData.postings ?? []).filter(inScope))
      hasFetchedLivePostingsRef.current = true
      setPendingPostings((pendingData.pendingPostings ?? []).filter(inScope))
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

  const fetchApplicants = useCallback(async (jobId: string, viewerId: string) => {
    if (!jobId || !viewerId) { setApplicants([]); return }
    try {
      const res = await fetch(`/api/recruitment?resource=applicants&job_id=${jobId}&viewer_id=${viewerId}`)
      const data = await res.json()
      if (data.success) setApplicants(data.applicants ?? [])
    } catch { setApplicants([]) }
  }, [])

  const fetchArchivedApplicants = useCallback(async (jobId: string, viewerId: string) => {
    if (!jobId || !viewerId) { setArchivedApplicants([]); return }
    try {
      const res = await fetch(`/api/recruitment?resource=applicants&job_id=${jobId}&viewer_id=${viewerId}`)
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

      // Must check the generic 'tasking_company_id' key FIRST — it's what Settings' "switch active
      // company" writes (see CompanySettingsView.handleSwitchActiveCompany) and what every other
      // owner page (sidebar, Communication, Team…) already reads first. Reading only the per-user
      // key here let this page silently show a different (stale) company than the rest of the app
      // after a company switch — e.g. the sidebar's Recruitment dot reflecting the active company
      // while this page's own Active Jobs / Pending Approval showed a leftover company's data.
      let storedCid = localStorage.getItem('tasking_company_id') || localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
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
        setCompanySize(currentData.company?.size ?? '')
        setCompanyIndustry(currentData.company?.industry ?? '')
        setCompanyDescription(currentData.company?.description ?? '')
        setCurrentPlan(currentData.company?.plan ?? 'Free')
      }
      if (!cancelled) await fetchAll(storedCid, uid)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchAll])

  useEffect(() => {
    const currentJobId = new URLSearchParams(window.location.search).get('job')
    const jobId = deepLinkJobIdRef.current ?? currentJobId
    if (!jobId || livePostings.length === 0) return
    const posting = livePostings.find(p => p.id === jobId)
    if (!posting) return
    deepLinkJobIdRef.current = null
    setSelectedTemplateId('')
    setSelectedPendingId('')
    setSelectedArchivedId('')
    setPostView('none')
    setOpenSource('none')
    if (posting.status === 'archived') {
      setActiveTab('post')
      setSelectedArchivedId(jobId)
    } else {
      setActiveTab('jobs')
      setSelectedLiveId(jobId)
    }
  }, [livePostings])

  // Viewing applicants is department-wide (see getApplicants) — always fetched once a job is
  // selected. canManageApplicants only gates the interactive actions rendered on top of this data.
  useEffect(() => {
    if (selectedLiveId) void fetchApplicants(selectedLiveId, internalUserId)
    else setApplicants([])
    setRecommendations([])
  }, [selectedLiveId, fetchApplicants, internalUserId])

  useEffect(() => {
    if (selectedArchivedId) void fetchArchivedApplicants(selectedArchivedId, internalUserId)
    else setArchivedApplicants([])
  }, [selectedArchivedId, fetchArchivedApplicants, internalUserId])

  useResourceInvalidation(['recruitment'], () => {
    if (!companyId || !internalUserId) return
    void fetchAll(companyId, internalUserId)
    if (selectedLiveId) void fetchApplicants(selectedLiveId, internalUserId)
    if (selectedArchivedId) void fetchArchivedApplicants(selectedArchivedId, internalUserId)
  })

  // Manager's Department field is removed from the wizard (it's always their own single
  // department — see below), so nothing ever fires the RDrop's onChange that used to both set
  // formDeptId and load that department's shift options — resetForm() below now does that
  // directly instead. This effect only exists for the race case: managerDeptIds can still be
  // mid-fetch when the wizard first opens, so resetForm's own attempt finds it empty and leaves
  // formDeptId blank; once the fetch lands, this fires exactly once (guarded on formDeptId still
  // being blank, not on any particular value) to fill it in and load shift options after the fact.
  useEffect(() => {
    if (!scopeToManagerDepartments || !formOpen || formDeptId) return
    const deptId = managerDeptIds[0]
    if (!deptId) return
    setFormDeptId(deptId)
    void loadDeptShiftOptions(deptId)
  }, [scopeToManagerDepartments, formOpen, managerDeptIds, formDeptId])


  // ── form helpers ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setEditingId(''); setEditingDraft(false); setEditingRejected(false); setWizardStep('type'); setFormJobType('oneoff')
    setFormTemplateId('')
    // Manager only ever has one department — set it up front instead of leaving it blank until
    // the wizard's Schedule & Post step, so an early "Save Draft" already carries the right
    // department_id (Owner/Partner still pick theirs later, at that step). Also kicks off
    // loadDeptShiftOptions immediately (see below) since there's no RDrop onChange to do it for
    // Manager anymore — Available Shift would otherwise stay empty for the whole wizard session.
    const managerDeptId = scopeToManagerDepartments ? (managerDeptIds[0] ?? '') : ''
    setFormTitle(''); setFormDeptId(managerDeptId)
    setFormSalaryAmt(''); setFormSalaryType('per hour')
    setFormResponsibilities(''); setFormSkills(''); setFormIndustry('')
    setFormExperienceRequired(''); setFormMinimumAge(''); setFormUniformType(''); setFormUniformDetails('')
    setFormBenefits(''); setFormOpenings('')
    setFormDeadlineChoice(''); setFormExpiresAt(''); setFormDeadlineTime('23:59')
    setFormJobStart('09:00'); setFormJobEnd('17:00'); setFormBreakStart('12:00'); setFormBreakEnd('13:00'); setFormShiftDays([])
    setFormIsRecurring(false); setFormRecurInterval(1); setFormRecurUnit('week')
    setFormJobDate(''); setFormAssignedEmployeeId('')
    setShiftDeptEmployees([]); setShiftAvailableDates([]); setShiftDateEmployees([])
    setFormJobEndDate(''); setFormEstHours(''); setFormUrgency('normal'); setFormJobStartTime('09:00')
    setAiPrompt(''); setAiPreview(null); setFormError('')
    setCreateStep(3); setDraftId(''); setScheduleSeen(false); setSavedTplSnapshot('')
    if (managerDeptId) void loadDeptShiftOptions(managerDeptId)
  }

  // Reopens a saved draft inside the AI Job Builder wizard it was created in: the draft's fields
  // are loaded back into the wizard's form state and it becomes the wizard's background draft
  // (draftId), so Save Draft keeps updating this same posting and Post Job publishes it.
  const openDraftInWizard = async (p: JobPostingSummary | JobPostingPendingApproval) => {
    const raw = p as unknown as Record<string, unknown>
    resetForm()
    setDraftId(p.id); setWizardStep('form'); setCreateStep(3)
    // A draft saved from the wizard's first step has no schedule data yet — leaving scheduleSeen
    // false keeps buildBody() from persisting the untouched 9–5 defaults on the next Save Draft.
    setScheduleSeen(!!(p.department_id || p.salary_amount != null || p.openings != null
      || raw.job_date || raw.assigned_employee_id || raw.expires_at))
    setFormTemplateId(p.template_id ?? '')
    const isShift = p.job_type === 'shift'
    setFormJobType(isShift ? 'shift' : 'oneoff')
    // Self-heals a pre-existing draft that was saved before its department was ever set (the bug
    // this fix closes) — reopening it now fills in the manager's own department instead of leaving
    // it blank again.
    setFormTitle(p.title); setFormDeptId(p.department_id ?? (scopeToManagerDepartments ? (managerDeptIds[0] ?? '') : ''))
    setFormSalaryAmt(p.salary_amount?.toString() ?? ''); setFormSalaryType(isShift ? 'per hour' : 'flat rate')
    setFormResponsibilities(p.responsibilities); setFormSkills(p.skills ?? '')
    setFormExperienceRequired(p.experience_required ?? ''); setFormMinimumAge(p.minimum_age != null ? String(p.minimum_age) : '')
    setFormUniformType(uniformTypeOf(p)); setFormUniformDetails(p.uniform_details ?? '')
    setFormIndustry(''); setFormBenefits('')
    setFormOpenings(p.openings != null ? String(p.openings) : '')
    const savedExpiresAt = typeof raw.expires_at === 'string' && raw.expires_at ? new Date(raw.expires_at) : null
    // A draft with no expiry simply hasn't chosen a deadline yet — don't imply "No Deadline"
    setFormDeadlineChoice(savedExpiresAt ? 'date' : '')
    setFormExpiresAt(savedExpiresAt ? localDateKey(savedExpiresAt) : '')
    setFormDeadlineTime(savedExpiresAt ? `${String(savedExpiresAt.getHours()).padStart(2, '0')}:${String(savedExpiresAt.getMinutes()).padStart(2, '0')}` : '23:59')
    setFormIsRecurring(false); setFormRecurInterval(1); setFormRecurUnit('week')
    setFormJobDate(''); setFormJobEndDate('')
    setAiPrompt(''); setAiPreview(null); setFormError('')
    const savedJobDate = typeof raw.job_date === 'string' ? raw.job_date : ''
    const savedJobStart = typeof raw.job_start_time === 'string' ? raw.job_start_time.slice(0, 5) : '09:00'
    const savedJobEnd = typeof raw.job_end_time === 'string' ? raw.job_end_time.slice(0, 5) : '17:00'
    const savedBreakStart = typeof raw.break_start_time === 'string' ? raw.break_start_time.slice(0, 5) : '12:00'
    const savedBreakEnd = typeof raw.break_end_time === 'string' ? raw.break_end_time.slice(0, 5) : '13:00'
    const savedEmployeeId = typeof raw.assigned_employee_id === 'string' ? raw.assigned_employee_id : ''
    const savedEstHours = typeof raw.estimated_hours === 'string' ? raw.estimated_hours : ''
    const savedUrgency = typeof raw.urgency === 'string' ? raw.urgency : 'normal'
    // job_start_time was merged into shift_start_time (job_type alone disambiguates which
    // reading applies) — savedJobStart above already holds this same raw value.
    const savedJobStartTime = savedJobStart
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
        if (savedJobDate && !dateMap.has(savedJobDate)) {
          dateMap.set(savedJobDate, { start_time: savedJobStart, end_time: savedJobEnd })
        }
        setShiftAvailableDates(Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).filter(([date]) => date >= new Date().toISOString().slice(0, 10)).map(([date, t]) => ({ date, start_time: t.start_time, end_time: t.end_time })))

        setFormJobDate(savedJobDate)
        if (savedJobDate) {
          let dateEmps = employees.filter((emp: { shifts?: { shift_date: string }[] }) =>
            emp.shifts?.some((s: { shift_date: string }) => s.shift_date === savedJobDate)
          )
          // If saved employee isn't in the filtered list, inject them from dept employees or as a placeholder
          if (savedEmployeeId && !dateEmps.some((e: { id: string }) => e.id === savedEmployeeId)) {
            const found = employees.find((e: { id: string }) => e.id === savedEmployeeId)
            dateEmps = found ? [...dateEmps, found] : [...dateEmps, { id: savedEmployeeId, full_name: 'Previously assigned employee', shifts: [] }]
          }
          setShiftDateEmployees(dateEmps)
        }
      }
      setFormJobStart(isShift ? savedJobStart : '09:00')
      setFormJobEnd(isShift ? savedJobEnd : '17:00')
      setFormBreakStart(isShift ? savedBreakStart : '12:00')
      setFormBreakEnd(isShift ? savedBreakEnd : '13:00')
      setFormAssignedEmployeeId(savedEmployeeId)
    } else {
      setFormJobStart('09:00'); setFormJobEnd('17:00'); setFormBreakStart('12:00'); setFormBreakEnd('13:00')
      setFormJobDate(''); setFormAssignedEmployeeId('')
      setShiftDeptEmployees([]); setShiftAvailableDates([]); setShiftDateEmployees([])
    }
    setFormShiftDays([])
    setFormOpen(true)
  }

  const buildBody = (status: 'open' | 'draft') => {
    // Department, pay, schedule, and positions all live on the wizard's final "Schedule & Post"
    // step. resetForm() seeds their local state with sensible UI defaults (e.g. a 9–5 shift) so the
    // pickers aren't blank once the user reaches that step — but if "Save Draft" is hit earlier
    // (createStep === 3), those defaults have never actually been seen, let alone chosen, so they
    // must not be persisted as if they were. Editing an existing posting always shows every field
    // at once, so it's always treated as reached; so is a reopened draft that already has schedule
    // data saved on it (scheduleSeen), otherwise saving it again would wipe those fields back to null.
    const scheduleReached = status === 'open' || !!editingId || createStep === 4 || scheduleSeen
    return {
      company_id: companyId,
      // Manager only ever has one department, so it's never gated by scheduleReached like the
      // schedule fields below — an early Save Draft must still carry it, or the draft saves with
      // no department and silently lands in Owner/Partner's company-wide Drafts instead of this
      // Manager's own. Falls back to managerDeptIds (fetched separately, see fetchAll) rather than
      // trusting formDeptId alone — resetForm() tries to pre-fill it too, but that fetch can still
      // be in flight when the wizard opens, so formDeptId may not have caught up by save time.
      department_id: scopeToManagerDepartments
        ? (formDeptId || managerDeptIds[0] || null)
        : (scheduleReached ? (formDeptId || null) : null),
      created_by: internalUserId,
      title: formTitle,
      responsibilities: formResponsibilities,
      skills: formSkills || null,
      experience_required: formExperienceRequired || null,
      minimum_age: formMinimumAge ? Number(formMinimumAge) : null,
      openings: scheduleReached && formOpenings ? Math.max(1, parseInt(formOpenings, 10) || 1) : null,
      uniform_type: formUniformType || 'none',
      uniform_details: formUniformType === 'dress_code' ? (formUniformDetails || null) : null,
      salary_amount: scheduleReached && formSalaryAmt ? Number(formSalaryAmt) : null,
      urgency: formJobType === 'oneoff' ? (formUrgency || 'normal') : null,
      estimated_hours: formJobType === 'oneoff' ? (formEstHours || null) : null,
      jobType: formJobType,
      job_date: scheduleReached ? (formJobDate || null) : null,
      // Shift/break times follow the chosen supervisor's own shift — never send them until a
      // supervisor is actually picked, or the wizard's UI-default times (e.g. 9–5) get persisted
      // as if the user had chosen them.
      // One-off jobs have no end/break — job_start_time alone carries their start time instead
      // (job_type on the read side decides which reading applies; no separate column for it).
      job_start_time: scheduleReached && formAssignedEmployeeId
        ? (formJobType === 'shift' ? (formJobStart || null) : formJobType === 'oneoff' ? (formJobStartTime || null) : null)
        : null,
      job_end_time: scheduleReached && formJobType === 'shift' && formAssignedEmployeeId ? (formJobEnd || null) : null,
      break_start_time: scheduleReached && formJobType === 'shift' && formAssignedEmployeeId ? (formBreakStart || null) : null,
      break_end_time: scheduleReached && formJobType === 'shift' && formAssignedEmployeeId ? (formBreakEnd || null) : null,
      assigned_employee_id: scheduleReached ? (formAssignedEmployeeId || null) : null,
      expires_at: scheduleReached && formDeadlineChoice === 'date' && formExpiresAt && formDeadlineTime
        ? new Date(`${formExpiresAt}T${formDeadlineTime}:00`).toISOString()
        : null,
      template_id: formTemplateId || null,
      status,
    }
  }

  // Reopens a rejected posting in the same wizard a draft reopens in — it was never publicly
  // visible either, so every field is fair game to fix before resubmitting. Reuses the draft
  // reopen logic to populate the form, then swaps it from "background draft" (draftId) to
  // "editing an existing posting" (editingId) so Save Changes patches this job in place instead
  // of creating a new one.
  const openRejectedInWizard = async (p: JobPostingSummary | JobPostingPendingApproval) => {
    await openDraftInWizard(p)
    setDraftId('')
    setEditingId(p.id)
    setEditingDraft(false)
    setEditingRejected(true)
  }

  // Fixes a rejected posting and puts it back in front of Owner/Partner: edit_posting saves the
  // corrected fields, then submit_for_review moves it back to pending_approval (also clearing the
  // old rejection reason/rejected_by — see recruitmentService.submitForReview).
  const saveRejectedEdit = async () => {
    setActionLoading(true); setFormError('')
    try {
      const body = buildBody('open')
      const editRes = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, action: 'edit_posting', job_id: editingId }),
      })
      const editData = await editRes.json()
      if (!editData.success) throw new Error(editData.message || 'Failed to save job')

      const resubmitRes = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_for_review', job_id: editingId }),
      })
      const resubmitData = await resubmitRes.json()
      if (!resubmitData.success) throw new Error(resubmitData.message || 'Failed to resubmit job')

      setFormOpen(false); resetForm()
      await fetchAll(companyId, internalUserId)
      // Resubmitting a rejected posting is a Manager-only flow (only their own submissions ever
      // get rejected) — it goes back to pending_approval, not live, so it belongs in Pending
      // Approval, not Active Jobs where it won't show up until approved again.
      setActiveTab('post'); setOpenSource('pending')
      showToast('Job updated and resubmitted for approval')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save job')
    } finally { setActionLoading(false) }
  }

  // ── job templates (UC36) ─────────────────────────────────────────────────────

  const applyTemplate = (t: JobTemplate) => {
    setFormTemplateId(t.id)
    setFormJobType(t.job_type === 'shift' ? 'shift' : 'oneoff')
    setFormTitle(t.title)
    setFormResponsibilities(t.responsibilities ?? '')
    setFormSkills(t.skills ?? '')
    setFormExperienceRequired(t.experience_required ?? '')
    setFormMinimumAge(t.minimum_age != null ? String(t.minimum_age) : '')
    setFormUniformType(uniformTypeOf(t))
    setFormUniformDetails(t.uniform_details ?? '')
    setFormDeptId(t.department_id ?? '')
    setFormSalaryAmt(t.salary_amount?.toString() ?? '')
    setFormEstHours(t.estimated_hours ?? '')
    setFormUrgency(t.urgency ?? 'normal')
    // Deadline is never part of a template — always start fresh so it's set deliberately each time.
    setFormDeadlineChoice('')
    setFormExpiresAt('')
    setFormDeadlineTime('23:59')
    // The template carries a department, so load that department's shift dates/employees
    // immediately — otherwise Shift Date shows "No scheduled shifts" until the user
    // re-selects the department by hand.
    void loadDeptShiftOptions(t.department_id ?? '')
    setShowTemplates(false)
    setWizardStep('form')
    setApplyStep(3)
    showToast('Template applied')
  }

  // Loads the shift dates + employees selectable for a department in the posting form,
  // clearing any date/employee picked under the previous department.
  const loadDeptShiftOptions = async (deptId: string) => {
    setFormJobDate(''); setFormAssignedEmployeeId('')
    setShiftDeptEmployees([]); setShiftAvailableDates([]); setShiftDateEmployees([])
    if (!deptId) return
    setShiftOptionsLoading(true)
    try {
      const res = await fetch(`/api/shifts/department-employees?company_id=${companyId}&department_id=${deptId}`)
      const data = await res.json()
      if (data.success) {
        const employees = data.employees ?? []
        setShiftDeptEmployees(employees)
        const dateMap = new Map<string, { start_time: string; end_time: string }>()
        employees.forEach((emp: { shifts?: { shift_date: string; start_time: string; end_time: string }[] }) => {
          (emp.shifts ?? []).forEach((s) => { if (!dateMap.has(s.shift_date)) dateMap.set(s.shift_date, { start_time: s.start_time, end_time: s.end_time }) })
        })
        setShiftAvailableDates(Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).filter(([date]) => date >= new Date().toISOString().slice(0, 10)).map(([date, tm]) => ({ date, start_time: tm.start_time, end_time: tm.end_time })))
      }
    } finally {
      setShiftOptionsLoading(false)
    }
  }

  const buildTemplateBody = () => ({
    company_id: companyId, created_by: internalUserId,
    title: formTitle, responsibilities: formResponsibilities || null, skills: formSkills || null,
    job_type: formJobType,
    department_id: formDeptId || null,
    salary_amount: formSalaryAmt ? Number(formSalaryAmt) : null,
    uniform_type: formUniformType || 'none',
    uniform_details: formUniformType === 'dress_code' ? (formUniformDetails || null) : null,
    experience_required: formExperienceRequired || null,
    minimum_age: formMinimumAge || null,
    estimated_hours: formJobType === 'oneoff' ? (formEstHours || null) : null,
    urgency: formJobType === 'oneoff' ? (formUrgency || 'normal') : null,
  })

  const saveAsTemplate = async () => {
    if (!companyId || !internalUserId) return
    if (!formTitle.trim()) { setFormError('Job title is required to save a template'); return }
    if (!formResponsibilities.trim()) { setFormError('Responsibilities are required to save a template'); return }
    if (!formSkills.trim()) { setFormError('Requirements are required to save a template'); return }
    if (formJobType === 'oneoff' && !formEstHours) { setFormError('Estimated hours are required to save a template'); return }
    if (formUniformType === 'dress_code' && !formUniformDetails.trim()) { setFormError('Dress code details are required to save a template'); return }
    if (!formExperienceRequired) { setFormError('Experience requirement is required to save a template'); return }
    if (!formMinimumAge) { setFormError('Minimum age is required to save a template'); return }
    if (!formDeptId) { setFormError('Department is required to save a template'); return }
    if (!formSalaryAmt || Number(formSalaryAmt) <= 0) { setFormError('Pay amount is required to save a template'); return }
    setTemplateActionLoading(true); setFormError('')
    try {
      const body = buildTemplateBody()
      const res = await fetch('/api/job-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save template')
      setTemplates(prev => [data.template, ...prev])
      setSavedTplSnapshot(JSON.stringify(body))
      showToast('Template saved')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setTemplateActionLoading(false)
    }
  }

  const resetNewTemplateForm = () => {
    setNtplStep(1)
    setNtplJobType(''); setNtplTitle(''); setNtplResponsibilities(''); setNtplSkills('')
    setNtplUniformType(''); setNtplUniformDetails(''); setNtplExperienceRequired(''); setNtplMinimumAge('')
    setNtplEstimatedHours(''); setNtplUrgency('normal')
    // Manager only ever has one department — pre-filled and locked (see the disabled RDrop below),
    // same treatment as the job posting wizard's Department field.
    setNtplDepartmentId(scopeToManagerDepartments ? (managerDeptIds[0] ?? '') : ''); setNtplSalaryAmt(''); setNtplError('')
  }

  const createTemplateFromScratch = async () => {
    if (!companyId || !internalUserId) return
    if (!ntplJobType) { setNtplError('Job type is required'); return }
    if (!ntplTitle.trim()) { setNtplError('Job title is required'); return }
    if (!ntplResponsibilities.trim()) { setNtplError('Responsibilities are required'); return }
    if (!ntplSkills.trim()) { setNtplError('Skills & qualifications are required'); return }
    if (ntplJobType === 'oneoff' && !ntplEstimatedHours) { setNtplError('Estimated hours are required'); return }
    if (!ntplUniformType) { setNtplError('Uniform requirement is required'); return }
    if (ntplUniformType === 'dress_code' && !ntplUniformDetails.trim()) { setNtplError('Dress code details are required'); return }
    if (!ntplExperienceRequired) { setNtplError('Experience requirement is required'); return }
    if (!ntplMinimumAge) { setNtplError('Minimum age is required'); return }
    // Manager's Department RDrop is disabled (always their own, see resetNewTemplateForm) — if
    // managerDeptIds was still mid-fetch when the modal opened, ntplDepartmentId can be blank with
    // no way to fix it by hand, so fall back to the live value here rather than hard-blocking on
    // "Department is required" for something the Manager was never shown a control to set.
    const effectiveDeptId = ntplDepartmentId || (scopeToManagerDepartments ? managerDeptIds[0] : '')
    if (!effectiveDeptId) { setNtplError('Department is required'); return }
    if (!ntplSalaryAmt || Number(ntplSalaryAmt) <= 0) { setNtplError('Pay amount is required'); return }
    setTemplateActionLoading(true); setNtplError('')
    try {
      const res = await fetch('/api/job-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId, created_by: internalUserId,
          title: ntplTitle.trim(), responsibilities: ntplResponsibilities || null, skills: ntplSkills || null,
          job_type: ntplJobType,
          department_id: effectiveDeptId || null,
          salary_amount: ntplSalaryAmt ? Number(ntplSalaryAmt) : null,
          uniform_type: ntplUniformType || 'none',
          uniform_details: ntplUniformType === 'dress_code' ? (ntplUniformDetails || null) : null,
          experience_required: ntplExperienceRequired || null,
          minimum_age: ntplMinimumAge || null,
          estimated_hours: ntplJobType === 'oneoff' ? (ntplEstimatedHours || null) : null,
          urgency: ntplJobType === 'oneoff' ? (ntplUrgency || 'normal') : null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to create template')
      setTemplates(prev => [data.template, ...prev])
      setNewTemplateModalOpen(false); resetNewTemplateForm()
      showToast('Template created')
    } catch (err) {
      setNtplError(err instanceof Error ? err.message : 'Failed to create template')
    } finally {
      setTemplateActionLoading(false)
    }
  }

  // Opens the inline Details/Edit view in the Post Job hub's right panel (not a modal) —
  // uses the tpl* form state, kept separate from the New Template modal's ntpl* state above.
  const openTemplateDetail = (t: JobTemplate) => {
    setSelectedTemplateId(t.id)
    setTplJobType(t.job_type === 'shift' ? 'shift' : 'oneoff')
    setTplTitle(t.title)
    setTplResponsibilities(t.responsibilities ?? '')
    setTplSkills(t.skills ?? '')
    setTplUniformType(uniformTypeOf(t))
    setTplUniformDetails(t.uniform_details ?? '')
    setTplExperienceRequired(t.experience_required ?? '')
    setTplMinimumAge(t.minimum_age != null ? String(t.minimum_age) : '')
    setTplEstimatedHours(t.estimated_hours ?? '')
    setTplUrgency(t.urgency ?? 'normal')
    // Self-heals a legacy template saved without a department (mirrors the same fallback on
    // draft postings) — falls back to the manager's own instead of leaving it blank.
    setTplDepartmentId(t.department_id ?? (scopeToManagerDepartments ? (managerDeptIds[0] ?? '') : ''))
    setTplSalaryAmt(t.salary_amount?.toString() ?? '')
    setTplError('')
    setPostView('template')
    setTplUsage(null)
    void (async () => {
      try {
        const res = await fetch(`/api/job-template/${t.id}/usage`)
        const data = await res.json()
        if (data.success) setTplUsage(data.stats)
      } catch { /* usage stats are informational only */ }
    })()
  }

  const saveTemplateEdits = async () => {
    if (!selectedTemplateId) return
    if (!tplJobType) { setTplError('Job type is required'); return }
    if (!tplTitle.trim()) { setTplError('Job title is required'); return }
    if (!tplResponsibilities.trim()) { setTplError('Job scope is required'); return }
    if (!tplSkills.trim()) { setTplError('Skills & qualifications are required'); return }
    if (tplJobType === 'oneoff' && !tplEstimatedHours) { setTplError('Estimated hours are required'); return }
    if (tplUniformType === 'dress_code' && !tplUniformDetails.trim()) { setTplError('Dress code details are required'); return }
    if (!tplExperienceRequired) { setTplError('Experience requirement is required'); return }
    if (!tplMinimumAge) { setTplError('Minimum age is required'); return }
    // Same self-correction as createTemplateFromScratch — Manager's Department RDrop is disabled,
    // so a still-blank tplDepartmentId (legacy template with no department + managerDeptIds not
    // yet loaded) needs a live fallback rather than a dead-end "Department is required".
    const effectiveTplDeptId = tplDepartmentId || (scopeToManagerDepartments ? managerDeptIds[0] : '')
    if (!effectiveTplDeptId) { setTplError('Department is required'); return }
    if (!tplSalaryAmt || Number(tplSalaryAmt) <= 0) { setTplError('Pay amount is required'); return }
    setTemplateActionLoading(true); setTplError('')
    try {
      const res = await fetch(`/api/job-template/${selectedTemplateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tplTitle.trim(),
          responsibilities: tplResponsibilities || null, skills: tplSkills || null,
          job_type: tplJobType,
          department_id: effectiveTplDeptId || null,
          salary_amount: tplSalaryAmt ? Number(tplSalaryAmt) : null,
          uniform_type: tplUniformType || 'none',
          uniform_details: tplUniformType === 'dress_code' ? (tplUniformDetails || null) : null,
          experience_required: tplExperienceRequired || null,
          minimum_age: tplMinimumAge || null,
          estimated_hours: tplJobType === 'oneoff' ? (tplEstimatedHours || null) : null,
          urgency: tplJobType === 'oneoff' ? (tplUrgency || 'normal') : null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update template')
      setTemplates(prev => [data.template, ...prev.filter(t => t.id !== selectedTemplateId)])
      showToast('Template updated')
    } catch (err) {
      setTplError(err instanceof Error ? err.message : 'Failed to update template')
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
      if (selectedTemplateId === id) { setSelectedTemplateId(''); setPostView('none') }
      showToast('Template deleted')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setTemplateActionLoading(false)
    }
  }

  const saveForm = async (status: 'open' | 'draft') => {
    if (!companyId || !internalUserId) return
    if (!formTitle.trim()) { setFormError('Title is required'); return }
    if (status === 'open') {
      if (!formResponsibilities.trim()) { setFormError('Responsibilities are required to publish'); return }
      if (!formSkills.trim()) { setFormError('Skills & qualifications are required to publish'); return }
      if (!formExperienceRequired) { setFormError('Experience requirement is required to publish'); return }
      if (!formMinimumAge) { setFormError('Minimum age is required to publish'); return }
      if (!formUniformType) { setFormError('Uniform requirement is required to publish'); return }
      if (formUniformType === 'dress_code' && !formUniformDetails.trim()) { setFormError('Dress code details are required to publish'); return }
      if (formJobType === 'oneoff' && !formEstHours) { setFormError('Estimated hours are required to publish'); return }
      if (formJobType === 'oneoff' && !formJobStartTime) { setFormError('Start time is required to publish'); return }
      if (!formDeptId) { setFormError('Department is required to publish'); return }
      if (!formJobDate) { setFormError('Available shift is required to publish'); return }
      if (!formAssignedEmployeeId) { setFormError('Supervisor is required to publish'); return }
      if (formJobType === 'shift' && (!formJobStart || !formJobEnd)) { setFormError('Shift start and end times are required to publish'); return }
      if (formJobType === 'shift' && (!formBreakStart || !formBreakEnd)) { setFormError('Break start and end times are required to publish'); return }
      if (!formSalaryAmt || Number(formSalaryAmt) <= 0) { setFormError('Pay amount is required to publish'); return }
      if (!formOpenings || Number(formOpenings) < 1) { setFormError('Number of positions is required to publish'); return }
      if (!formDeadlineChoice) { setFormError('Application deadline is required to publish — choose a date or "No Deadline"'); return }
    }
    if (formDeadlineChoice === 'date' && (!formExpiresAt || !formDeadlineTime)) { setFormError('Please set a full deadline date and time'); return }
    // A casual worker must never be on site outside the supervising employee's own shift —
    // start no earlier than the supervisor starts, end no later than the supervisor ends.
    if (status === 'open' && formAssignedEmployeeId && formJobDate) {
      const supEmp = shiftDeptEmployees.find(em => em.id === formAssignedEmployeeId) as unknown as { shifts?: { shift_date: string; start_time: string; end_time: string }[] } | undefined
      const supShift = supEmp?.shifts?.find(s => s.shift_date === formJobDate)
      if (supShift) {
        const supStart = supShift.start_time.slice(0, 5)
        const supEnd = supShift.end_time.slice(0, 5)
        if (formJobType === 'shift') {
          if (formJobStart && formJobStart.slice(0, 5) < supStart) { setFormError(`Start time cannot be earlier than the supervisor's shift start (${fmt12Time(supStart)})`); return }
          if (formJobEnd && formJobEnd.slice(0, 5) > supEnd) { setFormError(`End time cannot be later than the supervisor's shift end (${fmt12Time(supEnd)})`); return }
        } else if (formJobStartTime) {
          const start = formJobStartTime.slice(0, 5)
          if (start < supStart || start > supEnd) { setFormError(`Start time must be within the supervisor's shift (${fmt12Time(supStart)} – ${fmt12Time(supEnd)})`); return }
        }
      }
    }
    setActionLoading(true); setFormError('')
    try {
      const body = buildBody(status)
      let res: Response
      // draftId = a draft this wizard already saved in the background; update it instead of creating another
      const targetId = editingId || draftId
      if (targetId) {
        res = await fetch('/api/recruitment', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, action: 'edit_posting', job_id: targetId }),
        })
        // if publishing a draft, also flip its status — a Manager's draft must go through
        // Owner/Partner approval (submitForReview → pending_approval); publishDraft rejects
        // Manager-created drafts server-side, so calling it here for a Manager would throw and
        // (previously, unchecked) silently leave the draft stuck as a draft forever.
        if (status === 'open' && (editingDraft || draftId)) {
          const publishRes = await fetch('/api/recruitment', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: scopeToManagerDepartments ? 'submit_for_review' : 'publish_draft', job_id: targetId }),
          })
          const publishData = await publishRes.json()
          if (!publishData.success) throw new Error(publishData.message || 'Failed to submit job')
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
      if (status === 'draft' && !editingId) {
        // Save Draft from the create wizard is a background save — keep the wizard open
        if (!draftId && data.posting?.id) setDraftId(data.posting.id)
        await fetchAll(companyId, internalUserId)
        showToast('Saved as draft')
      } else {
        setFormOpen(false); resetForm()
        await fetchAll(companyId, internalUserId)
        if (status === 'open') {
          // A Manager's "Submit" never actually goes live — createJobPosting downgrades it to
          // pending_approval server-side — so it belongs in front of them in Pending Approval
          // (Create Job tab), not Active Jobs where it won't even appear until an Owner/Partner
          // approves it.
          if (scopeToManagerDepartments && !editingId) {
            setActiveTab('post'); setOpenSource('pending'); showToast('Submitted for review')
          } else {
            setActiveTab('jobs'); showToast(editingId ? 'Job updated' : 'Job posted')
          }
        }
        else { setActiveTab('post'); showToast('Draft saved') }
      }
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
          location: companyLocation,
          pay: formSalaryAmt ? `${formSalaryAmt} ${formSalaryType}` : null,
          notes: formSkills || formResponsibilities || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to generate description')
      const draft = data.draft
      setFormTitle(draft.title || formTitle)
      setFormResponsibilities(draft.description || formResponsibilities)
      setFormSkills([
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
      // Archiving removes the job from the Active Jobs list — clear the detail selection too
      if (action === 'archive_posting') setSelectedLiveId('')
      else if (data.posting?.id && data.posting.status !== 'draft') setSelectedLiveId(data.posting.id)
      showToast(action === 'archive_posting' ? 'Job archived' : action === 'duplicate_posting' ? 'Duplicated' : 'Job updated')
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
      setPostView('none')
      await fetchAll(companyId, internalUserId)
      showToast(action === 'unarchive_posting' ? 'Job unarchived' : 'Job deleted')
      // Restores to wherever it was archived from — Closed goes back to Closed, not Active.
      if (action === 'unarchive_posting') setActiveTab(data.posting?.status === 'closed' ? 'closed' : 'jobs')
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
      await Promise.all([fetchApplicants(selectedLiveId, internalUserId), fetchAll(companyId, internalUserId)])
      showToast(decision === 'accepted' ? 'Applicant accepted' : 'Applicant rejected')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update applicant')
    } finally { setActionLoading(false) }
  }

  const openPoolModal = async () => {
    if (!companyId) return
    setPoolModalOpen(true); setPoolSelected(new Set()); setPoolResults([]); setPoolError('')
    setPoolLoading(true)
    try {
      const res = await fetch(`/api/recruitment?resource=pool_workers&company_id=${companyId}${scopeToManagerDepartments && internalUserId ? `&manager_scope_id=${internalUserId}` : ''}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to load worker pool')
      setPoolWorkers(data.poolWorkers ?? [])
    } catch (err) {
      setPoolError(err instanceof Error ? err.message : 'Failed to load worker pool')
    } finally { setPoolLoading(false) }
  }

  // Offers land as invitations the workers still have to confirm — and each one is re-checked
  // against the same hard gates as a public application, so a worker already booked that day (or
  // banned) is refused and reported back rather than silently double-booked.
  const invitePoolWorkers = async () => {
    if (!selectedLiveId || !internalUserId || poolSelected.size === 0) return
    setPoolInviting(true); setPoolError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite_pool_workers',
          job_id: selectedLiveId,
          user_ids: [...poolSelected],
          sent_by: internalUserId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to send offers')
      setPoolResults(data.results ?? [])
      setPoolSelected(new Set())
      await Promise.all([fetchApplicants(selectedLiveId, internalUserId), fetchAll(companyId, internalUserId)])
      const sent = (data.results ?? []).filter((r: PoolInviteResult) => r.invited).length
      if (sent > 0) showToast(sent === 1 ? 'Offer sent' : `${sent} offers sent`)
    } catch (err) {
      setPoolError(err instanceof Error ? err.message : 'Failed to send offers')
    } finally { setPoolInviting(false) }
  }

  // Remove ONE confirmed worker (the job keeps hiring) — needs a written reason since a committed
  // worker is being cancelled on. Cancelling the WHOLE job is done via Archive → Delete, which
  // cancels any confirmed workers' shifts and notifies them automatically.
  const [removeWorkerTarget, setRemoveWorkerTarget] = useState<JobApplicant | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitError, setCancelSubmitError] = useState('')
  // Applicant whose full profile modal is open — opened by clicking the compact card's avatar.
  const [applicantDetail, setApplicantDetail] = useState<JobApplicant | null>(null)

  const submitRemoveWorker = async () => {
    if (!removeWorkerTarget || !internalUserId) return
    if (!cancelReason.trim()) { setCancelSubmitError('A reason is required.'); return }
    setActionLoading(true); setCancelSubmitError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_worker', job_id: selectedLiveId, applicant_id: removeWorkerTarget.id,
          removed_by: internalUserId, reason: cancelReason.trim(),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to remove worker')
      setRemoveWorkerTarget(null); setCancelReason('')
      await Promise.all([fetchApplicants(selectedLiveId, internalUserId), fetchAll(companyId, internalUserId)])
      showToast('Worker removed — they have been notified')
    } catch (err) {
      setCancelSubmitError(err instanceof Error ? err.message : 'Failed to remove worker')
    } finally { setActionLoading(false) }
  }

  const decidePosting = async (jobId: string, decision: 'approve_posting' | 'reject_posting', rejection_reason?: string) => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision, job_id: jobId, rejection_reason: rejection_reason ?? '', rejected_by: internalUserId }),
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
      setPostView('none')
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


  const deleteDraft = async (id: string, isDraft = true) => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isDraft ? 'delete_draft' : 'delete_posting', job_id: id, created_by: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete')
      setDeleteConfirm(null)
      setSelectedLiveId(prev => (prev === id ? '' : prev))
      setSelectedArchivedId(prev => (prev === id ? '' : prev))
      setSelectedPendingId(prev => (prev === id ? '' : prev))
      // Deleting the draft the wizard is currently editing — close it rather than leave it
      // writing back to a posting that no longer exists.
      if (draftId === id) { setFormOpen(false); resetForm() }
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
          body: JSON.stringify({ action: 'delete_posting', job_id: id, created_by: internalUserId }),
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
      const results = await Promise.all([...jobsSelected].map(async id => {
        const res = await fetch('/api/recruitment', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive_posting', job_id: id, created_by: internalUserId }),
        })
        return res.json()
      }))
      // The service refuses to archive a job whose applications aren't all resolved — surface that
      // rather than reporting a success the server never performed.
      const failed = results.find(r => !r.success)
      if (failed) throw new Error(failed.message || 'Failed to archive')
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
          body: JSON.stringify({ action: 'delete_posting', job_id: id, created_by: internalUserId }),
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
  // "Active Jobs" = still hiring (open); "Closed" = filled and taken off the board. Both reuse
  // the same list+detail layout, sourced from whichever tab is active.
  const jobsPostings    = useMemo(() => activeTab === 'closed' ? closedPostings : openPostings, [activeTab, openPostings, closedPostings])
  const archivedPostings = useMemo(() => livePostings.filter(p => p.status === 'archived'), [livePostings])

  // BUG-015 — used to derive filter options from existing job postings, so with 0 postings the
  // dropdown only ever had "All Departments" even though real departments existed. Sourced from
  // the company's actual department list instead, matching CommunicationView's equivalent filter.
  const jobsDepts = useMemo(() => ['all', ...departments.map(d => d.name)], [departments])
  const filteredJobsPostings = useMemo(() => jobsDeptFilter === 'all' ? jobsPostings : jobsPostings.filter(p => p.department_name === jobsDeptFilter), [jobsPostings, jobsDeptFilter])
  // Single source of truth for the card's red dot AND its sort position — same two signals as
  // each other (new applicants this viewer can act on, or their own submission just approved and
  // not opened yet), so a card can never show the dot without also being sorted to the front.
  const jobAttention = useCallback((p: JobPostingSummary) => {
    const hasNewApplicants = p.pending_count > 0 && canManageApplicants(p)
    const isNewlyApprovedUnseen = scopeToManagerDepartments && p.status === 'open' && p.created_by === internalUserId && !seenApprovedJobIds.has(p.id)
    return { hasNewApplicants, isNewlyApprovedUnseen, needsAttention: hasNewApplicants || isNewlyApprovedUnseen }
  }, [canManageApplicants, scopeToManagerDepartments, internalUserId, seenApprovedJobIds])
  // Dashboard-highlighted postings pin to the very top, then needs-attention cards (the same ones
  // carrying the red dot); Array.sort is stable, so each group keeps the order the API already
  // gave it (newest posted first) — a card drops back into that normal order the moment its dot
  // clears (applicants resolved, or the Manager opens their newly-approved job).
  const sortedJobsPostings = useMemo(
    () => [...filteredJobsPostings].sort((a, b) =>
      ((highlightIds.has(b.id) ? 2 : 0) + (jobAttention(b).needsAttention ? 1 : 0)) -
      ((highlightIds.has(a.id) ? 2 : 0) + (jobAttention(a).needsAttention ? 1 : 0))),
    [filteredJobsPostings, highlightIds, jobAttention],
  )

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F1F5F9' }}>
      <style>{pageKeyframes}</style>
      {sidebar}
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'blockSlideUp 0.38s ease both 0.04s' }}>

        {/* ── Page header ── */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Recruitment
            </h1>
          </div>
          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {/* Subscription plan is Owner/Partner-only — Manager (and every other role) can't switch it. */}
            {companyId && !scopeToManagerDepartments && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* ── Card wrapper (tab bar + content) ── */}
        <div style={{ padding: '0 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ── Tab bar ── */}
        <div style={{ padding: '0 0 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: 4, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            {([
              { key: 'jobs' as Tab,   label: 'Active Jobs' },
              { key: 'post' as Tab,   label: 'Create Job' },
              { key: 'closed' as Tab, label: 'Closed Jobs' },
            ]).map(tab => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setPostView('none'); setOpenSource('none'); setSelectedArchivedId(''); setArchivedSelected(new Set()); setSelectedTemplateId(''); setSelectedPendingId(''); setSelectedLiveId(''); setJobsDeptFilter('all'); setJobsSelected(new Set()) }}
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
                  {/* Pending Approval now lives inside Post Job's Job Sources accordion — the dot moves with it.
                      Owner/Partner: any item awaiting their decision. Manager: only a rejection needs their
                      attention here — a plain Pending submission is just waiting, nothing to react to yet. */}
                  {tab.key === 'post' && (scopeToManagerDepartments ? pendingPostings.some(p => p.status === 'rejected') : pendingPostings.length > 0) && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                  )}
                  {/* Scoped to open postings only — a closed/archived job's stale pending_count
                      shouldn't light up a dot on a tab that no longer shows that posting. Also
                      only jobs this viewer can actually manage — a Manager can't act on an
                      Owner/Partner posting's applicants, so it shouldn't flag "needs attention".
                      Plus a Manager's own submissions that just got approved and haven't been
                      opened yet — see seenApprovedJobIds. */}
                  {tab.key === 'jobs' && openPostings.some(p =>
                    (p.pending_count > 0 && canManageApplicants(p))
                    || (scopeToManagerDepartments && p.created_by === internalUserId && !seenApprovedJobIds.has(p.id))
                  ) && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="recruitment-scroll-region" style={{ padding: 0, flex: 1, minHeight: 0, overflow: 'hidden', animation: 'tabContentIn 0.22s ease-out both' }}>
          {error && (
            <div style={{ marginBottom: 12, padding: '11px 14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.84rem', fontWeight: 600 }}>{error}</div>
          )}

          {/* ══ JOBS / CLOSED tab — same list+detail layout, source list switches by tab ══ */}
          {(activeTab === 'jobs' || activeTab === 'closed') && (
            <div className="recruitment-grid" ref={jobsGridRef}>

              {/* Left: job list — pinned to the viewport with its own scrollbar: the header stays
                  put and only the card list scrolls, instead of the whole page growing with jobs. */}
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden', maxHeight: panelMaxHeight ?? undefined, display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: LIST_HEADER_HEIGHT, padding: '0 18px', boxSizing: 'border-box', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Briefcase size={15} style={{ color: '#F97316' }} />
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1 }}>{activeTab === 'closed' ? 'Closed Jobs' : 'Active Jobs'}</span>
                  {jobsSelected.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {selectedJobsArchivable && (
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
                      )}
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
                  {/* Manager only ever has one department, so the postings list is already scoped
                      to just it server-side — a filter offering "every department" would just be
                      "All Departments" vs. that one same department, dead choice either way.
                      Owner/Partner see every department at once and actually need it. */}
                  {jobsSelected.size === 0 && !scopeToManagerDepartments && (
                    <div ref={jobsDeptDropdownRef} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setJobsDeptDropdownOpen(o => !o)}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', border: `1.5px solid ${jobsDeptDropdownOpen ? '#F97316' : '#E5E7EB'}`, borderRadius: 10, background: '#FFFFFF', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: jobsDeptDropdownOpen ? '0 0 0 3px rgba(249,115,22,0.10)' : 'none', transition: 'border-color 0.15s' }}
                      >

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
                <div style={{ padding: '12px 14px', overflowY: 'auto', overscrollBehavior: 'contain', flex: 1, minHeight: 0 }}>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: '#9CA3AF', fontSize: '0.875rem' }}>
                    <Spinner size={14} dark /> Loading...
                  </div>
                ) : sortedJobsPostings.length === 0 ? (
                  <div style={{ padding: '28px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <Briefcase size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{
                      activeTab === 'closed'
                        ? (jobsDeptFilter === 'all' ? 'No closed jobs yet.' : `No closed jobs for ${jobsDeptFilter}.`)
                        : (jobsDeptFilter === 'all' ? 'No job postings yet.' : `No job postings for ${jobsDeptFilter}.`)
                    }</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Icon legend — explains the three counters every job card shows below */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '7px 12px', background: '#F8FAFC', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
                        <Users size={11} />
                      </span>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Pending review</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 999, background: '#FFFBEB', color: '#B45309', flexShrink: 0 }}>
                        <Clock size={11} />
                      </span>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Awaiting reply</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 999, background: '#ECFDF5', color: '#059669', flexShrink: 0 }}>
                        <UserCheck size={11} />
                      </span>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Positions to fill</span>
                    </div>
                  </div>
                  {sortedJobsPostings.map((p, idx) => {
                  const isSelected = selectedLiveId === p.id
                  const active = isSelected
                  const dc = p.department_id ? deptColor(p.department_id) : '#94A3B8'
                  // Same signals that decide this card's spot in sortedJobsPostings — see jobAttention.
                  const { hasNewApplicants, isNewlyApprovedUnseen, needsAttention } = jobAttention(p)
                  const highlighted = highlightIds.has(p.id)
                  return (
                    <div key={p.id} style={{ position: 'relative' }}>
                    {/* Needs-attention alert dot — floats outside the card's left edge, vertically centered;
                        the card's own marginLeft leaves the clearance */}
                    {needsAttention && (
                      <span
                        title={hasNewApplicants ? `${p.pending_count} new application${p.pending_count > 1 ? 's' : ''} to review` : 'Approved — now live'}
                        style={{ position: 'absolute', left: -6, top: '50%', marginTop: -5, width: 10, height: 10, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 0 2px #FFFFFF, 0 1px 3px rgba(0,0,0,0.15)', zIndex: 1 }}
                      />
                    )}
                    <article
                      onClick={() => { setSelectedLiveId(p.id); if (isNewlyApprovedUnseen) markApprovedJobSeen(p.id) }}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        marginLeft: needsAttention ? 18 : 0,
                        border: `1px solid ${active ? dc : highlighted ? '#F97316' : PANEL_BORDER}`,
                        borderRadius: 10, padding: '14px 16px',
                        background: active ? `${dc}0d` : highlighted ? '#FFF7ED' : '#F9FAFB',
                        cursor: 'pointer', overflow: 'hidden',
                        transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s, background 0.18s, margin-left 0.18s',
                        animation: `deptCardIn 0.28s ease both ${scopeToManagerDepartments ? 0 : idx * 55}ms`,
                        boxShadow: active ? `0 4px 16px ${dc}22` : highlighted ? '0 0 0 3px rgba(249,115,22,0.16)' : undefined,
                      }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.11)'; e.currentTarget.style.borderColor = dc } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = highlighted ? '0 0 0 3px rgba(249,115,22,0.16)' : 'none'; e.currentTarget.style.borderColor = highlighted ? '#F97316' : PANEL_BORDER } }}
                    >
                      {/* Department + job type badge row — Manager only ever has one department,
                          so the badge is Owner/Partner only (they see every department at once). */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          {!scopeToManagerDepartments && <DepartmentBadge departmentId={p.department_id} departmentName={p.department_name} />}
                          {(p.job_type === 'shift')
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
                            : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>One-Off Job</span>
                          }
                        </div>
                        {/* Card actions — same placement as the Template cards */}
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {/* Archive only once every application is resolved — none awaiting the Owner's
                              decision (pending) and none accepted but still awaiting the worker's
                              confirmation. Until then the button isn't offered at all. */}
                          {canArchivePostings && p.pending_count === 0 && p.awaiting_confirmation_count === 0 && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); void runPostingAction('archive_posting', p.id) }}
                            disabled={actionLoading}
                            title="Archive job"
                            style={{ border: 'none', background: 'transparent', color: '#EA580C', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', padding: 6, borderRadius: 6, opacity: actionLoading ? 0.5 : 1 }}
                            onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FFEDD5' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          ><Archive size={14} /></button>
                          )}
                          {/* Closed jobs must be archived first, not deleted directly — deleting is only
                              offered from the Archived list, once the posting is safely out of the live board.
                              canManageApplicants: a Manager only "owns" (and may delete) a live posting they
                              created themselves — an Owner/Partner's posting is view-only to them, same rule
                              as applicant management above. Owner/Partner (scopeToManagerDepartments=false)
                              are never restricted here. */}
                          {activeTab !== 'closed' && canManageApplicants(p) && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: p.id, title: p.title, isDraft: false }) }}
                            disabled={actionLoading}
                            title="Delete job"
                            style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', padding: 6, borderRadius: 6, opacity: actionLoading ? 0.5 : 1 }}
                            onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          ><Trash2 size={14} /></button>
                          )}
                        </div>
                      </div>
                      {/* Title row — the new-applications alert dot lives outside the card's left edge instead, see wrapper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{p.title}</h3>
                      </div>
                      {/* Pending review / awaiting worker confirmation / confirmed-vs-openings (left) + posted date (right) */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                          {/* New applications not yet accepted or rejected — clears to 0 once each is decided */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} title="Pending review">
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
                              <Users size={15} />
                            </span>
                            <span style={{ color: '#111827', fontSize: 15, fontWeight: 700 }}>{p.pending_count}</span>
                          </div>
                          {/* Owner accepted, worker hasn't confirmed the invitation yet */}
                          {p.awaiting_confirmation_count > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} title="Awaiting worker confirmation">
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#FFFBEB', color: '#B45309', flexShrink: 0 }}>
                                <Clock size={15} />
                              </span>
                              <span style={{ color: '#111827', fontSize: 15, fontWeight: 700 }}>{p.awaiting_confirmation_count}</span>
                            </div>
                          )}
                          {/* Confirmed hires (both sides accepted) vs the openings this posting needs */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} title="Confirmed / positions to fill">
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#ECFDF5', color: '#059669', flexShrink: 0 }}>
                              <UserCheck size={15} />
                            </span>
                            <span style={{ color: '#111827', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{p.confirmed_count} / {p.openings ?? 1}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF', flexShrink: 0 }}>Posted {formatCompactAt(p.created_at)}</span>
                      </div>
                    </article>
                    </div>
                  )
                  })}
                  </div>
                )}
                </div>
              </div>

              {/* Right: posting detail + applicants — same two-block design as the Archived view */}
              {!selectedLive ? (
                <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ padding: '40px 48px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, width: '100%' }}>
                    <ClipboardList size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Select a job posting</p>
                  </div>
                </div>
              ) : (
              <div className="jobs-detail-grid">
                {/* Job detail — read-only preview. Pinned to the viewport with its own scrollbar,
                    so a long description never stretches the page — the body scrolls internally. */}
                <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: panelMaxHeight ?? undefined }}>
                  <div style={{ height: LIST_HEADER_HEIGHT, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Briefcase size={15} style={{ color: '#F97316' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{selectedLive.title} Detail</span>
                  </div>
                  {/* Job details body — mirrors the Template Preview design, plus a Schedule section */}
                  {(() => {
                    const p = selectedLive
                    const isShiftJob = (p.job_type === 'shift')
                    const fmt12 = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(m).padStart(2, '0')} ${ap}` }
                    const payLabel = buildPayLabel(p, false)
                    const uniformLabel = p.uniform_type === 'dress_code' ? 'Specific Dress Code' : p.uniform_type === 'company' ? 'Company Uniform Provided' : null
                    const metaRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
                    const metaText: React.CSSProperties = { fontSize: '0.875rem', color: '#374151' }
                    const metaIcon: React.CSSProperties = { flexShrink: 0 }
                    const cd = deadlineCountdown(p.expires_at)
                    return (
                      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', overscrollBehavior: 'contain', flex: 1, minHeight: 0 }}>
                        {/* Who posted it + application deadline — moved below the header title so the
                            panel header only needs to fit the title, letting the column stay narrow */}
                        {(p.created_by_name || cd) && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {p.created_by_name && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Posted by {p.created_by_name}</span>
                            )}
                            {cd && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: cd.expired ? '#FEF2F2' : '#FFFBEB', color: cd.expired ? '#B91C1C' : '#B45309', border: `1px solid ${cd.expired ? '#FECACA' : '#FDE68A'}`, whiteSpace: 'nowrap' }}>
                                <Clock size={11} />{cd.label}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Rejected Job Status: reason + who rejected it, visible to everyone who can
                            see the job (department-wide Job Visibility) — but only the job's own
                            creator gets Edit / Resubmit, since that's this Manager's own submission
                            to fix, not something a viewing peer can touch. */}
                        {p.status === 'rejected' && (
                          <div style={{ border: '1.5px solid #FECACA', background: '#FEF2F2', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: '#B91C1C' }}>
                              <XCircle size={14} /> Rejected{p.rejected_by_name ? ` by ${p.rejected_by_name}` : ''}
                            </div>
                            {p.rejection_reason && (
                              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#7F1D1D', lineHeight: 1.5 }}>{p.rejection_reason}</p>
                            )}
                            {canManageApplicants(p) && (
                              <button
                                type="button"
                                onClick={() => void openRejectedInWizard(p)}
                                style={{ alignSelf: 'flex-start', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', height: 32, padding: '0 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                              >
                                <Pencil size={13} /> Edit &amp; Resubmit for Approval
                              </button>
                            )}
                          </div>
                        )}
                        {/* Job Board card look-alike */}
                        <div style={{ background: '#FFFFFF', border: '1.5px solid #EDE9E3', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {!isShiftJob && (p.urgency === 'high' || p.urgency === 'urgent') && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFF1F2', color: '#E11D48', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                                <Zap size={12} />{p.urgency === 'urgent' ? 'Urgent' : 'High'}
                              </span>
                            )}
                            {p.minimum_age && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF2FF', color: '#4F46E5', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                                <Cake size={12} />{p.minimum_age}+
                              </span>
                            )}
                            {p.experience_required && p.experience_required !== 'Not Required' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECFEFF', color: '#0891B2', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                                <UserCheck size={12} />{p.experience_required}
                              </span>
                            )}
                            {uniformLabel && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFFBEB', color: '#B45309', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                                <Shirt size={12} />{p.uniform_type === 'dress_code' ? 'Dress Code' : 'Uniform Provided'}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: 0 }}>{p.title}</p>
                            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: 0 }}>{p.company_name ?? companyName ?? '—'}</p>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {/* Location always comes from the company profile — same source and format as the Template preview */}
                            {(companyLocation || p.company_location) && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#4B5563', background: '#F3F4F6', borderRadius: 999, padding: '4px 10px' }}>
                                <MapPin size={12} strokeWidth={2.5} />{companyLocation || p.company_location}
                              </span>
                            )}
                            {p.salary_amount != null && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#065F46', background: '#ECFDF5', borderRadius: 999, padding: '4px 10px' }}>
                                ${p.salary_amount}{isShiftJob ? '/hr' : ''}
                              </span>
                            )}
                            {!isShiftJob && p.estimated_hours && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 999, padding: '4px 10px' }}>
                                <Clock size={12} />{p.estimated_hours}h
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Job detail look-alike */}
                        <div style={{ border: '1.5px solid #EDE9E3', borderRadius: 16, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                          <div>
                            <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: '0 0 4px' }}>{p.title}</h2>
                            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: '0 0 14px' }}>{p.company_name ?? companyName ?? '—'}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {p.department_name && (
                                <div style={metaRow}><LayoutGrid size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{p.department_name}</span></div>
                              )}
                              {p.minimum_age && (
                                <div style={metaRow}><Cake size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{p.minimum_age}+</span></div>
                              )}
                              {p.experience_required && p.experience_required !== 'Not Required' && (
                                <div style={metaRow}><UserCheck size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>Experience {p.experience_required}</span></div>
                              )}
                              {uniformLabel && (
                                <div style={metaRow}><Shirt size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{uniformLabel}</span></div>
                              )}
                              {!isShiftJob && p.estimated_hours && (
                                <div style={metaRow}><Clock size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>Est. {p.estimated_hours} hours</span></div>
                              )}
                              {payLabel && (
                                <div style={metaRow}><DollarSign size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>{payLabel}</span></div>
                              )}
                            </div>
                          </div>

                          {/* Schedule & posting facts — the full set of values entered when posting */}
                          <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                            <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Schedule</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {p.job_date && (
                                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Date:</span> {new Date(p.job_date).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                              )}
                              {isShiftJob && (p.job_start_time || p.job_end_time) && (
                                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Working Hours:</span> {p.job_start_time ? fmt12(p.job_start_time) : '—'} – {p.job_end_time ? fmt12(p.job_end_time) : '—'}</p>
                              )}
                              {isShiftJob && (p.break_start_time || p.break_end_time) && (
                                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Break Time:</span> {p.break_start_time ? fmt12(p.break_start_time) : '—'} – {p.break_end_time ? fmt12(p.break_end_time) : '—'}</p>
                              )}
                              {!isShiftJob && p.job_start_time && (
                                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Start Time:</span> {fmt12(p.job_start_time)}</p>
                              )}
                              {p.assigned_employee_name && (
                                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Supervisor:</span> {p.assigned_employee_name}</p>
                              )}
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                            <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Responsibilities</p>
                            <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{p.responsibilities || '—'}</p>
                          </div>
                          <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                            <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Skills &amp; Qualifications</p>
                            <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{p.skills || '—'}</p>
                          </div>
                          {uniformLabel && p.uniform_details && (
                            <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                              <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>{p.uniform_type === 'dress_code' ? 'Dress Code' : 'Uniform Details'}</p>
                              <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{p.uniform_details}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Flow arrow between Detail and Applicants — same orange chip as the template layout */}
                <div className="jobs-flow-arrow" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 150 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(249,115,22,0.35)' }}>
                    <ArrowRight size={15} strokeWidth={2.5} />
                  </div>
                </div>

                {/* Applicants — same treatment: pinned, with the list scrolling inside the panel */}
                <div ref={applicantsPanelRef} className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: panelMaxHeight ?? undefined }}>
                  <div style={{ height: LIST_HEADER_HEIGHT, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, overflow: 'hidden' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users size={15} style={{ color: '#F97316' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Applicants</span>
                    {/* Hand the job straight to workers who already worked here, alongside the AI
                        assessment of whoever applied on the public board. Below the compact
                        breakpoint (this PANEL's own width, not the window's) the buttons drop
                        their text label (icon + title tooltip only) so they never spill past the
                        panel edge into the next column. */}
                    {activeTab !== 'closed' && canManageApplicants(selectedLive) && (
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={openPoolModal}
                          title="Invite from Pool"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: 'linear-gradient(135deg, #059669, #047857)', color: '#FFFFFF', height: 36, padding: isCompactApplicantActions ? 0 : '0 14px', width: isCompactApplicantActions ? 36 : undefined, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                        >
                          <UserCheck size={15} strokeWidth={2.5} /> {!isCompactApplicantActions && 'Invite from Pool'}
                        </button>
                        <button
                          onClick={recommendCandidates}
                          disabled={aiLoading || applicants.length === 0}
                          title="AI Assessment"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: '#FFFFFF', height: 36, padding: isCompactApplicantActions ? 0 : '0 14px', width: isCompactApplicantActions ? 36 : undefined, fontSize: 13, fontWeight: 700, cursor: aiLoading || applicants.length === 0 ? 'default' : 'pointer', opacity: aiLoading || applicants.length === 0 ? 0.6 : 1 }}
                        >
                          {aiLoading ? <Spinner size={14} /> : <Sparkles size={15} strokeWidth={2.5} />} {!isCompactApplicantActions && 'AI Assessment'}
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '18px 20px', overflowY: 'auto', overscrollBehavior: 'contain', flex: 1, minHeight: 0 }}>
                        {pendingApplicants.length === 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px dashed #E5E7EB' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                              <UserX size={22} style={{ color: '#D1D5DB' }} />
                            </div>
                            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#6B7280' }}>No applicants yet</p>
                          </div>
                        ) : (
                          <>
                            {/* Hints that an applicant's photo opens their full profile */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', marginBottom: 12, background: '#F8FAFC', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8 }}>
                              <MousePointerClick size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Click an applicant&apos;s photo to view their full details</span>
                            </div>
                            {pendingApplicants.map(applicant => {
                          const rec = recommendations.find(r => r.applicant_id === applicant.id)
                          return (
                            <ApplicantCard
                              key={applicant.id}
                              applicant={applicant}
                              onOpenDetail={() => setApplicantDetail(applicant)}
                              actions={
                                // Read-only for anyone but the job's own creator (Owner/Partner always
                                // qualify) — Job Visibility lets them see who applied, not act on them.
                                !canManageApplicants(selectedLive) ? applicantStatusPill(applicant) :
                                applicant.status === 'pending' ? (
                                  // Outlined pill buttons stacked, matching the Off Day Approve/Modify column
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <button onClick={() => decideApplicant(applicant.id, 'accepted')} disabled={actionLoading}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 999, padding: '6px 16px', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.6 : 1, transition: 'background 0.15s' }}
                                      onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#DCFCE7' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = '#F0FDF4' }}
                                    ><UserCheck size={13} /> Accept</button>
                                    <button onClick={() => decideApplicant(applicant.id, 'rejected')} disabled={actionLoading}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 999, padding: '6px 16px', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.6 : 1, transition: 'background 0.15s' }}
                                      onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                                    ><UserX size={13} /> Reject</button>
                                  </div>
                                ) : applicant.status === 'accepted' ? (
                                  // Accepted but the worker hasn't confirmed yet — the Owner can still change
                                  // their mind: the Pending pill plus a Reject button, same style/behavior as
                                  // the pending-decision Reject above (rescinds the outstanding invitation).
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                    {applicantStatusPill(applicant)}
                                    <button onClick={() => decideApplicant(applicant.id, 'rejected')} disabled={actionLoading}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 999, padding: '6px 16px', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.6 : 1, transition: 'background 0.15s' }}
                                      onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                                    ><UserX size={13} /> Reject</button>
                                  </div>
                                ) : applicantStatusPill(applicant)
                              }
                            >
                              {rec && (rec.insufficient ? (
                                <div style={{ padding: '10px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '0.775rem', lineHeight: 1.5 }}>
                                  <strong style={{ color: '#6B7280' }}>AI: Insufficient information</strong>
                                  <p style={{ margin: '4px 0 0', color: '#6B7280' }}>{rec.reasons[0]}</p>
                                </div>
                              ) : (
                                // Hover the green segment for why it scored this way, the pink segment for
                                // what's holding it back — no caption text, just the bar.
                                <AiFitGauge score={rec.score} reason={rec.reasons[0] ?? rec.suggested_next_step} risk={rec.risks[0]} />
                              ))}
                            </ApplicantCard>
                          )
                            })}
                          </>
                        )}
                  </div>
                </div>

                {/* Flow arrow between Applicants and Confirmed */}
                <div className="jobs-flow-arrow" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 150 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(249,115,22,0.35)' }}>
                    <ArrowRight size={15} strokeWidth={2.5} />
                  </div>
                </div>

                {/* Confirmed — both sides accepted. Its own panel to the right of Applicants. */}
                <div className="recruitment-panel jobs-confirmed-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: panelMaxHeight ?? undefined }}>
                  <div style={{ height: LIST_HEADER_HEIGHT, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <UserCheck size={15} style={{ color: '#059669' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Confirmed</span>
                    <span title="Confirmed hires / positions to fill" style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', flexShrink: 0 }}>
                      {confirmedApplicants.length} / {selectedLive.openings ?? 1}
                    </span>
                  </div>
                  <div style={{ padding: '18px 20px', overflowY: 'auto', overscrollBehavior: 'contain', flex: 1, minHeight: 0 }}>
                    {confirmedApplicants.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px dashed #E5E7EB' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                          <UserCheck size={22} style={{ color: '#D1D5DB' }} />
                        </div>
                        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#6B7280' }}>No confirmed workers yet</p>
                      </div>
                    ) : confirmedApplicants.map(applicant => (
                      <ApplicantCard
                        key={applicant.id}
                        applicant={applicant}
                        onOpenDetail={() => setApplicantDetail(applicant)}
                        dateLabel="Confirmed"
                        dateValue={applicant.confirmed_at}
                        actions={
                          // Read-only for anyone but the job's own creator (Owner/Partner always
                          // qualify) — same rule as the Applicants panel above.
                          !canManageApplicants(selectedLive) ? (
                            <ApplicantPill tone={{ bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' }} icon={<UserCheck size={13} />} label="Confirmed" />
                          ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                            {(applicant.worker_cancellation_count ?? 0) > 0 && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B45309', textAlign: 'right' }}>
                                Cancelled {applicant.worker_cancellation_count} confirmed shift{applicant.worker_cancellation_count === 1 ? '' : 's'} before
                              </span>
                            )}
                            <button onClick={() => { setRemoveWorkerTarget(applicant); setCancelReason(''); setCancelSubmitError('') }} disabled={actionLoading}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 999, padding: '6px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                            ><UserX size={13} /> Remove</button>
                          </div>
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {/* ══ POST JOB hub tab ═══════════════════════════════════════════════ */}
          {activeTab === 'post' && (
            <div className="recruitment-grid" style={
              postView === 'template' ? { gap: 40, height: '100%', minHeight: 0, gridTemplateRows: 'minmax(0, 1fr)' }
              : undefined
            }>
            {/* Capped at viewport height — the template detail scrolls internally instead of the page */}
            <section className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: postView === 'template' ? '100%' : 'calc(100vh - 162px)' }}>
              <div style={{ height: LIST_HEADER_HEIGHT, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Plus size={15} style={{ color: '#F97316' }} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Job Postings</span>
                {/* AI action — purple gradient button, same treatment as the other AI features */}
                <button
                  type="button"
                  onClick={() => { resetForm(); setFormOpen(true) }}
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: '#FFFFFF', height: 36, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  <Sparkles size={15} strokeWidth={2.5} /> AI Job Builder
                </button>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto' }}>
                {([
                  // Same section, different framing per viewer: Owner/Partner are the ones deciding
                  // ("Pending Approval" — approve/reject sits in this queue), a Manager is just
                  // waiting on someone else's decision ("Waiting For Review").
                  { key: 'pending' as const, icon: ClipboardList, title: scopeToManagerDepartments ? 'Waiting For Review' : 'Pending Approval', onClick: () => { setOpenSource(o => o === 'pending' ? 'none' : 'pending'); setPostView('none'); setSelectedPendingId('') } },
                  { key: 'drafts' as const,   icon: FileText, title: 'Drafts', onClick: () => { setOpenSource(o => o === 'drafts' ? 'none' : 'drafts'); setPostView('none') } },
                  { key: 'archived' as const, icon: Archive,  title: 'Archived', onClick: () => { setOpenSource(o => o === 'archived' ? 'none' : 'archived'); setPostView('none'); setSelectedArchivedId(''); setArchivedSelected(new Set()) } },
                  { key: 'templates' as const, icon: ClipboardList, title: 'Templates', onClick: () => { setPostView('none'); setOpenSource(o => o === 'templates' ? 'none' : 'templates') } },
                ]).filter(card => canArchivePostings || card.key !== 'archived').map((card, idx) => {
                  const Icon = card.icon
                  const isSelected = openSource === card.key
                  // Template block shrinks with the panel so its list scrolls internally and the New Template button stays pinned
                  const isTemplateOpen = isSelected && card.key === 'templates'
                  return (
                    <div key={card.key} style={{ display: 'flex', flexDirection: 'column', gap: 10, ...(isTemplateOpen ? { flex: '1 1 auto', minHeight: 0 } : { flexShrink: 0 }) }}>
                    <article
                      onClick={card.onClick}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                        border: `1px solid ${isSelected ? '#F97316' : PANEL_BORDER}`,
                        borderRadius: 10, padding: '14px 16px',
                        background: isSelected ? '#FFF7ED' : '#F9FAFB',
                        cursor: 'pointer', overflow: 'hidden',
                        transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s, background 0.18s',
                        animation: `deptCardIn 0.28s ease both ${scopeToManagerDepartments ? 0 : idx * 55}ms`,
                        boxShadow: isSelected ? '0 4px 16px rgba(249,115,22,0.15)' : undefined,
                      }}
                      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.11)'; e.currentTarget.style.borderColor = '#F97316' } }}
                      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = PANEL_BORDER } }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={14} style={{ color: '#F97316' }} />
                      </div>
                      <h3 style={{ margin: 0, flex: 1, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</h3>
                      {/* Same rule as the top-level tab pill: Owner/Partner see any item awaiting
                          their decision; a Manager only sees a rejection flagged here. */}
                      {card.key === 'pending' && (scopeToManagerDepartments ? pendingPostings.some(p => p.status === 'rejected') : pendingPostings.length > 0) && (
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                      )}
                      <ChevronDown size={15} style={{ color: isSelected ? '#F97316' : '#9CA3AF', flexShrink: 0, transition: 'transform 0.18s', transform: isSelected ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </article>

                    {/* ── Pending Approval dropdown — postings submitted by Managers, awaiting Owner review ── */}
                    {isSelected && card.key === 'pending' && (
                      <div style={{ padding: '0 0 4px 14px', display: 'flex', flexDirection: 'column', gap: 10, animation: 'deptCardIn 0.2s ease both' }}>
                        {pendingPostings.length === 0 ? (
                          <div style={{ padding: '20px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 12 }}>
                            <ClipboardList size={20} style={{ color: '#CBD5E1', margin: '0 auto 6px', display: 'block' }} />
                            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{scopeToManagerDepartments ? 'No postings waiting for review.' : 'No postings awaiting approval.'}</p>
                          </div>
                        ) : (
                          pendingPostings.map((p, i) => {
                            const isRejected = p.status === 'rejected'
                            return (
                            <div key={p.id} style={{ position: 'relative' }}>
                              {/* Same "needs attention" treatment as an Active Jobs card — dot floats
                                  outside the card's left edge, vertically centered, card itself stays
                                  neutral (no red background/border — the dot alone is the signal). */}
                              {isRejected && (
                                <span
                                  title="Rejected — see reason and resubmit"
                                  style={{ position: 'absolute', left: -6, top: '50%', marginTop: -5, width: 10, height: 10, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 0 2px #FFFFFF, 0 1px 3px rgba(0,0,0,0.15)', zIndex: 1 }}
                                />
                              )}
                            <div style={{
                              display: 'flex', flexDirection: 'column', gap: 16,
                              marginLeft: isRejected ? 18 : 0,
                              border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 16px 18px', background: '#F9FAFB',
                              animation: `deptCardIn 0.28s ease both ${scopeToManagerDepartments ? 0 : i * 55}ms`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                {!scopeToManagerDepartments && <DepartmentBadge departmentId={p.department_id} departmentName={p.department_name} />}
                                {(p.job_type === 'shift')
                                  ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
                                  : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>One-Off Job</span>
                                }
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                {/* Status only makes sense once Pending vs Rejected can both appear
                                    here — Owner/Partner's own queue never includes rejected items. */}
                                {scopeToManagerDepartments && (
                                  isRejected
                                    ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', whiteSpace: 'nowrap', flexShrink: 0 }}>Rejected</span>
                                    : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>Pending</span>
                                )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setPostView('pending'); setSelectedPendingId(p.id) }}
                                title="Review posting"
                                style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: selectedPendingId === p.id && postView === 'pending' ? '#F97316' : '#0F172A', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#F97316' }}
                                onMouseLeave={e => { e.currentTarget.style.color = selectedPendingId === p.id && postView === 'pending' ? '#F97316' : '#0F172A' }}
                              >{p.title}</button>
                              {/* Who submitted it — every posting here came from a Manager awaiting Owner approval */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  <RoleAvatar role="Manager" size={22} photoUrl={p.submitter_photo_url} />
                                  <span style={{ color: '#111827', fontSize: 13, fontWeight: 400 }}>{p.submitter_name ?? 'Manager'}</span>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: '#9CA3AF', flexShrink: 0 }}>Submitted {formatCompactAt(p.created_at)}</span>
                              </div>
                            </div>
                            </div>
                            )
                          })
                        )}
                      </div>
                    )}

                    {/* ── Drafts dropdown ── */}
                    {isSelected && card.key === 'drafts' && (
                      <div style={{ padding: '0 0 4px 14px', display: 'flex', flexDirection: 'column', gap: 10, animation: 'deptCardIn 0.2s ease both' }}>
                        {drafts.length === 0 ? (
                          <div style={{ padding: '20px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 12 }}>
                            <FileText size={20} style={{ color: '#CBD5E1', margin: '0 auto 6px', display: 'block' }} />
                            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No drafts saved.</p>
                          </div>
                        ) : (
                          drafts.map((p, i) => (
                            <div key={p.id} style={{
                              display: 'flex', flexDirection: 'column', gap: 16,
                              border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 16px 18px', background: '#F9FAFB',
                              animation: `deptCardIn 0.28s ease both ${scopeToManagerDepartments ? 0 : i * 55}ms`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  {!scopeToManagerDepartments && p.department_id && <DepartmentBadge departmentId={p.department_id} departmentName={p.department_name} />}
                                  {(p.job_type === 'shift')
                                    ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
                                    : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>One-Off Job</span>
                                  }
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => void runPostingAction('duplicate_posting', p.id)}
                                    disabled={actionLoading}
                                    title="Duplicate draft"
                                    style={{ border: 'none', background: 'transparent', color: '#16A34A', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', padding: 6, borderRadius: 6, opacity: actionLoading ? 0.5 : 1 }}
                                    onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#DCFCE7' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                  ><Copy size={14} /></button>
                                  <button
                                    type="button"
                                    onClick={() => void deleteDraft(p.id, true)}
                                    disabled={actionLoading}
                                    title="Delete draft"
                                    style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', padding: 6, borderRadius: 6, opacity: actionLoading ? 0.5 : 1 }}
                                    onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                  ><Trash2 size={14} /></button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => void openDraftInWizard(p)}
                                  title="Continue draft"
                                  style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: formOpen && draftId === p.id ? '#F97316' : '#0F172A', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#F97316' }}
                                  onMouseLeave={e => { e.currentTarget.style.color = formOpen && draftId === p.id ? '#F97316' : '#0F172A' }}
                                >{p.title}</button>
                                <span style={{ fontSize: '0.75rem', color: '#9CA3AF', flexShrink: 0 }}>Saved {formatCompactAt(p.created_at)}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* ── Archived dropdown ── */}
                    {isSelected && card.key === 'archived' && (
                      <div style={{ padding: '0 0 4px 14px', display: 'flex', flexDirection: 'column', gap: 10, animation: 'deptCardIn 0.2s ease both' }}>
                        {archivedPostings.length === 0 ? (
                          <div style={{ padding: '20px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 12 }}>
                            <Archive size={20} style={{ color: '#CBD5E1', margin: '0 auto 6px', display: 'block' }} />
                            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No archived jobs.</p>
                          </div>
                        ) : (
                          archivedPostings.map((p, i) => (
                            <div key={p.id} style={{
                              display: 'flex', flexDirection: 'column', gap: 16,
                              border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 16px 18px', background: '#F9FAFB',
                              animation: `deptCardIn 0.28s ease both ${scopeToManagerDepartments ? 0 : i * 55}ms`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  <DepartmentBadge departmentId={p.department_id} departmentName={p.department_name} />
                                  {(p.job_type === 'shift')
                                    ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
                                    : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>One-Off Job</span>
                                  }
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => void runArchivedAction('unarchive_posting', p.id)}
                                    disabled={actionLoading}
                                    title="Unarchive job"
                                    style={{ border: 'none', background: 'transparent', color: '#16A34A', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', padding: 6, borderRadius: 6, opacity: actionLoading ? 0.5 : 1 }}
                                    onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#DCFCE7' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                  ><ArchiveRestore size={14} /></button>
                                  <button
                                    type="button"
                                    onClick={() => void runArchivedAction('delete_posting', p.id)}
                                    disabled={actionLoading}
                                    title="Delete job"
                                    style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', padding: 6, borderRadius: 6, opacity: actionLoading ? 0.5 : 1 }}
                                    onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#FEE2E2' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                  ><Trash2 size={14} /></button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => { setPostView('archived'); setSelectedArchivedId(p.id) }}
                                  title="View archived job"
                                  style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: selectedArchivedId === p.id && postView === 'archived' ? '#F97316' : '#0F172A', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#F97316' }}
                                  onMouseLeave={e => { e.currentTarget.style.color = selectedArchivedId === p.id && postView === 'archived' ? '#F97316' : '#0F172A' }}
                                >{p.title}</button>
                                <span style={{ fontSize: '0.75rem', color: '#9CA3AF', flexShrink: 0 }}>Archived {formatCompactAt(p.created_at)}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* ── Template dropdown ── */}
                    {isSelected && card.key === 'templates' && (
                <div style={{ padding: '0 0 4px 14px', display: 'flex', flexDirection: 'column', gap: 10, animation: 'deptCardIn 0.2s ease both', minHeight: 0, flex: '1 1 auto' }}>
                  {/* Only this list scrolls — the New Template button below stays visible at the bottom of the panel */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto' }}>
                  {templates.length === 0 ? (
                    <div style={{ padding: '20px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 12 }}>
                      <ClipboardList size={20} style={{ color: '#CBD5E1', margin: '0 auto 6px', display: 'block' }} />
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No templates saved.</p>
                    </div>
                  ) : (
                    templates.map((t, idx) => (
                      <div key={t.id} style={{
                        display: 'flex', flexDirection: 'column', gap: 16,
                        border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 16px 18px', background: '#F9FAFB',
                        animation: `deptCardIn 0.28s ease both ${scopeToManagerDepartments ? 0 : idx * 55}ms`,
                      }}>
                        {/* Department + job type badge row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            {!scopeToManagerDepartments && <DepartmentBadge departmentId={t.department_id} departmentName={departments.find(d => d.id === t.department_id)?.name} />}
                            {t.job_type === 'shift'
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', whiteSpace: 'nowrap', flexShrink: 0 }}>Shift Job</span>
                              : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap', flexShrink: 0 }}>One-Off Job</span>
                            }
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => { resetForm(); applyTemplate(t); setFormOpen(true) }}
                            title="Use template"
                            style={{ border: 'none', background: 'transparent', color: '#16A34A', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: 6 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#DCFCE7' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          ><ArrowRight size={14} /></button>
                          <button
                            type="button"
                            onClick={() => void deleteTemplateById(t.id)}
                            disabled={templateActionLoading}
                            title="Delete template"
                            style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: templateActionLoading ? 'default' : 'pointer', display: 'flex', padding: 6, borderRadius: 6, opacity: templateActionLoading ? 0.5 : 1 }}
                          >{templateActionLoading ? <Spinner size={12} dark /> : <Trash2 size={14} />}</button>
                          </div>
                        </div>
                        {/* Title row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => openTemplateDetail(t)}
                            title="View template details"
                            style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: selectedTemplateId === t.id && postView === 'template' ? '#F97316' : '#0F172A', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#F97316' }}
                            onMouseLeave={e => { e.currentTarget.style.color = selectedTemplateId === t.id && postView === 'template' ? '#F97316' : '#0F172A' }}
                          >{t.title}</button>
                          <span style={{ fontSize: '0.75rem', color: '#9CA3AF', flexShrink: 0 }}>Updated {formatCompactAt(t.updated_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { resetNewTemplateForm(); setNewTemplateModalOpen(true) }}
                    style={{ alignSelf: 'center', marginTop: 2, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', height: 36, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Plus size={15} strokeWidth={2.5} /> New Template
                  </button>
                </div>
                    )}
                    </div>
                  )
                })}
              </div>
            </section>

            {postView === 'none' && (
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ padding: '40px 48px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, width: '100%' }}>
                  <Plus size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Select an option to get started</p>
                </div>
              </div>
            )}

            {/* Pending detail — Approve/Reject a Manager's submitted posting, opened from the Job Sources dropdown */}
            {postView === 'pending' && selectedPending != null && (
              // There's no Applicants panel here (nothing can have applied to an unapproved posting),
              // so the detail panel takes the full row width.
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
              <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header — same composition as the Active/Closed/Archived detail header (icon, "{title} Detail",
                    deadline countdown), plus the Approve/Reject actions this view needs. Who submitted it is
                    already shown on the card in the Job Sources list — this header instead surfaces the one
                    thing the card can't fit: how many positions the Manager is asking to fill. */}
                <div style={{ padding: '18px 24px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Briefcase size={15} style={{ color: '#F97316' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{selectedPending.title} Detail</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
                      <Users size={11} style={{ marginRight: 5, verticalAlign: -1 }} />{selectedPending.openings ?? 1} Position{(selectedPending.openings ?? 1) === 1 ? '' : 's'}
                    </span>
                    {(() => {
                      const cd = deadlineCountdown(selectedPending.expires_at)
                      if (!cd) return null
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: cd.expired ? '#FEF2F2' : '#FFFBEB', color: cd.expired ? '#B91C1C' : '#B45309', border: `1px solid ${cd.expired ? '#FECACA' : '#FDE68A'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          <Clock size={11} />{cd.label}
                        </span>
                      )
                    })()}
                    {selectedPending.status === 'rejected' && canManageApplicants(selectedPending) && (
                      <>
                        <button
                          type="button"
                          onClick={() => void openRejectedInWizard(selectedPending)}
                          style={{ height: 28, padding: '0 11px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Pencil size={12} /> Edit &amp; Resubmit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ id: selectedPending.id, title: selectedPending.title, isDraft: false })}
                          style={{ height: 28, padding: '0 11px', border: '1px solid #FECACA', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                  {/* Approve/Reject only make sense on a posting still awaiting a decision — an
                      already-rejected one needs the Manager to fix and resubmit first (see the
                      Rejected banner below), not a second decision from Owner/Partner. */}
                  {canApprovePostings && selectedPending.status === 'pending_approval' && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => decidePosting(selectedPending.id, 'approve_posting')} disabled={actionLoading}
                      style={{ height: 34, padding: '0 14px', border: 'none', borderRadius: 9, background: '#059669', color: '#FFFFFF', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, opacity: actionLoading ? 0.6 : 1 }}
                    ><CheckCircle size={13} /> Approve</button>
                    <button onClick={() => { setPendingRejectId(selectedPending.id); setRejectReason(''); setRejectModalOpen(true) }} disabled={actionLoading}
                      style={{ height: 34, padding: '0 14px', border: 'none', borderRadius: 9, background: '#DC2626', color: '#FFFFFF', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, opacity: actionLoading ? 0.6 : 1 }}
                    ><XCircle size={13} /> Reject</button>
                  </div>
                  )}
                </div>

                {/* Rejected banner — reason + who rejected it, plus Edit & Resubmit for the
                    Manager who submitted it (mirrors the same block on the Active Jobs detail). */}
                {selectedPending.status === 'rejected' && (
                  <div style={{ margin: '18px 20px 0', border: '1.5px solid #FECACA', background: '#FEF2F2', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: '#B91C1C' }}>
                      <XCircle size={14} /> Rejected{selectedPending.rejected_by_name ? ` by ${selectedPending.rejected_by_name}` : ''}
                    </div>
                    {selectedPending.rejection_reason && (
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#7F1D1D', lineHeight: 1.5 }}>{selectedPending.rejection_reason}</p>
                    )}
                  </div>
                )}

                {/* Body — identical to the Active/Closed/Archived job detail (every role fills out the same
                    posting fields, so a Manager's submission should read exactly like the Owner's own). */}
                {(() => {
                  const p = selectedPending
                  const isShiftJob = (p.job_type === 'shift')
                  const fmt12 = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(m).padStart(2, '0')} ${ap}` }
                  const payLabel = buildPayLabel(p)
                  const uniformLabel = p.uniform_type === 'dress_code' ? 'Specific Dress Code' : p.uniform_type === 'company' ? 'Company Uniform Provided' : null
                  const metaRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
                  const metaText: React.CSSProperties = { fontSize: '0.875rem', color: '#374151' }
                  const metaIcon: React.CSSProperties = { flexShrink: 0 }
                  return (
                    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                      {/* Job Board card look-alike */}
                      <div style={{ background: '#FFFFFF', border: '1.5px solid #EDE9E3', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {!isShiftJob && (p.urgency === 'high' || p.urgency === 'urgent') && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFF1F2', color: '#E11D48', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                              <Zap size={12} />{p.urgency === 'urgent' ? 'Urgent' : 'High'}
                            </span>
                          )}
                          {p.minimum_age && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF2FF', color: '#4F46E5', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                              <Cake size={12} />{p.minimum_age}+
                            </span>
                          )}
                          {p.experience_required && p.experience_required !== 'Not Required' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECFEFF', color: '#0891B2', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                              <UserCheck size={12} />{p.experience_required}
                            </span>
                          )}
                          {uniformLabel && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFFBEB', color: '#B45309', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                              <Shirt size={12} />{p.uniform_type === 'dress_code' ? 'Dress Code' : 'Uniform Provided'}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: 0 }}>{p.title}</p>
                          <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: 0 }}>{p.company_name ?? companyName ?? '—'}</p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(companyLocation || p.company_location) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#4B5563', background: '#F3F4F6', borderRadius: 999, padding: '4px 10px' }}>
                              <MapPin size={12} strokeWidth={2.5} />{companyLocation || p.company_location}
                            </span>
                          )}
                          {p.salary_amount != null && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#065F46', background: '#ECFDF5', borderRadius: 999, padding: '4px 10px' }}>
                              ${p.salary_amount}{isShiftJob ? '/hr' : ''}
                            </span>
                          )}
                          {!isShiftJob && p.estimated_hours && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 999, padding: '4px 10px' }}>
                              <Clock size={12} />{p.estimated_hours}h
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Job detail look-alike */}
                      <div style={{ border: '1.5px solid #EDE9E3', borderRadius: 16, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                          <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: '0 0 4px' }}>{p.title}</h2>
                          <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: '0 0 14px' }}>{p.company_name ?? companyName ?? '—'}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {p.department_name && (
                              <div style={metaRow}><LayoutGrid size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{p.department_name}</span></div>
                            )}
                            {p.minimum_age && (
                              <div style={metaRow}><Cake size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{p.minimum_age}+</span></div>
                            )}
                            {p.experience_required && p.experience_required !== 'Not Required' && (
                              <div style={metaRow}><UserCheck size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>Experience {p.experience_required}</span></div>
                            )}
                            {uniformLabel && (
                              <div style={metaRow}><Shirt size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{uniformLabel}</span></div>
                            )}
                            {!isShiftJob && p.estimated_hours && (
                              <div style={metaRow}><Clock size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>Est. {p.estimated_hours} hours</span></div>
                            )}
                            {payLabel && (
                              <div style={metaRow}><DollarSign size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>{payLabel}</span></div>
                            )}
                          </div>
                        </div>

                        {/* Schedule & posting facts — the full set of values entered when posting */}
                        <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                          <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Schedule</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {p.job_date && (
                              <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Date:</span> {new Date(p.job_date).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            )}
                            {isShiftJob && (p.job_start_time || p.job_end_time) && (
                              <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Working Hours:</span> {p.job_start_time ? fmt12(p.job_start_time) : '—'} – {p.job_end_time ? fmt12(p.job_end_time) : '—'}</p>
                            )}
                            {isShiftJob && (p.break_start_time || p.break_end_time) && (
                              <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Break Time:</span> {p.break_start_time ? fmt12(p.break_start_time) : '—'} – {p.break_end_time ? fmt12(p.break_end_time) : '—'}</p>
                            )}
                            {!isShiftJob && p.job_start_time && (
                              <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Start Time:</span> {fmt12(p.job_start_time)}</p>
                            )}
                            {p.assigned_employee_name && (
                              <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Supervisor:</span> {p.assigned_employee_name}</p>
                            )}
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                          <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Responsibilities</p>
                          <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{p.responsibilities || '—'}</p>
                        </div>
                        <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                          <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Skills &amp; Qualifications</p>
                          <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{p.skills || '—'}</p>
                        </div>
                        {uniformLabel && p.uniform_details && (
                          <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                            <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>{p.uniform_type === 'dress_code' ? 'Dress Code' : 'Uniform Details'}</p>
                            <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{p.uniform_details}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
              </div>
            )}

            {/* Archived detail — read-only view opened by clicking an archived job in the Job Sources dropdown */}
            {postView === 'archived' && selectedArchived != null && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
                {/* Job detail — read-only */}
                <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* 20px vertical padding (vs 17px elsewhere): keeps this divider level with the Job Sources header, whose 36px AI button makes it 6px taller */}
                  <div style={{ padding: '20px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Archive size={15} style={{ color: '#F97316' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{selectedArchived.title} Detail</span>
                    {/* Who published this posting — Owner, Partner, or a Manager whose posting the Owner approved */}
                    {selectedArchived.created_by_name && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>Posted by {selectedArchived.created_by_name}</span>
                    )}
                    {/* Application deadline countdown — lives next to the Posted-by badge, not buried in Schedule; sized to match it */}
                    {(() => {
                      const cd = deadlineCountdown(selectedArchived.expires_at)
                      if (!cd) return null
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: cd.expired ? '#FEF2F2' : '#FFFBEB', color: cd.expired ? '#B91C1C' : '#B45309', border: `1px solid ${cd.expired ? '#FECACA' : '#FDE68A'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          <Clock size={11} />{cd.label}
                        </span>
                      )
                    })()}
                  </div>
                      {/* Job details body — mirrors the Template Preview design, plus a Schedule section
                          for the posting-only facts a template never has (date, hours, break) */}
                      {(() => {
                        const p = selectedArchived
                        const isShiftJob = (p.job_type === 'shift')
                        const fmt12 = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(m).padStart(2, '0')} ${ap}` }
                        const payLabel = buildPayLabel(p, false)
                        const uniformLabel = p.uniform_type === 'dress_code' ? 'Specific Dress Code' : p.uniform_type === 'company' ? 'Company Uniform Provided' : null
                        const metaRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
                        const metaText: React.CSSProperties = { fontSize: '0.875rem', color: '#374151' }
                        const metaIcon: React.CSSProperties = { flexShrink: 0 }
                        return (
                          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Job Board card look-alike */}
                            <div style={{ background: '#FFFFFF', border: '1.5px solid #EDE9E3', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {!isShiftJob && (p.urgency === 'high' || p.urgency === 'urgent') && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFF1F2', color: '#E11D48', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                                    <Zap size={12} />{p.urgency === 'urgent' ? 'Urgent' : 'High'}
                                  </span>
                                )}
                                {p.minimum_age && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF2FF', color: '#4F46E5', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                                    <Cake size={12} />{p.minimum_age}+
                                  </span>
                                )}
                                {p.experience_required && p.experience_required !== 'Not Required' && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECFEFF', color: '#0891B2', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                                    <UserCheck size={12} />{p.experience_required}
                                  </span>
                                )}
                                {uniformLabel && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFFBEB', color: '#B45309', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                                    <Shirt size={12} />{p.uniform_type === 'dress_code' ? 'Dress Code' : 'Uniform Provided'}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: 0 }}>{p.title}</p>
                                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: 0 }}>{p.company_name ?? companyName ?? '—'}</p>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {/* Location always comes from the company profile — same source and format as the Template preview */}
                                {(companyLocation || p.company_location) && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#4B5563', background: '#F3F4F6', borderRadius: 999, padding: '4px 10px' }}>
                                    <MapPin size={12} strokeWidth={2.5} />{companyLocation || p.company_location}
                                  </span>
                                )}
                                {p.salary_amount != null && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#065F46', background: '#ECFDF5', borderRadius: 999, padding: '4px 10px' }}>
                                    ${p.salary_amount}{isShiftJob ? '/hr' : ''}
                                  </span>
                                )}
                                {!isShiftJob && p.estimated_hours && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 999, padding: '4px 10px' }}>
                                    <Clock size={12} />{p.estimated_hours}h
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Job detail look-alike */}
                            <div style={{ border: '1.5px solid #EDE9E3', borderRadius: 16, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                              <div>
                                <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: '0 0 4px' }}>{p.title}</h2>
                                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: '0 0 14px' }}>{p.company_name ?? companyName ?? '—'}</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {p.department_name && (
                                    <div style={metaRow}><LayoutGrid size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{p.department_name}</span></div>
                                  )}
                                  {p.minimum_age && (
                                    <div style={metaRow}><Cake size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{p.minimum_age}+</span></div>
                                  )}
                                  {p.experience_required && p.experience_required !== 'Not Required' && (
                                    <div style={metaRow}><UserCheck size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>Experience {p.experience_required}</span></div>
                                  )}
                                  {uniformLabel && (
                                    <div style={metaRow}><Shirt size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{uniformLabel}</span></div>
                                  )}
                                  {!isShiftJob && p.estimated_hours && (
                                    <div style={metaRow}><Clock size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>Est. {p.estimated_hours} hours</span></div>
                                  )}
                                  {payLabel && (
                                    <div style={metaRow}><DollarSign size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>{payLabel}</span></div>
                                  )}
                                </div>
                              </div>

                              {/* Schedule & posting facts — the full set of values entered when posting */}
                              <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                                <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Schedule</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {p.job_date && (
                                    <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Date:</span> {new Date(p.job_date).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                  )}
                                  {isShiftJob && (p.job_start_time || p.job_end_time) && (
                                    <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Working Hours:</span> {p.job_start_time ? fmt12(p.job_start_time) : '—'} – {p.job_end_time ? fmt12(p.job_end_time) : '—'}</p>
                                  )}
                                  {isShiftJob && (p.break_start_time || p.break_end_time) && (
                                    <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Break Time:</span> {p.break_start_time ? fmt12(p.break_start_time) : '—'} – {p.break_end_time ? fmt12(p.break_end_time) : '—'}</p>
                                  )}
                                  {!isShiftJob && p.job_start_time && (
                                    <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Start Time:</span> {fmt12(p.job_start_time)}</p>
                                  )}
                                  {p.assigned_employee_name && (
                                    <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }}><span style={{ fontWeight: 600, color: '#EA580C' }}>Supervisor:</span> {p.assigned_employee_name}</p>
                                  )}
                                </div>
                              </div>

                              <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                                <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Responsibilities</p>
                                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{p.responsibilities || '—'}</p>
                              </div>
                              <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                                <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Skills &amp; Qualifications</p>
                                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{p.skills || '—'}</p>
                              </div>
                              {uniformLabel && p.uniform_details && (
                                <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                                  <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>{p.uniform_type === 'dress_code' ? 'Dress Code' : 'Uniform Details'}</p>
                                  <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{p.uniform_details}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                </div>

                {/* Applicants — read-only */}
                <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* 20px vertical padding (vs 17px elsewhere): keeps this divider level with the Job Sources header, whose 36px AI button makes it 6px taller */}
                  <div style={{ padding: '20px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users size={15} style={{ color: '#F97316' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Applicants</span>
                    {/* Confirmed (both employer accepted + worker confirmed the invitation) vs openings — sits right next to the title */}
                    <span title="Confirmed workers / positions to fill" style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', flexShrink: 0 }}>
                      {archivedApplicants.filter(a => a.status === 'accepted' && a.invitation_status === 'accepted').length} / {selectedArchived.openings ?? 1}
                    </span>
                  </div>
                  <div style={{ padding: '18px 20px' }}>
                        {archivedApplicants.length === 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px dashed #E5E7EB' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                              <UserX size={22} style={{ color: '#D1D5DB' }} />
                            </div>
                            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#6B7280' }}>No applicants yet</p>
                          </div>
                        ) : (
                          <>
                            {/* Hints that an applicant's photo opens their full profile */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', marginBottom: 12, background: '#F8FAFC', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8 }}>
                              <MousePointerClick size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Click an applicant&apos;s photo to view their full details</span>
                            </div>
                            {archivedApplicants.map(applicant => (
                              <ApplicantCard
                                key={applicant.id}
                                applicant={applicant}
                                onOpenDetail={() => setApplicantDetail(applicant)}
                                actions={
                                  applicant.status === 'accepted' && applicant.invitation_status === 'accepted'
                                    ? <ApplicantPill tone={{ bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' }} icon={<UserCheck size={13} />} label="Confirmed" />
                                    : (applicantStatusPill(applicant) ?? <ApplicantPill tone={{ bg: '#F3F4F6', border: '#E5E7EB', text: '#6B7280' }} label="Pending" />)
                                }
                              />
                            ))}
                          </>
                        )}
                  </div>
                </div>
              </div>
            )}

            {postView === 'template' && (
              !selectedTemplate ? (
                <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 48px' }}>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Template not found</p>
                </div>
              ) : (
                <div className="template-edit-grid" style={{ position: 'relative', height: '100%', minHeight: 0, gridTemplateRows: 'minmax(0, 1fr)' }}>
                  {/* Flow arrows: Edit → Preview → Template Information — same horizontal line as the Template menu card */}
                  <div className="flow-arrow flow-arrow-mid">
                    <ArrowRight size={15} strokeWidth={2.5} />
                  </div>
                  <div className="flow-arrow flow-arrow-end">
                    <ArrowRight size={15} strokeWidth={2.5} />
                  </div>
                  {/* LEFT: Edit Template form */}
                  <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
                    {/* 20px vertical padding (vs 17px elsewhere): keeps this divider level with the Job Sources header, whose 36px AI button makes it 6px taller */}
                    <div style={{ padding: '20px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Pencil size={15} style={{ color: '#F97316' }} />
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Edit {tplTitle || 'Untitled Role'}</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                      {/* ── Section: Job Information (mirrors New Template wizard step 1) ── */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, borderTop: '1.5px dashed #FDBA74' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Job Information</span>
                        <div style={{ flex: 1, borderTop: '1.5px dashed #FDBA74' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <label style={modalLabelStyle}>Job Type</label>
                          <RDrop
                            value={tplJobType}
                            placeholder="Select job type"
                            options={[{ value: 'shift', label: 'Shift' }, { value: 'oneoff', label: 'One-Off' }]}
                            onChange={v => setTplJobType(v === 'shift' ? 'shift' : 'oneoff')}
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label style={modalLabelStyle}>Job Title</label>
                          <input
                            value={tplTitle}
                            onChange={e => setTplTitle(e.target.value)}
                            placeholder="e.g. Barista"
                            style={modalInputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={modalLabelStyle}>Responsibilities</label>
                        <textarea
                          value={tplResponsibilities}
                          onChange={e => setTplResponsibilities(e.target.value)}
                          onKeyDown={handleListKeyDown}
                          rows={3}
                          placeholder="e.g. Serve customers, prep orders"
                          style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                          onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                          onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                        />
                      </div>
                      <div>
                        <label style={modalLabelStyle}>Skills &amp; Qualifications</label>
                        <textarea
                          value={tplSkills}
                          onChange={e => setTplSkills(e.target.value)}
                          onKeyDown={handleListKeyDown}
                          rows={2}
                          placeholder="e.g. Valid driver's license, basic Excel skills"
                          style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                          onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                          onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                        />
                      </div>
                      {tplJobType === 'oneoff' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <label style={modalLabelStyle}>Est. Hours</label>
                            <HoursField value={tplEstimatedHours} onChange={setTplEstimatedHours} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <label style={modalLabelStyle}>Urgency</label>
                            <RDrop
                              value={tplUrgency}
                              options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]}
                              onChange={setTplUrgency}
                            />
                          </div>
                        </div>
                      )}

                      {/* ── Section: Requirements & Payment (mirrors New Template wizard step 2) ── */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        <div style={{ flex: 1, borderTop: '1.5px dashed #FDBA74' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Requirements &amp; Payment</span>
                        <div style={{ flex: 1, borderTop: '1.5px dashed #FDBA74' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <label style={modalLabelStyle}>Uniform</label>
                        <RDrop
                          value={tplUniformType}
                          placeholder="Select uniform requirement"
                          options={UNIFORM_TYPE_OPTIONS}
                          onChange={v => setTplUniformType(v as UniformType)}
                        />
                      </div>
                      {tplUniformType === 'dress_code' && (
                        <div style={{ minWidth: 0 }}>
                          <label style={modalLabelStyle}>Dress Code</label>
                          <textarea
                            value={tplUniformDetails}
                            onChange={e => setTplUniformDetails(e.target.value)}
                            rows={2}
                            placeholder="e.g. Black shirt, black pants, black shoes"
                            style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                            onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                          />
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <label style={modalLabelStyle}>Experience Required</label>
                          <RDrop value={tplExperienceRequired} placeholder="Select preferences" options={EXPERIENCE_REQUIRED_OPTIONS} onChange={setTplExperienceRequired} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label style={modalLabelStyle}>Minimum Age</label>
                          <RDrop value={tplMinimumAge} placeholder="Select minimum age" options={MINIMUM_AGE_OPTIONS} onChange={setTplMinimumAge} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <label style={modalLabelStyle}>Department</label>
                          {/* Manager only ever has one department — locked to it, not a real choice
                              (same treatment as the job posting wizard's Department field). */}
                          <RDrop value={tplDepartmentId} placeholder="Select department"
                            options={(scopeToManagerDepartments ? departments.filter(d => managerDeptIds.includes(d.id)) : departments).map(d => ({ value: d.id, label: d.name }))}
                            onChange={setTplDepartmentId} disabled={scopeToManagerDepartments} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label style={modalLabelStyle}>{tplJobType === 'shift' ? 'Hourly Rate' : 'Flat Rate'}</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '0.9375rem', pointerEvents: 'none' }}>$</span>
                            <input type="number" min={0} step={0.5} onKeyDown={blockNonNumericKeys} value={tplSalaryAmt} onChange={e => setTplSalaryAmt(e.target.value)} placeholder="0.00" style={{ ...modalInputStyle, paddingLeft: 26 }} />
                          </div>
                        </div>
                      </div>

                      {tplError && <div style={modalErrorBoxStyle}>{tplError}</div>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid #F0F4F8', flexShrink: 0 }}>
                      <button type="button" onClick={() => { setPostView('none'); setSelectedTemplateId('') }} style={modalGhostButtonStyle}>Cancel</button>
                      <button
                        type="button"
                        onClick={() => void saveTemplateEdits()}
                        disabled={templateActionLoading || !tplTitle.trim() || !tplJobType}
                        style={modalPrimaryButtonStyle(templateActionLoading || !tplTitle.trim() || !tplJobType)}
                      >
                        {templateActionLoading ? <Spinner size={13} /> : <Check size={13} />} Save Changes
                      </button>
                    </div>
                  </div>

                  {/* RIGHT: live preview */}
                  <div className="recruitment-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
                    <div style={{ padding: '20px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Eye size={15} style={{ color: '#F97316' }} />
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Preview</span>
                    </div>
                    <div style={{ padding: '18px 20px', flex: 1, minHeight: 0, overflowY: 'auto' }}>

                      {/* Job Board card look-alike */}
                      <div style={{ background: '#FFFFFF', border: '1.5px solid #EDE9E3', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {tplJobType === 'oneoff' && (tplUrgency === 'high' || tplUrgency === 'urgent') && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFF1F2', color: '#E11D48', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                              <Zap size={12} />{tplUrgency === 'urgent' ? 'Urgent' : 'High'}
                            </span>
                          )}
                          {tplMinimumAge && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF2FF', color: '#4F46E5', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                              <Cake size={12} />{tplMinimumAge}+
                            </span>
                          )}
                          {tplExperienceRequired && tplExperienceRequired !== 'Not Required' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECFEFF', color: '#0891B2', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                              <UserCheck size={12} />{tplExperienceRequired}
                            </span>
                          )}
                          {(tplUniformType === 'company' || tplUniformType === 'dress_code') && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFFBEB', color: '#B45309', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                              <Shirt size={12} />{tplUniformType === 'company' ? 'Uniform Provided' : 'Dress Code'}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: 0 }}>{tplTitle || 'Untitled Role'}</p>
                          <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: 0 }}>{companyName || '—'}</p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {companyLocation && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#4B5563', background: '#F3F4F6', borderRadius: 999, padding: '4px 10px' }}>
                              <MapPin size={12} strokeWidth={2.5} />
                              {companyLocation}
                            </span>
                          )}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#065F46', background: '#ECFDF5', borderRadius: 999, padding: '4px 10px' }}>
                            ${tplSalaryAmt || '0'}{tplJobType === 'shift' ? '/hr' : ''}
                          </span>
                          {tplJobType === 'oneoff' && tplEstimatedHours && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 999, padding: '4px 10px' }}>
                              <Clock size={12} />{tplEstimatedHours}h
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Job detail panel look-alike */}
                      <div style={{ border: '1.5px solid #EDE9E3', borderRadius: 16, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                          <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: '0 0 4px' }}>{tplTitle || 'Untitled Role'}</h2>
                          <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: '0 0 14px' }}>{companyName || '—'}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {departments.find(d => d.id === tplDepartmentId)?.name && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <LayoutGrid size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.875rem', color: '#374151' }}>{departments.find(d => d.id === tplDepartmentId)?.name}</span>
                              </div>
                            )}
                            {tplMinimumAge && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Cake size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.875rem', color: '#374151' }}>{tplMinimumAge}</span>
                              </div>
                            )}
                            {tplExperienceRequired && tplExperienceRequired !== 'Not Required' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <UserCheck size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.875rem', color: '#374151' }}>Experience {tplExperienceRequired}</span>
                              </div>
                            )}
                            {(tplUniformType === 'company' || tplUniformType === 'dress_code') && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Shirt size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.875rem', color: '#374151' }}>{tplUniformType === 'company' ? 'Company Uniform Provided' : 'Specific Dress Code'}</span>
                              </div>
                            )}
                            {tplJobType === 'oneoff' && tplEstimatedHours && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Clock size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.875rem', color: '#374151' }}>Est. {tplEstimatedHours} hours</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <DollarSign size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>${tplSalaryAmt || '0'}{tplJobType === 'shift' ? '/hr' : ' flat rate'}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                          <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Responsibilities</p>
                          <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{tplResponsibilities || '—'}</p>
                        </div>

                        <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                          <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Skills &amp; Qualifications</p>
                          <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{tplSkills || '—'}</p>
                        </div>

                        {tplUniformType === 'dress_code' && (
                          <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                            <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Dress Code</p>
                            <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{tplUniformDetails || '—'}</p>
                          </div>
                        )}

                      </div>

                    </div>
                  </div>

                  {/* RIGHT: template information */}
                  <div className="recruitment-panel template-info-panel" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
                    <div style={{ padding: '20px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={15} style={{ color: '#F97316' }} />
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Template Information</span>
                    </div>
                    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Key facts — 2 cards on top, 3 below */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', background: '#FFFFFF', minWidth: 0 }}>
                          <p style={{ ...modalLabelStyle, margin: '0 0 6px' }}>Department</p>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{departments.find(d => d.id === tplDepartmentId)?.name ?? '—'}</p>
                        </div>
                        <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', background: '#FFFFFF', minWidth: 0 }}>
                          <p style={{ ...modalLabelStyle, margin: '0 0 6px' }}>{tplJobType === 'shift' ? 'Hourly Rate' : 'Flat Rate'}</p>
                          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>${tplSalaryAmt || '0'}{tplJobType === 'shift' ? '/hr' : ''}</p>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', background: '#FFFFFF', minWidth: 0 }}>
                          <p style={{ ...modalLabelStyle, margin: '0 0 6px' }}>Created</p>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'nowrap' }}>{formatCompactAt(selectedTemplate.created_at)}</p>
                        </div>
                        <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', background: '#FFFFFF', minWidth: 0 }}>
                          <p style={{ ...modalLabelStyle, margin: '0 0 6px' }}>Updated</p>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'nowrap' }}>{formatCompactAt(selectedTemplate.updated_at)}</p>
                        </div>
                        <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', background: '#FFFFFF', minWidth: 0 }}>
                          <p style={{ ...modalLabelStyle, margin: '0 0 6px' }}>Posted</p>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'nowrap' }}>{tplUsage ? `${tplUsage.published_jobs} ${tplUsage.published_jobs === 1 ? 'time' : 'times'}` : '—'}</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        <div style={{ flex: 1, borderTop: '1.5px dashed #FDBA74' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Completed When Posting</span>
                        <div style={{ flex: 1, borderTop: '1.5px dashed #FDBA74' }} />
                      </div>
                      {(() => {
                        // Mirrors the Post Job wizard: these fields are never stored on a template
                        // (schedule/deadline are set fresh per posting), plus any template field
                        // still left blank — rendered as greyed-out fields so the Owner sees at a
                        // glance what posting will still ask for.
                        const toFill: { label: string; hint: string }[] = []
                        if (!tplDepartmentId) toFill.push({ label: 'Department', hint: 'Select department' })
                        if (!tplSalaryAmt || Number(tplSalaryAmt) <= 0) toFill.push({ label: tplJobType === 'shift' ? 'Hourly Rate' : 'Flat Rate', hint: '$ 0.00' })
                        if (tplUniformType === 'dress_code' && !tplUniformDetails.trim()) toFill.push({ label: 'Dress Code', hint: 'e.g. Black shirt, black pants, black shoes' })
                        if (tplJobType === 'oneoff' && !tplEstimatedHours) toFill.push({ label: 'Est. Hours', hint: 'e.g. 5' })
                        if (tplJobType === 'shift') {
                          toFill.push(
                            { label: 'Available Shift', hint: 'Select shift' },
                            { label: 'Supervisor', hint: 'Select supervisor' },
                            { label: 'Start & End Time', hint: 'Set start & end time' },
                            { label: 'Break Time', hint: 'Set break time' },
                            { label: 'Number of Positions', hint: 'e.g. 1' },
                            { label: 'Application Deadline', hint: 'Set deadline' },
                          )
                        } else {
                          toFill.push(
                            { label: 'Available Shift', hint: 'Select shift' },
                            { label: 'Supervisor', hint: 'Select supervisor' },
                            { label: 'Start Time', hint: 'Set start time' },
                            { label: 'Number of Positions', hint: 'e.g. 1' },
                            { label: 'Application Deadline', hint: 'Set deadline' },
                          )
                        }
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {toFill.map(item => (
                              <div key={item.label} style={{ minWidth: 0 }}>
                                <label style={modalLabelStyle}>{item.label}</label>
                                <div style={{ ...modalInputStyle, background: '#F3F4F6', color: '#9CA3AF', cursor: 'not-allowed', userSelect: 'none' }}>{item.hint}</div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid #F0F4F8' }}>
                      <button
                        type="button"
                        onClick={() => { resetForm(); applyTemplate(selectedTemplate); setFormOpen(true) }}
                        style={modalPrimaryButtonStyle(false)}
                      >
                        <Send size={13} /> Apply Template
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}


            </div>
          )}


        </div>
        </div>
        </div>
      </main>

      {/* ══ Worker Pool modal — hand this job to people who already worked here ══ */}
      {poolModalOpen && (
        <ModalOverlay onClose={() => setPoolModalOpen(false)} maxWidth="560px">
          <ModalBox>
            <ModalHeader title="Invite from Worker Pool" icon={<UserCheck size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setPoolModalOpen(false)} />

            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
              {poolLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '32px 0', color: '#9CA3AF' }}>
                  <Spinner size={16} dark /> Loading pool…
                </div>
              ) : poolWorkers.length === 0 ? (
                <div style={{ padding: '32px 24px', textAlign: 'center', background: '#F8FAFC', borderRadius: 12, border: '1.5px dashed #E5E7EB' }}>
                  <Users size={22} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#6B7280' }}>No workers in the pool yet</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#9CA3AF' }}>Workers join the pool once they complete their first shift here.</p>
                </div>
              ) : poolWorkers.map(worker => {
                const picked = poolSelected.has(worker.id)
                const result = poolResults.find(r => r.user_id === worker.id)
                return (
                  <div
                    key={worker.id}
                    onClick={() => setPoolSelected(prev => {
                      const next = new Set(prev)
                      if (next.has(worker.id)) next.delete(worker.id); else next.add(worker.id)
                      return next
                    })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                      border: `1.5px solid ${picked ? '#059669' : '#E5E7EB'}`,
                      background: picked ? '#ECFDF5' : '#FFFFFF',
                      transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { if (!picked) { e.currentTarget.style.borderColor = '#A7F3D0'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' } }}
                    onMouseLeave={e => { if (!picked) { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' } }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${picked ? '#059669' : '#D1D5DB'}`, background: picked ? '#059669' : '#FFFFFF' }}>
                      {picked && <Check size={12} color="#fff" strokeWidth={3} />}
                    </div>
                    <RoleAvatar role="Casual Worker" size={36} photoUrl={worker.profile_photo_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>{worker.full_name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {worker.skills || 'No skills listed'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                        {worker.completed_shifts}× worked
                      </span>
                      {result && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', fontWeight: 600, color: result.invited ? '#059669' : '#B91C1C', maxWidth: 190, whiteSpace: 'normal' }}>
                          {result.invited ? 'Offer sent' : result.reason}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
              {poolError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.8125rem', color: '#DC2626' }}>
                  {poolError}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #F3F4F6', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setPoolModalOpen(false)} style={modalGhostButtonStyle}>Close</button>
              <button
                onClick={invitePoolWorkers}
                disabled={poolInviting || poolSelected.size === 0}
                style={{ ...modalPrimaryButtonStyle(poolInviting || poolSelected.size === 0), background: 'linear-gradient(135deg, #059669, #047857)' }}
              >
                {poolInviting ? <Spinner size={13} /> : <Send size={13} strokeWidth={2.5} />}
                {poolSelected.size > 0 ? ` Send ${poolSelected.size} Offer${poolSelected.size > 1 ? 's' : ''}` : ' Send Offers'}
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Success toast ── */}
      <Toast message={successToast ?? ''} />

      {/* ══ Applicant profile modal (opened from a card's avatar) ══════════════ */}
      {applicantDetail && createPortal(
        <ApplicantDetailModal applicant={applicantDetail} onClose={() => setApplicantDetail(null)} />,
        document.body,
      )}

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
                Please provide feedback for the manager.
              </p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Please enter your reason."
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


      {/* ══ Remove Worker modal — employer cancels ONE confirmed worker; job keeps hiring ══ */}
      {removeWorkerTarget && createPortal(
        <ModalOverlay onClose={() => { setRemoveWorkerTarget(null); setCancelReason('') }} maxWidth="420px">
          <ModalBox>
            <ModalHeader
              title="Remove Confirmed Worker"
              icon={<UserX size={15} color="#fff" strokeWidth={2.5} />}
              iconBg="linear-gradient(135deg, #EF4444, #DC2626)"
              onClose={() => { setRemoveWorkerTarget(null); setCancelReason('') }}
            />
            <div style={{ padding: '20px 24px 0' }}>
              <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Removal reason</p>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Explain why you're removing this worker."
                rows={3}
                style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
              />
            </div>
            {cancelSubmitError && <div style={modalErrorBoxStyle}>{cancelSubmitError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '20px 24px' }}>
              <button onClick={() => { setRemoveWorkerTarget(null); setCancelReason('') }} style={modalGhostButtonStyle}>
                Cancel
              </button>
              <button onClick={submitRemoveWorker} disabled={actionLoading || !cancelReason.trim()} style={modalDestructiveButtonStyle(actionLoading || !cancelReason.trim())}>
                {actionLoading ? <Spinner size={13} /> : <UserX size={13} />} Remove
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>,
        document.body
      )}

      {/* ══ New Template modal (create from scratch, UC36) ════════════════════ */}
      {newTemplateModalOpen && createPortal(
        <ModalOverlay onClose={() => { setNewTemplateModalOpen(false); resetNewTemplateForm() }} maxWidth="440px">
          <ModalBox>
            <ModalHeader
              title="New Template"
              icon={<ClipboardList size={15} color="#fff" strokeWidth={2.5} />}
              iconBg="linear-gradient(135deg, #F97316, #EA580C)"
              onClose={() => { setNewTemplateModalOpen(false); resetNewTemplateForm() }}
            />
            <div style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Step progress — same pattern as the Post Job wizard: completed step becomes a clickable back-circle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 22 }}>
                {([1, 2] as const).map(s => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {ntplStep > s ? (
                      <button type="button" onClick={() => setNtplStep(1)} title="Back" aria-label="Back to Job Information"
                        style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', background: '#FFF7ED', color: '#F97316', padding: 0, cursor: 'pointer' }}>
                        <ChevronLeft size={14} strokeWidth={2.75} />
                      </button>
                    ) : (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: ntplStep === s ? '#F97316' : '#F3F4F6', color: ntplStep === s ? '#FFF' : '#9CA3AF', flexShrink: 0 }}>
                        {s}
                      </div>
                    )}
                    {ntplStep === s && (
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#111827' }}>
                        {s === 1 ? 'Job Information' : 'Requirements & Payment'}
                      </span>
                    )}
                    {s < 2 && <div style={{ width: 16, height: 1.5, background: '#E5E7EB', margin: '0 1px' }} />}
                  </div>
                ))}
              </div>

              {/* ── Step 1: Job Information ── */}
              {ntplStep === 1 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <label style={modalLabelStyle}>Job Type</label>
                      <RDrop
                        autoFocus
                        value={ntplJobType}
                        placeholder="Select job type"
                        options={[{ value: 'shift', label: 'Shift' }, { value: 'oneoff', label: 'One-Off' }]}
                        onChange={v => setNtplJobType(v === 'shift' ? 'shift' : 'oneoff')}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label style={modalLabelStyle}>Job Title</label>
                      <input
                        value={ntplTitle}
                        onChange={e => setNtplTitle(e.target.value)}
                        placeholder="e.g. Barista"
                        style={modalInputStyle}
                        onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Responsibilities</label>
                    <textarea
                      value={ntplResponsibilities}
                      onChange={e => setNtplResponsibilities(e.target.value)}
                      onKeyDown={handleListKeyDown}
                      rows={3}
                      placeholder="e.g. Serve customers, prep orders"
                      style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                    />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Skills &amp; Qualifications</label>
                    <textarea
                      value={ntplSkills}
                      onChange={e => setNtplSkills(e.target.value)}
                      onKeyDown={handleListKeyDown}
                      rows={2}
                      placeholder="e.g. Valid driver's license, basic Excel skills"
                      style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                    />
                  </div>
                  {ntplJobType === 'oneoff' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <label style={modalLabelStyle}>Est. Hours</label>
                        <HoursField value={ntplEstimatedHours} onChange={setNtplEstimatedHours} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <label style={modalLabelStyle}>Urgency</label>
                        <RDrop
                          value={ntplUrgency}
                          options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]}
                          onChange={setNtplUrgency}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Step 2: Requirements & Payment ── */}
              {ntplStep === 2 && (
                <>
                  <div style={{ minWidth: 0 }}>
                    <label style={modalLabelStyle}>Uniform</label>
                    <RDrop
                      value={ntplUniformType}
                      placeholder="Select uniform requirement"
                      options={UNIFORM_TYPE_OPTIONS}
                      onChange={v => setNtplUniformType(v as UniformType)}
                    />
                  </div>
                  {ntplUniformType === 'dress_code' && (
                    <div style={{ minWidth: 0 }}>
                      <label style={modalLabelStyle}>Dress Code</label>
                      <textarea
                        value={ntplUniformDetails}
                        onChange={e => setNtplUniformDetails(e.target.value)}
                        rows={2}
                        placeholder="e.g. Black shirt, black pants, black shoes"
                        style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#F97316' }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <label style={modalLabelStyle}>Experience Required</label>
                      <RDrop
                        value={ntplExperienceRequired}
                        placeholder="Select preferences"
                        options={EXPERIENCE_REQUIRED_OPTIONS}
                        onChange={setNtplExperienceRequired}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label style={modalLabelStyle}>Minimum Age</label>
                      <RDrop
                        value={ntplMinimumAge}
                        placeholder="Select minimum age"
                        options={MINIMUM_AGE_OPTIONS}
                        onChange={setNtplMinimumAge}
                      />
                    </div>
                  </div>
                  <div style={{ borderTop: '1px dashed #E5E7EB' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <label style={modalLabelStyle}>Department</label>
                      {/* Manager only ever has one department — locked to it, not a real choice
                          (same treatment as the job posting wizard's Department field). */}
                      <RDrop
                        value={ntplDepartmentId}
                        placeholder="Select department"
                        options={(scopeToManagerDepartments ? departments.filter(d => managerDeptIds.includes(d.id)) : departments).map(d => ({ value: d.id, label: d.name }))}
                        onChange={setNtplDepartmentId}
                        disabled={scopeToManagerDepartments}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label style={modalLabelStyle}>{ntplJobType === 'shift' ? 'Hourly Rate' : 'Flat Rate'}</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '0.9375rem', pointerEvents: 'none' }}>$</span>
                        <input type="number" min={0} step={0.5} onKeyDown={blockNonNumericKeys} value={ntplSalaryAmt} onChange={e => setNtplSalaryAmt(e.target.value)} placeholder="0.00" style={{ ...modalInputStyle, paddingLeft: 26 }} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            {ntplError && <div style={modalErrorBoxStyle}>{ntplError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '20px 24px' }}>
              {ntplStep === 1 ? (
                (() => {
                  const step1Incomplete = !ntplJobType || !ntplTitle.trim() || !ntplResponsibilities.trim() || !ntplSkills.trim() || (ntplJobType === 'oneoff' && !ntplEstimatedHours)
                  return (
                    <button
                      onClick={() => { setNtplError(''); setNtplStep(2) }}
                      disabled={step1Incomplete}
                      style={modalPrimaryButtonStyle(step1Incomplete)}
                    >
                      Next <ChevronRight size={13} />
                    </button>
                  )
                })()
              ) : (
                (() => {
                  const step2Incomplete = templateActionLoading || !ntplUniformType
                    || (ntplUniformType === 'dress_code' && !ntplUniformDetails.trim())
                    || !ntplExperienceRequired || !ntplMinimumAge
                    || !ntplDepartmentId || !ntplSalaryAmt || Number(ntplSalaryAmt) <= 0
                  return (
                    <button onClick={createTemplateFromScratch} disabled={step2Incomplete} style={modalPrimaryButtonStyle(step2Incomplete)}>
                      {templateActionLoading ? <Spinner size={13} /> : <Plus size={13} />} Create Template
                    </button>
                  )
                })()
              )}
            </div>
          </ModalBox>
        </ModalOverlay>,
        document.body
      )}

      {/* ══ Post Job / Edit modal — 3-step wizard ═════════════════════════════ */}
      {formOpen && (() => {
        const WIZARD_STEPS = ['type', 'ai', 'form'] as const
        const displayStep = wizardStep
        const stepIdx = WIZARD_STEPS.indexOf(displayStep)
        // Applying a template jumps straight to the details form and isn't an AI action —
        // it gets the same plain orange treatment as editing, with no step wizard at all.
        // A draft reopened from the Drafts list (draftId) stays in the full AI wizard even when it
        // was originally created from a template — it's a half-finished job, not a template apply.
        const isTemplateMode = !editingId && !draftId && !!formTemplateId
        const modalTitle = editingId
          ? (editingDraft ? 'Edit Draft' : editingRejected ? 'Edit & Resubmit Job Posting' : 'Edit Job Posting')
          : isTemplateMode ? 'Apply Template'
          : wizardStep === 'type' ? 'Choose Job Type'
          : 'Complete Job Description'

        // AI Post Job reuses this same wizard — give the create flow the same purple AI
        // treatment as the Auto Shift Scheduling modal; editing an existing posting or
        // applying a template keeps the plain orange look since neither is the AI action.
        const accent = (editingId || isTemplateMode) ? '#F97316' : '#7C3AED'
        const accentDark = (editingId || isTemplateMode) ? '#EA580C' : '#6D28D9'
        const accentGradient = `linear-gradient(135deg, ${accent}, ${accentDark})`
        const accentTint = (editingId || isTemplateMode) ? '#FFF7ED' : '#F5F3FF'
        const accentTintBorder = (editingId || isTemplateMode) ? '#FED7AA' : '#DDD6FE'
        const accentTextDark = (editingId || isTemplateMode) ? '#C2410C' : '#6D28D9'
        const accentDisabledBg = (editingId || isTemplateMode) ? '#FDA060' : '#EDE9FE'
        const accentDisabledText = (editingId || isTemplateMode) ? '#FFFFFF' : '#A78BFA'

        // The chosen supervisor's own shift on the selected date bounds the worker's times:
        // start no earlier, end no later. Feeds the time pickers' min/max so out-of-window
        // slots can't even be picked (the service enforces the same rule server-side).
        const supEmp = shiftDeptEmployees.find(e => e.id === formAssignedEmployeeId) as unknown as { shifts?: { shift_date: string; start_time: string; end_time: string }[] } | undefined
        const supShift = supEmp?.shifts?.find(s => s.shift_date === formJobDate)
        const supWindowStart = supShift ? supShift.start_time.slice(0, 5) : undefined
        const supWindowEnd = supShift ? supShift.end_time.slice(0, 5) : undefined

        const handleAIGenerate = async () => {
          if (!aiPrompt.trim()) return
          setAiLoading(true); setFormError('')
          try {
            const res = await fetch('/api/ai/job-description', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: aiPrompt, job_type: formJobType, company_name: companyName }),
            })
            const data = await res.json()
            if (data.success && data.draft) {
              const draft = data.draft
              // Responsibilities feed the Responsibilities field; Skills & Qualifications only take requirements
              setAiPreview({
                title: draft.title || aiPrompt,
                responsibilities: [draft.description || '', ...(draft.responsibilities ?? []).map((i: string) => `• ${i}`)].filter(Boolean).join('\n'),
                skills: (draft.requirements ?? []).join('\n'),
              })
            } else {
              setFormError(data.message || 'Failed to generate job description')
            }
          } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to generate job description')
          }
          finally { setAiLoading(false) }
        }

        const handleUseAIDraft = () => {
          if (!aiPreview) return
          setFormTitle(aiPreview.title)
          setFormResponsibilities(aiPreview.responsibilities)
          setFormSkills(aiPreview.skills)
          setAiPreview(null)
          setCreateStep(3)
          setWizardStep('form')
        }

        const iStyle: React.CSSProperties = modalInputStyle
        const lStyle: React.CSSProperties = modalLabelStyle

        // Apply Template: Post stays disabled until every field is filled — mirrors saveForm's publish validation
        const applyReady = !!(formTitle.trim() && formResponsibilities.trim() && formSkills.trim()
          && formExperienceRequired && formMinimumAge
          && (formUniformType !== 'dress_code' || formUniformDetails.trim())
          && formDeptId && formSalaryAmt && Number(formSalaryAmt) > 0
          && formJobDate && formAssignedEmployeeId
          && (formJobType !== 'shift' || (formJobStart && formJobEnd && formBreakStart && formBreakEnd))
          && (formJobType !== 'oneoff' || (formEstHours && formJobStartTime))
          && Number(formOpenings) >= 1
          && formDeadlineChoice && (formDeadlineChoice !== 'date' || (formExpiresAt && formDeadlineTime)))
        // Applies to both the Apply Template wizard and the AI Create Job wizard (editing is exempt)
        const postDisabled = actionLoading || (!editingId && !applyReady)
        // Save as Template appears in the create wizard once every field a template stores is filled
        // (department + pay live on the last step, so it only ever lights up there)
        const templateReady = !!(formTitle.trim() && formResponsibilities.trim() && formSkills.trim()
          && (formUniformType !== 'dress_code' || formUniformDetails.trim())
          && formExperienceRequired && formMinimumAge && formDeptId
          && formSalaryAmt && Number(formSalaryAmt) > 0
          && (formJobType !== 'oneoff' || formEstHours))
        const templateAlreadySaved = templateReady && !!savedTplSnapshot && savedTplSnapshot === JSON.stringify(buildTemplateBody())
        const sectionLabel: React.CSSProperties = { margin: '4px 0 0', color: '#374151', fontSize: '0.875rem', fontWeight: 600 }
        const divider: React.CSSProperties = { borderTop: '1px dashed #E5E7EB', margin: '0' }

        return createPortal(
          <ModalOverlay onClose={() => { setFormOpen(false); resetForm() }} maxWidth={isTemplateMode ? '440px' : '500px'}>
            <ModalBox>

              {/* Header */}
              <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {!editingId && (
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: accentGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isTemplateMode
                        ? <ClipboardList size={15} color="#FFFFFF" strokeWidth={2.5} />
                        : <Sparkles size={15} color="#FFFFFF" strokeWidth={2.5} />}
                    </div>
                  )}
                  <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                    {editingId || isTemplateMode
                      ? modalTitle
                      : wizardStep === 'type' ? 'Create Job'
                      : formJobType === 'shift' ? 'Create Shift Job' : 'Create One-Off Job'}
                  </h2>
                </div>
                <button onClick={() => { setFormOpen(false); resetForm() }} aria-label="Close" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: 6, borderRadius: 8, flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable body */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Step progress — same pattern as the Auto Shift Scheduling modal: completed steps become clickable back-circles */}
                {!editingId && !isTemplateMode && (() => {
                  // 4-step create flow: Job Type → AI Content Generator → Requirements → Schedule & Payment
                  const CREATE_STEPS = [
                    { key: 'type', label: 'Job Type' },
                    { key: 'ai', label: 'AI Content Generator' },
                    { key: 'req', label: 'Requirements' },
                    { key: 'post', label: 'Schedule & Payment' },
                  ] as const
                  const currentIdx = wizardStep === 'type' ? 0 : wizardStep === 'ai' ? 1 : createStep === 3 ? 2 : 3
                  const goTo = (i: number) => {
                    setFormError('')
                    if (i === 0) { setAiPreview(null); setAiPrompt(''); setWizardStep('type') }
                    else if (i === 1) { setWizardStep('ai') }
                    else { setCreateStep(3); setWizardStep('form') }
                  }
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 22 }}>
                      {CREATE_STEPS.map((s, i) => (
                        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {currentIdx > i ? (
                            <button type="button" onClick={() => goTo(i)} title="Back" aria-label={`Back to ${s.label}`}
                              style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', background: accentTint, color: accent, padding: 0, cursor: 'pointer' }}>
                              <ChevronLeft size={14} strokeWidth={2.75} />
                            </button>
                          ) : (
                            <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: currentIdx === i ? accent : '#F3F4F6', color: currentIdx === i ? '#FFF' : '#9CA3AF', flexShrink: 0 }}>
                              {i + 1}
                            </div>
                          )}
                          {currentIdx === i && (
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#111827' }}>{s.label}</span>
                          )}
                          {i < 3 && <div style={{ width: 16, height: 1.5, background: '#E5E7EB', margin: '0 1px' }} />}
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* ── Step 1: Job Type ── */}
                {wizardStep === 'type' && (
                  <>
                    <button onClick={() => { setFormJobType('shift'); setFormSalaryType('per hour'); setWizardStep('ai') }}
                      style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 12, background: '#FFFFFF', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = accent }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: accentTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Repeat size={17} color={accent} />
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: '0 0 2px' }}>Shift Job</p>
                          <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>Fixed schedule with a defined start and end time.</p>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => { setFormJobType('oneoff'); setFormSalaryType('flat rate'); setWizardStep('ai') }}
                      style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 12, background: '#FFFFFF', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = accent }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: accentTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Zap size={17} color={accent} />
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: '0 0 2px' }}>One-Off Job</p>
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
                        <div>
                          <label style={lStyle}>Job Title</label>
                          <input value={aiPreview.title} onChange={e => setAiPreview(p => p && ({ ...p, title: e.target.value }))} style={iStyle} />
                        </div>
                        <div>
                          <label style={lStyle}>Responsibilities</label>
                          <textarea value={aiPreview.responsibilities} onChange={e => setAiPreview(p => p && ({ ...p, responsibilities: e.target.value }))} onKeyDown={handleListKeyDown}
                            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 3}px` } }}
                            rows={3} style={{ ...iStyle, resize: 'none', overflow: 'hidden', lineHeight: 1.6, verticalAlign: 'top' }} />
                        </div>
                        <div>
                          <label style={lStyle}>Skills &amp; Qualifications</label>
                          <textarea value={aiPreview.skills} onChange={e => setAiPreview(p => p && ({ ...p, skills: e.target.value }))} onKeyDown={handleListKeyDown}
                            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 3}px` } }}
                            rows={3} style={{ ...iStyle, resize: 'none', overflow: 'hidden', lineHeight: 1.6, verticalAlign: 'top' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <button onClick={handleAIGenerate} disabled={aiLoading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF', color: '#6B7280', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading ? 0.6 : 1 }}>
                            {aiLoading ? <><Spinner size={13} /> Regenerating…</> : 'Regenerate'}
                          </button>
                          <button onClick={handleUseAIDraft} disabled={aiLoading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: accent, color: '#FFFFFF', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading ? 0.6 : 1 }}>
                            Continue
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label style={lStyle}>Describe Your Job</label>
                          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                            rows={3} style={{ ...iStyle, resize: 'vertical', lineHeight: 1.55, verticalAlign: 'top' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          {/* Hidden for now: manual fill becomes the Free-tier path once plan gating lands; keep the logic wired */}
                          {false && (
                            <button onClick={() => { setAiPreview(null); setWizardStep('form') }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF', color: '#111827', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                              Fill Manually
                            </button>
                          )}
                          <button onClick={handleAIGenerate} disabled={!aiPrompt.trim() || aiLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: !aiPrompt.trim() || aiLoading ? accentDisabledBg : accent, color: !aiPrompt.trim() || aiLoading ? accentDisabledText : '#FFFFFF', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: !aiPrompt.trim() || aiLoading ? 'default' : 'pointer' }}>
                            {aiLoading ? <><Spinner size={13} /> Generating…</> : 'Generate'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ── Apply Template: 3-step wizard (steps 1–2 mirror New Template, step 3 = posting details) ── */}
                {wizardStep === 'form' && isTemplateMode && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Step progress — completed steps become clickable back-circles */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 22 }}>
                      {([1, 2, 3] as const).map(s => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {applyStep > s ? (
                            <button type="button" onClick={() => { setFormError(''); setApplyStep(s) }} title="Back" aria-label={`Back to step ${s}`}
                              style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', background: accentTint, color: accent, padding: 0, cursor: 'pointer' }}>
                              <ChevronLeft size={14} strokeWidth={2.75} />
                            </button>
                          ) : (
                            <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: applyStep === s ? accent : '#F3F4F6', color: applyStep === s ? '#FFF' : '#9CA3AF', flexShrink: 0 }}>
                              {s}
                            </div>
                          )}
                          {applyStep === s && (
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#111827' }}>
                              {s === 1 ? 'Job Information' : s === 2 ? 'Requirements' : 'Schedule & Payment'}
                            </span>
                          )}
                          {s < 3 && <div style={{ width: 16, height: 1.5, background: '#E5E7EB', margin: '0 1px' }} />}
                        </div>
                      ))}
                    </div>

                    {/* ── Step 1: Job Information ── */}
                    {applyStep === 1 && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Job Type</label>
                            <RDrop
                              disabled
                              value={formJobType}
                              options={[{ value: 'shift', label: 'Shift' }, { value: 'oneoff', label: 'One-Off' }]}
                              onChange={() => {}}
                            />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Job Title</label>
                            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Barista" style={iStyle} />
                          </div>
                        </div>
                        <div>
                          <label style={lStyle}>Responsibilities</label>
                          <textarea value={formResponsibilities} onChange={e => setFormResponsibilities(e.target.value)} onKeyDown={handleListKeyDown} rows={3} style={{ ...iStyle, resize: 'vertical', lineHeight: 1.55, verticalAlign: 'top' }} placeholder="e.g. Serve customers, prep orders" />
                        </div>
                        <div>
                          <label style={lStyle}>Skills &amp; Qualifications</label>
                          <textarea value={formSkills} onChange={e => setFormSkills(e.target.value)} onKeyDown={handleListKeyDown} rows={2} style={{ ...iStyle, resize: 'vertical', lineHeight: 1.55, verticalAlign: 'top' }} placeholder="e.g. Valid driver's license, basic Excel skills" />
                        </div>
                        {formJobType === 'oneoff' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <label style={lStyle}>Est. Hours</label>
                              <HoursField value={formEstHours} onChange={setFormEstHours} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <label style={lStyle}>Urgency</label>
                              <RDrop value={formUrgency}
                                options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]}
                                onChange={setFormUrgency} />
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* ── Step 2: Requirements & Payment ── */}
                    {applyStep === 2 && (
                      <>
                        <div>
                          <label style={lStyle}>Uniform</label>
                          <RDrop
                            value={formUniformType}
                            placeholder="Select uniform requirement"
                            options={UNIFORM_TYPE_OPTIONS}
                            onChange={v => setFormUniformType(v as UniformType)}
                          />
                        </div>
                        {formUniformType === 'dress_code' && (
                          <div>
                            <label style={lStyle}>Dress Code</label>
                            <textarea value={formUniformDetails} onChange={e => setFormUniformDetails(e.target.value)} rows={2} placeholder="e.g. Black shirt, black pants, black shoes" style={{ ...iStyle, resize: 'vertical', lineHeight: 1.55, verticalAlign: 'top' }} />
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Experience Required</label>
                            <RDrop value={formExperienceRequired} placeholder="Select preferences" options={EXPERIENCE_REQUIRED_OPTIONS} onChange={setFormExperienceRequired} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Minimum Age</label>
                            <RDrop value={formMinimumAge} placeholder="Select minimum age" options={MINIMUM_AGE_OPTIONS} onChange={setFormMinimumAge} />
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── Step 3: Schedule & Payment ── */}
                    {applyStep === 3 && (
                      <>
                        {/* Department & Pay live here (not step 2) so they can be changed while scheduling */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Department</label>
                            <RDrop value={formDeptId} placeholder="Select department"
                              options={(scopeToManagerDepartments ? departments.filter(d => managerDeptIds.includes(d.id)) : departments).map(d => ({ value: d.id, label: d.name }))}
                              onChange={(deptId) => { setFormDeptId(deptId); void loadDeptShiftOptions(deptId) }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>{formJobType === 'shift' ? 'Hourly Rate' : 'Flat Rate'}</label>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '0.9375rem', pointerEvents: 'none' }}>$</span>
                              <input type="number" min={0} step={0.5} onKeyDown={blockNonNumericKeys} value={formSalaryAmt} onChange={e => setFormSalaryAmt(e.target.value)} placeholder="0.00" style={{ ...iStyle, paddingLeft: 26 }} />
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Available Shift</label>
                            {shiftOptionsLoading ? (
                              <div style={{ ...iStyle, color: '#94A3B8', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}><Spinner size={13} dark /> Loading shifts…</div>
                            ) : shiftAvailableDates.length > 0 ? (
                              <RDrop value={formJobDate} placeholder="Select shift"
                                options={shiftAvailableDates.map(({ date }) => ({
                                  // date only — shift times vary per employee, so they come from the chosen supervisor
                                  value: date,
                                  label: new Date(date).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
                                }))}
                                onChange={(date) => {
                                  setFormJobDate(date); setFormAssignedEmployeeId('')
                                  setShiftDateEmployees(shiftDeptEmployees.filter(emp =>
                                    (emp as unknown as { shifts?: { shift_date: string }[] }).shifts?.some((s: { shift_date: string }) => s.shift_date === date)
                                  ))
                                }} />
                            ) : (
                              <div style={{ ...iStyle, color: '#94A3B8', background: '#F8FAFC' }}>No scheduled shifts found for this department</div>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Supervisor</label>
                            {!formJobDate ? (
                              <RDrop value="" placeholder="Select supervisor" options={[]} onChange={() => {}} disabled />
                            ) : shiftDateEmployees.length > 0 ? (
                              <RDrop value={formAssignedEmployeeId} placeholder="Select supervisor"
                                options={shiftDateEmployees.map(emp => ({ value: emp.id, label: emp.full_name }))}
                                onChange={(empId) => {
                                  setFormAssignedEmployeeId(empId)
                                  const emp = shiftDeptEmployees.find(em => em.id === empId) as unknown as { shifts?: { shift_date: string; start_time: string; end_time: string }[] } | undefined
                                  const shift = emp?.shifts?.find((s: { shift_date: string }) => s.shift_date === formJobDate)
                                  if (shift) {
                                    // Worker times follow the chosen supervisor's own shift that day
                                    if (formJobType === 'shift') { setFormJobStart(shift.start_time.slice(0, 5)); setFormJobEnd(shift.end_time.slice(0, 5)) }
                                    else setFormJobStartTime(shift.start_time.slice(0, 5))
                                  }
                                }} />
                            ) : (
                              <div style={{ ...iStyle, color: '#94A3B8', background: '#F8FAFC' }}>No employees scheduled on this date</div>
                            )}
                          </div>
                        </div>
                        {formJobType === 'shift' && formAssignedEmployeeId && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <label style={lStyle}>Start Time</label>
                                <RTimePicker value={formJobStart || '09:00'} onChange={setFormJobStart} min={supWindowStart} max={supWindowEnd} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <label style={lStyle}>End Time</label>
                                <RTimePicker value={formJobEnd || '17:00'} onChange={setFormJobEnd} min={supWindowStart} max={supWindowEnd} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <label style={lStyle}>Break Start</label>
                                <RTimePicker value={formBreakStart || '12:00'} onChange={setFormBreakStart} min={formJobStart || supWindowStart} max={formJobEnd || supWindowEnd} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <label style={lStyle}>Break End</label>
                                <RTimePicker value={formBreakEnd || '13:00'} onChange={setFormBreakEnd} min={formJobStart || supWindowStart} max={formJobEnd || supWindowEnd} />
                              </div>
                            </div>
                          </>
                        )}
                        {formJobType === 'oneoff' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <label style={lStyle}>Start Time</label>
                              <RTimePicker value={formJobStartTime || '09:00'} onChange={setFormJobStartTime} min={supWindowStart} max={supWindowEnd} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <label style={lStyle}>Number of Positions</label>
                              <input inputMode="numeric" value={formOpenings}
                                onChange={e => setFormOpenings(e.target.value.replace(/\D/g, ''))}
                                placeholder="Set number of openings" style={iStyle} />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label style={lStyle}>Number of Positions</label>
                            <input inputMode="numeric" value={formOpenings}
                              onChange={e => setFormOpenings(e.target.value.replace(/\D/g, ''))}
                              placeholder="Set number of openings" style={iStyle} />
                          </div>
                        )}
                        <div style={divider} />
                        <div>
                          <label style={lStyle}>Application Deadline</label>
                          <RDrop
                            value={formDeadlineChoice}
                            placeholder="Select deadline option"
                            options={[
                              { value: 'never', label: 'No Deadline' },
                              { value: 'date', label: 'Set a Deadline' },
                            ]}
                            onChange={v => {
                              setFormDeadlineChoice(v as '' | 'never' | 'date')
                              if (v !== 'date') { setFormExpiresAt(''); setFormDeadlineTime('23:59') }
                            }}
                          />
                          {formDeadlineChoice === 'date' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                              <DatePickerField value={formExpiresAt} onChange={setFormExpiresAt} min={localDateKey(new Date())} clearable={false} />
                              <RTimePicker value={formDeadlineTime} onChange={setFormDeadlineTime} />
                            </div>
                          )}
                        </div>
                        {/* Pay estimate — shift only, and only once a shift + supervisor are chosen (times are real, not defaults).
                            The rate is per person, so the total scales with Number of Positions — hiring 3 people at
                            $200 each costs $600, not $200. */}
                        {formJobType === 'shift' && formJobDate && formAssignedEmployeeId && (() => {
                          const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
                          const workMins = toMins(formJobEnd) - toMins(formJobStart)
                          const breakMins = toMins(formBreakEnd) - toMins(formBreakStart)
                          const netMins = workMins - (breakMins > 0 ? breakMins : 0)
                          const rate = parseFloat(formSalaryAmt)
                          if (netMins <= 0 || !formSalaryAmt || isNaN(rate) || rate <= 0) return null
                          const positions = Math.max(1, parseInt(formOpenings, 10) || 1)
                          const perPerson = netMins / 60 * rate
                          const total = (perPerson * positions).toFixed(2)
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10 }}>
                              <span style={{ ...lStyle, marginBottom: 0 }}>Estimated Cost{positions > 1 && <span style={{ fontWeight: 400, color: '#6B7280' }}> (${perPerson.toFixed(2)}/person × {positions})</span>}</span>
                              <strong style={{ fontSize: 15, color: '#059669' }}>${total}</strong>
                            </div>
                          )
                        })()}
                        {/* One-off pay estimate — the flat rate is per person, so the total scales with Number of Positions */}
                        {formJobType === 'oneoff' && (() => {
                          const rate = parseFloat(formSalaryAmt)
                          if (!formSalaryAmt || isNaN(rate) || rate <= 0) return null
                          const positions = Math.max(1, parseInt(formOpenings, 10) || 1)
                          const total = (rate * positions).toFixed(2)
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10 }}>
                              <span style={{ ...lStyle, marginBottom: 0 }}>Estimated Cost{positions > 1 && <span style={{ fontWeight: 400, color: '#6B7280' }}> (${rate.toFixed(2)}/person × {positions})</span>}</span>
                              <strong style={{ fontSize: 15, color: '#059669' }}>${total}</strong>
                            </div>
                          )
                        })()}
                      </>
                    )}

                  </div>
                )}

                {/* ── Step 3: Details form — single flat flex column so gap is identical everywhere ── */}
                {wizardStep === 'form' && !isTemplateMode && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* ── Requirements & Payment (step 3) — editing shows everything at once ── */}
                    {(!!editingId || createStep === 3) && (<>
                    <div>
                      <label style={lStyle}>Job Title</label>
                      <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Barista" style={iStyle} />
                    </div>
                    <div>
                      <label style={lStyle}>Responsibilities</label>
                      {/* Content was already reviewed in the AI step — keep these compact and scrollable */}
                      <textarea value={formResponsibilities} onChange={e => setFormResponsibilities(e.target.value)} onKeyDown={handleListKeyDown}
                        rows={4} style={{ ...iStyle, resize: 'vertical', overflowY: 'auto', lineHeight: 1.55, verticalAlign: 'top' }} placeholder="e.g. Serve customers, prep orders" />
                    </div>
                    <div>
                      <label style={lStyle}>Skills &amp; Qualifications</label>
                      <textarea value={formSkills} onChange={e => setFormSkills(e.target.value)} onKeyDown={handleListKeyDown}
                        rows={3} style={{ ...iStyle, resize: 'vertical', overflowY: 'auto', lineHeight: 1.55, verticalAlign: 'top' }} placeholder="e.g. Valid driver's license, basic Excel skills" />
                    </div>
                    {formJobType === 'oneoff' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <label style={lStyle}>Est. Hours</label>
                          <HoursField value={formEstHours} onChange={setFormEstHours} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label style={lStyle}>Urgency</label>
                          <RDrop value={formUrgency}
                            options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]}
                            onChange={setFormUrgency} />
                        </div>
                      </div>
                    )}
                    <div>
                      <label style={lStyle}>Uniform</label>
                      <RDrop
                        value={formUniformType}
                        placeholder="Select uniform requirement"
                        options={UNIFORM_TYPE_OPTIONS}
                        onChange={v => setFormUniformType(v as UniformType)}
                      />
                    </div>
                    {formUniformType === 'dress_code' && (
                      <div>
                        <label style={lStyle}>Dress Code</label>
                        <textarea value={formUniformDetails} onChange={e => setFormUniformDetails(e.target.value)} rows={2} placeholder="e.g. Black shirt, black pants, black shoes" style={{ ...iStyle, resize: 'vertical', lineHeight: 1.55, verticalAlign: 'top' }} />
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <label style={lStyle}>Experience Required</label>
                        <RDrop value={formExperienceRequired} placeholder="Select preferences" options={EXPERIENCE_REQUIRED_OPTIONS} onChange={setFormExperienceRequired} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <label style={lStyle}>Minimum Age</label>
                        <RDrop value={formMinimumAge} placeholder="Select minimum age" options={MINIMUM_AGE_OPTIONS} onChange={setFormMinimumAge} />
                      </div>
                    </div>
                    </>)}

                    {/* ── Schedule & Post (step 4) ── */}
                    {(!!editingId || createStep === 4) && (<>
                    {!!editingId && <div style={divider} />}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        {/* Manager only ever has one department (already resolved into formDeptId,
                            see the managerDeptIds effect above) — no picker, Number of Positions
                            takes this slot instead of sitting further down the form. */}
                        {scopeToManagerDepartments ? (
                          <>
                            <label style={lStyle}>Number of Positions</label>
                            <input inputMode="numeric" value={formOpenings}
                              onChange={e => setFormOpenings(e.target.value.replace(/\D/g, ''))}
                              placeholder="Set number of openings" style={iStyle} />
                          </>
                        ) : (
                          <>
                            <label style={lStyle}>Department</label>
                            <RDrop value={formDeptId} placeholder="Select department"
                              options={departments.map(d => ({ value: d.id, label: d.name }))}
                              onChange={(deptId) => { setFormDeptId(deptId); void loadDeptShiftOptions(deptId) }} />
                          </>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <label style={lStyle}>{formJobType === 'shift' ? 'Hourly Rate' : 'Flat Rate'}</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '0.9375rem', pointerEvents: 'none' }}>$</span>
                          <input type="number" min={0} step={0.5} onKeyDown={blockNonNumericKeys} value={formSalaryAmt} onChange={e => setFormSalaryAmt(e.target.value)} placeholder="0.00" style={{ ...iStyle, paddingLeft: 26 }} />
                        </div>
                      </div>
                    </div>

                    {(formDeptId || editingId) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <label style={lStyle}>Available Shift</label>
                          {shiftOptionsLoading ? (
                            <div style={{ ...iStyle, color: '#94A3B8', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}><Spinner size={13} dark /> Loading shifts…</div>
                          ) : shiftAvailableDates.length > 0 ? (
                            <RDrop value={formJobDate} placeholder="Select shift"
                              options={shiftAvailableDates.map(({ date }) => ({
                                // date only — shift times vary per employee, so they come from the chosen supervisor
                                value: date,
                                label: new Date(date).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
                              }))}
                              onChange={(date) => {
                                setFormJobDate(date); setFormAssignedEmployeeId('')
                                setShiftDateEmployees(shiftDeptEmployees.filter(emp =>
                                  (emp as unknown as { shifts?: { shift_date: string }[] }).shifts?.some((s: { shift_date: string }) => s.shift_date === date)
                                ))
                              }} />
                          ) : (
                            <div style={{ ...iStyle, color: '#94A3B8', background: '#F8FAFC' }}>No scheduled shifts found for this department</div>
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label style={lStyle}>Supervisor</label>
                          {!(formJobDate || editingId) ? (
                            <RDrop value="" placeholder="Select supervisor" options={[]} onChange={() => {}} disabled />
                          ) : shiftDateEmployees.length > 0 ? (
                            <RDrop value={formAssignedEmployeeId} placeholder="Select supervisor"
                              options={shiftDateEmployees.map(emp => ({ value: emp.id, label: emp.full_name }))}
                              onChange={(empId) => {
                                setFormAssignedEmployeeId(empId)
                                const emp = shiftDeptEmployees.find(em => em.id === empId) as unknown as { shifts?: { shift_date: string; start_time: string; end_time: string }[] } | undefined
                                const shift = emp?.shifts?.find((s: { shift_date: string }) => s.shift_date === formJobDate)
                                if (shift) {
                                  // Worker times follow the chosen supervisor's own shift that day
                                  if (formJobType === 'shift') { setFormJobStart(shift.start_time.slice(0, 5)); setFormJobEnd(shift.end_time.slice(0, 5)) }
                                  else setFormJobStartTime(shift.start_time.slice(0, 5))
                                }
                              }} />
                          ) : (
                            <div style={{ ...iStyle, color: '#94A3B8', background: '#F8FAFC' }}>No employees scheduled on this date</div>
                          )}
                        </div>
                      </div>
                    )}
                    {formJobType === 'shift' && (formAssignedEmployeeId || editingId) && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Start Time</label>
                            <RTimePicker value={formJobStart || '09:00'} onChange={setFormJobStart} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>End Time</label>
                            <RTimePicker value={formJobEnd || '17:00'} onChange={setFormJobEnd} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Break Start</label>
                            <RTimePicker value={formBreakStart || '12:00'} onChange={setFormBreakStart} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Break End</label>
                            <RTimePicker value={formBreakEnd || '13:00'} onChange={setFormBreakEnd} />
                          </div>
                        </div>
                      </>
                    )}
                    {formJobType === 'oneoff' && (
                      // Number of Positions already sits in the Department slot above for a
                      // Manager (see scopeToManagerDepartments there) — Owner/Partner still get it
                      // paired with Start Time here since their first row is a real Department picker.
                      <div style={{ display: 'grid', gridTemplateColumns: scopeToManagerDepartments ? '1fr' : '1fr 1fr', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <label style={lStyle}>Start Time</label>
                          <RTimePicker value={formJobStartTime || '09:00'} onChange={setFormJobStartTime} />
                        </div>
                        {!scopeToManagerDepartments && (
                          <div style={{ minWidth: 0 }}>
                            <label style={lStyle}>Number of Positions</label>
                            <input inputMode="numeric" value={formOpenings}
                              onChange={e => setFormOpenings(e.target.value.replace(/\D/g, ''))}
                              placeholder="Set number of openings" style={iStyle} />
                          </div>
                        )}
                      </div>
                    )}
                    {formJobType === 'shift' && !scopeToManagerDepartments && (
                      <div>
                        <label style={lStyle}>Number of Positions</label>
                        <input inputMode="numeric" value={formOpenings}
                          onChange={e => setFormOpenings(e.target.value.replace(/\D/g, ''))}
                          placeholder="Set number of openings" style={iStyle} />
                      </div>
                    )}
                    <div style={divider} />
                    <div>
                      <label style={lStyle}>Application Deadline</label>
                      <RDrop
                        value={formDeadlineChoice}
                        placeholder="Select deadline option"
                        options={[
                          { value: 'never', label: 'No Deadline' },
                          { value: 'date', label: 'Set a Deadline' },
                        ]}
                        onChange={v => {
                          setFormDeadlineChoice(v as '' | 'never' | 'date')
                          if (v !== 'date') { setFormExpiresAt(''); setFormDeadlineTime('23:59') }
                        }}
                      />
                      {formDeadlineChoice === 'date' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                          <DatePickerField value={formExpiresAt} onChange={setFormExpiresAt} min={localDateKey(new Date())} clearable={false} />
                          <RTimePicker value={formDeadlineTime} onChange={setFormDeadlineTime} />
                        </div>
                      )}
                    </div>
                    {/* Pay estimate — shift only, and only once a shift + supervisor are chosen (times are real, not defaults).
                        The rate is per person, so the total scales with Number of Positions — hiring 3 people at
                        $200 each costs $600, not $200. */}
                    {formJobType === 'shift' && (formJobDate || editingId) && (formAssignedEmployeeId || editingId) && (() => {
                      const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
                      const workMins = toMins(formJobEnd) - toMins(formJobStart)
                      const breakMins = toMins(formBreakEnd) - toMins(formBreakStart)
                      const netMins = workMins - (breakMins > 0 ? breakMins : 0)
                      const rate = parseFloat(formSalaryAmt)
                      if (netMins <= 0 || !formSalaryAmt || isNaN(rate) || rate <= 0) return null
                      const positions = Math.max(1, parseInt(formOpenings, 10) || 1)
                      const perPerson = netMins / 60 * rate
                      const total = (perPerson * positions).toFixed(2)
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10 }}>
                          <span style={{ ...lStyle, marginBottom: 0 }}>Estimated Cost{positions > 1 && <span style={{ fontWeight: 400, color: '#6B7280' }}> (${perPerson.toFixed(2)}/person × {positions})</span>}</span>
                          <strong style={{ fontSize: 15, color: '#059669' }}>${total}</strong>
                        </div>
                      )
                    })()}
                    {/* One-off pay estimate — the flat rate is per person, so the total scales with Number of Positions */}
                    {formJobType === 'oneoff' && (() => {
                      const rate = parseFloat(formSalaryAmt)
                      if (!formSalaryAmt || isNaN(rate) || rate <= 0) return null
                      const positions = Math.max(1, parseInt(formOpenings, 10) || 1)
                      const total = (rate * positions).toFixed(2)
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10 }}>
                          <span style={{ ...lStyle, marginBottom: 0 }}>Estimated Cost{positions > 1 && <span style={{ fontWeight: 400, color: '#6B7280' }}> (${rate.toFixed(2)}/person × {positions})</span>}</span>
                          <strong style={{ fontSize: 15, color: '#059669' }}>${total}</strong>
                        </div>
                      )
                    })()}
                    </>)}

                  </div>
                )}

              </div>

              {formError && <div style={modalErrorBoxStyle}>{formError}</div>}

              {/* Footer */}
              {wizardStep === 'form' && (
                <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
                  {!editingId && !formTemplateId && templateReady && (
                    <button onClick={() => void saveAsTemplate()} disabled={templateActionLoading || templateAlreadySaved}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: templateAlreadySaved ? '1px solid #BBF7D0' : '1px solid #E5E7EB', borderRadius: 10, background: templateAlreadySaved ? '#F0FDF4' : '#FFFFFF', color: templateAlreadySaved ? '#059669' : '#6B7280', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: templateActionLoading || templateAlreadySaved ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                      {templateActionLoading ? <Spinner size={13} dark /> : templateAlreadySaved ? <Check size={13} /> : <ClipboardList size={13} />} {templateAlreadySaved ? 'Template Saved' : 'Save as Template'}
                    </button>
                  )}
                  {!editingId && !isTemplateMode && (
                    <button onClick={() => saveForm('draft')} disabled={actionLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF', color: '#6B7280', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {actionLoading ? <Spinner size={13} dark /> : <FileText size={13} />} Save Draft
                    </button>
                  )}
                  {isTemplateMode && applyStep < 3 ? (
                    (() => {
                      const nextDisabled = applyStep === 1
                        ? (!formTitle.trim() || !formResponsibilities.trim() || !formSkills.trim() || (formJobType === 'oneoff' && !formEstHours))
                        : (!formUniformType || (formUniformType === 'dress_code' && !formUniformDetails.trim()) || !formExperienceRequired || !formMinimumAge)
                      return (
                        <button
                          onClick={() => { setFormError(''); setApplyStep((applyStep + 1) as 2 | 3) }}
                          disabled={nextDisabled}
                          style={{ ...modalPrimaryButtonStyle(nextDisabled), flex: 1, justifyContent: 'center' }}>
                          Next <ChevronRight size={13} />
                        </button>
                      )
                    })()
                  ) : !editingId && !isTemplateMode && createStep === 3 ? (
                    (() => {
                      const nextDisabled = !formTitle.trim() || !formResponsibilities.trim() || !formSkills.trim()
                        || (formJobType === 'oneoff' && !formEstHours)
                        || !formUniformType || (formUniformType === 'dress_code' && !formUniformDetails.trim())
                        || !formExperienceRequired || !formMinimumAge
                      return (
                        <button
                          onClick={() => { setFormError(''); setCreateStep(4); setScheduleSeen(true) }}
                          disabled={nextDisabled}
                          style={{ ...modalPrimaryButtonStyle(nextDisabled), background: nextDisabled ? accentDisabledBg : accentGradient, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 36, whiteSpace: 'nowrap' }}>
                          Next <ChevronRight size={13} />
                        </button>
                      )
                    })()
                  ) : (
                    <button onClick={() => (editingRejected ? saveRejectedEdit() : saveForm(editingDraft ? 'draft' : 'open'))} disabled={postDisabled}
                      style={{
                        ...(editingId ? modalPrimaryButtonStyle(postDisabled) : { ...modalPrimaryButtonStyle(postDisabled), background: postDisabled ? accentDisabledBg : accentGradient }),
                        ...(isTemplateMode ? { flex: 1, justifyContent: 'center' } : {}),
                      }}>
                      {/* Manager submissions always go through Owner/Partner approval before going
                          live (createJobPosting downgrades status to pending_approval server-side
                          regardless of what's requested here) — "Submit" says that, "Post Job"
                          would falsely imply it's live immediately like Owner/Partner's own. */}
                      {actionLoading ? <Spinner size={13} /> : <Check size={13} />} {editingRejected ? 'Save & Resubmit' : editingDraft ? 'Save Changes' : editingId ? 'Save Changes' : scopeToManagerDepartments ? 'Submit' : 'Post Job'}
                    </button>
                  )}
                </div>
              )}

            </ModalBox>
          </ModalOverlay>,
          document.body
        )
      })()}



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

