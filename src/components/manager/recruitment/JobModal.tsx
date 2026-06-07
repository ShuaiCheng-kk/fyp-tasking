'use client'

import React, { useState } from 'react'
import { X, Repeat, Zap, Check } from 'lucide-react'
import { JobFormType, PostJobForm, ShiftForm, OneOffForm, defaultShiftForm, defaultOneOffForm } from '@/types/recruitment.form.types'
import { Spinner, primaryBtnStyle, secondaryBtnStyle } from './ui'
import { AIRequestBuilder } from './AIRequestBuilder'
import { ShiftFormBody, OneOffFormBody } from './JobFormBodies'

interface JobModalProps {
  mode: 'post' | 'edit'
  initial?: PostJobForm
  onClose: () => void
  onSubmit: (form: PostJobForm) => Promise<void>
  submitting: boolean
}

type Step = 'type' | 'ai' | 'form'
const STEPS: Step[] = ['type', 'ai', 'form']

export function JobModal({ mode, initial, onClose, onSubmit, submitting }: JobModalProps) {
  const [step, setStep]       = useState<Step>(mode === 'edit' ? 'form' : 'type')
  const [jobType, setJobType] = useState<JobFormType>(initial?.formType ?? 'oneoff')
  const [form, setForm]       = useState<PostJobForm>(initial ?? defaultOneOffForm)

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const selectType = (t: JobFormType) => {
    setJobType(t)
    if (form.formType !== t) setForm(t === 'shift' ? defaultShiftForm : defaultOneOffForm)
    setStep('ai')
  }

  const handleAIGenerated = (aiForm: PostJobForm) => { setForm(aiForm); setStep('form') }
  const handleSkipAI      = () => { setForm(jobType === 'shift' ? defaultShiftForm : defaultOneOffForm); setStep('form') }

  const modalTitle =
    mode === 'edit'       ? 'Edit Job Listing'
    : step === 'type'     ? 'New Job Listing'
    : step === 'ai'       ? 'AI Request Builder'
    : `New ${jobType === 'shift' ? 'Shift' : 'One-off'} Listing`

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '18px', width: '100%', maxWidth: '600px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '22px 28px 16px', borderBottom: '1.5px solid #F3F4F6', position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 5, borderRadius: '18px 18px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontWeight: 800, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>{modalTitle}</h2>
              {step !== 'type' && mode !== 'edit' && (
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '2px 0 0' }}>
                  {jobType === 'shift' ? 'Recurring Shift Job' : 'One-off Job'}
                  {step === 'form' && (
                    <span
                      style={{ marginLeft: '8px', color: '#2563EB', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setStep('type')}>
                      Change
                    </span>
                  )}
                </p>
              )}
            </div>
            <button onClick={onClose}
              style={{ background: '#F3F4F6', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <X size={18} />
            </button>
          </div>

          {/* Step indicators */}
          {mode === 'post' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px' }}>
              {STEPS.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.2s',
                    background: step === s ? '#1E3A5F' : STEPS.indexOf(step) > i ? '#DCFCE7' : '#F3F4F6',
                    color:      step === s ? '#FFFFFF'  : STEPS.indexOf(step) > i ? '#15803D' : '#9CA3AF',
                  }}>
                    {STEPS.indexOf(step) > i ? <Check size={12} /> : i + 1}
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: step === s ? '#111827' : '#9CA3AF' }}>
                    {s === 'type' ? 'Job Type' : s === 'ai' ? 'AI Builder' : 'Details'}
                  </span>
                  {i < 2 && <div style={{ width: '20px', height: '1.5px', background: '#E5E7EB' }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '24px 28px' }}>
          {/* Step 1: Type selection */}
          {step === 'type' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: '0 0 4px' }}>
                What kind of job are you posting?
              </p>

              <button onClick={() => selectType('shift')}
                style={{ padding: '20px', border: '2px solid #E5E7EB', borderRadius: '14px', background: '#FFFFFF', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2563EB'; (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Repeat size={20} color="#2563EB" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', margin: '0 0 4px' }}>Shift Job</p>
                    <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>Recurring or scheduled shifts. Best for cashiers, crew, warehouse, F&B staff — roles that repeat on a set schedule.</p>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      {['Weekly shifts', 'Recurring', 'Flexible days'].map(t => (
                        <span key={t} style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2563EB', background: '#DBEAFE', padding: '2px 8px', borderRadius: 999 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>

              <button onClick={() => selectType('oneoff')}
                style={{ padding: '20px', border: '2px solid #E5E7EB', borderRadius: '14px', background: '#FFFFFF', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#D97706'; (e.currentTarget as HTMLButtonElement).style.background = '#FFFBEB' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={20} color="#D97706" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', margin: '0 0 4px' }}>One-off Job</p>
                    <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>A single or short engagement with a specific date. Best for events, emergency repairs, deliveries, or project-based work.</p>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      {['Specific date', 'Event-based', 'Urgent roles'].map(t => (
                        <span key={t} style={{ fontSize: '0.7rem', fontWeight: 600, color: '#D97706', background: '#FEF3C7', padding: '2px 8px', borderRadius: 999 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Step 2: AI Builder */}
          {step === 'ai' && (
            <AIRequestBuilder formType={jobType} onGenerated={handleAIGenerated} onSkip={handleSkipAI} />
          )}

          {/* Step 3: Form */}
          {step === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {form.formType === 'shift'
                ? <ShiftFormBody  form={form as ShiftForm}  set={(k, v) => setF(k, v)} />
                : <OneOffFormBody form={form as OneOffForm} set={(k, v) => setF(k, v)} />
              }
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', paddingTop: '16px', borderTop: '1.5px solid #F3F4F6' }}>
                <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
                <button onClick={() => onSubmit(form)} disabled={submitting}
                  style={{ ...primaryBtnStyle, opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {submitting ? <><Spinner size={14} /> Saving…</> : mode === 'edit' ? 'Save Changes' : 'Post Job'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
