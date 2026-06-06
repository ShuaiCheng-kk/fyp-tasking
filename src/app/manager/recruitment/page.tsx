'use client'

import React, { useState } from 'react'
import { Plus, Briefcase, Search, X } from 'lucide-react'
import ManagerSidebar from '@/components/ManagerSidebar'
import { JobPosting } from '@/types/recruitment.types'

import { useRecruitment } from '@/hooks/manager/useRecruitment'
import { ConfirmDialog, Spinner, inputStyle } from '@/components/manager/recruitment/ui'
import { JobCard } from '@/components/manager/recruitment/JobCard'
import { JobModal } from '@/components/manager/recruitment/JobModal'
import { ConfirmState } from '@/types/recruitment.form.types'
import { jobToForm } from './utils/recruitment.utils'
import { isExpired } from './utils/recruitment.utils'

type ActiveTab = 'all' | 'open' | 'closed' | 'archived' | 'expired'

export default function ManagerRecruitmentPage() {
  const {
    companyName, deptName,
    jobs, loadingJobs, error, submitting, setError,
    handlePostJob, handleEditJob, handleDuplicate, handleStatusChange, handleDelete,
  } = useRecruitment()

  const [modalMode, setModalMode]   = useState<'post' | 'edit' | null>(null)
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null)
  const [confirm, setConfirm]       = useState<ConfirmState>(null)
  const [activeTab, setActiveTab]   = useState<ActiveTab>('all')
  const [search, setSearch]         = useState('')

  const pageTitle = companyName && deptName
    ? `${companyName} [${deptName}] — Recruitment`
    : 'Recruitment'

  // ── Filtering ──────────────────────────────────────────────────────────────
  const q = search.toLowerCase()
  const filtered = jobs.filter(job => {
    const j = job as any
    if (activeTab === 'open'     && (job.status !== 'open' || isExpired(job))) return false
    if (activeTab === 'closed'   && job.status !== 'closed')                    return false
    if (activeTab === 'archived' && job.status !== 'archived')                  return false
    if (activeTab === 'expired'  && !isExpired(job))                            return false
    if (q && ![job.title, job.location, j.industry, j.company_name, job.description]
      .filter(Boolean).some((v: string) => v.toLowerCase().includes(q))) return false
    return true
  })

  const tabs: { key: ActiveTab; label: string; count: number }[] = [
    { key: 'all',      label: 'All',      count: jobs.length },
    { key: 'open',     label: 'Active',   count: jobs.filter(j => j.status === 'open' && !isExpired(j)).length },
    { key: 'closed',   label: 'Closed',   count: jobs.filter(j => j.status === 'closed').length },
    { key: 'expired',  label: 'Expired',  count: jobs.filter(j => isExpired(j)).length },
    { key: 'archived', label: 'Archived', count: jobs.filter(j => j.status === 'archived').length },
  ]

  const stats = [
    { label: 'Active',      count: jobs.filter(j => j.status === 'open' && !isExpired(j)).length, color: '#15803D', bg: '#DCFCE7' },
    { label: 'Shift Jobs',  count: jobs.filter(j => (j as any).formType === 'shift' || j.is_recurring).length, color: '#1D4ED8', bg: '#DBEAFE' },
    { label: 'One-off Jobs',count: jobs.filter(j => (j as any).formType === 'oneoff' && !j.is_recurring).length, color: '#D97706', bg: '#FEF3C7' },
    { label: 'Expired',     count: jobs.filter(j => isExpired(j)).length, color: '#6B7280', bg: '#F3F4F6' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ManagerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{ padding: '18px 32px', background: '#1E3A5F', borderBottom: '1px solid #163050', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#FFFFFF', margin: 0 }}>{pageTitle}</h1>
          <button
            onClick={() => { setEditingJob(null); setModalMode('post') }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2.5} /> Post Job
          </button>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          {/* Error banner */}
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#B91C1C', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          {/* Stats bar */}
          {jobs.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              {stats.map(s => (
                <div key={s.label} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.125rem', color: s.color }}>{s.count}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 500 }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          {jobs.length > 0 && (
            <div style={{ display: 'flex', gap: '2px', marginBottom: '16px', background: '#F3F4F6', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 0.15s', background: activeTab === t.key ? '#FFFFFF' : 'transparent', color: activeTab === t.key ? '#111827' : '#6B7280', boxShadow: activeTab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {t.label}
                  {t.count > 0 && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: activeTab === t.key ? '#F3F4F6' : '#E5E7EB', color: activeTab === t.key ? '#374151' : '#9CA3AF' }}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          {jobs.length > 0 && (
            <div style={{ position: 'relative', maxWidth: '400px', marginBottom: '16px' }}>
              <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title, location, industry…"
                style={{ ...inputStyle, paddingLeft: '32px', fontSize: '0.8125rem' }}
              />
              {search && (
                <button onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 0 }}>
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Job list */}
          {loadingJobs ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '0.9375rem' }}>
              <Spinner /> Loading…
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '60px 20px', color: '#9CA3AF', textAlign: 'center' }}>
              <Briefcase size={36} strokeWidth={1.5} />
              <p style={{ fontWeight: 600, fontSize: '1rem', color: '#6B7280', margin: 0 }}>No job openings yet</p>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>Click "Post Job" to create your first listing.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '48px 20px', color: '#9CA3AF', textAlign: 'center' }}>
              <Search size={28} strokeWidth={1.5} />
              <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', margin: 0 }}>No listings match</p>
              <p style={{ fontSize: '0.8125rem', margin: 0 }}>Try a different search or tab.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '760px' }}>
              {filtered.map(job => (
                <JobCard
                  key={job.id}
                  job={job as any}
                  onEdit={() => { setEditingJob(job); setModalMode('edit') }}
                  onDuplicate={() => handleDuplicate(job)}
                  onClose={() => setConfirm({
                    message: `Close "${job.title}"? Applicants will no longer be able to apply.`,
                    confirmLabel: 'Close Job', danger: false,
                    onConfirm: () => { setConfirm(null); handleStatusChange(job, 'closed') },
                  })}
                  onArchive={() => setConfirm({
                    message: `Archive "${job.title}"? It will be hidden from active listings.`,
                    confirmLabel: 'Archive', danger: false,
                    onConfirm: () => { setConfirm(null); handleStatusChange(job, 'archived') },
                  })}
                  onDelete={() => setConfirm({
                    message: `Permanently delete "${job.title}"? This cannot be undone.`,
                    confirmLabel: 'Delete', danger: true,
                    onConfirm: () => { setConfirm(null); handleDelete(job) },
                  })}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {modalMode && (
        <JobModal
          mode={modalMode}
          initial={editingJob ? jobToForm(editingJob as any) : undefined}
          onClose={() => { setModalMode(null); setEditingJob(null); setError(null) }}
          onSubmit={async form => {
            if (modalMode === 'edit' && editingJob) {
              await handleEditJob(form, editingJob.id)
            } else {
              await handlePostJob(form)
            }
            setModalMode(null)
            setEditingJob(null)
          }}
          submitting={submitting}
        />
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
