'use client'

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronDown, Upload, Building2, Network, Crown, UserCog, UserRound, HardHat, Users, UserPlus, Send, Check, Trash2, FileText, BriefcaseBusiness, UsersRound, MapPinned, Pencil, MessageCircle, Search, Download } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import DatePickerField from '@/components/DatePickerField'
import { DEPT_COLORS, deptColor, setDeptColorOverrides } from '@/lib/deptColor'
import { ModalOverlay, ModalBox, ModalHeader, modalInputStyle, modalLabelStyle } from '@/components/modal'
import { SectionBlock, ShowcaseCard } from '@/components/panel'
import Toast from '@/components/Toast'
import Spinner from '@/components/Spinner'
import AnimatedNumber from '@/components/AnimatedNumber'
import RoleAvatar from '@/components/RoleAvatar'
import DropdownField from '@/components/DropdownField'

// ─── Department color picker ────────────────────────────────────────────────

function DepartmentColorPicker({ value, onChange, usedColors = [] }: { value: string; onChange: (color: string) => void; usedColors?: string[] }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const normalizedUsed = usedColors.map(c => c.toUpperCase())

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !popoverRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div>
      <label style={modalLabelStyle}>Department color</label>
      <div style={{ position: 'relative' }}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={`Department color ${value}`}
          style={{
            width: '100%',
            height: 40,
            borderRadius: 8,
            border: `1.5px solid ${value}`,
            background: value,
            cursor: 'pointer',
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          <span aria-hidden="true" />
          <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.85)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
        {open && (
          <div
            ref={popoverRef}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 20,
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
              padding: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {DEPT_COLORS.map(color => {
                const active = value.toUpperCase() === color.toUpperCase()
                const taken = normalizedUsed.includes(color.toUpperCase())
                return (
                  <div key={color} style={{ position: 'relative', flexShrink: 0 }} title={taken ? 'Already used by another department' : undefined}>
                    <button
                      type="button"
                      aria-label={`Use color ${color}${taken ? ' (already used)' : ''}`}
                      onClick={() => { onChange(color); setOpen(false) }}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        border: active ? '2px solid #0F172A' : '1px solid #E5E7EB',
                        background: color,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: active ? '0 0 0 2px rgba(15,23,42,0.12)' : 'none',
                        opacity: taken && !active ? 0.35 : 1,
                      }}
                    >
                      {active && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                    </button>
                    {taken && !active && (
                      <span style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        background: '#EF4444',
                        border: '1.5px solid #FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                      }}>
                        <X size={7} color="#FFFFFF" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const OWNER_ORANGE = '#F97316'
const TEXT_DARK = '#0F172A'
const MUTED = '#64748B'
const PANEL_BORDER = '#E2E8F0'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: `1.5px solid ${PANEL_BORDER}`,
  borderRadius: 8,
  fontSize: '0.9375rem',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  fontWeight: 400,
  color: TEXT_DARK,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#FFFFFF',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 700,
  fontSize: '0.8125rem',
  color: TEXT_DARK,
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
}

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  border: 0,
  borderRadius: 10,
  background: OWNER_ORANGE,
  color: '#FFFFFF',
  height: 36,
  padding: '0 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  border: `1px solid ${PANEL_BORDER}`,
  borderRadius: 10,
  background: '#FFFFFF',
  color: TEXT_DARK,
  height: 36,
  padding: '0 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.45)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
}

const modalStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 18,
  boxShadow: '0 20px 56px rgba(0,0,0,0.16)',
  padding: '24px',
  maxWidth: 540,
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
}

const modalFooterStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  justifyContent: 'flex-end',
  marginTop: 20,
}

const errorBoxStyle: React.CSSProperties = {
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 13,
  color: '#B91C1C',
}

const successBoxStyle: React.CSSProperties = {
  background: '#F0FDF4',
  border: '1px solid #BBF7D0',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 13,
  color: '#15803D',
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={modalOverlayStyle}>
      <style>{`
        @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalSlideIn  { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
      <div style={{ width: 'min(540px, calc(100% - 32px))', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={modalStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, color: TEXT_DARK, fontSize: 16, fontWeight: 700 }}>{title}</h2>
            <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#9CA3AF', borderRadius: 6 }}><X size={16} /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

const teamTabKeyframes = `
  @keyframes teamTabContentIn {
    from { opacity: 0; transform: translateY(8px) scale(0.99); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes blockSlideUp {
    from { opacity: 0; transform: translateY(22px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }
  @keyframes blockPopIn {
    0%   { opacity: 0; transform: scale(0.93) translateY(10px); }
    65%  { opacity: 1; transform: scale(1.025) translateY(-2px); }
    100% { transform: scale(1) translateY(0); }
  }
  @keyframes cardStagger {
    from { opacity: 0; transform: translateY(14px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes deptCardIn {
    from { opacity: 0; transform: translateX(-10px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes logRowIn {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .all-block-company  { animation: blockPopIn  0.42s cubic-bezier(0.34,1.56,0.64,1) both 0.05s; }
  .all-block-activity { animation: blockSlideUp 0.38s ease both 0.13s; }
  .all-block-dept     { animation: blockSlideUp 0.38s ease both 0.21s; }
  .all-block-cw       { animation: blockSlideUp 0.40s ease both 0.10s; }
  .all-block-internal { animation: blockSlideUp 0.40s ease both 0.18s; }
  .cw-preview-card    { animation: cardStagger 0.32s ease both; }
  .internal-member-card { animation: cardStagger 0.32s ease both; }
  .dept-card-item     { animation: deptCardIn 0.28s ease both; }
  .log-row-item       { animation: logRowIn 0.26s ease both; }
  .org-chart-wrap     { animation: blockSlideUp 0.38s ease both 0.04s; }
  .org-node-btn       { animation: cardStagger 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
  .org-dept-col       { animation: blockSlideUp 0.36s ease both; }
`

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
      <RoleAvatar role={member.role} size={34} photoUrl={member.profile_photo_url} />
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
        <RoleAvatar role={member.role} size={28} photoUrl={member.profile_photo_url} />
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

function HorizontalMemberCard({
  member,
  subtitle,
  badgeLabel,
  badgeBg,
  badgeColor,
  onClick,
}: {
  member: TeamMember
  subtitle: string
  badgeLabel?: string
  badgeBg: string
  badgeColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: 168,
        minWidth: 168,
        padding: '12px 14px',
        borderRadius: 14,
        border: '1px solid #E5E7EB',
        background: '#FFFFFF',
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        animation: 'memberFadeIn 0.35s ease-out',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 8px 18px rgba(15,23,42,0.08)'
        e.currentTarget.style.borderColor = '#D1D5DB'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.06)'
        e.currentTarget.style.borderColor = '#E5E7EB'
      }}
    >
      <RoleAvatar role={member.role} size={40} photoUrl={member.profile_photo_url} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.full_name}</p>
      </div>
      {badgeLabel && (
        <span style={{ background: badgeBg, color: badgeColor, borderRadius: 999, padding: '3px 8px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {badgeLabel}
        </span>
      )}
    </button>
  )
}

function CWStatusBar({
  activeCount,
  inactiveCount,
  totalCount,
}: {
  activeCount: number
  inactiveCount: number
  totalCount: number
}) {
  const [hovered, setHovered] = useState(false)
  const activePct = totalCount > 0 ? (activeCount / totalCount) * 100 : 0
  const inactivePct = totalCount > 0 ? (inactiveCount / totalCount) * 100 : 0
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'flex-end',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 140,
          height: 12,
          borderRadius: 999,
          overflow: 'hidden',
          background: '#E5E7EB',
          display: 'flex',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.55)',
          flexShrink: 0,
          cursor: 'default',
        }}
      >
        <div style={{ width: `${activePct}%`, background: '#86EFAC' }} />
        <div style={{ width: `${inactivePct}%`, background: '#FCA5A5' }} />
      </div>
      {hovered && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            zIndex: 20,
            minWidth: 224,
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 12,
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
            padding: '12px 14px 14px',
          }}
          >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#374151', letterSpacing: '-0.1px' }}>Status</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Total {totalCount}</span>
          </div>
          <div style={{ height: 1, background: '#E5E7EB', marginBottom: 12 }} />
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: '#86EFAC', flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>Active</span>
              </div>
              <span style={{ fontSize: 14, color: '#374151', fontWeight: 600, justifySelf: 'center', minWidth: 24, textAlign: 'center' }}>{activeCount}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: '#FCA5A5', flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>Inactive</span>
              </div>
              <span style={{ fontSize: 14, color: '#374151', fontWeight: 600, justifySelf: 'center', minWidth: 24, textAlign: 'center' }}>{inactiveCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InternalMembersBar({
  partnerCount,
  managerCount,
  employeeCount,
}: {
  partnerCount: number
  managerCount: number
  employeeCount: number
}) {
  const [hovered, setHovered] = useState(false)
  const total = partnerCount + managerCount + employeeCount
  const partnerPct  = total > 0 ? (partnerCount  / total) * 100 : 0
  const managerPct  = total > 0 ? (managerCount  / total) * 100 : 0
  const employeePct = total > 0 ? (employeeCount / total) * 100 : 0
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', position: 'relative' }}
    >
      <div style={{ width: 140, height: 12, borderRadius: 999, overflow: 'hidden', background: '#E5E7EB', display: 'flex', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.55)', flexShrink: 0, cursor: 'default' }}>
        <div style={{ width: `${partnerPct}%`,  background: '#C4B5FD' }} />
        <div style={{ width: `${managerPct}%`,  background: '#93C5FD' }} />
        <div style={{ width: `${employeePct}%`, background: '#6EE7B7' }} />
      </div>
      {hovered && (
        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 20, minWidth: 224, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 10px 24px rgba(15,23,42,0.12)', padding: '12px 14px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#374151', letterSpacing: '-0.1px' }}>Roles</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Total {total}</span>
          </div>
          <div style={{ height: 1, background: '#E5E7EB', marginBottom: 12 }} />
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              { label: 'Partner',  count: partnerCount,  color: '#C4B5FD' },
              { label: 'Manager',  count: managerCount,  color: '#93C5FD' },
              { label: 'Employee', count: employeeCount, color: '#6EE7B7' },
            ].map(row => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: row.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{row.label}</span>
                </div>
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 600, justifySelf: 'center', minWidth: 24, textAlign: 'center' }}>{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CasualWorkerPreviewCard({
  name,
  lastShift,
  totalVisits,
  status,
  photoUrl,
  onClick,
  highlighted = false,
  dimmed = false,
}: {
  name: string
  lastShift: string
  totalVisits: number
  status: 'Active' | 'Inactive'
  photoUrl?: string | null
  onClick?: () => void
  highlighted?: boolean
  dimmed?: boolean
}) {
  const isActive = status === 'Active'
  const borderColor = isActive ? '#86EFAC' : '#FCA5A5'
  return (
    <button
      type="button"
      onClick={onClick}
      className="cw-preview-card"
      style={{
        flex: '0 0 110px',
        width: 110,
        minWidth: 110,
        maxWidth: 110,
        height: 128,
        padding: '0 1px',
        borderRadius: 8,
        border: highlighted ? '2px solid #F97316' : `1.5px solid ${borderColor}`,
        background: highlighted ? '#FFF7ED' : '#FFFFFF',
        boxShadow: highlighted ? '0 0 0 3px rgba(249,115,22,0.18), 0 4px 12px rgba(249,115,22,0.15)' : '0 1px 3px rgba(15,23,42,0.06)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'center',
        opacity: dimmed ? 0.35 : 1,
        transition: 'box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease, opacity 0.22s ease, background 0.22s ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
        <RoleAvatar role="Casual Worker" size={80} photoUrl={photoUrl ?? null} />
        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px', maxWidth: '100%' }}>
          {name}
        </p>
      </div>
    </button>
  )
}

function RoleGroupCard({
  icon,
  label,
  count,
  emptyText,
  children,
}: {
  icon: React.ReactNode
  label: string
  count: number
  emptyText: string
  children: React.ReactNode
}) {
  return (
    <div className="role-group-card" style={{ border: '1px solid #EEF2F7', borderRadius: 14, overflow: 'hidden', background: '#FFFFFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 6, background: 'transparent', color: '#374151', flexShrink: 0 }}>
            {icon}
          </span>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>{label}</span>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #F1F5F9' }} />
      <div style={{ padding: '14px 16px 16px' }}>
        {count === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{emptyText}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

type AllBlockId = 'company' | 'activity' | 'departments' | 'casual' | 'internal'

const ALL_BLOCK_ORDER_KEY = 'owner_team_all_block_order_v1'
const DEFAULT_ALL_BLOCK_ORDER: AllBlockId[] = ['company', 'activity', 'departments', 'casual', 'internal']

function normalizeAllBlockOrder(saved: string[]): AllBlockId[] {
  const valid = saved.filter((id): id is AllBlockId => (DEFAULT_ALL_BLOCK_ORDER as readonly string[]).includes(id))
  const missing = DEFAULT_ALL_BLOCK_ORDER.filter(id => !valid.includes(id))
  return [...valid, ...missing]
}

// ─── Org Chart Node ──────────────────────────────────────────────────────────

function OrgNode({
  member,
  onClick,
  animationDelay,
  searchHighlighted = false,
  searchDimmed = false,
}: {
  member: TeamMember
  onClick: () => void
  animationDelay?: string
  searchHighlighted?: boolean
  searchDimmed?: boolean
}) {
  const dark = member.role === 'Owner' || member.role === 'Partner'
  const isManager = member.role === 'Manager'
  return (
    <button
      onClick={onClick}
      className={`org-node-btn org-node-${member.role.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '12px 16px', borderRadius: 12,
        border: searchHighlighted
          ? '2px solid #F97316'
          : `1.5px solid ${dark ? '#0F172A' : isManager ? '#FDBA74' : '#E5E7EB'}`,
        background: searchHighlighted ? '#FFF7ED' : dark ? '#0F172A' : '#FFFFFF',
        cursor: 'pointer', width: '100%',
        boxShadow: searchHighlighted ? '0 0 0 3px rgba(249,115,22,0.18), 0 4px 12px rgba(249,115,22,0.15)' : '0 1px 4px rgba(0,0,0,0.07)',
        animationDelay: animationDelay ?? '0s',
        opacity: searchDimmed ? 0.35 : 1,
        transition: 'box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease, opacity 0.22s ease, background 0.22s ease',
      }}
    >
      <span className="org-node-avatar">
        <RoleAvatar role={member.role} size={36} photoUrl={member.profile_photo_url} />
      </span>
      <p className="org-name-export" style={{ fontWeight: 700, fontSize: '0.8125rem', color: searchHighlighted ? '#111827' : dark ? '#FFFFFF' : '#111827', margin: 0, lineHeight: 1.3, textAlign: 'center' }}>{member.full_name}</p>
      <p className="org-role-export" style={{ fontWeight: 600, fontSize: '0.72rem', color: searchHighlighted ? '#4B5563' : dark ? '#CBD5E1' : '#6B7280', margin: 0, lineHeight: 1.2, textAlign: 'center' }}>{member.role}</p>
    </button>
  )
}

// ─── Org Chart Tree ───────────────────────────────────────────────────────────

type OrgChartTreeProps = {
  topMembers: TeamMember[]
  departments: { id: string; name: string }[]
  teamMembers: TeamMember[]
  onMemberClick: (m: TeamMember) => void
  onDepartmentClick: (department: { id: string; name: string }) => void
  searchQuery?: string
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

function OrgChartTree({ topMembers, departments, teamMembers, onMemberClick, onDepartmentClick, searchQuery = '' }: OrgChartTreeProps) {
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const searchActive = normalizedSearch.length > 0
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

  const memberMatchesSearch = (member: TeamMember) =>
    member.full_name.toLowerCase().includes(normalizedSearch) ||
    member.role.toLowerCase().includes(normalizedSearch)

  const deptMatchesSearch = (dept: { id: string; name: string }) =>
    dept.name.toLowerCase().includes(normalizedSearch) ||
    teamMembers.some(member =>
      member.department_id === dept.id &&
      member.full_name.toLowerCase().includes(normalizedSearch)
    )

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8, paddingTop: 8 }}>
      <div className="org-chart-capture" style={{ width: totalW + 48, margin: '0 auto', padding: '16px 24px 8px', background: '#FFFFFF', boxSizing: 'border-box' }}>

        {/* ── Row 1: Leadership — Owner pinned to totalW/2 ── */}
        <div style={{ position: 'relative', height: 80, flexShrink: 0 }}>
          {orderedLeaders.map((m, i) => (
            <div key={m.id} style={{
              position: 'absolute',
              left: leaderRowStartX2 + i * (LEADER_W + LEADER_GAP),
              top: 0,
              width: LEADER_W,
            }}>
              <OrgNode
                member={m}
                onClick={() => onMemberClick(m)}
                animationDelay={`${0.08 + i * 0.08}s`}
                searchHighlighted={searchActive && memberMatchesSearch(m)}
                searchDimmed={searchActive && !memberMatchesSearch(m)}
              />
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
              const deptHighlighted = searchActive && deptMatchesSearch(dept)
              const deptDimmed = searchActive && !deptHighlighted

              return (
                <div key={dept.id} className="org-dept-col" style={{
                  width: colW, flexShrink: 0,
                  border: '1.5px solid #E5E7EB',
                  borderRadius: 14,
                  background: '#FFFFFF',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  overflow: 'hidden',
                  animationDelay: `${0.18 + di * 0.07}s`,
                }}>

                  {/* Dept header */}
                  <div className="org-dept-header" style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: deptHighlighted ? '#FFF7ED' : '#F9FAFB',
                    borderBottom: '1px solid #F3F4F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: deptDimmed ? 0.35 : 1,
                    transition: 'opacity 0.22s ease, background 0.22s ease',
                  }}>
                    <button
                      className="org-dept-title-btn"
                      type="button"
                      aria-label={`Open ${dept.name} actions`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onDepartmentClick(dept)
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#111827',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.9375rem',
                        lineHeight: 1.2,
                        padding: 0,
                        margin: 0,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <span className="org-dept-dot" style={{ width: 8, height: 8, borderRadius: 999, background: deptColor(dept.id), flexShrink: 0 }} />
                      <span className="org-dept-title-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dept.name}</span>
                    </button>
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
                      {managers.map((m, mi) => (
                        <div key={m.id} style={{ width: NODE_W }}>
                          <OrgNode
                            member={m}
                            onClick={() => onMemberClick(m)}
                            animationDelay={`${0.26 + di * 0.07 + mi * 0.05}s`}
                            searchHighlighted={searchActive && memberMatchesSearch(m)}
                            searchDimmed={searchActive && !memberMatchesSearch(m)}
                          />
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
                      {employees.map((m, ei) => (
                        <OrgNode
                          key={m.id}
                          member={m}
                          onClick={() => onMemberClick(m)}
                          animationDelay={`${0.32 + di * 0.07 + ei * 0.04}s`}
                          searchHighlighted={searchActive && memberMatchesSearch(m)}
                          searchDimmed={searchActive && !memberMatchesSearch(m)}
                        />
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

function formatDateDisplay(value: string | null | undefined, empty = '—') {
  if (!value) return empty
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return empty
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatLongDateTime(value: string | null | undefined, empty = '—') {
  if (!value) return empty
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return empty
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OwnedCompany = { id: string; name: string }
type Department = { id: string; name: string; color?: string | null }
type Manager = { id: string; full_name: string }
type CWPreviewCard = {
  id: string
  name: string
  lastShift: string
  totalVisits: number
  status: 'Active' | 'Inactive'
  inactiveReason?: string | null
  email?: string | null
  dateOfBirth?: string | null
  phoneNumber?: string | null
  photoUrl?: string | null
}
type TeamMember = {
  id: string
  full_name: string
  email_address: string
  phone_number: string | null
  date_of_birth: string | null
  profile_photo_url?: string | null
  role: string
  department_id: string | null
  worker_status?: string | null
  inactivate_reason?: string | null
  created_at: string
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
  const [editPostalLoading, setEditPostalLoading] = useState(false)
  const [editProfileSuccess, setEditProfileSuccess] = useState('')
  const editProfileSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editProfileClosing, setEditProfileClosing] = useState(false)
  const editProfileCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const INDUSTRIES = ['Retail', 'F&B', 'Logistics', 'Event Management', 'Healthcare', 'Education', 'Technology', 'Finance', 'Construction', 'Hospitality', 'Manufacturing', 'Other']
  const SIZES = ['1-10', '11-50', '51-200', '200+']

  useEffect(() => {
    const postal = editProfilePostal.trim()
    if (postal.length < 6) {
      setEditProfileLoc('')
      setEditProfileAddress('')
      setEditPostalLoading(false)
      return
    }

    if (!/^\d{6}$/.test(postal)) {
      setEditProfileError('Postal code must contain only numbers.')
      setEditPostalLoading(false)
      return
    }

    let cancelled = false

    const lookupPostal = async () => {
      setEditPostalLoading(true)
      setEditProfileError('')
      try {
        const res = await fetch(
          `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postal}&returnGeom=Y&getAddrDetails=Y`
        )
        const data = await res.json()
        if (cancelled) return
        if (!data.results || data.results.length === 0) {
          setEditProfileError('Postal code not found.')
          return
        }

        const result = data.results[0]
        setEditProfileAddress(result.ADDRESS ?? '')
        setEditProfileLoc(
          result.BUILDING && result.BUILDING !== 'NIL'
            ? result.BUILDING
            : `${result.ROAD_NAME ?? ''}, Singapore`
        )
      } catch {
        if (!cancelled) setEditProfileError('Postal code not found.')
      } finally {
        if (!cancelled) setEditPostalLoading(false)
      }
    }

    void lookupPostal()

    return () => {
      cancelled = true
    }
  }, [editProfilePostal])

  useEffect(() => {
    return () => {
      if (editProfileSuccessTimerRef.current) clearTimeout(editProfileSuccessTimerRef.current)
      if (editProfileCloseTimerRef.current) clearTimeout(editProfileCloseTimerRef.current)
      if (inviteSuccessTimerRef.current) clearTimeout(inviteSuccessTimerRef.current)
      if (cwDetailSuccessTimerRef.current) clearTimeout(cwDetailSuccessTimerRef.current)
      if (departmentSuccessTimerRef.current) clearTimeout(departmentSuccessTimerRef.current)
    }
  }, [])

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
  const [inviteSuccessToast, setInviteSuccessToast] = useState('')
  const inviteSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cwScrollRef = useRef<HTMLDivElement | null>(null)
  const roleScrollRefs = useRef<(HTMLDivElement | null)[]>([])
  const [memberImportOpen, setMemberImportOpen] = useState(false)
  const [memberImportRows, setMemberImportRows] = useState<MemberImportPreview[]>([])
  const [memberImportLoading, setMemberImportLoading] = useState(false)
  const [memberImportError, setMemberImportError] = useState('')
  const [memberImportResult, setMemberImportResult] = useState('')
  const [inviteTab, setInviteTab] = useState<'manual' | 'import'>('manual')
  const [teamViewTab, setTeamViewTab] = useState<'all' | 'org'>('all')
  const [allBlockOrder, setAllBlockOrder] = useState<AllBlockId[]>(DEFAULT_ALL_BLOCK_ORDER)
  const [draggingAllBlockId, setDraggingAllBlockId] = useState<AllBlockId | null>(null)
  const [dragOverAllBlockId, setDragOverAllBlockId] = useState<AllBlockId | null>(null)
  const allBlockEls = useRef<Map<AllBlockId, HTMLDivElement>>(new Map())
  const allBlockPrevRects = useRef<Map<AllBlockId, DOMRect>>(new Map())
  const [cwSearchQuery, setCwSearchQuery] = useState('')
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const [orgSearchQuery, setOrgSearchQuery] = useState('')
  const orgChartRef = useRef<HTMLDivElement>(null)
  const [orgExporting, setOrgExporting] = useState(false)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef<Record<'all' | 'org', HTMLButtonElement | null>>({ all: null, org: null })
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, opacity: 0 })
  const [departmentModal, setDepartmentModal] = useState<'add' | 'edit' | null>(null)
  const [departmentModalTab, setDepartmentModalTab] = useState<'manual' | 'import'>('manual')
  const [activeDepartment, setActiveDepartment] = useState<Department | null>(null)
  const [departmentNameInput, setDepartmentNameInput] = useState('')
  const [departmentColorInput, setDepartmentColorInput] = useState(DEPT_COLORS[0])
  const [departmentImportRows, setDepartmentImportRows] = useState<string[]>([])
  const [departmentActionLoading, setDepartmentActionLoading] = useState(false)
  const [departmentActionError, setDepartmentActionError] = useState('')
  const [departmentSuccessToast, setDepartmentSuccessToast] = useState('')
  const departmentSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)


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
  const [profileDeptSelectedId, setProfileDeptSelectedId] = useState('')
  const [profileDeptSaving, setProfileDeptSaving] = useState(false)
  const [profileDeptError, setProfileDeptError] = useState('')
  const [highlightDeptId, setHighlightDeptId] = useState<string | null>(null)
  const [selectedCWPreview, setSelectedCWPreview] = useState<CWPreviewCard | null>(null)
  const [cwDetailSuccess, setCWDetailSuccess] = useState('')
  const cwDetailSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [activityLogs, setActivityLogs] = useState<{ id: string; actor_id: string | null; action: string; target_name: string | null; detail: string | null; is_read: boolean; created_at: string }[]>([])
  const normalizedCwSearch = cwSearchQuery.trim().toLowerCase()
  const normalizedInternalSearch = internalSearchQuery.trim().toLowerCase()
  const normalizedOrgSearch = orgSearchQuery.trim().toLowerCase()

  const handleExportOrgChart = async () => {
    const el = orgChartRef.current
    if (!el || orgExporting) return
    setOrgExporting(true)
    let captureEl: HTMLElement | null = null
    try {
      el.classList.add('org-chart-exporting')
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      captureEl = el.querySelector<HTMLElement>('.org-chart-capture') ?? el
      captureEl.classList.add('org-chart-exporting')
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      await document.fonts?.ready
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(captureEl, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        logging: false,
        width: captureEl.scrollWidth,
        height: captureEl.scrollHeight,
        windowWidth: captureEl.scrollWidth,
        windowHeight: captureEl.scrollHeight,
      })
      const link = document.createElement('a')
      link.download = 'organisation-chart.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {}
    finally {
      captureEl?.classList.remove('org-chart-exporting')
      el.classList.remove('org-chart-exporting')
      setOrgExporting(false)
    }
  }

  useEffect(() => {
    setProfileDeptSelectedId(profileMember?.department_id ?? '')
    setProfileDeptError('')
  }, [profileMember])

  useEffect(() => {
    if (teamViewTab === 'all') {
      setOrgSearchQuery('')
      return
    }
    setCwSearchQuery('')
    setInternalSearchQuery('')
  }, [teamViewTab])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ALL_BLOCK_ORDER_KEY)
      if (saved) {
        setAllBlockOrder(normalizeAllBlockOrder(JSON.parse(saved) as string[]))
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(ALL_BLOCK_ORDER_KEY, JSON.stringify(allBlockOrder))
    } catch {}
  }, [allBlockOrder])

  const captureAllBlockRects = useCallback(() => {
    allBlockEls.current.forEach((el, id) => {
      if (el) allBlockPrevRects.current.set(id, el.getBoundingClientRect())
    })
  }, [])

  const playAllBlockFlip = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        allBlockEls.current.forEach((el, id) => {
          if (!el) return
          const prev = allBlockPrevRects.current.get(id)
          if (!prev) return
          const next = el.getBoundingClientRect()
          const dx = prev.left - next.left
          const dy = prev.top - next.top
          const sx = next.width ? prev.width / next.width : 1
          const sy = next.height ? prev.height / next.height : 1
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
          el.style.willChange = 'transform'
          el.style.transition = 'none'
          el.style.transformOrigin = 'top left'
          el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
          void el.offsetHeight
          el.style.transition = 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease, opacity 220ms ease'
          el.style.transform = 'translate(0px, 0px) scale(1, 1)'
          window.setTimeout(() => {
            el.style.willChange = ''
          }, 420)
        })
      })
    })
  }, [])

  useLayoutEffect(() => {
    if (allBlockPrevRects.current.size === 0) return
    playAllBlockFlip()
  }, [allBlockOrder, playAllBlockFlip])

  const handleAllBlockDragStart = useCallback((blockId: AllBlockId) => {
    setDraggingAllBlockId(blockId)
  }, [])

  const handleAllBlockDragEnd = useCallback(() => {
    setDraggingAllBlockId(null)
    setDragOverAllBlockId(null)
  }, [])

  const swapAllBlocks = useCallback((sourceId: AllBlockId, targetId: AllBlockId) => {
    if (sourceId === targetId) return
    captureAllBlockRects()
    setAllBlockOrder(prev => {
      const sourceIdx = prev.indexOf(sourceId)
      const targetIdx = prev.indexOf(targetId)
      if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return prev
      const next = [...prev]
      next[sourceIdx] = targetId
      next[targetIdx] = sourceId
      return next
    })
  }, [captureAllBlockRects])

  const fetchActivityLogs = useCallback(async (cid: string) => {
    try {
      const res = await fetch(`/api/activity-log?company_id=${cid}`)
      const data = await res.json()
      if (data.success) setActivityLogs(data.logs)
    } catch {}
  }, [])

  const companyIdRef = useRef(companyId)
  const userIdRef = useRef(internalUserId)
  useEffect(() => { companyIdRef.current = companyId }, [companyId])
  useEffect(() => { userIdRef.current = internalUserId }, [internalUserId])

  const logActivity = useCallback(async (action: string, target_name?: string, detail?: string) => {
    const cid = companyIdRef.current
    const uid = userIdRef.current
    if (!cid || !uid) return
    try {
      const res = await fetch('/api/activity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: cid, actor_id: uid, action, target_name, detail }),
      })
      const json = await res.json()
      console.log('[logActivity] POST result:', json, { cid, uid, action, target_name, detail })
      fetchActivityLogs(cid)
    } catch (e) { console.error('[logActivity] failed:', e) }
  }, [fetchActivityLogs])
  const [cwInactiveReasonModal, setCWInactiveReasonModal] = useState<CWPreviewCard | null>(null)
  const [cwInactiveReason, setCWInactiveReason] = useState('')

  // CW application data (resume + cover letter)
  const [cwApplication, setCWApplication] = useState<{ resume_url: string | null; cover_letter: string | null } | null>(null)
  const [cwApplicationLoading, setCWApplicationLoading] = useState(false)

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
    setInviteSuccessToast('')
    setMemberImportRows([])
    setMemberImportError('')
    setMemberImportResult('')
    setInviteTab('manual')
  }, [])

  const showCWDetailSuccess = useCallback((message: string) => {
    if (cwDetailSuccessTimerRef.current) clearTimeout(cwDetailSuccessTimerRef.current)
    setCWDetailSuccess(message)
    cwDetailSuccessTimerRef.current = setTimeout(() => setCWDetailSuccess(''), 3000)
  }, [])

  const closeModal = useCallback(() => {
    setInviteOpen(false)
    resetModal()
  }, [resetModal])

  const handleHorizWheel = useCallback((e: React.WheelEvent<HTMLDivElement>, el: HTMLDivElement | null) => {
    if (!el) return
    const primaryDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    if (!primaryDelta) return
    e.preventDefault()
    el.scrollBy({ left: primaryDelta, behavior: 'auto' })
  }, [])

  const handleCwWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    handleHorizWheel(e, cwScrollRef.current)
  }, [handleHorizWheel])

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
        fetchActivityLogs(storedCid)
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
          if (!cancelled && deptData.success) {
            setCompanyDepartments(deptData.departments)
            setDeptColorOverrides(deptData.departments)
          }
        } catch {}
      }
    }
    void run()
    return () => { cancelled = true }
  }, [fetchTeamMembers, router])

  const handleEditProfile = async () => {
    const name = editProfileName.trim()
    const desc = editProfileDesc.trim()
    const postal = editProfilePostal.trim()
    const location = editProfileLoc.trim()
    const address = editProfileAddress.trim()
    const industry = editProfileIndustry.trim()
    const size = editProfileSize.trim()

    if (!name) { setEditProfileError('Company name is required.'); return }
    if (!desc) { setEditProfileError('Company description is required.'); return }
    if (!postal) { setEditProfileError('Postal code is required.'); return }
    if (!/^\d{6}$/.test(postal)) { setEditProfileError('Postal code must be exactly 6 digits.'); return }
    if (!location) { setEditProfileError('Location is required.'); return }
    if (!address) { setEditProfileError('Address is required.'); return }
    if (!industry) { setEditProfileError('Industry is required.'); return }
    if (size === '0') { setEditProfileError('Number of staff cannot be 0.'); return }
    if (!size) { setEditProfileError('Number of staff is required.'); return }

    setEditProfileLoading(true); setEditProfileError('')
    try {
      const res = await fetch('/api/company/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          name,
          description: desc,
          location,
          address,
          postal_code: postal,
          industry: editProfileIndustry === 'Other' ? (editProfileIndustryOther.trim() || null) : (industry || null),
          size,
          website: null,
          logo_url: null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      const savedIndustry = editProfileIndustry === 'Other' ? (editProfileIndustryOther.trim() || null) : (editProfileIndustry || null)
      setCompanyName(name)
      setCompanyProfile({ description: desc || null, location: location || null, address: address || null, postal_code: postal || null, industry: savedIndustry, size: size || null })
      setEditProfileClosing(true)
      if (editProfileCloseTimerRef.current) clearTimeout(editProfileCloseTimerRef.current)
      editProfileCloseTimerRef.current = setTimeout(() => {
        setEditProfileOpen(false)
        setEditProfileClosing(false)
      }, 220)
      if (editProfileSuccessTimerRef.current) clearTimeout(editProfileSuccessTimerRef.current)
      setEditProfileSuccess('Company profile updated successfully.')
      editProfileSuccessTimerRef.current = setTimeout(() => setEditProfileSuccess(''), 3000)
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
      if (data.success) { setDepartments(data.departments); setDeptColorOverrides(data.departments) }
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
    const email = inviteEmail.trim()

    if (!email || !inviteRole) {
      setInviteError('Email and role are required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Please enter a valid email address (e.g. you@company.com).')
      return
    }
    if (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()) {
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
          email,
          role: inviteRole,
          company_id: selectedCompanyId,
          department_id: inviteRole === 'partner' ? null : (inviteDeptId || null),
          invited_by: userId,
          reporting_manager_id: inviteRole === 'Employee' ? (inviteManagerId || null) : null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      if (inviteSuccessTimerRef.current) clearTimeout(inviteSuccessTimerRef.current)
      setInviteSuccess(`Invitation sent to ${email}`)
      setInviteSuccessToast('Invitation sent successfully.')
      inviteSuccessTimerRef.current = setTimeout(() => setInviteSuccessToast(''), 3000)
      logActivity('invite_member', email, inviteRole)
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

  const handleProfileDepartmentChange = async (departmentId: string) => {
    if (!profileMember || !departmentId || departmentId === profileMember.department_id) return
    setProfileDeptSelectedId(departmentId)
    setProfileDeptSaving(true)
    setProfileDeptError('')
    try {
      const res = await fetch('/api/user/update-department', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profileMember.id, department_id: departmentId, company_id: companyId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update department')

      const nextMember = { ...profileMember, department_id: departmentId }
      setProfileMember(nextMember)
      setTeamMembers(prev => prev.map(member => member.id === profileMember.id ? { ...member, department_id: departmentId } : member))
      await fetchTeamMembers(companyId)
      showCWDetailSuccess(`${profileMember.full_name}'s department has been updated.`)
      logActivity('change_department', profileMember.full_name, companyDepartments.find(dept => dept.id === departmentId)?.name ?? undefined)
    } catch (err) {
      setProfileDeptSelectedId(profileMember.department_id ?? '')
      setProfileDeptError(err instanceof Error ? err.message : 'Failed to update department')
    } finally {
      setProfileDeptSaving(false)
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
      const removedName = removeModal.full_name
      const removedRole = removeModal.role
      setRemoveModal(null)
      fetchTeamMembers(companyId)
      showCWDetailSuccess(`${removedName} has been removed from the team.`)
      logActivity('remove_member', removedName, removedRole)
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

  const parseDepartmentImportCsv = (text: string): string[] => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    const withoutHeader = lines[0]?.toLowerCase().includes('department') ? lines.slice(1) : lines
    return [...new Set(withoutHeader.map(line => line.split(',')[0]?.trim()).filter(Boolean))]
  }

  const handleDepartmentImportFile = async (file: File | null) => {
    setDepartmentActionError('')
    if (!file) return
    const rows = parseDepartmentImportCsv(await file.text())
    setDepartmentImportRows(rows)
    if (rows.length === 0) setDepartmentActionError('No valid departments found.')
  }

  const openAddDepartment = () => {
    setDepartmentModal('add')
    setDepartmentModalTab('manual')
    setActiveDepartment(null)
    setDepartmentNameInput('')
    setDepartmentColorInput(DEPT_COLORS[companyDepartments.length % DEPT_COLORS.length])
    setDepartmentImportRows([])
    setDepartmentActionError('')
  }

  const openEditDepartment = (department: Department) => {
    setDepartmentModal('edit')
    setActiveDepartment(department)
    setDepartmentNameInput(department.name)
    setDepartmentColorInput(department.color ?? deptColor(department.id))
    setDepartmentActionError('')
  }

  const handleSaveDepartment = async () => {
    if (!companyId) return
    const name = departmentNameInput.trim()
    if (departmentModalTab === 'manual' && !name) {
      setDepartmentActionError('Department name is required.')
      return
    }
    if (departmentModalTab === 'import' && departmentImportRows.length === 0) {
      setDepartmentActionError('Choose a CSV file with department names.')
      return
    }
    setDepartmentActionLoading(true)
    setDepartmentActionError('')
    try {
      if (departmentModalTab === 'import') {
        const res = await fetch('/api/import/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, departments: departmentImportRows }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message || 'Failed to import departments')
        const created = data.result?.created?.length ?? 0
        if (departmentSuccessTimerRef.current) clearTimeout(departmentSuccessTimerRef.current)
        setDepartmentSuccessToast(`${created} department(s) imported successfully.`)
        departmentSuccessTimerRef.current = setTimeout(() => setDepartmentSuccessToast(''), 3000)
      } else {
        const isEdit = departmentModal === 'edit'
        const res = await fetch(isEdit ? '/api/company/update-department' : '/api/company/create-department', {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isEdit ? { department_id: activeDepartment?.id, name, color: departmentColorInput } : { company_id: companyId, name, color: departmentColorInput }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message || 'Failed to save department')

        setDepartmentModal(null)
        setActiveDepartment(null)
        if (departmentSuccessTimerRef.current) clearTimeout(departmentSuccessTimerRef.current)
        setDepartmentSuccessToast(isEdit ? 'Department updated successfully.' : 'Department created successfully.')
        departmentSuccessTimerRef.current = setTimeout(() => setDepartmentSuccessToast(''), 3000)
      }
      await Promise.all([fetchTeamMembers(companyId), (async () => {
        const deptRes = await fetch(`/api/company/departments?company_id=${companyId}`)
        const deptData = await deptRes.json()
        if (deptData.success) { setCompanyDepartments(deptData.departments); setDeptColorOverrides(deptData.departments) }
      })()])
    } catch (err) {
      setDepartmentActionError(err instanceof Error ? err.message : 'Failed to save department')
    } finally {
      setDepartmentActionLoading(false)
    }
  }

  const handleDeleteDepartment = async () => {
    if (!companyId || !activeDepartment) return
    setDepartmentActionLoading(true)
    setDepartmentActionError('')
    try {
      const res = await fetch('/api/company/delete-department', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: activeDepartment.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete department')
      setDepartmentModal(null)
      setActiveDepartment(null)
      if (departmentSuccessTimerRef.current) clearTimeout(departmentSuccessTimerRef.current)
      setDepartmentSuccessToast('Department deleted successfully.')
      departmentSuccessTimerRef.current = setTimeout(() => setDepartmentSuccessToast(''), 3000)
      await Promise.all([
        fetchTeamMembers(companyId),
        (async () => {
          const deptRes = await fetch(`/api/company/departments?company_id=${companyId}`)
          const deptData = await deptRes.json()
          if (deptData.success) { setCompanyDepartments(deptData.departments); setDeptColorOverrides(deptData.departments) }
        })(),
      ])
    } catch (err) {
      setDepartmentActionError(err instanceof Error ? err.message : 'Failed to delete department')
    } finally {
      setDepartmentActionLoading(false)
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
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim()) ||
    !inviteRole ||
    ((inviteRole === 'Manager' || inviteRole === 'Employee') && !inviteDeptId)

  const partnerCount      = teamMembers.filter(m => m.role === 'Partner').length
  const managerCount      = teamMembers.filter(m => m.role === 'Manager').length
  const employeeCount     = teamMembers.filter(m => m.role === 'Employee').length
  const casualWorkerCount = teamMembers.filter(m => m.role === 'Casual Worker').length
  const totalInternal     = managerCount + employeeCount
  const sharedIconColor = '#F97316'
  const casualWorkers = teamMembers
    .filter(m => m.role === 'Casual Worker')
    .sort((a, b) => {
      const aActive = (a.worker_status ?? 'active') === 'active' ? 0 : 1
      const bActive = (b.worker_status ?? 'active') === 'active' ? 0 : 1
      return aActive - bActive
    })
  const cwActiveCount = casualWorkers.filter(w => (w.worker_status ?? 'active') === 'active').length
  const cwInactiveCount = casualWorkers.length - cwActiveCount
  const partnerMembers = teamMembers.filter(m => m.role === 'Partner')
  const managerMembers = teamMembers.filter(m => m.role === 'Manager')
  const employeeMembers = teamMembers.filter(m => m.role === 'Employee')
  const roleGroups = [
    {
      label: 'Partner',
      icon: <Crown size={13} strokeWidth={2.2} style={{ color: '#374151' }} />,
      members: partnerMembers,
      emptyText: 'No partners have joined yet',
    },
    {
      label: 'Manager',
      icon: <UserCog size={13} strokeWidth={2.2} style={{ color: '#374151' }} />,
      members: managerMembers,
      emptyText: 'No managers have joined yet',
    },
    {
      label: 'Employee',
      icon: <UserRound size={13} strokeWidth={2.2} style={{ color: '#374151' }} />,
      members: employeeMembers,
      emptyText: 'No employees have joined yet',
    },
  ] as const

  const renderAllBlockFrame = (blockId: AllBlockId, content: React.ReactNode) => (
    <div
      ref={el => {
        if (el) allBlockEls.current.set(blockId, el)
        else allBlockEls.current.delete(blockId)
      }}
      draggable
      onDragStart={(event) => {
        const target = event.target as HTMLElement | null
        if (target?.closest('button, input, textarea, select, a, [role="button"]')) {
          event.preventDefault()
          return
        }
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', blockId)
        handleAllBlockDragStart(blockId)
      }}
      onDragEnd={handleAllBlockDragEnd}
      onDragOver={(event) => {
        event.preventDefault()
        if (draggingAllBlockId && draggingAllBlockId !== blockId) {
          setDragOverAllBlockId(blockId)
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDragOverAllBlockId(current => current === blockId ? null : current)
      }}
      onDrop={(event) => {
        event.preventDefault()
        const sourceId = event.dataTransfer.getData('text/plain') as AllBlockId
        if (sourceId) swapAllBlocks(sourceId, blockId)
        handleAllBlockDragEnd()
      }}
      style={{
        cursor: draggingAllBlockId === blockId ? 'grabbing' : 'grab',
        opacity: draggingAllBlockId === blockId ? 0.88 : 1,
        outline: dragOverAllBlockId === blockId ? '2px dashed #F97316' : 'none',
        outlineOffset: 4,
        boxShadow: dragOverAllBlockId === blockId ? '0 14px 34px rgba(249,115,22,0.12)' : undefined,
        transform: draggingAllBlockId === blockId ? 'scale(0.985)' : undefined,
        transition: 'box-shadow 180ms ease, opacity 180ms ease, transform 180ms ease',
        minWidth: 0,
      }}
    >
      {content}
    </div>
  )

  const renderAllBlockContent = (blockId: AllBlockId): React.ReactNode => {
    switch (blockId) {
      case 'company':
        return (
          <div className="team-panel-card all-block-company" style={{ minHeight: 0, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '20px 24px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', maxWidth: 500, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={15} style={{ color: '#F97316' }} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', display: 'block' }}>
                  {companyName || 'Company Name'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {isCreator && (
                  <button
                    onClick={() => {
                      setEditProfileName(companyName)
                      setEditProfileDesc(companyProfile?.description ?? '')
                      setEditProfileLoc(companyProfile?.location ?? '')
                      setEditProfileAddress(companyProfile?.address ?? '')
                      setEditProfilePostal(companyProfile?.postal_code ?? '')
                      setEditProfileIndustry(companyProfile?.industry ?? '')
                      setEditProfileIndustryOther('')
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

            {!companyName ? (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div className="skeleton-line" style={{ height: 18, width: '40%' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="skeleton-line" style={{ height: 32, width: 60, borderRadius: 8 }} />
                  <div className="skeleton-line" style={{ height: 32, width: 72, borderRadius: 8 }} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 2 }} />

                {[
                  { label: 'Industry', value: companyProfile?.industry?.trim() || '—', icon: <BriefcaseBusiness size={13} strokeWidth={2.2} /> },
                  { label: 'Number of Staff', value: companyProfile?.size?.trim() || '—', icon: <UsersRound size={13} strokeWidth={2.2} /> },
                  { label: 'Address', value: companyProfile?.address?.trim() || '—', icon: <MapPinned size={13} strokeWidth={2.2} /> },
                  { label: 'Description', value: companyProfile?.description?.trim() || '—', icon: <FileText size={13} strokeWidth={2.2} /> },
                ].map((field) => (
                  <div key={field.label} style={{ padding: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 6, background: 'transparent', color: '#374151', flexShrink: 0 }}>
                        {field.icon}
                      </span>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: 0 }}>
                        {field.label}
                      </p>
                    </div>
                    <p style={{ fontWeight: 500, fontSize: '0.9375rem', color: '#111827', margin: 0, lineHeight: 1.45 }}>
                      {field.value}
                    </p>
                  </div>
                ))}
                <div style={{ height: 0 }} />
              </div>
            )}
          </div>
        )
      case 'activity': {
        return (
          <div className="all-block-activity" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: '18px 24px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={15} style={{ color: '#F97316' }} />
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Activity Log</span>
            </div>
            <div style={{ borderTop: '1px solid #E5E7EB', marginBottom: 14 }} />
            {activityLogs.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, textAlign: 'center', padding: '16px 0' }}>No activity yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 224, overflowY: 'auto' }}>
                {activityLogs.map((log, i) => {
                  const actionVerb: Record<string, string> = {
                    invite_member: 'Invited',
                    remove_member: 'Removed',
                    set_active:    'Activated',
                    set_inactive:  'Deactivated',
                  }
                  const actionIcon: Record<string, React.ReactNode> = {
                    invite_member: <div style={{ width: 26, height: 26, borderRadius: 7, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserPlus size={13} style={{ color: '#16A34A' }} /></div>,
                    remove_member: <div style={{ width: 26, height: 26, borderRadius: 7, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trash2 size={13} style={{ color: '#DC2626' }} /></div>,
                    set_active:    <div style={{ width: 26, height: 26, borderRadius: 7, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={13} style={{ color: '#16A34A' }} /></div>,
                    set_inactive:  <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={13} style={{ color: '#64748B' }} /></div>,
                  }
                  const verb = actionVerb[log.action] ?? log.action
                  const icon = actionIcon[log.action] ?? <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F1F5F9', flexShrink: 0 }} />
                  const date = new Date(log.created_at)
                  const timeStr = date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
                  return (
                    <div key={log.id} className="log-row-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < activityLogs.length - 1 ? '1px solid #F3F4F6' : 'none', animationDelay: `${0.22 + i * 0.06}s` }}>
                      <div style={{ flexShrink: 0 }}>{icon}</div>
                      <div>
                        <p style={{ fontSize: 13, color: '#0F172A', margin: 0, lineHeight: 1.5 }}>
                          {verb} {log.target_name ?? '—'}
                        </p>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', fontWeight: 500 }}>{timeStr}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      }
      case 'departments':
        return (
          <div className="all-block-dept" style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: '18px 24px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Network size={15} style={{ color: '#F97316' }} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Departments</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={openAddDepartment}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 10, background: OWNER_ORANGE, color: '#FFFFFF', height: 34, padding: '0 11px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #E5E7EB', marginBottom: 14 }} />
            {companyDepartments.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, textAlign: 'center', padding: '16px 0' }}>No departments yet</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {companyDepartments.map(dept => {
                  const mgrCount = teamMembers.filter(m => m.role === 'Manager' && m.department_id === dept.id).length
                  const empCount = teamMembers.filter(m => m.role === 'Employee' && m.department_id === dept.id).length
                  return (
                    <div
                      key={dept.id}
                      onClick={() => setHighlightDeptId(prev => prev === dept.id ? null : dept.id)}
                      className="dept-card-item"
                      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px', background: highlightDeptId === dept.id ? '#FFF7ED' : '#F9FAFB', border: `1px solid ${highlightDeptId === dept.id ? '#F97316' : '#E5E7EB'}`, borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', animationDelay: `${0.28 + companyDepartments.indexOf(dept) * 0.07}s` }}
                    >
                      <div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: deptColor(dept.id), flexShrink: 0 }} />
                          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#374151' }}>{dept.name}</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
                              <UserCog size={14} />
                            </span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{mgrCount}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', flexShrink: 0 }}>
                              <UserRound size={14} />
                            </span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{empCount}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                        <button
                          onClick={() => openEditDepartment(dept)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#9CA3AF', borderRadius: 6, flexShrink: 0, marginTop: 1 }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB'; (e.currentTarget as HTMLButtonElement).style.color = '#F97316' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF' }}
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      case 'casual':
        return (
          <ShowcaseCard
            className="all-block-cw"
            icon={<HardHat size={15} style={{ color: sharedIconColor }} />}
            title="Casual Workers"
            rightContent={<CWStatusBar activeCount={cwActiveCount} inactiveCount={cwInactiveCount} totalCount={casualWorkers.length} />}
            searchValue={cwSearchQuery}
            onSearchChange={setCwSearchQuery}
          >
            {(() => {
              if (teamLoading) {
                return (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
                    <Spinner size={16} dark />
                  </div>
                )
              }

              if (casualWorkers.length === 0) {
                return (
                  <div style={{ padding: '28px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No casual workers have joined yet</p>
                  </div>
                )
              }

              return (
                <div
                  ref={cwScrollRef}
                  onWheel={handleCwWheel}
                  className="cw-preview-scroll"
                  style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, paddingTop: 6, marginTop: -6, paddingRight: 4, scrollBehavior: 'auto' }}
                >
                  {casualWorkers.map(worker => {
                    const rawStatus = (worker.worker_status ?? 'active').toLowerCase()
                    const displayStatus = rawStatus === 'active' ? 'Active' : 'Inactive'
                    const matchesSearch = normalizedCwSearch.length === 0 || worker.full_name.toLowerCase().includes(normalizedCwSearch)
                    return (
                      <CasualWorkerPreviewCard
                        key={worker.id}
                        name={worker.full_name}
                        lastShift="—"
                        totalVisits={0}
                        status={displayStatus}
                        photoUrl={worker.profile_photo_url ?? null}
                        highlighted={normalizedCwSearch.length > 0 && matchesSearch}
                        dimmed={normalizedCwSearch.length > 0 && !matchesSearch}
                        onClick={() => {
                          setSelectedCWPreview({
                            id: worker.id,
                            name: worker.full_name,
                            lastShift: '—',
                            totalVisits: 0,
                            status: displayStatus,
                            inactiveReason: worker.inactivate_reason || null,
                            email: worker.email_address || null,
                            dateOfBirth: worker.date_of_birth || null,
                            phoneNumber: worker.phone_number || null,
                            photoUrl: worker.profile_photo_url || null,
                          })
                          setCWApplication(null)
                          setCWApplicationLoading(true)
                          fetch(`/api/team/cw-application?user_id=${worker.id}`)
                            .then(r => r.json())
                            .then(d => { if (d.success) setCWApplication(d.application) })
                            .catch(() => {})
                            .finally(() => setCWApplicationLoading(false))
                        }}
                      />
                    )
                  })}
                </div>
              )
            })()}
          </ShowcaseCard>
        )
      case 'internal':
        return (
          <ShowcaseCard
            className="all-block-internal"
            icon={<Users size={15} style={{ color: sharedIconColor }} />}
            title="Internal Members"
            rightContent={<InternalMembersBar partnerCount={partnerMembers.length} managerCount={managerMembers.length} employeeCount={employeeMembers.length} />}
            searchValue={internalSearchQuery}
            onSearchChange={setInternalSearchQuery}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {roleGroups.map((group, gi) => (
                <RoleGroupCard
                  key={group.label}
                  icon={group.icon}
                  label={group.label}
                  count={group.members.length}
                  emptyText={group.emptyText}
                >
                  <div
                    ref={el => { roleScrollRefs.current[gi] = el }}
                    onWheel={e => handleHorizWheel(e, roleScrollRefs.current[gi])}
                    style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, paddingTop: 6, marginTop: -6, paddingRight: 4, scrollBehavior: 'auto' }}
                  >
                    {group.members.map(member => {
                      const deptMatches = highlightDeptId !== null && member.department_id === highlightDeptId
                      const searchMatches = normalizedInternalSearch.length > 0 && (
                        member.full_name.toLowerCase().includes(normalizedInternalSearch) ||
                        member.role.toLowerCase().includes(normalizedInternalSearch)
                      )
                      const isHighlighted = deptMatches || searchMatches
                      const isDimmed = (highlightDeptId !== null || normalizedInternalSearch.length > 0) && !isHighlighted
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setProfileMember(member)}
                          className="internal-member-card"
                          style={{
                            flex: '0 0 110px',
                            width: 110,
                            minWidth: 110,
                            maxWidth: 110,
                            height: 128,
                            padding: '10px 1px',
                            borderRadius: 8,
                            border: isHighlighted ? '2px solid #F97316' : '1.5px solid #E5E7EB',
                            background: isHighlighted ? '#FFF7ED' : '#FFFFFF',
                            boxShadow: isHighlighted ? '0 0 0 3px rgba(249,115,22,0.18), 0 4px 12px rgba(249,115,22,0.15)' : '0 1px 3px rgba(15,23,42,0.06)',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            textAlign: 'center',
                            opacity: isDimmed ? 0.35 : 1,
                            transition: 'box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease, opacity 0.22s ease, background 0.22s ease',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
                            <RoleAvatar role={member.role} size={80} photoUrl={member.profile_photo_url ?? null} />
                            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px', maxWidth: '100%' }}>
                              {member.full_name}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </RoleGroupCard>
              ))}
            </div>
          </ShowcaseCard>
        )
    }
  }

  useLayoutEffect(() => {
    const container = tabBarRef.current
    const activeButton = tabButtonRefs.current[teamViewTab]
    if (!container || !activeButton) return

    const containerRect = container.getBoundingClientRect()
    const activeRect = activeButton.getBoundingClientRect()
    setTabIndicator({
      left: activeRect.left - containerRect.left,
      width: activeRect.width,
      opacity: 1,
    })
  }, [teamViewTab])

  useEffect(() => {
    const updateIndicator = () => {
      const container = tabBarRef.current
      const activeButton = tabButtonRefs.current[teamViewTab]
      if (!container || !activeButton) return

      const containerRect = container.getBoundingClientRect()
      const activeRect = activeButton.getBoundingClientRect()
      setTabIndicator({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
        opacity: 1,
      })
    }

    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [teamViewTab])

  function timeAgo(ts: string): string {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F1F5F9' }}>
      <style>{`
        ${teamTabKeyframes}
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
        .org-role-export {
          display: none;
        }
        .org-chart-capture.org-chart-exporting,
        .org-chart-capture.org-chart-exporting *,
        .org-chart-exporting .org-chart-capture,
        .org-chart-exporting .org-chart-capture * {
          animation: none !important;
          transition: none !important;
          font-family: var(--font-heading), "Plus Jakarta Sans", "Inter", "Segoe UI", system-ui, sans-serif !important;
          letter-spacing: 0 !important;
          text-rendering: geometricPrecision !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
        }
        .org-chart-exporting .org-dept-col {
          opacity: 1 !important;
          transform: none !important;
        }
        .org-chart-exporting .org-dept-header {
          height: 42px !important;
          min-height: 42px !important;
          padding: 0 12px !important;
          overflow: visible !important;
          box-sizing: border-box !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .org-chart-exporting .org-dept-title-btn {
          height: 100% !important;
          min-height: 0 !important;
          line-height: normal !important;
          overflow: visible !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .org-chart-exporting .org-dept-title-text {
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: nowrap !important;
          line-height: normal !important;
          font-size: 1rem !important;
          font-weight: 800 !important;
          padding: 0 !important;
        }
        .org-chart-exporting .org-dept-dot {
          display: none !important;
        }
        .org-chart-exporting .org-node-manager {
          border-color: #E5E7EB !important;
        }
        .org-chart-exporting .org-node-btn {
          min-height: 84px !important;
          animation: none !important;
          transform: none !important;
          justify-content: center !important;
          opacity: 1 !important;
        }
        .org-chart-exporting .org-node-avatar {
          display: none !important;
        }
        .org-chart-exporting .org-name-export {
          display: block !important;
          font-size: 0.875rem !important;
          font-weight: 800 !important;
          line-height: 1.22 !important;
        }
        .org-chart-exporting .org-role-export {
          display: block !important;
          color: #64748B !important;
          font-size: 0.76rem !important;
          font-weight: 700 !important;
          line-height: 1.2 !important;
        }
        .org-dept-col {
          transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease !important;
        }
        .org-dept-col:hover {
          box-shadow: 0 10px 28px rgba(0,0,0,0.12) !important;
          transform: translateY(-3px) !important;
          border-color: #F97316 !important;
        }
        .cw-preview-card {
          flex: 0 0 110px !important;
          width: 110px !important;
          min-width: 110px !important;
          max-width: 110px !important;
          animation: cardStagger 0.32s ease both;
        }
        .cw-preview-card:nth-child(1)  { animation-delay: 0.12s; }
        .cw-preview-card:nth-child(2)  { animation-delay: 0.18s; }
        .cw-preview-card:nth-child(3)  { animation-delay: 0.24s; }
        .cw-preview-card:nth-child(4)  { animation-delay: 0.30s; }
        .cw-preview-card:nth-child(5)  { animation-delay: 0.36s; }
        .cw-preview-card:nth-child(6)  { animation-delay: 0.42s; }
        .cw-preview-card:nth-child(n+7){ animation-delay: 0.48s; }
        .cw-preview-card:hover {
          box-shadow: 0 8px 18px rgba(15,23,42,0.08) !important;
          transform: translateY(-2px) scale(1.01) !important;
          z-index: 2;
          position: relative;
        }
        .role-group-card {
          transition: box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease;
        }
        .role-group-card:hover {
          box-shadow: 0 8px 18px rgba(15,23,42,0.08) !important;
          transform: translateY(-2px) !important;
        }
        .internal-member-card {
          flex: 0 0 110px !important;
          width: 110px !important;
          min-width: 110px !important;
          max-width: 110px !important;
          animation: cardStagger 0.32s ease both;
        }
        .internal-member-card:nth-child(1)  { animation-delay: 0.20s; }
        .internal-member-card:nth-child(2)  { animation-delay: 0.26s; }
        .internal-member-card:nth-child(3)  { animation-delay: 0.32s; }
        .internal-member-card:nth-child(4)  { animation-delay: 0.38s; }
        .internal-member-card:nth-child(5)  { animation-delay: 0.44s; }
        .internal-member-card:nth-child(6)  { animation-delay: 0.50s; }
        .internal-member-card:nth-child(n+7){ animation-delay: 0.56s; }
        .internal-member-card:hover {
          box-shadow: 0 8px 18px rgba(15,23,42,0.08) !important;
          transform: translateY(-2px) scale(1.01) !important;
          z-index: 2;
          position: relative;
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
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        <div style={{ padding: '16px 28px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 20 }}>
            <div
              ref={tabBarRef}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: 4,
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: 999,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                overflow: 'hidden',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 4,
                  left: tabIndicator.left,
                  width: tabIndicator.width,
                  height: 'calc(100% - 8px)',
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
                  boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
                  opacity: tabIndicator.opacity,
                  transform: tabIndicator.opacity ? 'translateY(0)' : 'translateY(4px)',
                  transition: 'left 0.24s cubic-bezier(0.22, 1, 0.36, 1), width 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                  pointerEvents: 'none',
                }}
              />
              {([ 
                { id: 'all' as const, label: 'All Members' },
                { id: 'org' as const, label: 'Organization Chart' },
              ]).map(tab => {
                const active = teamViewTab === tab.id
                return (
                  <button
                    key={tab.id}
                    ref={el => { tabButtonRefs.current[tab.id] = el }}
                    type="button"
                    onClick={() => setTeamViewTab(tab.id)}
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      height: 36,
                      padding: '0 18px',
                      borderRadius: 999,
                      border: 'none',
                      background: 'transparent',
                      color: active ? '#FFFFFF' : '#64748B',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: 'none',
                      transition: 'color 0.18s ease, transform 0.18s ease',
                      transform: active ? 'translateY(-0.5px)' : 'translateY(0)',
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div key={teamViewTab} style={{ animation: 'teamTabContentIn 0.24s ease-out both' }}>
          {teamViewTab === 'all' && (() => {
            const leftBlockIds = allBlockOrder.slice(0, 3)
            const rightBlockIds = allBlockOrder.slice(3)
            return (
              <div style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
                <div style={{ flex: '0 0 500px', width: 500, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {leftBlockIds.map(blockId => (
                    <div key={blockId} style={{ minWidth: 0 }}>
                      {renderAllBlockFrame(blockId, renderAllBlockContent(blockId))}
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {rightBlockIds.map(blockId => (
                    <div key={blockId} style={{ minWidth: 0 }}>
                      {renderAllBlockFrame(blockId, renderAllBlockContent(blockId))}
                    </div>
                  ))}
                </div>
              </div>
            )
            const casualWorkers = teamMembers
              .filter(m => m.role === 'Casual Worker')
              .sort((a, b) => {
                const aActive = (a.worker_status ?? 'active') === 'active' ? 0 : 1
                const bActive = (b.worker_status ?? 'active') === 'active' ? 0 : 1
                return aActive - bActive
              })
            const partnerMembers = teamMembers.filter(m => m.role === 'Partner')
            const managerMembers = teamMembers.filter(m => m.role === 'Manager')
            const employeeMembers = teamMembers.filter(m => m.role === 'Employee')
            const sharedIconColor = '#F97316'
            const roleGroups = [
              {
                label: 'Partner',
                icon: <Crown size={13} strokeWidth={2.2} style={{ color: '#374151' }} />,
                members: partnerMembers,
                emptyText: 'No partners have joined yet',
              },
              {
                label: 'Manager',
                icon: <UserCog size={13} strokeWidth={2.2} style={{ color: '#374151' }} />,
                members: managerMembers,
                emptyText: 'No managers have joined yet',
              },
              {
                label: 'Employee',
                icon: <UserRound size={13} strokeWidth={2.2} style={{ color: '#374151' }} />,
                members: employeeMembers,
                emptyText: 'No employees have joined yet',
              },
            ] as const
            const cwActiveCount = casualWorkers.filter(w => (w.worker_status ?? 'active') === 'active').length
            const cwInactiveCount = casualWorkers.length - cwActiveCount

            return (
              <div style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
                <div style={{ flex: '0 0 500px', width: 500, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="team-panel-card all-block-company" style={{ minHeight: 0, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '20px 24px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', maxWidth: 500, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Building2 size={15} style={{ color: '#F97316' }} />
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', display: 'block' }}>
                          {companyName || 'Company Name'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {isCreator && (
                          <button
                            onClick={() => {
                              setEditProfileName(companyName)
                              setEditProfileDesc(companyProfile?.description ?? '')
                              setEditProfileLoc(companyProfile?.location ?? '')
                              setEditProfileAddress(companyProfile?.address ?? '')
                              setEditProfilePostal(companyProfile?.postal_code ?? '')
                              setEditProfileIndustry(companyProfile?.industry ?? '')
                              setEditProfileIndustryOther('')
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

                    {!companyName ? (
                      <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div className="skeleton-line" style={{ height: 18, width: '40%' }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div className="skeleton-line" style={{ height: 32, width: 60, borderRadius: 8 }} />
                          <div className="skeleton-line" style={{ height: 32, width: 72, borderRadius: 8 }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 2 }} />

                        {[
                          { label: 'Industry', value: companyProfile?.industry?.trim() || '—', icon: <BriefcaseBusiness size={13} strokeWidth={2.2} /> },
                          { label: 'Number of Staff', value: companyProfile?.size?.trim() || '—', icon: <UsersRound size={13} strokeWidth={2.2} /> },
                          { label: 'Address', value: companyProfile?.address?.trim() || '—', icon: <MapPinned size={13} strokeWidth={2.2} /> },
                          { label: 'Description', value: companyProfile?.description?.trim() || '—', icon: <FileText size={13} strokeWidth={2.2} /> },
                        ].map((field) => (
                          <div key={field.label} style={{ padding: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 6, background: 'transparent', color: '#374151', flexShrink: 0 }}>
                                {field.icon}
                              </span>
                              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: 0 }}>
                                {field.label}
                              </p>
                            </div>
                            <p style={{ fontWeight: 500, fontSize: '0.9375rem', color: '#111827', margin: 0, lineHeight: 1.45 }}>
                              {field.value}
                            </p>
                          </div>
                        ))}
                        <div style={{ height: 0 }} />
                      </div>
                    )}
                  </div>

                  {/* Activity Log block */}
                  <div className="all-block-activity" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: '18px 24px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={15} style={{ color: '#F97316' }} />
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Activity Log</span>
                    </div>
                    <div style={{ borderTop: '1px solid #E5E7EB', marginBottom: 14 }} />
                    {activityLogs.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, textAlign: 'center', padding: '16px 0' }}>No activity yet</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 224, overflowY: 'auto' }}>
                        {activityLogs.map((log, i) => {
                          const actionVerb: Record<string, string> = {
                            invite_member: 'Invited',
                            remove_member: 'Removed',
                            set_active:    'Activated',
                            set_inactive:  'Deactivated',
                          }
                          const actionIcon: Record<string, React.ReactNode> = {
                            invite_member: <div style={{ width: 26, height: 26, borderRadius: 7, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserPlus size={13} style={{ color: '#16A34A' }} /></div>,
                            remove_member: <div style={{ width: 26, height: 26, borderRadius: 7, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trash2 size={13} style={{ color: '#DC2626' }} /></div>,
                            set_active:    <div style={{ width: 26, height: 26, borderRadius: 7, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={13} style={{ color: '#16A34A' }} /></div>,
                            set_inactive:  <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={13} style={{ color: '#64748B' }} /></div>,
                          }
                          const verb = actionVerb[log.action] ?? log.action
                          const icon = actionIcon[log.action] ?? <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F1F5F9', flexShrink: 0 }} />
                          const date = new Date(log.created_at)
                          const timeStr = date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
                          return (
                            <div key={log.id} className="log-row-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < activityLogs.length - 1 ? '1px solid #F3F4F6' : 'none', animationDelay: `${0.22 + i * 0.06}s` }}>
                              <div style={{ flexShrink: 0 }}>{icon}</div>
                              <div>
                                <p style={{ fontSize: 13, color: '#0F172A', margin: 0, lineHeight: 1.5 }}>
                                  {verb} {log.target_name ?? '—'}
                                </p>
                                <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', fontWeight: 500 }}>{timeStr}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Departments block */}
                  <div className="all-block-dept" style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: '18px 24px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Network size={15} style={{ color: '#F97316' }} />
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Departments</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={openAddDepartment}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 10, background: OWNER_ORANGE, color: '#FFFFFF', height: 34, padding: '0 11px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                        >
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid #E5E7EB', marginBottom: 14 }} />
                    {companyDepartments.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, textAlign: 'center', padding: '16px 0' }}>No departments yet</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {companyDepartments.map(dept => {
                          const mgrCount = teamMembers.filter(m => m.role === 'Manager' && m.department_id === dept.id).length
                          const empCount = teamMembers.filter(m => m.role === 'Employee' && m.department_id === dept.id).length
                          return (
                          <div
                            key={dept.id}
                            onClick={() => setHighlightDeptId(prev => prev === dept.id ? null : dept.id)}
                            className="dept-card-item"
                            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px', background: highlightDeptId === dept.id ? '#FFF7ED' : '#F9FAFB', border: `1px solid ${highlightDeptId === dept.id ? '#F97316' : '#E5E7EB'}`, borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', animationDelay: `${0.28 + companyDepartments.indexOf(dept) * 0.07}s` }}
                          >
                            <div>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 999, background: deptColor(dept.id), flexShrink: 0 }} />
                                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#374151' }}>{dept.name}</span>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
                                    <UserCog size={14} />
                                  </span>
                                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{mgrCount}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', flexShrink: 0 }}>
                                    <UserRound size={14} />
                                  </span>
                                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{empCount}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                              <button
                                onClick={() => openEditDepartment(dept)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#9CA3AF', borderRadius: 6, flexShrink: 0, marginTop: 1 }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB'; (e.currentTarget as HTMLButtonElement).style.color = '#F97316' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF' }}
                              >
                                <Pencil size={13} />
                              </button>
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <ShowcaseCard
                      className="all-block-cw"
                      icon={<HardHat size={15} style={{ color: sharedIconColor }} />}
                      title="Casual Workers"
                      rightContent={<CWStatusBar activeCount={cwActiveCount} inactiveCount={cwInactiveCount} totalCount={casualWorkers.length} />}
                      searchValue={cwSearchQuery}
                      onSearchChange={setCwSearchQuery}
                    >
                      {(() => {
                        if (teamLoading) {
                          return (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
                              <Spinner size={16} dark />
                            </div>
                          )
                        }

                        if (casualWorkers.length === 0) {
                          return (
                            <div style={{ padding: '28px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No casual workers have joined yet</p>
                            </div>
                          )
                        }

                        return (
                          <div
                            ref={cwScrollRef}
                            onWheel={handleCwWheel}
                            className="cw-preview-scroll"
                            style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, paddingTop: 6, marginTop: -6, paddingRight: 4, scrollBehavior: 'auto' }}
                          >
                            {casualWorkers.map(worker => {
                              const rawStatus = (worker.worker_status ?? 'active').toLowerCase()
                              const displayStatus = rawStatus === 'active' ? 'Active' : 'Inactive'
                              const matchesSearch = normalizedCwSearch.length === 0 || worker.full_name.toLowerCase().includes(normalizedCwSearch)
                              return (
                                <CasualWorkerPreviewCard
                                  key={worker.id}
                                  name={worker.full_name}
                                  lastShift="—"
                                  totalVisits={0}
                                  status={displayStatus}
                                  photoUrl={worker.profile_photo_url ?? null}
                                  highlighted={normalizedCwSearch.length > 0 && matchesSearch}
                                  dimmed={normalizedCwSearch.length > 0 && !matchesSearch}
                                  onClick={() => {
                                    setSelectedCWPreview({
                                      id: worker.id,
                                      name: worker.full_name,
                                      lastShift: '—',
                                      totalVisits: 0,
                                      status: displayStatus,
                                      inactiveReason: worker.inactivate_reason || null,
                                      email: worker.email_address || null,
                                      dateOfBirth: worker.date_of_birth || null,
                                      phoneNumber: worker.phone_number || null,
                                      photoUrl: worker.profile_photo_url || null,
                                    })
                                    setCWApplication(null)
                                    setCWApplicationLoading(true)
                                    fetch(`/api/team/cw-application?user_id=${worker.id}`)
                                      .then(r => r.json())
                                      .then(d => { if (d.success) setCWApplication(d.application) })
                                      .catch(() => {})
                                      .finally(() => setCWApplicationLoading(false))
                                  }}
                                />
                              )
                            })}
                          </div>
                        )
                      })()}
                    </ShowcaseCard>

                    <ShowcaseCard
                      className="all-block-internal"
                      icon={<Users size={15} style={{ color: sharedIconColor }} />}
                      title="Internal Members"
                      rightContent={<InternalMembersBar partnerCount={partnerMembers.length} managerCount={managerMembers.length} employeeCount={employeeMembers.length} />}
                      searchValue={internalSearchQuery}
                      onSearchChange={setInternalSearchQuery}
                    >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {roleGroups.map((group, gi) => (
                      <RoleGroupCard
                        key={group.label}
                        icon={group.icon}
                        label={group.label}
                        count={group.members.length}
                        emptyText={group.emptyText}
                      >
                          <div
                          ref={el => { roleScrollRefs.current[gi] = el }}
                          onWheel={e => handleHorizWheel(e, roleScrollRefs.current[gi])}
                          style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, paddingTop: 6, marginTop: -6, paddingRight: 4, scrollBehavior: 'auto' }}
                        >
                          {group.members.map(member => {
                            const deptMatches = highlightDeptId !== null && member.department_id === highlightDeptId
                            const searchMatches = normalizedInternalSearch.length > 0 && (
                              member.full_name.toLowerCase().includes(normalizedInternalSearch) ||
                              member.role.toLowerCase().includes(normalizedInternalSearch)
                            )
                            const isHighlighted = deptMatches || searchMatches
                            const isDimmed = (highlightDeptId !== null || normalizedInternalSearch.length > 0) && !isHighlighted
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => setProfileMember(member)}
                                className="internal-member-card"
                                style={{
                                  flex: '0 0 110px',
                                  width: 110,
                                  minWidth: 110,
                                  maxWidth: 110,
                                  height: 128,
                                  padding: '10px 1px',
                                  borderRadius: 8,
                                  border: isHighlighted ? '2px solid #F97316' : '1.5px solid #E5E7EB',
                                  background: isHighlighted ? '#FFF7ED' : '#FFFFFF',
                                  boxShadow: isHighlighted ? '0 0 0 3px rgba(249,115,22,0.18), 0 4px 12px rgba(249,115,22,0.15)' : '0 1px 3px rgba(15,23,42,0.06)',
                                  flexShrink: 0,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  textAlign: 'center',
                                  opacity: isDimmed ? 0.35 : 1,
                                  transition: 'box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease, opacity 0.22s ease, background 0.22s ease',
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
                                  <RoleAvatar role={member.role} size={80} photoUrl={member.profile_photo_url ?? null} />
                                  <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px', maxWidth: '100%' }}>
                                    {member.full_name}
                                  </p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </RoleGroupCard>
                    ))}
                  </div>
                </ShowcaseCard>
                  </div>
              </div>
            )
          })()}

          {teamViewTab === 'org' && (
            <ShowcaseCard
              className="org-chart-wrap"
              icon={<Network size={15} style={{ color: '#F97316' }} />}
              title="Organisation Chart"
              actions={
                <button
                  type="button"
                  onClick={handleExportOrgChart}
                  disabled={orgExporting || teamLoading}
                  title="Export as image"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: orgExporting ? '#F3F4F6' : '#F9FAFB', color: '#374151', fontSize: 13, fontWeight: 600, cursor: orgExporting || teamLoading ? 'default' : 'pointer', opacity: orgExporting || teamLoading ? 0.6 : 1, transition: 'background 0.15s, border-color 0.15s', flexShrink: 0 }}
                  onMouseEnter={e => { if (!orgExporting && !teamLoading) { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.borderColor = '#D1D5DB' } }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#E5E7EB' }}
                >
                  <Download size={14} />
                  {orgExporting ? 'Exporting…' : 'Export'}
                </button>
              }
              searchValue={orgSearchQuery}
              onSearchChange={setOrgSearchQuery}
              fillHeight
            >
              {teamLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: '0.9375rem' }}>
                  <Spinner size={16} dark /> Loading…
                </div>
                ) : (
                  <div ref={orgChartRef} style={{ background: '#ffffff', padding: '8px 0' }}>
                    <OrgChartTree
                      topMembers={teamMembers.filter(m => m.role === 'Owner' || m.role === 'Partner')}
                      departments={companyDepartments}
                      teamMembers={teamMembers}
                      onMemberClick={(m) => setProfileMember(m)}
                      onDepartmentClick={(department) => openEditDepartment(department)}
                      searchQuery={normalizedOrgSearch}
                    />
                  </div>
              )}
            </ShowcaseCard>
          )}
          </div>
        </div>
      </main>

      {/* ── Department Modal ───────────────────────────────────────────── */}
      {/* ── Add/Edit/Delete Department Modal ──────────────────────────── */}
      {departmentModal && (
        <ModalOverlay onClose={() => setDepartmentModal(null)} maxWidth="420px">
          <ModalBox>
            {departmentModal === 'edit' && activeDepartment ? (
              <>
                <ModalHeader title="Edit Department" icon={<Network size={15} color="#fff" strokeWidth={2} />} onClose={() => setDepartmentModal(null)} />
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={modalLabelStyle}>Department name</label>
                    <input value={departmentNameInput} onChange={e => setDepartmentNameInput(e.target.value)} style={modalInputStyle} placeholder="Operations" />
                  </div>

                  <DepartmentColorPicker value={departmentColorInput} onChange={setDepartmentColorInput} usedColors={companyDepartments.filter(d => d.id !== activeDepartment.id).map(d => d.color ?? deptColor(d.id))} />
                  {departmentActionError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>{departmentActionError}</div>}
                </div>
                <div style={{ padding: '0 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                  {(() => {
                    const hasMembers = teamMembers.filter(m => m.department_id === activeDepartment.id).length > 0
                    const deleteDisabled = departmentActionLoading || hasMembers
                    return (
                      <button type="button" onClick={handleDeleteDepartment} disabled={deleteDisabled} title={hasMembers ? 'Reassign or remove all members before deleting this department' : undefined} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', borderRadius: 8, background: deleteDisabled ? '#F3A8A8' : 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', height: 36, padding: '0 14px', fontSize: '0.8125rem', fontWeight: 600, cursor: deleteDisabled ? 'not-allowed' : 'pointer', opacity: deleteDisabled ? 0.7 : 1, marginRight: 'auto' }}>{departmentActionLoading ? <Spinner size={13} /> : <Trash2 size={13} />} Delete</button>
                    )
                  })()}
                  {(() => {
                    const editDisabled = departmentActionLoading || !departmentNameInput.trim()
                    return (
                      <button type="button" onClick={handleSaveDepartment} disabled={editDisabled} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: editDisabled ? '#FDA060' : '#F97316', color: '#FFFFFF', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: editDisabled ? 'not-allowed' : 'pointer', opacity: editDisabled ? 0.65 : 1 }}>{departmentActionLoading ? <Spinner /> : <Check size={16} />} Save</button>
                    )
                  })()}
                </div>
              </>
            ) : (
              <>
                <ModalHeader title={departmentModal === 'add' ? 'Add Department' : 'Edit Department'} icon={<Network size={15} color="#fff" strokeWidth={2} />} onClose={() => setDepartmentModal(null)} />
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {departmentModal === 'add' && (
                    <div style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'inline-flex', border: '1.5px solid #E5E7EB', borderRadius: 9, overflow: 'hidden' }}>
                        {(['manual', 'import'] as const).map(tab => (
                          <button key={tab} type="button" onClick={() => setDepartmentModalTab(tab)} style={{ border: 0, height: 34, padding: '0 20px', background: departmentModalTab === tab ? '#0F172A' : '#FFFFFF', color: departmentModalTab === tab ? '#FFFFFF' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                            {tab === 'manual' ? 'Single' : 'Import'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div key={departmentModalTab} style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'tabFadeIn 0.2s ease-out' }}>
                  {departmentModalTab === 'manual' ? (
                    <>
                      <div>
                        <label style={modalLabelStyle}>Department name</label>
                        <input value={departmentNameInput} onChange={e => setDepartmentNameInput(e.target.value)} style={modalInputStyle} placeholder="Operations" />
                      </div>
                      <DepartmentColorPicker value={departmentColorInput} onChange={setDepartmentColorInput} usedColors={companyDepartments.map(d => d.color ?? deptColor(d.id))} />
                    </>
                  ) : (
                    <>
                      {/* Sample CSV preview */}
                      <div>
                        <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Sample CSV format</p>
                        <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', fontSize: '0.8125rem' }}>
                          <div style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                            <div style={{ padding: '7px 12px', fontWeight: 700, color: '#6B7280', fontFamily: "'Inter', system-ui, sans-serif" }}>Department</div>
                          </div>
                          {['Operations', 'Marketing', 'Engineering'].map((name, i) => (
                            <div key={i} style={{ borderBottom: i < 2 ? '1px solid #F3F4F6' : 'none' }}>
                              <div style={{ padding: '6px 12px', color: '#374151' }}>{name}</div>
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
                          onChange={e => void handleDepartmentImportFile(e.target.files?.[0] ?? null)}
                          style={{ display: 'none' }}
                        />
                        <Upload size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.9375rem', color: departmentImportRows.length > 0 ? '#111827' : '#9CA3AF' }}>
                          {departmentImportRows.length > 0 ? `${departmentImportRows.length} row(s) ready to import` : 'Choose a CSV file'}
                        </span>
                      </label>
                      {departmentImportRows.length > 0 && (
                        <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                          {departmentImportRows.map(name => (
                            <div key={name} style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8125rem', color: '#374151' }}>
                              {name}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  </div>
                  {departmentActionError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>{departmentActionError}</div>}
                </div>
                <div style={{ padding: '0 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                  {(() => {
                    const addDisabled = departmentActionLoading || (departmentModalTab === 'manual' ? !departmentNameInput.trim() : departmentImportRows.length === 0)
                    return (
                      <button type="button" onClick={handleSaveDepartment} disabled={addDisabled} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: addDisabled ? '#FDA060' : '#F97316', color: '#FFFFFF', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: addDisabled ? 'not-allowed' : 'pointer', opacity: addDisabled ? 0.65 : 1 }}>{departmentActionLoading ? <Spinner /> : departmentModalTab === 'import' ? <Upload size={16} /> : <Check size={16} />} Save</button>
                    )
                  })()}
                </div>
              </>
            )}
          </ModalBox>
        </ModalOverlay>
      )}

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
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div style={{ width: '560px' }}>
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
              <RoleAvatar role={profileMember.role} size={44} photoUrl={profileMember.profile_photo_url} />
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
                { label: 'Date of Birth', value: formatDateDisplay(profileMember.date_of_birth) },
                { label: 'Phone Number', value: profileMember.phone_number ?? '—' },
                { label: 'Joined On', value: formatDateDisplay(profileMember.created_at) },
              ].map((field, i, arr) => (
                <div key={field.label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{field.label}</label>
                  <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>{field.value}</p>
                </div>
              ))}
              {(profileMember.role === 'Manager' || profileMember.role === 'Employee') && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ ...modalLabelStyle, marginBottom: 6 }}>Department</label>
                  {canRemove(profileMember) && companyDepartments.length > 0 ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <DropdownField
                        value={profileDeptSelectedId}
                        onChange={value => void handleProfileDepartmentChange(value)}
                        placeholder="Select department"
                        disabled={profileDeptSaving}
                        options={companyDepartments.map(department => ({ value: department.id, label: department.name }))}
                      />
                      {profileDeptSaving && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#9CA3AF', fontSize: 13 }}>
                          <Spinner size={13} dark /> Updating department...
                        </div>
                      )}
                      {profileDeptError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px', fontSize: '0.8125rem', color: '#DC2626' }}>
                          {profileDeptError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>
                      {companyDepartments.find(d => d.id === profileMember.department_id)?.name ?? '—'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {profileMember.id !== internalUserId && (
              <button
                onClick={() => { setProfileMember(null); router.push(`/owner/communication?tab=messages&partner_id=${profileMember.id}`) }}
                style={{ padding: '7px 16px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#FFFFFF', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
              >
                <MessageCircle size={13} />
                Send Message
              </button>
              )}
              {canRemove(profileMember) && (
                <button
                  onClick={() => { setProfileMember(null); setRemoveModal(profileMember); setRemoveError('') }}
                  style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #EF4444, #DC2626)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 size={13} />
                  Remove
                </button>
              )}
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Casual Worker Detail Modal ───────────────────────────────────── */}
      {selectedCWPreview && (
        <ModalOverlay onClose={() => setSelectedCWPreview(null)} maxWidth="420px">
          <ModalBox>
            <ModalHeader title="Casual Worker Detail" icon={<HardHat size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setSelectedCWPreview(null)} />

            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 14 }}>
              <RoleAvatar role="Casual Worker" size={44} photoUrl={selectedCWPreview.photoUrl ?? null} />
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: 0 }}>{selectedCWPreview.name}</p>
              </div>
            </div>

            <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column' }}>
              {[
                { label: 'Email Address', value: selectedCWPreview.email || '—' },
                { label: 'Date of Birth', value: formatDateDisplay(selectedCWPreview.dateOfBirth) },
                { label: 'Phone Number', value: selectedCWPreview.phoneNumber || '—' },
                { label: 'Resume File', value: cwApplicationLoading ? 'Loading…' : (cwApplication?.resume_url || '—') },
                { label: 'Cover Letter File', value: cwApplicationLoading ? 'Loading…' : (cwApplication?.cover_letter || '—') },
                ...(selectedCWPreview.status === 'Inactive' && selectedCWPreview.inactiveReason ? [
                  { label: 'Reason', value: selectedCWPreview.inactiveReason },
                ] : []),
              ].map((field) => (
                <div key={field.label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{field.label}</label>
                  <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>{field.value}</p>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #F3F4F6', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={async () => {
                  const current = selectedCWPreview
                  if (!current) return
                  if (current.status === 'Active') {
                    // Open reason modal when inactivating
                    setCWInactiveReasonModal(current)
                    setCWInactiveReason('')
                  } else {
                    // Activate directly - call API
                    try {
                      const res = await fetch('/api/team/casual-worker-status', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          user_id: current.id,
                          worker_status: 'active',
                          inactivate_reason: null,
                        }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setTeamMembers(prev => prev.map(m => m.id === current.id ? { ...m, worker_status: 'active', inactivate_reason: null } : m))
                        setSelectedCWPreview(null)
                        showCWDetailSuccess(`${current.name} has been set to Active.`)
                        logActivity('set_active', current.name)
                      }
                    } catch (err) {
                      console.error('Failed to update CW status:', err)
                    }
                  }
                }}
                style={{
                  padding: '7px 18px',
                  border: 'none',
                  borderRadius: 8,
                  background: selectedCWPreview.status === 'Active' ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {selectedCWPreview.status === 'Active' ? (
                  <>
                    <X size={13} strokeWidth={2.5} />
                    Inactive
                  </>
                ) : (
                  <>
                    <Check size={13} strokeWidth={2.5} />
                    Active
                  </>
                )}
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── CW Inactive Reason Modal ──────────────────────────────────────── */}
      {cwInactiveReasonModal && (
        <ModalOverlay onClose={() => setCWInactiveReasonModal(null)} maxWidth="480px">
          <ModalBox>
            <ModalHeader title={`Inactive ${cwInactiveReasonModal.name}`} icon={<HardHat size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setCWInactiveReasonModal(null)} />

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={modalLabelStyle}>Reason</label>
                <textarea
                  value={cwInactiveReason}
                  onChange={(e) => setCWInactiveReason(e.target.value)}
                  placeholder="Enter reason for inactivation..."
                  style={{
                    ...modalInputStyle,
                    minHeight: 100,
                    resize: 'vertical',
                  } as React.CSSProperties}
                />
              </div>
            </div>

            <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setCWInactiveReasonModal(null)}
                style={{ padding: '7px 16px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!cwInactiveReasonModal) return
                  try {
                    const res = await fetch('/api/team/casual-worker-status', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        user_id: cwInactiveReasonModal.id,
                        worker_status: 'inactive',
                        inactivate_reason: cwInactiveReason || null,
                      }),
                    })
                    const data = await res.json()
                    if (data.success) {
                      const name = cwInactiveReasonModal.name
                      setTeamMembers(prev => prev.map(m => m.id === cwInactiveReasonModal.id ? { ...m, worker_status: 'inactive', inactivate_reason: cwInactiveReason || null } : m))
                      setCWInactiveReasonModal(null)
                      setCWInactiveReason('')
                      setSelectedCWPreview(null)
                      showCWDetailSuccess(`${name} has been set to Inactive.`)
                      logActivity('set_inactive', name, cwInactiveReason || undefined)
                    }
                  } catch (err) {
                    console.error('Failed to inactivate CW:', err)
                  }
                }}
                style={{ padding: '7px 18px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <X size={13} strokeWidth={2.5} />
                Inactivate
              </button>
            </div>
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
                      onChange={(e) => {
                        setInviteEmail(e.target.value)
                        setInviteError('')
                        setInviteSuccess('')
                      }}
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
              </>
            )}

            {/* Footer */}
            {inviteTab === 'import' && currentUserRole !== 'Manager' ? (
              <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
          <ModalBox closing={editProfileClosing}>
            <ModalHeader title="Edit Company Profile" icon={<Building2 size={15} color="#fff" strokeWidth={2} />} onClose={() => setEditProfileOpen(false)} />

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleEditProfile()
              }}
            >
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
                    <div style={{ position: 'relative' }}>
                      <input
                        value={editProfilePostal}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                          setEditProfileError('')
                          setEditProfilePostal(digits)
                          if (digits.length < 6) {
                            setEditProfileLoc('')
                            setEditProfileAddress('')
                          }
                        }}
                        placeholder="e.g. 238858"
                        maxLength={6}
                        style={{ ...modalInputStyle, paddingRight: editPostalLoading ? 40 : undefined }}
                      />
                      {editPostalLoading && (
                        <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                          <Spinner size={14} dark />
                        </div>
                      )}
                    </div>
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
                  type="submit"
                  disabled={editProfileLoading}
                  style={{ padding: '7px 18px', background: editProfileLoading ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: editProfileLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: editProfileLoading ? 0.65 : 1 }}
                >
                  {editProfileLoading ? <Spinner size={13} /> : <Check size={13} />} Save Changes
                </button>
              </div>
            </form>
          </ModalBox>
        </ModalOverlay>
      )}

      <Toast message={editProfileSuccess} />
      <Toast message={departmentSuccessToast} />
      <Toast message={inviteSuccessToast} />
      <Toast message={cwDetailSuccess} />
      <style>{`
        .cw-preview-scroll::-webkit-scrollbar { height: 10px; }
        .cw-preview-scroll::-webkit-scrollbar-track { background: #E5E7EB; border-radius: 999px; }
        .cw-preview-scroll::-webkit-scrollbar-thumb { background: #A3A3A3; border-radius: 999px; }
      `}</style>
    </div>
  )
}

