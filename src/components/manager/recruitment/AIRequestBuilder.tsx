'use client'

import React, { useState } from 'react'
import { Sparkles, ChevronRight, Edit3, DollarSign, Calendar, AlertCircle } from 'lucide-react'
import { JobFormType, PostJobForm, ShiftForm, OneOffForm } from '@/types/recruitment.form.types'
import { Spinner, Chip, primaryBtnStyle, secondaryBtnStyle, inputStyle, labelStyle } from './ui'

interface AIRequestBuilderProps {
  formType: JobFormType
  onGenerated: (form: PostJobForm) => void
  onSkip: () => void
}

export function AIRequestBuilder({ formType, onGenerated, onSkip }: AIRequestBuilderProps) {
  const [prompt, setPrompt]   = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<PostJobForm | null>(null)

  const examplePrompts = formType === 'shift'
    ? ['Need 2 cashiers weekend morning shifts $12/hr', 'Kitchen crew every Sat & Sun 7am-3pm, F&B exp required']
    : ['Need plumber urgently 24 May $500+', 'Event setup crew for 1-day conference 15 Jun, physical work $150']

  // Placeholder — replace with real Anthropic API call
  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1800))

    if (formType === 'shift') {
      const generated: ShiftForm = {
        formType: 'shift',
        title: 'Part-Time Cashier (Weekend)',
        description: 'We are looking for friendly and reliable cashiers to join our weekend team. You will be responsible for processing customer transactions accurately, maintaining a clean checkout area, and providing excellent customer service at our retail outlet.',
        requirements: 'No prior experience required — full training provided. Must be punctual, presentable, and comfortable handling cash and card payments. Able to commit to weekend shifts consistently.',
        location: '',
        employment_type: 'part-time',
        shift_start_time: '09:00', shift_end_time: '17:00',
        shift_days: ['Sat', 'Sun'],
        is_recurring: true,
        recurrence_interval: 1, recurrence_unit: 'week',
        openings: 2,
        company_name: '', industry: 'Retail',
        salary_amount: '12', salary_type: 'per hour',
        benefits: '', urgency: 'normal',
        expires_at: '', expiry_preset: 'none',
      }
      setPreview(generated)
    } else {
      const generated: OneOffForm = {
        formType: 'oneoff',
        title: 'Emergency Plumbing Service Required',
        description: 'We are looking for a certified plumber to attend to an urgent plumbing issue at our premises. The scope of work will be confirmed upon contact. Same-day response is strongly preferred due to the urgency of the situation.',
        requirements: 'Must hold a valid plumbing licence. Bring own tools and equipment. Relevant experience with commercial or residential plumbing required. Able to respond and attend on short notice.',
        location: '',
        employment_type: 'casual',
        job_date: '2025-05-24', job_end_date: '',
        estimated_hours: '3–5',
        openings: 1,
        company_name: '', industry: 'Facilities & Maintenance',
        salary_amount: '500', salary_type: 'flat rate',
        benefits: '', urgency: 'high',
        expires_at: '', expiry_preset: 'none',
      }
      setPreview(generated)
    }
    setLoading(false)
  }

  if (preview) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)', border: '1.5px solid #BFDBFE', borderRadius: '12px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Sparkles size={16} color="#2563EB" />
            <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1D4ED8' }}>AI Draft Ready</span>
            <span style={{ fontSize: '0.75rem', color: '#6B7280', marginLeft: 'auto' }}>Review and edit before posting</span>
          </div>
          <p style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: '0 0 6px' }}>{preview.title}</p>
          <p style={{ fontSize: '0.8125rem', color: '#374151', margin: '0 0 10px', lineHeight: 1.6 }}>{preview.description}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {preview.formType === 'oneoff' && preview.urgency === 'high' && (
              <Chip icon={<AlertCircle size={11} />} label="High Urgency" color="#DC2626" bg="#FEF2F2" />
            )}
            {preview.salary_amount && (
              <Chip icon={<DollarSign size={11} />} label={`$${preview.salary_amount} ${preview.salary_type}`} color="#065F46" bg="#D1FAE5" />
            )}
            {preview.formType === 'shift' && preview.shift_days.length > 0 && (
              <Chip icon={<Calendar size={11} />} label={preview.shift_days.join(', ')} color="#1D4ED8" bg="#DBEAFE" />
            )}
            {preview.formType === 'oneoff' && preview.job_date && (
              <Chip icon={<Calendar size={11} />} label={`Date: ${preview.job_date}`} color="#1D4ED8" bg="#DBEAFE" />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setPreview(null)} style={secondaryBtnStyle}>← Regenerate</button>
          <button onClick={() => onGenerated(preview)}
            style={{ ...primaryBtnStyle, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#2563EB' }}>
            <Edit3 size={14} /> Use This Draft & Edit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #1D4ED8 100%)', borderRadius: '12px', padding: '18px 20px', color: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sparkles size={16} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>AI Request Builder</span>
        </div>
        <p style={{ fontSize: '0.8125rem', color: '#BFDBFE', margin: 0, lineHeight: 1.5 }}>
          Describe the job in plain language — AI will turn it into a complete, professional listing you can review and edit.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Your Request</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={formType === 'shift'
            ? 'e.g. Need 2 cashiers every weekend morning shift, $12/hr, retail'
            : 'e.g. Need plumber urgently 24 May $500+'}
          rows={3}
          style={{ ...inputStyle, resize: 'none', marginTop: '5px' }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
        />
        <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '4px 0 0' }}>Press ⌘ + Enter to generate</p>
      </div>

      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', margin: '0 0 8px' }}>TRY AN EXAMPLE</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {examplePrompts.map((ex, i) => (
            <button key={i} onClick={() => setPrompt(ex)}
              style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8125rem', color: '#374151', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ChevronRight size={13} color="#9CA3AF" />
              "{ex}"
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onSkip} style={{ ...secondaryBtnStyle, fontSize: '0.875rem' }}>
          Skip — Fill manually
        </button>
        <button onClick={handleGenerate} disabled={!prompt.trim() || loading}
          style={{ ...primaryBtnStyle, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#2563EB', opacity: !prompt.trim() || loading ? 0.7 : 1 }}>
          {loading ? <><Spinner size={14} /> Generating…</> : <><Sparkles size={14} /> Generate Listing</>}
        </button>
      </div>
    </div>
  )
}
