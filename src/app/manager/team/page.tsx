'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronDown, Check, Building2, Network, Crown, UserCog, UserRound, HardHat, Users } from 'lucide-react'
import { deptColor, setDeptColorOverrides } from '@/lib/deptColor'
import { createBrowserClient } from '@supabase/ssr'
import ManagerSidebar from '@/components/ManagerSidebar'

// ─── Theme ────────────────────────────────────────────────────────────────────

const ACCENT       = '#2563EB'
const ACCENT_DARK  = '#1D4ED8'
const ACCENT_LIGHT = '#EFF6FF'
const NAVY         = '#1E3A5F'

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={light ? 'rgba(255,255,255,0.35)' : 'rgba(17,24,39,0.2)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={light ? 'white' : '#111827'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, duration = 550 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef  = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to   = value
    if (from === to) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else prevRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return <>{display.toLocaleString()}</>
}

// ─── Modal keyframes ─────────────────────────────────────────────────────────

const pageKeyframes = `
  @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes modalSlideIn  { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
  @keyframes blockSlideUp  { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes cardStagger   { from { opacity: 0; transform: translateY(14px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
`

// ─── Modal primitives ─────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose, maxWidth = '540px' }: { children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, zIndex: 100,
        animation: 'overlayFadeIn 0.18s ease-out',
      }}
    >
      <style>{pageKeyframes}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ width: `min(${maxWidth}, calc(100% - 32px))`, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

function ModalBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
      maxHeight: '90vh',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)',
    }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, icon, iconBg, onClose }: { title: string; icon?: React.ReactNode; iconBg?: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && <div style={{ width: 32, height: 32, borderRadius: 9, background: iconBg ?? 'linear-gradient(135deg, #2563EB, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>}
        <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>{title}</h2>
      </div>
      <button
        onClick={onClose}
        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: 6, borderRadius: 8, flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

const modalInputStyle: React.CSSProperties = {
  width: '100%', minHeight: 40, padding: '10px 12px',
  border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9375rem',
  color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}

const modalLabelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: 12, color: '#334155', marginBottom: 6,
}

// ─── Role avatar ──────────────────────────────────────────────────────────────

function RoleAvatar({ role, size = 36, photoUrl }: { role: string; size?: number; photoUrl?: string | null }) {
  if (photoUrl) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 999, flexShrink: 0, overflow: 'hidden' }}>
        <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    )
  }
  const cfg: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    Owner:   { bg: '#0F172A', color: '#FFFFFF',  icon: <Crown    size={size * 0.42} /> },
    Partner: { bg: '#0F172A', color: '#FFFFFF',  icon: <Crown    size={size * 0.42} /> },
    Manager: { bg: ACCENT_LIGHT, color: ACCENT,  icon: <UserCog  size={size * 0.42} /> },
    Employee:{ bg: '#F3F4F6', color: '#4B5563',  icon: <UserRound size={size * 0.42} /> },
    'Casual Worker': { bg: '#EFF6FF', color: '#2563EB', icon: <HardHat size={size * 0.42} /> },
  }
  const { bg, color, icon } = cfg[role] ?? { bg: '#F3F4F6', color: '#6B7280', icon: <UserRound size={size * 0.42} /> }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 999, background: bg, color, flexShrink: 0 }}>
      {icon}
    </span>
  )
}

// ─── ProfileField ─────────────────────────────────────────────────────────────

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontWeight: 600, fontSize: '0.6875rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontWeight: 500, fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{value}</p>
    </div>
  )
}

// ─── Org Chart sub-components ─────────────────────────────────────────────────

function OrgNode({ member, onClick }: { member: TeamMember; onClick: () => void }) {
  const dark = member.role === 'Owner' || member.role === 'Partner'
  return (
    <button
      onClick={onClick}
      className="org-node-btn"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '12px 16px', borderRadius: 12,
        border: `1.5px solid ${dark ? '#0F172A' : '#E5E7EB'}`,
        background: dark ? '#0F172A' : '#FFFFFF',
        cursor: 'pointer', width: '100%',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}
    >
      <RoleAvatar role={member.role} size={36} photoUrl={member.profile_photo_url} />
      <p style={{ fontWeight: 700, fontSize: '0.8125rem', color: dark ? '#FFFFFF' : '#111827', margin: 0, lineHeight: 1.3, textAlign: 'center' }}>{member.full_name}</p>
    </button>
  )
}

