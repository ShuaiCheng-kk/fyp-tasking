import React from 'react'
import { ShiftForm, OneOffForm, DAYS } from '@/types/recruitment.form.types'
import { Field, Toggle, SectionHeader, inputStyle } from './ui'
import { ExpiryPicker } from './ExpiryPicker'

// ─── Shared tail (location, industry, company, benefits, expiry) ──────────────

interface CommonTailProps {
  form: ShiftForm | OneOffForm
  set: (k: string, v: any) => void
}

export function CommonTail({ form, set }: CommonTailProps) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Location">
          <input value={form.location} onChange={e => set('location', e.target.value)}
            placeholder="e.g. Orchard Branch" style={inputStyle} />
        </Field>
        <Field label="Industry">
          <select value={form.industry} onChange={e => set('industry', e.target.value)} style={inputStyle}>
            <option value="">Select industry</option>
            <option value="Retail">Retail</option>
            <option value="F&B">F&B</option>
            <option value="Logistics">Logistics</option>
            <option value="Event Management">Event Management</option>
            <option value="Facilities & Maintenance">Facilities & Maintenance</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Hospitality">Hospitality</option>
            <option value="Construction">Construction</option>
          </select>
        </Field>
      </div>

      <Field label="Company Name">
        <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
          placeholder="e.g. Tasking Pte Ltd" style={inputStyle} />
      </Field>

      <Field label="Benefits / Perks (optional)">
        <input value={form.benefits} onChange={e => set('benefits', e.target.value)}
          placeholder="e.g. Meals provided, Transport allowance" style={inputStyle} />
      </Field>

      <div style={{ borderBottom: '1.5px solid #F3F4F6', paddingBottom: '6px', marginTop: '4px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
          Listing Expiry
        </p>
      </div>

      <Field label="Expires after">
        <ExpiryPicker
          preset={form.expiry_preset}
          customDate={form.expires_at}
          onPresetChange={v => set('expiry_preset', v)}
          onDateChange={v => set('expires_at', v)}
        />
      </Field>
    </>
  )
}

// ─── Shift form body ──────────────────────────────────────────────────────────

interface ShiftFormBodyProps {
  form: ShiftForm
  set: (k: keyof ShiftForm, v: any) => void
}

