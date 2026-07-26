'use client'

import { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

// Shared personal clock in/out stepper — Manager's "My Shift Today" (DashboardView) and
// Employee's Dashboard both render the exact same Clock In → Break In → Break Out → Clock Out
// chain, so this lives in one place instead of being redrawn per role.

export const CLOCK_IN_WINDOW_MINUTES_BEFORE = 30

export function canClockIn(shift: { shift_date: string; start_time: string }): boolean {
  const shiftStart = new Date(`${shift.shift_date}T${shift.start_time}Z`)
  return Date.now() >= shiftStart.getTime() - CLOCK_IN_WINDOW_MINUTES_BEFORE * 60000
}

export function canClockOut(shift: { shift_date: string; end_time: string; is_open_ended: boolean }): boolean {
  if (shift.is_open_ended) return true
  return Date.now() >= new Date(`${shift.shift_date}T${shift.end_time}Z`).getTime()
}

export function fmtShiftTime(hhmmss: string): string {
  const [h, m] = hhmmss.split(':').map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function fmtShiftTimeMinusMinutes(hhmmss: string, minutes: number): string {
  const [h, m] = hhmmss.split(':').map(Number)
  const total = (h * 60 + m - minutes + 1440) % 1440
  return fmtShiftTime(`${Math.floor(total / 60)}:${total % 60}`)
}

export function fmtClockStamp(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function ClockFlowButton({ icon, label, sub, enabled, completed, activeColor, completedColor = '#16A34A', onClick }: {
  icon: ReactNode
  label: string
  sub: string
  enabled: boolean
  completed: boolean
  activeColor: string
  completedColor?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      style={{
        border: 'none',
        borderRadius: 12,
        padding: '0 16px',
        height: 62,
        boxSizing: 'border-box',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        minWidth: 152,
        background: completed ? completedColor : enabled ? activeColor : '#F3F4F6',
        color: completed || enabled ? '#FFFFFF' : '#9CA3AF',
        cursor: enabled ? 'pointer' : 'default',
        boxShadow: 'none',
      }}
    >
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 800, fontSize: '0.9375rem', whiteSpace: 'nowrap' }}>{label}</span>
        {sub && (
          <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginTop: 1, opacity: 0.92, whiteSpace: 'nowrap' }}>{sub}</span>
        )}
      </span>
    </button>
  )
}

export function ClockFlowConnector() {
  return (
    <span style={{ width: 46, flex: '0 0 46px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB' }}>
      <ArrowRight size={16} />
    </span>
  )
}