// ─── Org Chart Tree ───────────────────────────────────────────────────────────

type OrgChartTreeProps = {
  departments: CompanyDept[]
  teamMembers: TeamMember[]
  onMemberClick: (m: TeamMember) => void
  myDeptId: string
}

const LINE_COLOR  = '#CBD5E1'
const NODE_W      = 140
const LEADER_W    = 160
const LEADER_GAP  = 16
const MGR_GAP     = 12
const EMP_GAP     = 8
const DEPT_PAD    = 12
const DEPT_GAP    = 20
const OUTER_H     = 48
const INNER_H     = 30
const M2E_H       = 16

function OrgChartTree({ departments, teamMembers, onMemberClick, myDeptId }: OrgChartTreeProps) {
  const topMembers = teamMembers.filter(m => m.role === 'Owner' || m.role === 'Partner')
  const sortedDepts = [...departments].sort((a, b) => a.name.localeCompare(b.name))

  const deptCols = sortedDepts.map(dept => ({
    dept,
    managers:  teamMembers.filter(m => m.role === 'Manager'  && m.department_id === dept.id),
    employees: dept.id === myDeptId
      ? teamMembers.filter(m => m.role === 'Employee' && m.department_id === dept.id)
      : [],
  }))

  const deptInnerWs = deptCols.map(({ managers }) =>
    Math.max(NODE_W, managers.length * NODE_W + (managers.length - 1) * MGR_GAP)
  )
  const deptColWs = deptInnerWs.map(w => w + 2 * DEPT_PAD)

  const totalDeptW = deptColWs.reduce((s, w) => s + w, 0) + Math.max(0, deptCols.length - 1) * DEPT_GAP

  const owners        = topMembers.filter(m => m.role === 'Owner')
  const partners      = topMembers.filter(m => m.role === 'Partner')
  const leftPartners  = partners.slice(0, Math.floor(partners.length / 2))
  const rightPartners = partners.slice(Math.floor(partners.length / 2))
  const orderedLeaders = [...leftPartners, ...owners, ...rightPartners]

  const topCount    = orderedLeaders.length
  const leaderRowW  = topCount * LEADER_W + Math.max(0, topCount - 1) * LEADER_GAP
  const totalW      = Math.max(totalDeptW, leaderRowW + 60)

  const deptRowStartX = (totalW - totalDeptW) / 2
  const deptColStartXs: number[] = []
  let x = deptRowStartX
  for (const w of deptColWs) { deptColStartXs.push(x); x += w + DEPT_GAP }

  const deptCenterXs = deptCols.map((_, i) => deptColStartXs[i] + deptColWs[i] / 2)

  const ownerIdxInOrdered = orderedLeaders.findIndex(m => m.role === 'Owner')
  const leaderRowStartX = totalW / 2 - (ownerIdxInOrdered >= 0 ? ownerIdxInOrdered : 0) * (LEADER_W + LEADER_GAP) - LEADER_W / 2

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8, paddingTop: 8 }}>
      <div style={{ width: totalW, margin: '0 auto' }}>

        {/* Row 1: Owner + Partners — Owner pinned to totalW/2 */}
        {orderedLeaders.length > 0 && (
          <div style={{ position: 'relative', height: 80, flexShrink: 0 }}>
            {orderedLeaders.map((m, i) => (
              <div key={m.id} style={{
                position: 'absolute',
                left: leaderRowStartX + i * (LEADER_W + LEADER_GAP),
                top: 0,
                width: LEADER_W,
              }}>
                <OrgNode member={m} onClick={() => onMemberClick(m)} />
              </div>
            ))}
          </div>
        )}

        {/* SVG: leadership → dept columns — vertical stem always at totalW/2 */}
        {deptCols.length > 0 && orderedLeaders.length > 0 && (
          <svg width={totalW} height={OUTER_H} style={{ display: 'block', overflow: 'visible' }}>
            <line x1={totalW / 2} y1={0} x2={totalW / 2} y2={OUTER_H / 2} stroke={LINE_COLOR} strokeWidth={1.5} />
            {deptCols.length > 1 && (
              <line x1={deptCenterXs[0]} y1={OUTER_H / 2} x2={deptCenterXs[deptCols.length - 1]} y2={OUTER_H / 2} stroke={LINE_COLOR} strokeWidth={1.5} />
            )}
            {deptCenterXs.map((cx, i) => (
              <line key={i} x1={cx} y1={OUTER_H / 2} x2={cx} y2={OUTER_H} stroke={LINE_COLOR} strokeWidth={1.5} />
            ))}
          </svg>
        )}

        {/* Row 2: Dept columns */}
        {deptCols.length > 0 && (
          <div style={{ display: 'flex', gap: DEPT_GAP, alignItems: 'flex-start', justifyContent: 'center' }}>
            {deptCols.map(({ dept, managers, employees }, di) => {
              const color   = deptColor(dept.id)
              const colW    = deptColWs[di]
              const innerW  = deptInnerWs[di]
              const offsetX = (colW - innerW) / 2
              const mgrCXs  = managers.map((_, mi) => offsetX + mi * (NODE_W + MGR_GAP) + NODE_W / 2)
              const isMyDept = dept.id === myDeptId

              return (
                <div key={dept.id} style={{
                  width: colW, flexShrink: 0,
                  border: `1.5px solid ${color}30`,
                  borderTop: `3px solid ${color}`,
                  borderRadius: 14,
                  background: '#FFFFFF',
                  boxShadow: isMyDept ? `0 1px 6px rgba(0,0,0,0.08), 0 0 0 1.5px ${color}40` : '0 1px 6px rgba(0,0,0,0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden',
                }}>
                  {/* Dept header */}
                  <div style={{ width: '100%', padding: '9px 12px', background: `${color}10`, borderBottom: `1px solid ${color}28`, textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>{dept.name}</span>
                  </div>

                  {/* SVG: dept header → managers */}
                  {managers.length > 0 && (
                    <svg width={colW} height={INNER_H} style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}>
                      <line x1={colW / 2} y1={0} x2={colW / 2} y2={INNER_H / 2} stroke={LINE_COLOR} strokeWidth={1.5} />
                      {managers.length > 1 && (
                        <line x1={mgrCXs[0]} y1={INNER_H / 2} x2={mgrCXs[managers.length - 1]} y2={INNER_H / 2} stroke={LINE_COLOR} strokeWidth={1.5} />
                      )}
                      {mgrCXs.map((cx, i) => (
                        <line key={i} x1={cx} y1={INNER_H / 2} x2={cx} y2={INNER_H} stroke={LINE_COLOR} strokeWidth={1.5} />
                      ))}
                    </svg>
                  )}

                  {/* Managers */}
                  {managers.length > 0 && (
                    <div style={{ display: 'flex', gap: MGR_GAP, flexShrink: 0, marginBottom: (!isMyDept || employees.length === 0) ? DEPT_PAD : 0 }}>
                      {managers.map(m => (
                        <div key={m.id} style={{ width: NODE_W }}>
                          <OrgNode member={m} onClick={() => onMemberClick(m)} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Connector → employees (my dept only) */}
                  {isMyDept && employees.length > 0 && (
                    <div style={{ width: 1.5, height: M2E_H, background: LINE_COLOR, flexShrink: 0 }} />
                  )}

                  {/* Employees (my dept only) */}
                  {isMyDept && employees.length > 0 && (
                    <div style={{
                      margin: `0 ${DEPT_PAD}px ${DEPT_PAD}px`,
                      display: 'flex', flexDirection: 'column', gap: EMP_GAP,
                      width: `calc(100% - ${DEPT_PAD * 2}px)`, boxSizing: 'border-box',
                    }}>
                      {employees.map(m => (
                        <OrgNode key={m.id} member={m} onClick={() => onMemberClick(m)} />
                      ))}
                    </div>
                  )}

                  {managers.length === 0 && (
                    <div style={{ padding: '12px', fontSize: '0.75rem', color: '#9CA3AF' }}>No members</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CompanyDept = { id: string; name: string }
type AssignedDept = { department_id: string; department_name: string }
type TeamMember = {
  id: string
  full_name: string
  email_address: string
  phone_number: string | null
  role: string
  department_id: string | null
  profile_photo_url?: string | null
  worker_status?: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerTeamPage() {
  const router = useRouter()
  const [userId,         setUserId]         = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId,      setCompanyId]      = useState('')
  const [primaryDeptId,  setPrimaryDeptId]  = useState('')
  const [companyName,    setCompanyName]    = useState('')
  const [managerName,    setManagerName]    = useState('')
  const [userEmail,      setUserEmail]      = useState('')

  const [assignedDepts,      setAssignedDepts]      = useState<AssignedDept[]>([])
  const [selectedDeptId,     setSelectedDeptId]     = useState('')
  const [companyDepartments, setCompanyDepartments] = useState<CompanyDept[]>([])
  const [teamMembers,        setTeamMembers]        = useState<TeamMember[]>([])
  const [teamLoading,        setTeamLoading]        = useState(false)

  // Invite modal
  const [inviteOpen,    setInviteOpen]    = useState(false)
  const [inviteEmail,   setInviteEmail]   = useState('')
  const [inviteDeptId,  setInviteDeptId]  = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError,   setInviteError]   = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(''), 3000)
  }, [])

  // Profile modal
  const [profileMember, setProfileMember] = useState<TeamMember | null>(null)

  // Remove modal
  const [removeModal,   setRemoveModal]   = useState<TeamMember | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError,   setRemoveError]   = useState('')

  const closeModal = useCallback(() => {
    setInviteOpen(false)
    setInviteEmail('')
    setInviteDeptId('')
    setInviteError('')
    setInviteSuccess('')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { closeModal(); setProfileMember(null); setRemoveModal(null) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeModal])

  const fetchTeamMembers = useCallback(async (cid: string) => {
    if (!cid) return
    setTeamLoading(true)
    try {
      const res = await fetch(`/api/team/members?company_id=${cid}`)
      const data = await res.json()
      if (data.success) setTeamMembers(data.members)
    } catch {}
    finally { setTeamLoading(false) }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let uid = localStorage.getItem('tasking_user_id')
      if (!uid) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          uid = session.user.id
          localStorage.setItem('tasking_user_id', uid)
        }
      }
      if (!uid) { router.replace('/signin'); return }
      if (cancelled) return
      setUserId(uid)

      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }

      const { id: internalId, email_address, full_name, company_id, department_id } = meData.user
      if (internalId)     setInternalUserId(internalId)
      if (email_address)  setUserEmail(email_address)
      if (full_name)      setManagerName(full_name)

      let cid = company_id || localStorage.getItem(`tasking_company_id_${uid}`) || ''
      if (cid) localStorage.setItem(`tasking_company_id_${uid}`, cid)
      if (cancelled) return
      setCompanyId(cid)
      setPrimaryDeptId(department_id || '')

      if (cid) {
        const [compRes, deptsRes] = await Promise.all([
          fetch(`/api/company/current?user_id=${uid}&company_id=${cid}`),
          fetch(`/api/company/departments?company_id=${cid}`),
        ])
        const [compData, deptsData] = await Promise.all([compRes.json(), deptsRes.json()])
        if (!cancelled && compData.success && compData.company?.name) setCompanyName(compData.company.name)
        if (!cancelled && deptsData.success) {
          setCompanyDepartments(deptsData.departments)
          setDeptColorOverrides(deptsData.departments)
        }

        if (internalId) {
          const assignedRes = await fetch(`/api/manager/departments?manager_id=${internalId}&company_id=${cid}`)
          const assignedData = await assignedRes.json()
          if (!cancelled && assignedData.success) {
            setAssignedDepts(assignedData.departments)
            const initial = department_id || (assignedData.departments[0]?.department_id ?? '')
            setSelectedDeptId(initial)
            setInviteDeptId(initial)
          }
        }

        fetchTeamMembers(cid)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [fetchTeamMembers, router])

  const openInviteModal = () => {
    setInviteDeptId(selectedDeptId || primaryDeptId)
    setInviteOpen(true)
  }

  const handleSendInvite = async () => {
    if (!inviteEmail) { setInviteError('Email is required.'); return }
    if (userEmail && inviteEmail.toLowerCase() === userEmail.toLowerCase()) {
      setInviteError('You cannot invite yourself.')
      return
    }
    if (!inviteDeptId) { setInviteError('Please select a department.'); return }
    setInviteLoading(true)
    setInviteError('')
    try {
      const res = await fetch('/api/invitation/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: 'Employee',
          company_id: companyId,
          department_id: inviteDeptId || null,
          invited_by: userId,
          reporting_manager_id: internalUserId || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      showToast('Invitation sent successfully.')
      closeModal()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!removeModal) return
    setRemoveLoading(true)
    setRemoveError('')
    try {
      const res = await fetch('/api/team/remove-member', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          user_id_to_remove: removeModal.id,
          requesting_user_id: userId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setRemoveModal(null)
      fetchTeamMembers(companyId)
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemoveLoading(false)
    }
  }

  // Manager can remove Employees in their own dept; cannot remove themselves or Owner/Partner/Manager
  const canRemove = (member: TeamMember) => {
    if (member.id === internalUserId) return false
    if (member.role === 'Owner' || member.role === 'Partner' || member.role === 'Manager') return false
    return member.department_id === primaryDeptId || member.department_id === selectedDeptId
  }

  // Dept-scoped view: Managers + Employees/Casual Workers in selected dept
  const deptMembers = selectedDeptId
    ? teamMembers.filter(m => m.role === 'Manager' || m.department_id === selectedDeptId)
    : teamMembers

  const managerCount      = deptMembers.filter(m => m.role === 'Manager').length
  const employeeCount     = deptMembers.filter(m => m.role === 'Employee').length

  const totalInternal     = managerCount + employeeCount

  const casualWorkers = teamMembers.filter(m => m.role === 'Casual Worker' && m.department_id === selectedDeptId)
  const sendDisabled  = inviteLoading || !inviteEmail || !inviteDeptId

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F1F5F9', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          40%      { transform: translateY(-4px); }
          70%      { transform: translateY(-2px); }
        }
        .team-stat-card {
          transition: box-shadow 0.22s ease, transform 0.22s ease;
        }
        .team-stat-card:hover {
          box-shadow: 0 8px 28px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(37,99,235,0.18) !important;
          transform: translateY(-3px) scale(1.015);
        }
        .team-stat-card:hover .stat-icon { animation: iconBounce 0.5s ease forwards; }
        .team-stat-card:nth-child(1) { animation: fadeSlideUp 0.36s ease both 0.04s; }
        .team-stat-card:nth-child(2) { animation: fadeSlideUp 0.36s ease both 0.08s; }
        .team-stat-card:nth-child(3) { animation: fadeSlideUp 0.36s ease both 0.12s; }
        .team-stat-card:nth-child(4) { animation: fadeSlideUp 0.36s ease both 0.16s; }
        .team-panel-card {
          transition: box-shadow 0.22s ease, transform 0.22s ease;
        }
        .team-panel-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.09), 0 0 0 1.5px rgba(0,0,0,0.07) !important;
          transform: translateY(-2px);
        }
        .team-panel-card:nth-child(1) { animation: scaleIn 0.40s ease both 0.18s; }
        .team-panel-card:nth-child(2) { animation: scaleIn 0.40s ease both 0.26s; }
        .team-panel-card:nth-child(3) { animation: scaleIn 0.40s ease both 0.34s; }
        .org-node-btn {
          transition: box-shadow 0.15s ease, transform 0.12s ease !important;
          position: relative; z-index: 0;
        }
        .org-node-btn:hover {
          box-shadow: 0 6px 18px rgba(0,0,0,0.13) !important;
          transform: translateY(-2px) scale(1.02) !important;
          z-index: 10;
        }
      `}</style>
      <ManagerSidebar />

      {/* ── MAIN ───────────────────────────────────────────────────────────── */}
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Page header */}
        <div style={{ padding: '20px 28px 0', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Team
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {managerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: NAVY, color: '#FFFFFF', flexShrink: 0 }}>
                  <UserCog size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{managerName}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── ORG CHART ───────────────────────────────────────────────────── */}
            <div className="team-panel-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Network size={15} style={{ color: ACCENT }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', flex: 1 }}>Organisation Chart</span>
                <button
                  onClick={openInviteModal}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', border: 'none', borderRadius: 8, background: ACCENT, fontWeight: 700, fontSize: '0.875rem', color: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => { e.currentTarget.style.background = ACCENT_DARK }}
                  onMouseLeave={e => { e.currentTarget.style.background = ACCENT }}
                >
                  <Plus size={14} strokeWidth={2.5} /> Invite Employee
                </button>
              </div>
              {teamLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: '0.9375rem' }}>
                  <Spinner size={16} /> Loading…
                </div>
              ) : (
                <OrgChartTree
                  departments={companyDepartments}
                  teamMembers={teamMembers}
                  onMemberClick={m => setProfileMember(m)}
                  myDeptId={primaryDeptId}
                />
              )}
            </div>

            {/* ── CASUAL WORKERS ──────────────────────────────────────────────── */}
            <div className="team-panel-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HardHat size={15} style={{ color: ACCENT }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', flex: 1 }}>Casual Workers</span>
              </div>
              {teamLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: '0.9375rem' }}>
                  <Spinner size={16} /> Loading…
                </div>
              ) : casualWorkers.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                  <HardHat size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No casual workers in your department yet</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {casualWorkers.map(worker => {
                    const status = worker.worker_status ?? 'active'
                    const statusColors: Record<string, { bg: string; text: string }> = {
                      active:   { bg: '#ECFDF5', text: '#047857' },
                      inactive: { bg: '#F3F4F6', text: '#4B5563' },
                      blocked:  { bg: '#FEF2F2', text: '#B91C1C' },
                    }
                    const sc = statusColors[status] ?? statusColors.active
                    return (
                      <button
                        key={worker.id}
                        onClick={() => setProfileMember(worker)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 12,
                          border: `1.5px solid ${ACCENT}22`, background: ACCENT_LIGHT,
                          cursor: 'pointer', textAlign: 'left',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          transition: 'box-shadow 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 3px 10px rgba(37,99,235,0.12)` }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
                      >
                        <RoleAvatar role="Casual Worker" size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{worker.full_name}</p>
                          <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{worker.email_address}</p>
                        </div>
                        <span style={{ background: sc.bg, color: sc.text, borderRadius: 999, padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                          {status}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Member Profile Modal ─────────────────────────────────────────── */}
      {profileMember && (
        <ModalOverlay onClose={() => setProfileMember(null)}>
          <ModalBox>
            <ModalHeader title="Member Profile" onClose={() => setProfileMember(null)} />
            <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 16 }}>
              <RoleAvatar role={profileMember.role} size={54} photoUrl={profileMember.profile_photo_url} />
              <div>
                <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#0F172A', margin: '0 0 5px' }}>{profileMember.full_name}</p>
                <span style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  background: profileMember.role === 'Owner' || profileMember.role === 'Partner' ? '#0F172A'
                    : profileMember.role === 'Manager' ? ACCENT_LIGHT
                    : profileMember.role === 'Employee' ? '#F3F4F6' : ACCENT_LIGHT,
                  color: profileMember.role === 'Owner' || profileMember.role === 'Partner' ? '#FFFFFF'
                    : profileMember.role === 'Manager' ? ACCENT
                    : profileMember.role === 'Employee' ? '#4B5563' : ACCENT,
                }}>
                  {profileMember.role}
                </span>
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <ProfileField label="Email" value={profileMember.email_address} />
              <ProfileField label="Phone" value={profileMember.phone_number ?? '—'} />
              {profileMember.department_id && (
                <ProfileField
                  label="Department"
                  value={companyDepartments.find(d => d.id === profileMember.department_id)?.name ?? '—'}
                />
              )}
            </div>
            {canRemove(profileMember) && (
              <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setProfileMember(null); setRemoveModal(profileMember); setRemoveError('') }}
                  style={{ flex: 1, height: 40, borderRadius: 10, border: '1.5px solid #FECACA', background: '#FFFFFF', fontWeight: 600, fontSize: 13, color: '#DC2626', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            )}
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Remove Member Modal ──────────────────────────────────────────── */}
      {removeModal && (
        <ModalOverlay onClose={() => { if (!removeLoading) { setRemoveModal(null); setRemoveError('') } }}>
          <ModalBox>
            <ModalHeader
              title="Remove Member"
              onClose={() => { if (!removeLoading) { setRemoveModal(null); setRemoveError('') } }}
            />
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55, padding: '16px 20px 0' }}>
              Remove <strong>{removeModal.full_name}</strong> from <strong>{companyName}</strong>? They will lose access to this company.
            </p>
            {removeError && (
              <div style={{ margin: '0 20px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>
                {removeError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, padding: '8px 20px 20px' }}>
              <button
                onClick={() => { setRemoveModal(null); setRemoveError('') }}
                disabled={removeLoading}
                style={{ flex: 1, padding: 10, background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: removeLoading ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={removeLoading}
                style={{
                  flex: 1, padding: 10, background: '#DC2626', border: 'none', borderRadius: 8,
                  fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
                  cursor: removeLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  opacity: removeLoading ? 0.65 : 1,
                }}
              >
                {removeLoading && <Spinner size={14} />}
                Remove
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Invite Employee Modal ─────────────────────────────────────────── */}
      {inviteOpen && (
        <ModalOverlay onClose={closeModal}>
          <ModalBox>
            <ModalHeader title="Invite Employee" onClose={closeModal} />
            <div style={{ padding: '20px 20px 0' }}>
              <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 18px', lineHeight: 1.6 }}>
                Send an invitation email to your new team member.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={modalLabelStyle}>Email Address</label>
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  style={modalInputStyle}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={modalLabelStyle}>Department</label>
                {assignedDepts.length <= 1 ? (
                  <div style={{ ...modalInputStyle, color: '#6B7280', background: '#F9FAFB' }}>
                    {assignedDepts[0]?.department_name ?? 'Your department'}
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <select
                      value={inviteDeptId}
                      onChange={e => setInviteDeptId(e.target.value)}
                      style={{ ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer' }}
                    >
                      <option value="">Select a department</option>
                      {assignedDepts.map(d => (
                        <option key={d.department_id} value={d.department_id}>
                          {d.department_name}{d.department_id === primaryDeptId ? ' (Primary)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                )}
              </div>

              {inviteError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#B91C1C', marginTop: 10 }}>
                  {inviteError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '20px 24px', borderTop: '1px solid #F3F4F6', marginTop: 16 }}>
                <button onClick={closeModal} style={{ padding: '7px 18px', background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={handleSendInvite}
                  disabled={sendDisabled}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', border: 'none', borderRadius: 8, background: sendDisabled ? '#93C5FD' : ACCENT, color: '#FFFFFF', fontWeight: 600, fontSize: '0.8125rem', cursor: sendDisabled ? 'not-allowed' : 'pointer' }}
                >
                  {inviteLoading ? <Spinner size={13} light /> : <Check size={13} />}
                  Send Invite
                </button>
              </div>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0F172A', color: '#FFFFFF', borderRadius: 999, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 9999,
          animation: 'fadeSlideUpToast 0.22s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <Check size={15} style={{ color: '#10B981', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </div>
  )
}
