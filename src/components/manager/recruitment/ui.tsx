import React from 'react'
import { Check, X } from 'lucide-react'

// ─── Styles (shared across form components) ───────────────────────────────────

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: '8px', fontSize: '0.875rem', color: '#111827',
  background: '#FFFFFF', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
export const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 20px', background: '#1E3A5F', color: '#FFFFFF',
  border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
}
export const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px', background: '#F3F4F6', color: '#374151',
  border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
}
export const labelStyle: React.CSSProperties = {
  fontSize: '0.8125rem', fontWeight: 600, color: '#374151',
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18"
      style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(17,24,39,0.2)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

export function Chip({ icon, label, color, bg }: {
  icon: React.ReactNode; label: string; color: string; bg: string
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 9px', borderRadius: 999, background: bg, color,
      fontSize: '0.75rem', fontWeight: 600,
    }}>
      {icon}{label}
    </span>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      width: 40, height: 22, borderRadius: 999,
      background: on ? '#2563EB' : '#D1D5DB',
      position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 16, height: 16,
        borderRadius: '50%', background: '#FFFFFF', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

export function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ borderBottom: '1.5px solid #F3F4F6', paddingBottom: '6px', marginTop: '4px' }}>
      <p style={{
        fontWeight: 700, fontSize: '0.75rem', color: '#6B7280',
        textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0,
      }}>
        {title}
      </p>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    open:     { bg: '#DCFCE7', color: '#15803D' },
    closed:   { bg: '#FEF9C3', color: '#854D0E' },
    archived: { bg: '#F3F4F6', color: '#6B7280' },
  }
  const c = colors[status] ?? colors.open
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: c.bg, color: c.color }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

export function ConfirmDialog({ message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: {
  message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '28px 28px 22px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0 0 20px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={onConfirm} style={{ ...primaryBtnStyle, background: danger ? '#DC2626' : '#1E3A5F' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