export function ShiftFormBody({ form, set }: ShiftFormBodyProps) {
  const toggleDay = (day: string) => {
    set('shift_days', form.shift_days.includes(day)
      ? form.shift_days.filter(d => d !== day)
      : [...form.shift_days, day])
  }

  return (
    <>
      <SectionHeader title="Role Details" />
      <Field label="Job Title *">
        <input value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="e.g. Weekend Cashier" style={inputStyle} />
      </Field>
      <Field label="Description *">
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Describe the role, responsibilities, and expectations…"
          rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>
      <Field label="Requirements">
        <textarea value={form.requirements} onChange={e => set('requirements', e.target.value)}
          placeholder="e.g. Must be available weekends, physically fit…"
          rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>

      <SectionHeader title="Shift Schedule" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Shift Start">
          <input type="time" value={form.shift_start_time}
            onChange={e => set('shift_start_time', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Shift End">
          <input type="time" value={form.shift_end_time}
            onChange={e => set('shift_end_time', e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <Field label="Working Days">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {DAYS.map(d => (
            <button key={d} onClick={() => toggleDay(d)}
              style={{
                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                fontWeight: 600, fontSize: '0.8125rem',
                border: `1.5px solid ${form.shift_days.includes(d) ? '#2563EB' : '#E5E7EB'}`,
                background: form.shift_days.includes(d) ? '#EFF6FF' : '#FFFFFF',
                color: form.shift_days.includes(d) ? '#1D4ED8' : '#374151',
              }}>
              {d}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '14px 16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <Toggle on={form.is_recurring} onClick={() => set('is_recurring', !form.is_recurring)} />
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0 }}>Recurring Posting</p>
            <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: 0 }}>Auto re-post this job on a schedule</p>
          </div>
        </label>
        {form.is_recurring && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <span style={{ fontSize: '0.875rem', color: '#374151' }}>Every</span>
            <input type="number" min={1} value={form.recurrence_interval}
              onChange={e => set('recurrence_interval', Number(e.target.value))}
              style={{ ...inputStyle, width: '64px', textAlign: 'center' }} />
            <select value={form.recurrence_unit}
              onChange={e => set('recurrence_unit', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="day">Day(s)</option>
              <option value="week">Week(s)</option>
              <option value="month">Month(s)</option>
            </select>
          </div>
        )}
      </div>

      <SectionHeader title="Compensation & Details" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Pay Amount">
          <input type="number" min={0} value={form.salary_amount}
            onChange={e => set('salary_amount', e.target.value)}
            placeholder="e.g. 12" style={inputStyle} />
        </Field>
        <Field label="Pay Type">
          <select value={form.salary_type} onChange={e => set('salary_type', e.target.value)} style={inputStyle}>
            <option value="per hour">Per Hour</option>
            <option value="per day">Per Day</option>
            <option value="per shift">Per Shift</option>
          </select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Openings">
          <input type="number" min={1} value={form.openings}
            onChange={e => set('openings', Number(e.target.value))} style={inputStyle} />
        </Field>
        <Field label="Employment Type">
          <select value={form.employment_type}
            onChange={e => set('employment_type', e.target.value)} style={inputStyle}>
            <option value="casual">Casual</option>
            <option value="part-time">Part-time</option>
            <option value="full-time">Full-time</option>
          </select>
        </Field>
      </div>
      <CommonTail form={form} set={set as any} />
    </>
  )
}

// ─── One-off form body ────────────────────────────────────────────────────────

interface OneOffFormBodyProps {
  form: OneOffForm
  set: (k: keyof OneOffForm, v: any) => void
}

export function OneOffFormBody({ form, set }: OneOffFormBodyProps) {
  return (
    <>
      <SectionHeader title="Role Details" />
      <Field label="Job Title *">
        <input value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="e.g. Event Setup Crew" style={inputStyle} />
      </Field>
      <Field label="Description *">
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Describe the work, setting, and what's needed…"
          rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>
      <Field label="Requirements">
        <textarea value={form.requirements} onChange={e => set('requirements', e.target.value)}
          placeholder="e.g. Must have own tools, physically fit…"
          rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>

      <SectionHeader title="Job Date & Time" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Start Date *">
          <input type="date" value={form.job_date}
            onChange={e => set('job_date', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="End Date (optional)">
          <input type="date" value={form.job_end_date}
            onChange={e => set('job_end_date', e.target.value)} style={inputStyle} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Est. Hours">
          <input value={form.estimated_hours} onChange={e => set('estimated_hours', e.target.value)}
            placeholder="e.g. 4–6 hours" style={inputStyle} />
        </Field>
        <Field label="Urgency">
          <select value={form.urgency} onChange={e => set('urgency', e.target.value)} style={inputStyle}>
            <option value="normal">Normal</option>
            <option value="high">High — same-day response</option>
            <option value="urgent">Urgent — immediate</option>
          </select>
        </Field>
      </div>

      <SectionHeader title="Compensation & Details" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Pay Amount">
          <input type="number" min={0} value={form.salary_amount}
            onChange={e => set('salary_amount', e.target.value)}
            placeholder="e.g. 500" style={inputStyle} />
        </Field>
        <Field label="Pay Type">
          <select value={form.salary_type} onChange={e => set('salary_type', e.target.value)} style={inputStyle}>
            <option value="flat rate">Flat Rate</option>
            <option value="per hour">Per Hour</option>
            <option value="per day">Per Day</option>
            <option value="negotiable">Negotiable</option>
          </select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Openings">
          <input type="number" min={1} value={form.openings}
            onChange={e => set('openings', Number(e.target.value))} style={inputStyle} />
        </Field>
        <Field label="Employment Type">
          <select value={form.employment_type}
            onChange={e => set('employment_type', e.target.value)} style={inputStyle}>
            <option value="casual">Casual</option>
            <option value="contract">Contract</option>
            <option value="freelance">Freelance</option>
          </select>
        </Field>
      </div>
      <CommonTail form={form} set={set as any} />
    </>
  )
}
