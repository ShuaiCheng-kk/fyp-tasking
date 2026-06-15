'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronDown, Upload, Building2, Network, Crown, UserCog, UserRound, HardHat, Users, UserPlus, Send, Check, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ─── Animated counter ────────────────────────────────────────────────────────

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

// ─── Modal primitives ─────────────────────────────────────────────────────────

const modalKeyframes = `
  @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes modalSlideIn  { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
  @keyframes tabFadeIn     { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeIn        { from { opacity: 0 } to { opacity: 1 } }
`

function ModalOverlay({ children, onClose, maxWidth = '540px' }: { children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        animation: 'overlayFadeIn 0.18s ease-out',
      }}
    >
      <style>{modalKeyframes}</style>
      <div style={{ width: `min(${maxWidth}, calc(100% - 32px))` }}>
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

function ModalHeader({ title, icon, onClose }: { title: string; icon?: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && (
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{title}</h2>
      </div>
      <button
        onClick={onClose}
        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E5E7EB',
  borderRadius: 8,
  fontSize: '0.9375rem',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  fontWeight: 400,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#FFFFFF',
}

const modalLabelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: '#374151',
  marginBottom: '8px',
}

// ─── Custom Dropdown ──────────────────────────────────────────────────────────

function DropdownField({ value, options, onChange, placeholder }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
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

  const handleOpen = () => {
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
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: '#FFFFFF', cursor: 'pointer', fontSize: '0.9375rem',
          color: selected ? '#111827' : '#9CA3AF', fontWeight: selected ? 500 : 400,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', minHeight: 40,
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronDown size={13} style={{ color: '#94A3B8', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div ref={dropdownRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10,
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

// ─── Role avatar config ───────────────────────────────────────────────────────

function RoleAvatar({ role, size = 36 }: { role: string; size?: number }) {
  const cfg: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    Owner:   { bg: '#0F172A', color: '#FFFFFF',  icon: <Crown    size={size * 0.42} /> },
    Partner: { bg: '#0F172A', color: '#FFFFFF',  icon: <Crown    size={size * 0.42} /> },
    Manager: { bg: '#FFF7ED', color: '#EA580C',  icon: <UserCog  size={size * 0.42} /> },
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

// ─── Org Chart sub-components ────────────────────────────────────────────────

function OrgMemberCard({ member, onClick }: { member: TeamMember; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        border: '1px solid #E5E7EB', background: '#FFFFFF',
        cursor: 'pointer', textAlign: 'left',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s',
        minWidth: 180,
        animation: 'memberFadeIn 0.35s ease-out',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.10)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <RoleAvatar role={member.role} size={34} />
      <div>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0 }}>{member.full_name}</p>
        <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: 0 }}>{member.role}</p>
      </div>
    </button>
  )
}

function OrgMemberRow({ member, onClick, onEdit, onRemove }: { member: TeamMember; onClick: () => void; onEdit?: () => void; onRemove?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <button
        onClick={onClick}
        style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid #F3F4F6', background: '#FAFAFA', cursor: 'pointer', textAlign: 'left' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#FAFAFA' }}
      >
        <RoleAvatar role={member.role} size={28} />
        <span style={{ fontWeight: 500, fontSize: '0.8125rem', color: '#111827' }}>{member.full_name}</span>
      </button>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {onEdit && (
          <button onClick={onEdit} style={{ height: 28, padding: '0 8px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#FFFFFF', fontSize: '0.75rem', color: '#6B7280', fontWeight: 500, cursor: 'pointer' }}>Edit</button>
        )}
        {onRemove && (
          <button onClick={onRemove} style={{ height: 28, padding: '0 8px', border: '1px solid #FECACA', borderRadius: 6, background: '#FFFFFF', fontSize: '0.75rem', color: '#DC2626', fontWeight: 500, cursor: 'pointer' }}>Remove</button>
        )}
      </div>
    </div>
  )
}

// ─── Org Chart Node ──────────────────────────────────────────────────────────

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
      <RoleAvatar role={member.role} size={36} />
      <p style={{ fontWeight: 700, fontSize: '0.8125rem', color: dark ? '#FFFFFF' : '#111827', margin: 0, lineHeight: 1.3, textAlign: 'center' }}>{member.full_name}</p>
    </button>
  )
}

// ─── Org Chart Tree ───────────────────────────────────────────────────────────

type OrgChartTreeProps = {
  topMembers: TeamMember[]
  departments: { id: string; name: string }[]
  teamMembers: TeamMember[]
  onMemberClick: (m: TeamMember) => void
}

const LINE_COLOR = '#CBD5E1'
const NODE_W    = 140   // node width inside dept column
const LEADER_W  = 160   // leadership node width
const LEADER_GAP = 16   // gap between leadership nodes
const MGR_GAP   = 12    // horizontal gap between managers in same dept
const EMP_GAP   = 8     // vertical gap between employees
const DEPT_PAD  = 12    // horizontal padding inside dept box
const DEPT_GAP  = 20    // gap between dept columns
const OUTER_H   = 48    // SVG height: leadership → dept cols
const INNER_H   = 30    // SVG height: dept header → managers
const M2E_H     = 16    // connector height: managers → employees

