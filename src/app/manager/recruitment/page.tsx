'use client'

import React, { useState } from 'react'
import { Plus, Briefcase, Search, X, Users, UserCog } from 'lucide-react'
import ManagerSidebar from '@/components/ManagerSidebar'
import { JobPosting } from '@/types/recruitment.types'

import { useRecruitment } from '@/hooks/manager/useRecruitment'
import { ConfirmDialog, Spinner, inputStyle } from '@/components/manager/recruitment/ui'
import { JobCard } from '@/components/manager/recruitment/JobCard'
import { JobModal } from '@/components/manager/recruitment/JobModal'
import { JobDetailPanel } from '@/components/manager/recruitment/JobDetailPanel'
import { ConfirmState } from '@/types/recruitment.form.types'
import { jobToForm, isExpired } from './utils/recruitment.utils'

type ActiveTab = 'all' | 'open' | 'closed' | 'archived' | 'expired'

export default function ManagerRecruitmentPage() {
  const {
    companyName, deptName,
    jobs, loadingJobs, error, submitting, setError,
    handlePostJob, handleEditJob, handleDuplicate, handleStatusChange, handleDelete,
  } = useRecruitment()

  const [modalMode, setModalMode]     = useState<'post' | 'edit' | null>(null)
  const [editingJob, setEditingJob]   = useState<JobPosting | null>(null)
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null)
  const [confirm, setConfirm]         = useState<ConfirmState>(null)
  const [activeTab, setActiveTab]     = useState<ActiveTab>('all')
  const [search, setSearch]           = useState('')
  const [managerName, setManagerName] = useState('')

  React.useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    if (!uid) return
    fetch(`/api/user/me?user_id=${uid}`)
      .then(r => r.json())
      .then(d => { if (d.success) setManagerName(d.user.full_name ?? '') })
      .catch(() => {})
  }, [])

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
    { label: 'Active',       count: jobs.filter(j => j.status === 'open' && !isExpired(j)).length, color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Shift Jobs',   count: jobs.filter(j => (j as any).formType === 'shift' || j.is_recurring).length, color: '#1D4ED8', bg: '#DBEAFE' },
    { label: 'One-off Jobs', count: jobs.filter(j => (j as any).formType === 'oneoff' && !j.is_recurring).length, color: '#0369A1', bg: '#E0F2FE' },
    { label: 'Expired',      count: jobs.filter(j => isExpired(j)).length, color: '#64748B', bg: '#F1F5F9' },
  ]

  // ── Helpers ────────────────────────────────────────────────────────────────
  const selectJob = (job: JobPosting) =>
    setSelectedJob(prev => prev?.id === job.id ? null : job)

  const closePanel = () => setSelectedJob(null)

  const openEdit = (job: JobPosting) => {
    setEditingJob(job)
    setModalMode('edit')
  }

  const panelOpen = selectedJob !== null

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ManagerSidebar />

      {/* Main area */}
      <div style={{ marginLeft: '64px', flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.4px' }}>
              {deptName ? `Recruitment · ${deptName}` : 'Recruitment'}
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748B', fontWeight: 500 }}>Post and manage job listings for your department</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {managerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#1E3A5F', color: '#FFFFFF', flexShrink: 0 }}>
                  <UserCog size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{managerName}</span>
              </div>
            )}
            <button
              onClick={() => { setEditingJob(null); setModalMode('post') }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '9px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
              <Plus size={15} strokeWidth={2.5} /> Post Job
            </button>
          </div>
        </div>

        {/* Content row: list left, detail panel right */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: scrollable job list */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '28px 32px', transition: 'padding 0.25s' }}>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#B91C1C', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            {/* Stats — hide when panel open to reclaim space */}
            {jobs.length > 0 && !panelOpen && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
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
              <div style={{ display: 'flex', gap: '2px', marginBottom: '16px', background: '#EBEBEB', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', fontWeight: 600, fontSize: panelOpen ? '0.75rem' : '0.8125rem', cursor: 'pointer', transition: 'all 0.15s', background: activeTab === t.key ? '#FFFFFF' : 'transparent', color: activeTab === t.key ? '#2563EB' : '#6B7280', boxShadow: activeTab === t.key ? '0 1px 3px rgba(37,99,235,0.1)' : 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {t.label}
                    {t.count > 0 && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: activeTab === t.key ? '#EFF6FF' : '#E5E7EB', color: activeTab === t.key ? '#2563EB' : '#9CA3AF' }}>
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
                  placeholder="Search listings…"
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: panelOpen ? '100%' : '760px' }}>
                {filtered.map(job => (
                  // Outer div handles card selection; stopPropagation on the
                  // action buttons inside JobCard is handled by JobCard itself.
                  // We intercept clicks on the action menu wrapper here so they
                  // don't bubble up and trigger selectJob.
                  <div
                    key={job.id}
                    onClick={() => selectJob(job)}
                    style={{ cursor: 'pointer' }}
                  >
                    <JobCard
                      job={job as any}
                      selected={selectedJob?.id === job.id}
                      compact={panelOpen}
                      onEdit={() => openEdit(job)}
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: detail panel */}
          {selectedJob && (
            <JobDetailPanel
              job={selectedJob as any}
              onClose={closePanel}
              onEdit={() => openEdit(selectedJob)}
              onDuplicate={() => { handleDuplicate(selectedJob); closePanel() }}
              onCloseJob={() => setConfirm({
                message: `Close "${selectedJob.title}"? Applicants will no longer be able to apply.`,
                confirmLabel: 'Close Job', danger: false,
                onConfirm: () => { setConfirm(null); handleStatusChange(selectedJob, 'closed'); closePanel() },
              })}
              onArchive={() => setConfirm({
                message: `Archive "${selectedJob.title}"? It will be hidden from active listings.`,
                confirmLabel: 'Archive', danger: false,
                onConfirm: () => { setConfirm(null); handleStatusChange(selectedJob, 'archived'); closePanel() },
              })}
              onDelete={() => setConfirm({
                message: `Permanently delete "${selectedJob.title}"? This cannot be undone.`,
                confirmLabel: 'Delete', danger: true,
                onConfirm: () => { setConfirm(null); handleDelete(selectedJob); closePanel() },
              })}
            />
          )}
        </div>
      </div>

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