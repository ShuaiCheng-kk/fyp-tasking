import React from 'react'
import { Timer } from 'lucide-react'
import { EXPIRY_PRESETS } from '@/types/recruitment.form.types'
import { addDays } from '@/app/manager/recruitment/utils/recruitment.utils'
import { inputStyle } from './ui'

interface ExpiryPickerProps {
  preset: string
  customDate: string
  onPresetChange: (v: string) => void
  onDateChange: (v: string) => void
}

export function ExpiryPicker({ preset, customDate, onPresetChange, onDateChange }: ExpiryPickerProps) {
  const handlePreset = (v: string) => {
    onPresetChange(v)
    if (v === '7d')  onDateChange(addDays(7))
    if (v === '14d') onDateChange(addDays(14))
    if (v === '30d') onDateChange(addDays(30))
    if (v === '60d') onDateChange(addDays(60))
    if (v === 'none' || v === 'custom') onDateChange('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {EXPIRY_PRESETS.map(p => (
          <button key={p.value} onClick={() => handlePreset(p.value)}
            style={{
              padding: '5px 11px', borderRadius: '7px', cursor: 'pointer', transition: 'all 0.15s',
              border: `1.5px solid ${preset === p.value ? '#2563EB' : '#E5E7EB'}`,
              background: preset === p.value ? '#EFF6FF' : '#FFFFFF',
              color: preset === p.value ? '#1D4ED8' : '#374151',
              fontWeight: 600, fontSize: '0.8rem',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <input
          type="date"
          value={customDate}
          onChange={e => onDateChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          style={{ ...inputStyle, maxWidth: '200px' }}
        />
      )}

      {preset !== 'none' && preset !== 'custom' && customDate && (
        <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Timer size={11} />
          Expires on {new Date(customDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}