function OrgChartTree({ topMembers, departments, teamMembers, onMemberClick }: OrgChartTreeProps) {
  // Sort departments A→Z (left to right)
  const sortedDepts = [...departments].sort((a, b) => a.name.localeCompare(b.name))

  const deptCols = sortedDepts.map(dept => ({
    dept,
    managers: teamMembers.filter(m => m.role === 'Manager' && m.department_id === dept.id),
    employees: teamMembers.filter(m => m.role === 'Employee' && m.department_id === dept.id),
  }))

  // Each dept column width: fit all managers side-by-side + padding
  const deptInnerWs = deptCols.map(({ managers }) =>
    Math.max(NODE_W, managers.length * NODE_W + (managers.length - 1) * MGR_GAP)
  )
  const deptColWs = deptInnerWs.map(w => w + 2 * DEPT_PAD)

  // Total dept row width
  const totalDeptW = deptColWs.reduce((s, w) => s + w, 0) + (deptCols.length - 1) * DEPT_GAP

  // Owner in centre, partners split left/right
  const owners   = topMembers.filter(m => m.role === 'Owner')
  const partners = topMembers.filter(m => m.role === 'Partner')
  const leftPartners  = partners.slice(0, Math.floor(partners.length / 2))
  const rightPartners = partners.slice(Math.floor(partners.length / 2))
  const orderedLeaders = [...leftPartners, ...owners, ...rightPartners]

  // Leadership row width
  const topCount   = orderedLeaders.length
  const leaderRowW = topCount * LEADER_W + (topCount - 1) * LEADER_GAP

  // Fixed container width — large enough for both rows
  const totalW = Math.max(totalDeptW, leaderRowW + 60)

  // Dept column left-edge positions (centered within totalW)
  const deptRowStartX = (totalW - totalDeptW) / 2
  const deptColStartXs: number[] = []
  let x = deptRowStartX
  for (const w of deptColWs) { deptColStartXs.push(x); x += w + DEPT_GAP }

  // Dept column center Xs (for outer SVG connector)
  const deptCenterXs = deptCols.map((_, i) => deptColStartXs[i] + deptColWs[i] / 2)

  // Owner pinned to totalW/2; place leader row symmetrically around it
  const ownerIdxInOrdered = orderedLeaders.findIndex(m => m.role === 'Owner')
  const leaderRowStartX2 = totalW / 2 - (ownerIdxInOrdered >= 0 ? ownerIdxInOrdered : 0) * (LEADER_W + LEADER_GAP) - LEADER_W / 2

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8, paddingTop: 8 }}>
      <div style={{ width: totalW, margin: '0 auto' }}>

        {/* ── Row 1: Leadership — Owner pinned to totalW/2 ── */}
        <div style={{ position: 'relative', height: 80, flexShrink: 0 }}>
          {orderedLeaders.map((m, i) => (
            <div key={m.id} style={{
              position: 'absolute',
              left: leaderRowStartX2 + i * (LEADER_W + LEADER_GAP),
              top: 0,
              width: LEADER_W,
            }}>
              <OrgNode member={m} onClick={() => onMemberClick(m)} />
            </div>
          ))}
        </div>

        {/* ── SVG: leadership → dept columns ── */}
        {deptCols.length > 0 && topMembers.length > 0 && (
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

        {/* ── Row 2: Dept columns ── */}
        {deptCols.length > 0 && (
          <div style={{ display: 'flex', gap: DEPT_GAP, alignItems: 'flex-start', justifyContent: 'center' }}>
            {deptCols.map(({ dept, managers, employees }, di) => {
              const colW     = deptColWs[di]
              const innerW   = deptInnerWs[di]
              // Manager center Xs relative to left edge of colW (accounting for DEPT_PAD)
              const offsetX  = (colW - innerW) / 2
              const mgrCXs   = managers.map((_, mi) => offsetX + mi * (NODE_W + MGR_GAP) + NODE_W / 2)

              return (
                <div key={dept.id} style={{
                  width: colW, flexShrink: 0,
                  border: '1.5px solid #E5E7EB',
                  borderRadius: 14,
                  background: '#FFFFFF',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  overflow: 'hidden',
                }}>

                  {/* Dept header */}
                  <div style={{ width: '100%', padding: '9px 12px', background: '#F9FAFB', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>{dept.name}</span>
                  </div>

                  {/* SVG: dept header → managers (fan-out) */}
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

                  {/* Managers — horizontal row */}
                  {managers.length > 0 && (
                    <div style={{ display: 'flex', gap: MGR_GAP, flexShrink: 0, marginBottom: employees.length === 0 ? DEPT_PAD : 0 }}>
                      {managers.map(m => (
                        <div key={m.id} style={{ width: NODE_W }}>
                          <OrgNode member={m} onClick={() => onMemberClick(m)} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Connector: managers → employees */}
                  {employees.length > 0 && (
                    <div style={{ width: 1.5, height: M2E_H, background: LINE_COLOR, flexShrink: 0 }} />
                  )}

                  {/* Employees — vertical list, no extra border (dept box already frames them) */}
                  {employees.length > 0 && (
                    <div style={{
                      margin: `0 ${DEPT_PAD}px ${DEPT_PAD}px`,
                      display: 'flex', flexDirection: 'column', gap: EMP_GAP,
                      width: `calc(100% - ${DEPT_PAD * 2}px)`,
                      boxSizing: 'border-box',
                    }}>
                      {employees.map(m => (
                        <OrgNode key={m.id} member={m} onClick={() => onMemberClick(m)} />
                      ))}
                    </div>
                  )}

                  {managers.length === 0 && employees.length === 0 && (
                    <div style={{ height: 36 }} />
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

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontWeight: 600, fontSize: '0.6875rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontWeight: 500, fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{value}</p>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OwnedCompany = { id: string; name: string }
type Department = { id: string; name: string }
type Manager = { id: string; full_name: string }
type TeamMember = {
  id: string
  full_name: string
  email_address: string
  phone_number: string | null
  role: string
  department_id: string | null
  worker_status?: string | null
}
type ChangeDeptModal = { member: TeamMember } | null
type ManageDeptModal = { member: TeamMember } | null
type EditManagerModal = { member: TeamMember } | null
type MemberImportPreview = { email: string; role: 'Partner' | 'Manager' | 'Employee'; department_name: string | null }

const ROLE_LABEL: Record<string, string> = {
  Owner: 'OWNER',
  Partner: 'PARTNER',
  Manager: 'MANAGER',
  Employee: 'EMPLOYEE',
  'Casual Worker': 'CASUAL WORKER',
}

function parseMemberImportCsv(text: string): MemberImportPreview[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const withoutHeader = lines[0]?.toLowerCase().includes('email') ? lines.slice(1) : lines
  return withoutHeader.map(line => {
    const [email = '', role = '', department = ''] = line.split(',').map(cell => cell.trim())
    const normalizedRole: MemberImportPreview['role'] = role.toLowerCase() === 'partner' ? 'Partner' : role.toLowerCase() === 'manager' ? 'Manager' : 'Employee'
    return { email, role: normalizedRole, department_name: department || null }
  }).filter(row => row.email)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyOwnerId, setCompanyOwnerId] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [companyName,        setCompanyName]        = useState('')
  const [ownerName,          setOwnerName]          = useState('')
  const [currentPlan,        setCurrentPlan]        = useState('Free')
  const [companyProfile,     setCompanyProfile]     = useState<{ description: string | null; location: string | null; address: string | null; postal_code: string | null; industry: string | null; size: string | null } | null>(null)
  const [editProfileOpen,    setEditProfileOpen]    = useState(false)
  const [editProfileName,    setEditProfileName]    = useState('')
  const [editProfileDesc,    setEditProfileDesc]    = useState('')
  const [editProfileLoc,     setEditProfileLoc]     = useState('')
  const [editProfileAddress, setEditProfileAddress] = useState('')
  const [editProfilePostal,  setEditProfilePostal]  = useState('')
  const [editProfileIndustry,     setEditProfileIndustry]     = useState('')
  const [editProfileIndustryOther,setEditProfileIndustryOther] = useState('')
  const [editProfileSize,         setEditProfileSize]          = useState('')
  const [editProfileLoading, setEditProfileLoading] = useState(false)
  const [editProfileError,   setEditProfileError]   = useState('')

  const INDUSTRIES = ['Retail', 'F&B', 'Logistics', 'Event Management', 'Healthcare', 'Education', 'Technology', 'Finance', 'Construction', 'Hospitality', 'Manufacturing', 'Other']
  const SIZES = ['1-10', '11-50', '51-200', '200+']

  // Team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)

  // Modal state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('')

  // Company picker
  const [ownedCompanies, setOwnedCompanies] = useState<OwnedCompany[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [companiesLoading, setCompaniesLoading] = useState(false)

  // Department picker
  const [inviteDeptId, setInviteDeptId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])

  // Manager picker
  const [inviteManagerId, setInviteManagerId] = useState('')
  const [managers, setManagers] = useState<Manager[]>([])
  const [managersLoading, setManagersLoading] = useState(false)

  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [memberImportOpen, setMemberImportOpen] = useState(false)
  const [memberImportRows, setMemberImportRows] = useState<MemberImportPreview[]>([])
  const [memberImportLoading, setMemberImportLoading] = useState(false)
  const [memberImportError, setMemberImportError] = useState('')
  const [memberImportResult, setMemberImportResult] = useState('')
  const [inviteTab, setInviteTab] = useState<'manual' | 'import'>('manual')


  // Current user's role (to gate Edit buttons)
  const [currentUserRole, setCurrentUserRole] = useState('')
  const [userDeptId, setUserDeptId] = useState('')

  // Departments for the whole company (for display + change dept modal)
  const [companyDepartments, setCompanyDepartments] = useState<Department[]>([])

  // Change Department modal
  const [changeDeptModal, setChangeDeptModal] = useState<ChangeDeptModal>(null)
  const [changeDeptSelectedId, setChangeDeptSelectedId] = useState('')
  const [changeDeptLoading, setChangeDeptLoading] = useState(false)
  const [changeDeptError, setChangeDeptError] = useState('')

  // Remove Member modal
  const [removeModal, setRemoveModal] = useState<TeamMember | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState('')

  // Account deleted modal (shown when removed from last company)
  const [accountDeletedModal] = useState(false)

  // Manage Departments modal (legacy — kept for internal logic reuse)
  const [manageDeptModal, setManageDeptModal] = useState<ManageDeptModal>(null)
  const [manageDeptAssigned, setManageDeptAssigned] = useState<{ department_id: string; department_name: string }[]>([])
  const [manageDeptChecked, setManageDeptChecked] = useState<Set<string>>(new Set())
  const [manageDeptLoading, setManageDeptLoading] = useState(false)
  const [manageDeptSaving, setManageDeptSaving] = useState(false)
  const [manageDeptToast, setManageDeptToast] = useState('')

  // Profile modal
  const [profileMember, setProfileMember] = useState<TeamMember | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // Edit Manager modal (combined home dept + dept access)
  const [editManagerModal, setEditManagerModal] = useState<EditManagerModal>(null)
  const [editHomeDeptId, setEditHomeDeptId] = useState('')
  const [editDeptChecked, setEditDeptChecked] = useState<Set<string>>(new Set())
  const [editDeptAssigned, setEditDeptAssigned] = useState<{ department_id: string; department_name: string }[]>([])
  const [editDeptLoading, setEditDeptLoading] = useState(false)
  const [editManagerSaving, setEditManagerSaving] = useState(false)
  const [editManagerError, setEditManagerError] = useState('')

  const resetModal = useCallback(() => {
    setInviteEmail('')
    setInviteRole('')
    setSelectedCompanyId('')
    setOwnedCompanies([])
    setInviteDeptId('')
    setDepartments([])
    setInviteManagerId('')
    setManagers([])
    setInviteError('')
    setInviteSuccess('')
    setMemberImportRows([])
    setMemberImportError('')
    setMemberImportResult('')
    setInviteTab('manual')
  }, [])

  const closeModal = useCallback(() => {
    setInviteOpen(false)
    resetModal()
  }, [resetModal])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeModal])

  const fetchTeamMembers = useCallback(async (cid: string) => {
    if (!cid) return
    setTeamLoading(true)
    try {
      const res = await fetch(`/api/team/members?company_id=${cid}`)
      const data = await res.json()
      if (data.success) { setTeamMembers(data.members); setLastRefreshed(new Date()) }
    } catch {}
    finally { setTeamLoading(false) }
  }, [])

  // Realtime: auto-refresh team list when a new user joins the company
  useEffect(() => {
    if (!companyId) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const channel = supabase
      .channel(`team-members-${companyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `company_id=eq.${companyId}`,
      }, () => {
        fetchTeamMembers(companyId)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId, fetchTeamMembers])

  const handleMemberImportFile = async (file: File | null) => {
    setMemberImportError('')
    setMemberImportResult('')
    if (!file) return
    const text = await file.text()
    const rows = parseMemberImportCsv(text)
    setMemberImportRows(rows)
    if (rows.length === 0) setMemberImportError('No valid member rows found.')
  }

  const confirmMemberImport = async () => {
    if (!companyId || !internalUserId || memberImportRows.length === 0) return
    setMemberImportLoading(true)
    setMemberImportError('')
    setMemberImportResult('')
    try {
      const res = await fetch('/api/import/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, invited_by: internalUserId, members: memberImportRows }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to import members')
      const invited = data.result?.invited?.length ?? 0
      const failed = data.result?.failed?.length ?? 0
      setMemberImportResult(`${invited} invitation(s) sent. ${failed} failed.`)
      await fetchTeamMembers(companyId)
    } catch (err) {
      setMemberImportError(err instanceof Error ? err.message : 'Failed to import members')
    } finally {
      setMemberImportLoading(false)
    }
  }

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
      if (!uid) {
        router.replace('/signin')
        return
      }
      if (cancelled) return
      setUserId(uid)

      fetch(`/api/user/me?user_id=${uid}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setInternalUserId(d.user.id)
            setOwnerEmail(d.user.email_address)
            setCurrentUserRole(d.user.role)
            setUserDeptId(d.user.department_id || '')
            if (d.user?.full_name) setOwnerName(d.user.full_name)
          }
        })
        .catch(() => {})

      let storedCid = localStorage.getItem(`tasking_company_id_${uid}`) || ''

      if (!storedCid) {
        // Fallback 1: fetch from /api/user/me (works for invited users)
        try {
          const meRes = await fetch(`/api/user/me?user_id=${uid}`)
          const meData = await meRes.json()
          if (meData.success && meData.user?.company_id) {
            storedCid = meData.user.company_id
            localStorage.setItem(`tasking_company_id_${uid}`, storedCid)
          }
        } catch {}
      }

      if (!storedCid) {
        // Fallback 2: fetch default company for owner
        try {
          const res = await fetch(`/api/company/by-owner?owner_id=${uid}`)
          const d = await res.json()
          if (cancelled) return
          if (d.success && d.company) {
            storedCid = d.company.id
            localStorage.setItem(`tasking_company_id_${uid}`, storedCid)
          }
        } catch {}
      }

      if (storedCid) {
        setCompanyId(storedCid)
        fetchTeamMembers(storedCid)
        try {
          const params = new URLSearchParams({ user_id: uid, company_id: storedCid })
          const [companyRes, deptRes] = await Promise.all([
            fetch(`/api/company/current?${params}`),
            fetch(`/api/company/departments?company_id=${storedCid}`),
          ])
          const companyData = await companyRes.json()
          const deptData = await deptRes.json()
          if (!cancelled && companyData.success && companyData.company?.name) {
            setCompanyName(companyData.company.name)
            setCompanyOwnerId(companyData.company.owner_id || '')
            setCurrentPlan(companyData.company.plan ?? 'Free')
            setCompanyProfile({
              description: companyData.company.description ?? null,
              location: companyData.company.location ?? null,
              address: companyData.company.address ?? null,
              postal_code: companyData.company.postal_code ?? null,
              industry: companyData.company.industry ?? null,
              size: companyData.company.size ?? null,
            })
          }
          if (!cancelled && deptData.success) setCompanyDepartments(deptData.departments)
        } catch {}
      }
    }
    void run()
    return () => { cancelled = true }
  }, [fetchTeamMembers, router])

  const handleEditProfile = async () => {
    if (!editProfileName.trim()) return
    setEditProfileLoading(true); setEditProfileError('')
    try {
      const res = await fetch('/api/company/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          name: editProfileName.trim(),
          description: editProfileDesc || null,
          location: editProfileLoc || null,
          address: editProfileAddress || null,
          postal_code: editProfilePostal || null,
          industry: editProfileIndustry === 'Other' ? (editProfileIndustryOther.trim() || null) : (editProfileIndustry || null),
          size: editProfileSize || null,
          website: null,
          logo_url: null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      const savedIndustry = editProfileIndustry === 'Other' ? (editProfileIndustryOther.trim() || null) : (editProfileIndustry || null)
      setCompanyName(editProfileName.trim())
      setCompanyProfile({ description: editProfileDesc || null, location: editProfileLoc || null, address: editProfileAddress || null, postal_code: editProfilePostal || null, industry: savedIndustry, size: editProfileSize || null })
      setEditProfileOpen(false)
    } catch (err) { setEditProfileError(err instanceof Error ? err.message : 'Failed to update') }
    finally { setEditProfileLoading(false) }
  }

  // When invite modal opens: lock to the current company page
  useEffect(() => {
    if (!inviteOpen) return
    setSelectedCompanyId(companyId)
  }, [inviteOpen, companyId])


  const openInviteModal = () => {
    setSelectedCompanyId(companyId)
    if (currentUserRole === 'Manager') {
      setInviteRole('Employee')
      setInviteDeptId(userDeptId)
      if (companyId && userDeptId) fetchManagers(companyId, userDeptId)
    }
    setInviteOpen(true)
  }

  const fetchDepts = async (companyId: string) => {
    setDepartments([])
    setInviteDeptId('')
    setManagers([])
    setInviteManagerId('')
    try {
      const res = await fetch(`/api/company/departments?company_id=${companyId}`)
      const data = await res.json()
      if (data.success) setDepartments(data.departments)
    } catch {}
  }

  const fetchManagers = async (companyId: string, deptId: string) => {
    setManagersLoading(true)
    setManagers([])
    setInviteManagerId('')
    try {
      const res = await fetch(`/api/company/managers?company_id=${companyId}&department_id=${deptId}`)
      const data = await res.json()
      if (data.success) setManagers(data.managers)
    } catch {}
    finally { setManagersLoading(false) }
  }

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId)
    setInviteDeptId('')
    setDepartments([])
    setManagers([])
    setInviteManagerId('')
    if (companyId && (inviteRole === 'Manager' || inviteRole === 'Employee')) {
      fetchDepts(companyId)
    }
  }

  const handleRoleChange = (role: string) => {
    setInviteRole(role)
    setInviteDeptId('')
    setDepartments([])
    setManagers([])
    setInviteManagerId('')
    if (companyId && (role === 'Manager' || role === 'Employee')) {
      fetchDepts(companyId)
    }
  }

  const handleDeptChange = (deptId: string) => {
    setInviteDeptId(deptId)
    setInviteManagerId('')
    setManagers([])
    if (inviteRole === 'Employee' && deptId && selectedCompanyId) {
      fetchManagers(selectedCompanyId, deptId)
    }
  }

  const noManagersInDept = inviteRole === 'Employee' && !!inviteDeptId && !managersLoading && managers.length === 0
  const showDept = (inviteRole === 'Manager' || inviteRole === 'Employee') && !!companyId
  const showReportingManager = inviteRole === 'Employee' && !!inviteDeptId

  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteRole) {
      setInviteError('Email and role are required.')
      return
    }
    if (ownerEmail && inviteEmail.toLowerCase() === ownerEmail.toLowerCase()) {
      setInviteError('You cannot send an invitation to yourself.')
      return
    }
    if (!selectedCompanyId) {
      setInviteError('Please select a company.')
      return
    }
    if ((inviteRole === 'Manager' || inviteRole === 'Employee') && !inviteDeptId) {
      setInviteError('Please select a department.')
      return
    }
    setInviteLoading(true)
    setInviteError('')
    try {
      const res = await fetch('/api/invitation/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          company_id: selectedCompanyId,
          department_id: inviteRole === 'partner' ? null : (inviteDeptId || null),
          invited_by: userId,
          reporting_manager_id: inviteRole === 'Employee' ? (inviteManagerId || null) : null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleChangeDept = async () => {
    if (!changeDeptModal || !changeDeptSelectedId) return
    setChangeDeptLoading(true)
    setChangeDeptError('')
    try {
      const res = await fetch('/api/user/update-department', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: changeDeptModal.member.id, department_id: changeDeptSelectedId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setChangeDeptModal(null)
      setChangeDeptSelectedId('')
      fetchTeamMembers(companyId)
    } catch (err) {
      setChangeDeptError(err instanceof Error ? err.message : 'Failed to update department')
    } finally {
      setChangeDeptLoading(false)
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

  const handleAccountDeletedExit = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    localStorage.clear()
    await supabase.auth.signOut()
    router.replace('/')
  }

  const openManageDeptModal = async (member: TeamMember) => {
    setManageDeptModal({ member })
    setManageDeptToast('')
    setManageDeptLoading(true)
    try {
      const res = await fetch(`/api/manager/departments?manager_id=${member.id}&company_id=${companyId}`)
      const data = await res.json()
      if (data.success) {
        setManageDeptAssigned(data.departments)
        setManageDeptChecked(new Set(data.departments.map((d: { department_id: string }) => d.department_id)))
      }
    } catch {}
    finally { setManageDeptLoading(false) }
  }
  void openManageDeptModal

  const handleManageDeptToggle = (deptId: string) => {
    if (!manageDeptModal) return
    if (deptId === manageDeptModal.member.department_id) return // primary — cannot uncheck
    setManageDeptChecked(prev => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  const handleManageDeptSave = async () => {
    if (!manageDeptModal) return
    const member = manageDeptModal.member
    const originalIds = new Set(manageDeptAssigned.map(d => d.department_id))
    const toAdd = [...manageDeptChecked].filter(id => !originalIds.has(id))
    const toRemove = [...originalIds].filter(id => !manageDeptChecked.has(id))
    setManageDeptSaving(true)
    try {
      await Promise.all([
        ...toAdd.map(dept_id =>
          fetch('/api/manager/departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manager_id: member.id, company_id: companyId, department_id: dept_id, assigned_by: internalUserId }),
          })
        ),
        ...toRemove.map(dept_id =>
          fetch('/api/manager/departments', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manager_id: member.id, department_id: dept_id }),
          })
        ),
      ])
      setManageDeptToast('Departments updated')
      setTimeout(() => {
        setManageDeptModal(null)
        setManageDeptToast('')
      }, 1200)
    } catch {}
    finally { setManageDeptSaving(false) }
  }

  const openEditManagerModal = async (member: TeamMember) => {
    setEditManagerModal({ member })
    setEditHomeDeptId(member.department_id ?? '')
    setEditManagerError('')
    setEditDeptLoading(true)
    try {
      const res = await fetch(`/api/manager/departments?manager_id=${member.id}&company_id=${companyId}`)
      const data = await res.json()
      if (data.success) {
        setEditDeptAssigned(data.departments)
        setEditDeptChecked(new Set(data.departments.map((d: { department_id: string }) => d.department_id)))
      }
    } catch {}
    finally { setEditDeptLoading(false) }
  }

  const handleEditDeptToggle = (deptId: string) => {
    setEditDeptChecked(prev => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  const handleEditManagerSave = async () => {
    if (!editManagerModal) return
    const member = editManagerModal.member
    setEditManagerSaving(true)
    setEditManagerError('')
    try {
      const originalIds = new Set(editDeptAssigned.map(d => d.department_id))
      const toAdd = [...editDeptChecked].filter(id => !originalIds.has(id))
      const toRemove = [...originalIds].filter(id => !editDeptChecked.has(id))

      await Promise.all([
        // Home department
        fetch('/api/user/update-department', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: member.id, department_id: editHomeDeptId }),
        }),
        // Department access additions
        ...toAdd.map(dept_id =>
          fetch('/api/manager/departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manager_id: member.id, company_id: companyId, department_id: dept_id, assigned_by: internalUserId }),
          })
        ),
        // Department access removals
        ...toRemove.map(dept_id =>
          fetch('/api/manager/departments', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manager_id: member.id, department_id: dept_id }),
          })
        ),
      ])
      setEditManagerModal(null)
      fetchTeamMembers(companyId)
    } catch (err) {
      setEditManagerError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setEditManagerSaving(false)
    }
  }

  const isCreator = !!internalUserId && !!companyOwnerId && internalUserId === companyOwnerId

  const canRemove = (member: TeamMember): boolean => {
    if (member.id === internalUserId) return false
    if (member.id === companyOwnerId) return false
    if (isCreator) return true
    // Partner (Owner role but not creator) can only remove Manager/Employee
    if (currentUserRole === 'Owner' && member.role !== 'Owner') return true
    return false
  }

  const sendDisabled = inviteLoading ||
    !inviteEmail.trim() ||
    !inviteRole ||
    ((inviteRole === 'Manager' || inviteRole === 'Employee') && !inviteDeptId)

  const partnerCount      = teamMembers.filter(m => m.role === 'Partner').length
  const managerCount      = teamMembers.filter(m => m.role === 'Manager').length
  const employeeCount     = teamMembers.filter(m => m.role === 'Employee').length
  const casualWorkerCount = teamMembers.filter(m => m.role === 'Casual Worker').length
  const totalInternal     = managerCount + employeeCount

  function timeAgo(ts: string): string {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F1F5F9', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes memberFadeIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-line {
          border-radius: 6px;
          background: linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite linear;
        }
        @keyframes dotPulse {
          0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0.55); }
          70%  { box-shadow: 0 0 0 5px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
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
          box-shadow: 0 8px 28px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(249,115,22,0.18) !important;
          transform: translateY(-3px) scale(1.015);
        }
        .team-stat-card:hover .stat-icon { animation: iconBounce 0.5s ease forwards; }
        .team-stat-card:nth-child(1) { animation: fadeSlideUp 0.36s ease both 0.04s; }
        .team-stat-card:nth-child(2) { animation: fadeSlideUp 0.36s ease both 0.08s; }
        .team-stat-card:nth-child(3) { animation: fadeSlideUp 0.36s ease both 0.12s; }
        .team-stat-card:nth-child(4) { animation: fadeSlideUp 0.36s ease both 0.16s; }
        .team-stat-card:nth-child(5) { animation: fadeSlideUp 0.36s ease both 0.20s; }
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
          position: relative;
          z-index: 0;
        }
        .org-node-btn:hover {
          box-shadow: 0 6px 18px rgba(0,0,0,0.13) !important;
          transform: translateY(-2px) scale(1.02) !important;
          z-index: 10;
        }
      `}</style>
      <OwnerSidebar />

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

        <div style={{ padding: '16px 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* ── Stat cards ─────────────────────────────────────────────────── */}
          {companyId && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                {
                  label: 'Total Staff',
                  value: teamLoading ? null : totalInternal,
                  icon: <Users size={16} style={{ color: '#F97316' }} />,
                  accentBg: '#FFF7ED',
                },
                {
                  label: 'Departments',
                  value: teamLoading ? null : companyDepartments.length,
                  icon: <Building2 size={16} style={{ color: '#3B82F6' }} />,
                  accentBg: '#EFF6FF',
                },
                {
                  label: 'Managers',
                  value: teamLoading ? null : managerCount,
                  icon: <UserCog size={16} style={{ color: '#EA580C' }} />,
                  accentBg: '#FFF7ED',
                },
                {
                  label: 'Employees',
                  value: teamLoading ? null : employeeCount,
                  icon: <UserRound size={16} style={{ color: '#6B7280' }} />,
                  accentBg: '#F3F4F6',
                },
                {
                  label: 'Casual Workers',
                  value: teamLoading ? null : casualWorkerCount,
                  icon: <HardHat size={16} style={{ color: '#2563EB' }} />,
                  accentBg: '#EFF6FF',
                },
              ].map(card => (
                <article key={card.label} className="team-stat-card" style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: '16px 18px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{card.label}</p>
                    <div className="stat-icon" style={{ width: 32, height: 32, borderRadius: 10, background: card.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {card.icon}
                    </div>
                  </div>
                  <p style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, margin: 0, letterSpacing: '-0.5px' }}>
                    {card.value === null ? <Spinner size={14} dark /> : <AnimatedNumber value={card.value} />}
                  </p>
                </article>
              ))}
            </div>
          )}

          {/* Partners badge row (if any) */}
          {partnerCount > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '10px 16px', background: '#0F172A', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.12)', animation: 'fadeSlideUp 0.4s ease both 0.28s', width: 'fit-content' }}>
              <Crown size={14} style={{ color: '#F97316', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
                {partnerCount} Partner{partnerCount !== 1 ? 's' : ''} in this company
              </span>
            </div>
          )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── COMPANY PROFILE CARD ──────────────────────────────────────────── */}
          <div className="team-panel-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={15} style={{ color: '#F97316' }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>My Company</span>
            </div>
            {/* Loading skeleton or real content */}
            {!companyName ? (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div className="skeleton-line" style={{ height: 18, width: '40%' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="skeleton-line" style={{ height: 32, width: 60, borderRadius: 8 }} />
                  <div className="skeleton-line" style={{ height: 32, width: 72, borderRadius: 8 }} />
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{companyName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {isCreator && (
                    <button
                      onClick={() => {
                        setEditProfileName(companyName)
                        setEditProfileDesc(companyProfile?.description ?? '')
                        setEditProfileLoc(companyProfile?.location ?? '')
                        setEditProfileAddress(companyProfile?.address ?? '')
                        setEditProfilePostal(companyProfile?.postal_code ?? '')
                        const savedIndustry = companyProfile?.industry ?? ''
                        const knownIndustries = ['Retail', 'F&B', 'Logistics', 'Event Management', 'Healthcare', 'Education', 'Technology', 'Finance', 'Construction', 'Hospitality', 'Manufacturing', 'Other']
                        if (savedIndustry && !knownIndustries.includes(savedIndustry)) {
                          setEditProfileIndustry('Other')
                          setEditProfileIndustryOther(savedIndustry)
                        } else {
                          setEditProfileIndustry(savedIndustry)
                          setEditProfileIndustryOther('')
                        }
                        setEditProfileSize(companyProfile?.size ?? '')
                        setEditProfileError('')
                        setEditProfileOpen(true)
                      }}
                      style={{ padding: '7px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', background: 'none', fontWeight: 600, fontSize: '0.875rem', color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#9CA3AF' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => { setInviteTab('manual'); openInviteModal() }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', border: 'none', borderRadius: '8px', background: '#F97316', fontWeight: 700, fontSize: '0.875rem', color: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#EA6C0A' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#F97316' }}
                  >
                    <Plus size={14} strokeWidth={2.5} /> Invite
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── ORG CHART ─────────────────────────────────────────────────────── */}
          <div className="team-panel-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Network size={15} style={{ color: '#F97316' }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>Organisation Chart</span>
            </div>

            {teamLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: '0.9375rem' }}>
                <Spinner size={16} dark /> Loading…
              </div>
            ) : (
              <OrgChartTree
                topMembers={teamMembers.filter(m => m.role === 'Owner' || m.role === 'Partner')}
                departments={companyDepartments}
                teamMembers={teamMembers}
                onMemberClick={(m) => setProfileMember(m)}
              />
            )}
          </div>

          {/* ── CASUAL WORKERS ────────────────────────────────────────────────── */}
          {(() => {
            const casualWorkers = teamMembers.filter(m => m.role === 'Casual Worker')
            return (
              <div className="team-panel-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <HardHat size={15} style={{ color: '#2563EB' }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>Casual Workers</span>
                </div>

                {teamLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                    <Spinner size={16} dark />
                  </div>
                ) : casualWorkers.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <HardHat size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No casual workers have joined yet</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                    {casualWorkers.map(worker => {
                      const deptName = worker.department_id
                        ? companyDepartments.find(d => d.id === worker.department_id)?.name ?? null
                        : null
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
                            border: '1.5px solid #DBEAFE', background: '#F8FBFF',
                            cursor: 'pointer', textAlign: 'left',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'box-shadow 0.15s',
                            animation: 'memberFadeIn 0.35s ease-out',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 10px rgba(37,99,235,0.12)' }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
                        >
                          <RoleAvatar role="Casual Worker" size={36} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{worker.full_name}</p>
                            <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {deptName ?? worker.email_address}
                            </p>
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
            )
          })()}
        </div>
        </div>
      </main>

      {/* ── Edit Manager Modal ──────────────────────────────────────────── */}
      {editManagerModal && (
        <ModalOverlay onClose={() => { if (!editManagerSaving) { setEditManagerModal(null); setEditManagerError('') } }}>
          <ModalBox>
            <ModalHeader
              title="Edit Manager"
              onClose={() => { if (!editManagerSaving) { setEditManagerModal(null); setEditManagerError('') } }}
            />

            {/* Section 1 — Home Department */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: '0 0 2px' }}>Home Department</p>
              <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '0 0 10px' }}>The department this manager belongs to</p>
              <div style={{ position: 'relative' }}>
                <select
                  value={editHomeDeptId}
                  onChange={(e) => setEditHomeDeptId(e.target.value)}
                  style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">Select a department</option>
                  {companyDepartments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Section 2 — Department Access */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: '0 0 2px' }}>Department Access</p>
              <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '0 0 10px' }}>Departments this manager can view and manage</p>
              {editDeptLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '0.875rem', padding: '8px 0' }}>
                  <Spinner size={14} dark /> Loading…
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {companyDepartments.map((dept) => {
                    const checked = editDeptChecked.has(dept.id)
                    return (
                      <label key={dept.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: '8px',
                        border: `1.5px solid ${checked ? '#BFDBFE' : '#E5E7EB'}`,
                        background: checked ? '#F0F9FF' : '#FFFFFF',
                        cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleEditDeptToggle(dept.id)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#3B82F6' }}
                        />
                        <span style={{ fontSize: '0.9rem', color: '#111827', fontWeight: checked ? 600 : 400 }}>
                          {dept.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {editManagerError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginBottom: '12px' }}>
                {editManagerError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setEditManagerModal(null); setEditManagerError('') }}
                disabled={editManagerSaving}
                style={{ flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: editManagerSaving ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditManagerSave}
                disabled={editManagerSaving || editDeptLoading || !editHomeDeptId}
                style={{
                  flex: 1, padding: '10px', background: '#111827', border: 'none', borderRadius: '8px',
                  fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
                  cursor: (editManagerSaving || editDeptLoading || !editHomeDeptId) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  opacity: (editManagerSaving || editDeptLoading || !editHomeDeptId) ? 0.65 : 1,
                }}
              >
                {editManagerSaving && <Spinner size={14} />}
                Save Changes
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Change Department Modal ──────────────────────────────────────── */}
      {changeDeptModal && (
        <ModalOverlay onClose={() => { setChangeDeptModal(null); setChangeDeptSelectedId(''); setChangeDeptError('') }}>
          <ModalBox>
            <ModalHeader
              title="Change Department"
              onClose={() => { setChangeDeptModal(null); setChangeDeptSelectedId(''); setChangeDeptError('') }}
            />
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
              Move <strong>{changeDeptModal.member.full_name}</strong> to a different department.
            </p>
            {companyDepartments.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', margin: '8px 0 16px' }}>
                No departments found.
              </p>
            ) : (
              <>
                <label style={modalLabelStyle}>Department</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={changeDeptSelectedId}
                    onChange={(e) => setChangeDeptSelectedId(e.target.value)}
                    style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select a department</option>
                    {companyDepartments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </>
            )}
            {changeDeptError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginTop: '12px' }}>
                {changeDeptError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => { setChangeDeptModal(null); setChangeDeptSelectedId(''); setChangeDeptError('') }}
                style={{ flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleChangeDept}
                disabled={changeDeptLoading || !changeDeptSelectedId}
                style={{
                  flex: 1, padding: '10px', background: '#111827', border: 'none', borderRadius: '8px',
                  fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
                  cursor: (changeDeptLoading || !changeDeptSelectedId) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  opacity: (changeDeptLoading || !changeDeptSelectedId) ? 0.65 : 1,
                }}
              >
                {changeDeptLoading && <Spinner size={14} />}
                Save
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Manage Departments Modal ─────────────────────────────────────── */}
      {manageDeptModal && (
        <div
          onClick={() => { if (!manageDeptSaving) { setManageDeptModal(null); setManageDeptToast('') } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '560px' }}>
            <ModalBox>
              <ModalHeader
                title={`Manage Departments — ${manageDeptModal.member.full_name}`}
                onClose={() => { if (!manageDeptSaving) { setManageDeptModal(null); setManageDeptToast('') } }}
              />
              <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
                Select which departments this manager can access. The primary department cannot be removed.
              </p>

              {manageDeptLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '0.875rem', padding: '8px 0' }}>
                  <Spinner size={14} dark /> Loading…
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {companyDepartments.map((dept) => {
                      const isPrimary = dept.id === manageDeptModal.member.department_id
                      const checked = manageDeptChecked.has(dept.id)
                      return (
                        <label key={dept.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px', borderRadius: '8px',
                          border: `1.5px solid ${checked ? '#BFDBFE' : '#E5E7EB'}`,
                          background: checked ? '#F0F9FF' : '#FFFFFF',
                          cursor: isPrimary ? 'not-allowed' : 'pointer',
                          opacity: isPrimary ? 0.8 : 1,
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isPrimary}
                            onChange={() => handleManageDeptToggle(dept.id)}
                            style={{ width: 16, height: 16, cursor: isPrimary ? 'not-allowed' : 'pointer', accentColor: '#3B82F6' }}
                          />
                          <span style={{ fontSize: '0.9rem', color: '#111827', fontWeight: checked ? 600 : 400 }}>
                            {dept.name}
                            {isPrimary && (
                              <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#6B7280', fontWeight: 400 }}>(Primary)</span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Currently assigned:</p>
                    {companyDepartments.filter(d => manageDeptChecked.has(d.id)).length === 0 ? (
                      <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>None</p>
                    ) : (
                      <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0 }}>
                        {companyDepartments
                          .filter(d => manageDeptChecked.has(d.id))
                          .map(d => d.id === manageDeptModal.member.department_id ? `${d.name} (Primary)` : d.name)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </>
              )}

              {manageDeptToast && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#15803D', marginBottom: '12px' }}>
                  {manageDeptToast}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setManageDeptModal(null); setManageDeptToast('') }}
                  disabled={manageDeptSaving}
                  style={{ flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: manageDeptSaving ? 'not-allowed' : 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleManageDeptSave}
                  disabled={manageDeptSaving || manageDeptLoading}
                  style={{
                    flex: 1, padding: '10px', background: '#3B82F6', border: 'none', borderRadius: '8px',
                    fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
                    cursor: (manageDeptSaving || manageDeptLoading) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                    opacity: (manageDeptSaving || manageDeptLoading) ? 0.65 : 1,
                  }}
                >
                  {manageDeptSaving && <Spinner size={14} />}
                  Save
                </button>
              </div>
            </ModalBox>
          </div>
        </div>
      )}

      {/* ── Remove Member Modal ──────────────────────────────────────────── */}
      {removeModal && (
        <ModalOverlay onClose={() => { if (!removeLoading) { setRemoveModal(null); setRemoveError('') } }}>
          <ModalBox>
            <ModalHeader
              title="Remove Member"
              icon={<UserRound size={15} color="#fff" strokeWidth={2.5} />}
              onClose={() => { if (!removeLoading) { setRemoveModal(null); setRemoveError('') } }}
            />
            <div style={{ padding: '20px 24px', fontSize: '0.9375rem', color: '#374151', lineHeight: 1.6 }}>
              Are you sure you want to remove <strong style={{ color: '#111827' }}>{removeModal.full_name}</strong>?
            </div>
            {removeError && (
              <div style={{ margin: '0 24px 8px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>
                {removeError}
              </div>
            )}
            <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => { setRemoveModal(null); setRemoveError('') }}
                disabled={removeLoading}
                style={{ padding: '7px 16px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', cursor: removeLoading ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={removeLoading}
                style={{
                  padding: '7px 18px', background: removeLoading ? '#EF4444' : 'linear-gradient(135deg, #EF4444, #DC2626)', border: 'none', borderRadius: 8,
                  fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF',
                  cursor: removeLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: removeLoading ? 0.65 : 1,
                }}
              >
                {removeLoading ? <Spinner size={13} /> : <Trash2 size={13} />}
                Remove
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Account Deleted Modal ────────────────────────────────────────── */}
      {accountDeletedModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <div style={{ width: '440px', background: '#FFFFFF', borderRadius: '16px', padding: '36px 32px', boxShadow: '0 8px 40px rgba(0,0,0,0.16)' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: '#111827', margin: '0 0 12px' }}>
              Your account has been removed
            </h2>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 28px' }}>
              You have been removed from your last company. Your account has been permanently deleted.
            </p>
            <button
              onClick={handleAccountDeletedExit}
              style={{
                width: '100%',
                height: '48px',
                background: '#F97316',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.9375rem',
                cursor: 'pointer',
              }}
            >
              Exit
            </button>
          </div>
        </div>
      )}

      {/* ── Member Profile Modal ─────────────────────────────────────────── */}
      {profileMember && (
        <ModalOverlay onClose={() => setProfileMember(null)} maxWidth="420px">
          <ModalBox>
            <ModalHeader title="Member Profile" icon={<UserRound size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setProfileMember(null)} />

            {/* Avatar + name */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 14 }}>
              <RoleAvatar role={profileMember.role} size={44} />
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: '0 0 5px' }}>{profileMember.full_name}</p>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: profileMember.role === 'Owner' || profileMember.role === 'Partner' ? '#0F172A' :
                    profileMember.role === 'Manager' ? '#FFF7ED' :
                    profileMember.role === 'Employee' ? '#F3F4F6' : '#EFF6FF',
                  color: profileMember.role === 'Owner' || profileMember.role === 'Partner' ? '#FFFFFF' :
                    profileMember.role === 'Manager' ? '#EA580C' :
                    profileMember.role === 'Employee' ? '#4B5563' : '#2563EB',
                }}>
                  {profileMember.role}
                </span>
              </div>
            </div>

            {/* Fields */}
            <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column' }}>
              {[
                { label: 'Email Address', value: profileMember.email_address },
                { label: 'Phone', value: profileMember.phone_number ?? '—' },
                ...(profileMember.department_id ? [{
                  label: 'Department',
                  value: companyDepartments.find(d => d.id === profileMember.department_id)?.name ?? '—',
                }] : []),
              ].map((field, i, arr) => (
                <div key={field.label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{field.label}</label>
                  <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>{field.value}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            {canRemove(profileMember) && (
              <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => { setProfileMember(null); setRemoveModal(profileMember); setRemoveError('') }}
                  style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #EF4444, #DC2626)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 size={13} />
                  Remove
                </button>
              </div>
            )}
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Invite Member Modal ───────────────────────────────────────────── */}
      {inviteOpen && (
        <ModalOverlay onClose={closeModal}>
          <ModalBox>
            <ModalHeader title="Invite Member" icon={<UserPlus size={15} color="#fff" strokeWidth={2.5} />} onClose={closeModal} />

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 240 }}>
              {/* Tab switcher */}
              {currentUserRole !== 'Manager' && (
                <div style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'inline-flex', border: '1.5px solid #E5E7EB', borderRadius: 9, overflow: 'hidden' }}>
                    {(['manual', 'import'] as const).map(tab => (
                      <button key={tab} type="button" onClick={() => setInviteTab(tab)} style={{ border: 0, height: 34, padding: '0 20px', background: inviteTab === tab ? '#0F172A' : '#FFFFFF', color: inviteTab === tab ? '#FFFFFF' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                        {tab === 'manual' ? 'Single' : 'Import'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div key={inviteTab} style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'tabFadeIn 0.2s ease-out' }}>
              {inviteTab === 'import' && currentUserRole !== 'Manager' ? (
                <>
                  {/* Sample CSV preview */}
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Sample CSV format</p>
                    <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', fontSize: '0.8125rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.2fr', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        {['Email', 'Role', 'Department'].map((h, i) => (
                          <div key={h} style={{ padding: '7px 12px', fontWeight: 700, color: '#6B7280', fontFamily: "'Inter', system-ui, sans-serif", borderRight: i < 2 ? '1px solid #E5E7EB' : 'none' }}>{h}</div>
                        ))}
                      </div>
                      {[
                        ['partner@company.com', 'Partner', ''],
                        ['manager@company.com', 'Manager', 'Sales'],
                        ['employee@company.com', 'Employee', 'Marketing'],
                      ].map(([email, role, dept], i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.2fr', borderBottom: '1px solid #F3F4F6' }}>
                          <div style={{ padding: '6px 12px', color: '#374151', borderRight: '1px solid #E5E7EB' }}>{email}</div>
                          <div style={{ padding: '6px 12px', color: '#374151', borderRight: '1px solid #E5E7EB' }}>{role}</div>
                          <div style={{ padding: '6px 12px', color: '#374151' }}>{dept}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', background: '#FFFFFF' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                  >
                    <input
                      type="file"
                      accept=".csv,text/csv,text/plain"
                      onChange={event => void handleMemberImportFile(event.target.files?.[0] ?? null)}
                      style={{ display: 'none' }}
                    />
                    <Upload size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9375rem', color: memberImportRows.length > 0 ? '#111827' : '#9CA3AF', fontFamily: "'Inter', system-ui, sans-serif" }}>
                      {memberImportRows.length > 0 ? `${memberImportRows.length} row(s) ready to send` : 'Choose a CSV file'}
                    </span>
                  </label>
                  {memberImportRows.length > 0 && (
                    <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                      {memberImportRows.map((row, index) => (
                        <div key={`${row.email}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr', gap: 10, padding: '9px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8125rem', color: '#374151' }}>
                          <span>{row.email}</span>
                          <strong>{row.role}</strong>
                          <span>{row.department_name || '-'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Email */}
                  <div>
                    <label style={modalLabelStyle}>Email Address</label>
                    <input
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      style={{ ...modalInputStyle, background: '#FFFFFF' }}
                    />
                  </div>

                  {/* Role */}
                  {currentUserRole !== 'Manager' && (
                    <div>
                      <label style={modalLabelStyle}>Role</label>
                      <DropdownField
                        value={inviteRole}
                        onChange={handleRoleChange}
                        placeholder="Select a role"
                        options={[
                          { value: 'partner', label: 'Partner' },
                          { value: 'Manager', label: 'Manager' },
                          { value: 'Employee', label: 'Employee' },
                        ]}
                      />
                    </div>
                  )}


                  {/* Department */}
                  {currentUserRole === 'Manager' ? (
                    <div>
                      <label style={modalLabelStyle}>Department</label>
                      <div style={{ ...modalInputStyle, color: '#6B7280', background: '#F9FAFB' }}>
                        {companyDepartments.find(d => d.id === userDeptId)?.name || 'Your department'}
                      </div>
                    </div>
                  ) : showDept && (
                    <div>
                      <label style={modalLabelStyle}>Department</label>
                      <DropdownField
                        value={inviteDeptId}
                        onChange={handleDeptChange}
                        placeholder="Select a department"
                        options={departments.map(d => ({ value: d.id, label: d.name }))}
                      />
                    </div>
                  )}


                </>
              )}
              </div>
            </div>

            {/* Errors / success — between body and footer */}
            {inviteTab === 'import' && currentUserRole !== 'Manager' ? (
              <>
                {memberImportError && (
                  <div style={{ margin: '0 24px 8px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>
                    {memberImportError}
                  </div>
                )}
                {memberImportResult && (
                  <div style={{ margin: '0 24px 8px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#166534' }}>
                    {memberImportResult}
                  </div>
                )}
              </>
            ) : (
              <>
                {inviteError && (
                  <div style={{ margin: '0 24px 8px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>
                    {inviteError}
                  </div>
                )}
                {inviteSuccess && (
                  <div style={{ margin: '0 24px 8px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#166534' }}>
                    {inviteSuccess}
                  </div>
                )}
              </>
            )}

            {/* Footer */}
            {inviteTab === 'import' && currentUserRole !== 'Manager' ? (
              <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={closeModal} style={{ padding: '7px 16px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={confirmMemberImport}
                  disabled={memberImportLoading || memberImportRows.length === 0}
                  style={{ padding: '7px 18px', background: memberImportLoading || memberImportRows.length === 0 ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: memberImportLoading || memberImportRows.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: memberImportLoading || memberImportRows.length === 0 ? 0.65 : 1 }}
                >
                  {memberImportLoading ? <Spinner size={13} /> : <Send size={13} />}
                  Send Invites
                </button>
              </div>
            ) : (
              <div
                title={noManagersInDept ? 'Add a manager to this department first' : undefined}
                style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}
              >
                <button onClick={closeModal} style={{ padding: '7px 16px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={handleSendInvite}
                  disabled={sendDisabled}
                  style={{ padding: '7px 18px', background: sendDisabled ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: sendDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: sendDisabled ? 0.65 : 1 }}
                >
                  {inviteLoading ? <Spinner size={13} /> : <Send size={13} />}
                  Send Invite
                </button>
              </div>
            )}
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Import Members Modal (standalone, kept for backward compat) ── */}
      {memberImportOpen && (
        <ModalOverlay onClose={() => setMemberImportOpen(false)}>
          <ModalBox>
            <ModalHeader title="Import Members" onClose={() => setMemberImportOpen(false)} />
            <p style={{ margin: '0 0 16px', color: '#6B7280', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Upload a CSV with columns: email, role, department_name. Importing members sends invitation emails.
            </p>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={event => void handleMemberImportFile(event.target.files?.[0] ?? null)}
              style={modalInputStyle}
            />
            {memberImportRows.length > 0 && (
              <div style={{ marginTop: 16, border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                {memberImportRows.map((row, index) => (
                  <div key={`${row.email}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr', gap: 10, padding: '9px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.82rem', color: '#374151' }}>
                    <span>{row.email}</span>
                    <strong>{row.role}</strong>
                    <span>{row.department_name || '-'}</span>
                  </div>
                ))}
              </div>
            )}
            {memberImportError && <p style={{ margin: '12px 0 0', color: '#DC2626', fontSize: '0.84rem', fontWeight: 700 }}>{memberImportError}</p>}
            {memberImportResult && <p style={{ margin: '12px 0 0', color: '#059669', fontSize: '0.84rem', fontWeight: 700 }}>{memberImportResult}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setMemberImportOpen(false)} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={confirmMemberImport}
                disabled={memberImportLoading || memberImportRows.length === 0}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#F97316', color: '#FFFFFF', fontWeight: 800, fontSize: '0.875rem', cursor: memberImportLoading || memberImportRows.length === 0 ? 'default' : 'pointer', opacity: memberImportLoading || memberImportRows.length === 0 ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {memberImportLoading && <Spinner size={14} />}
                Send Invites
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {editProfileOpen && (
        <ModalOverlay onClose={() => setEditProfileOpen(false)}>
          <ModalBox>
            <ModalHeader title="Edit Company Profile" icon={<Building2 size={15} color="#fff" strokeWidth={2} />} onClose={() => setEditProfileOpen(false)} />

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={modalLabelStyle}>Company Name</label>
                <input value={editProfileName} onChange={e => setEditProfileName(e.target.value)} placeholder="e.g. Acme Pte Ltd" style={modalInputStyle} />
              </div>
              <div>
                <label style={modalLabelStyle}>Company Description</label>
                <textarea value={editProfileDesc} onChange={e => setEditProfileDesc(e.target.value)} rows={2} placeholder="Brief description of your company..." style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabelStyle}>Postal Code</label>
                  <input value={editProfilePostal} onChange={e => setEditProfilePostal(e.target.value)} placeholder="e.g. 238858" style={modalInputStyle} />
                </div>
                <div>
                  <label style={modalLabelStyle}>Number of Staff</label>
                  <input value={editProfileSize} onChange={e => setEditProfileSize(e.target.value)} placeholder="e.g. 20-30" style={modalInputStyle} />
                </div>
              </div>
              <div>
                <label style={modalLabelStyle}>Location</label>
                <input value={editProfileLoc} onChange={e => setEditProfileLoc(e.target.value)} placeholder="e.g. Singapore, Orchard Road" style={modalInputStyle} />
              </div>
              <div>
                <label style={modalLabelStyle}>Address</label>
                <input value={editProfileAddress} onChange={e => setEditProfileAddress(e.target.value)} placeholder="e.g. 123 Orchard Road" style={modalInputStyle} />
              </div>
              <div>
                <label style={modalLabelStyle}>Industry</label>
                <input value={editProfileIndustry} onChange={e => setEditProfileIndustry(e.target.value)} placeholder="e.g. Retail, Healthcare, Technology..." style={modalInputStyle} />
              </div>
            </div>

            {/* Error — between body and footer */}
            {editProfileError && (
              <div style={{ margin: '0 24px 8px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>
                {editProfileError}
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setEditProfileOpen(false)}
                style={{ padding: '7px 16px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={handleEditProfile}
                disabled={editProfileLoading}
                style={{ padding: '7px 18px', background: editProfileLoading ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: editProfileLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: editProfileLoading ? 0.65 : 1 }}
              >
                {editProfileLoading ? <Spinner size={13} /> : <Check size={13} />} Save Changes
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}
    </div>
  )
}
