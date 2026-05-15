'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ─── Modal primitives ─────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '520px' }}>
        {children}
      </div>
    </div>
  )
}

function ModalBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      padding: '32px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
    }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
      <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>{title}</h2>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: '4px', borderRadius: '6px' }}
      >
        <X size={18} />
      </button>
    </div>
  )
}

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E5E7EB',
  borderRadius: '8px',
  fontSize: '0.9375rem',
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Department = { id: string; name: string }
type Manager = { id: string; full_name: string }

export default function TeamPage() {
  const [userId, setUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')

  // Modal state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [inviteDeptId, setInviteDeptId] = useState('')
  const [inviteManagerId, setInviteManagerId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [managersLoading, setManagersLoading] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const closeModal = useCallback(() => {
    setInviteOpen(false)
    setInviteEmail('')
    setInviteRole('')
    setInviteDeptId('')
    setInviteManagerId('')
    setManagers([])
    setInviteError('')
    setInviteSuccess('')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeModal])

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id') || ''
    const cid = localStorage.getItem('tasking_company_id') || ''
    setUserId(uid)
    setCompanyId(cid)
    if (cid) {
      fetchDepts(cid)
      fetchCompanyName(cid)
    }
  }, [])

  const fetchCompanyName = async (cid: string) => {
    try {
      const res = await fetch(`/api/company/profile?company_id=${cid}`)
      const data = await res.json()
      if (data.success && data.company?.name) setCompanyName(data.company.name)
    } catch {}
  }

  const fetchDepts = async (cid: string) => {
    try {
      const res = await fetch(`/api/company/departments?company_id=${cid}`)
      const data = await res.json()
      if (data.success) setDepartments(data.departments)
    } catch {}
  }

  const fetchManagers = async (cid: string, deptId: string) => {
    setManagersLoading(true)
    setManagers([])
    setInviteManagerId('')
    try {
      const res = await fetch(`/api/company/managers?company_id=${cid}&department_id=${deptId}`)
      const data = await res.json()
      if (data.success) setManagers(data.managers)
    } catch {}
    finally { setManagersLoading(false) }
  }

  const handleDeptChange = (deptId: string) => {
    setInviteDeptId(deptId)
    setInviteManagerId('')
    setManagers([])
    if (inviteRole === 'Employee' && deptId && companyId) {
      fetchManagers(companyId, deptId)
    }
  }

  const noManagersInDept = inviteRole === 'Employee' && !!inviteDeptId && !managersLoading && managers.length === 0
  const deptRequired = (inviteRole === 'Manager' || inviteRole === 'Employee') && !inviteDeptId

  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteRole) {
      setInviteError('Email and role are required.')
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
          company_id: companyId,
          department_id: inviteRole === 'Owner' ? null : (inviteDeptId || null),
          invited_by: userId,
          reporting_manager_id: inviteRole === 'Employee' ? (inviteManagerId || null) : null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      setTimeout(() => closeModal(), 2000)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setInviteLoading(false)
    }
  }

  const showDept = inviteRole === 'Manager' || inviteRole === 'Employee'
  const showReportingManager = inviteRole === 'Employee' && !!inviteDeptId

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar />

      {/* ── MAIN ───────────────────────────────────────────────────────────── */}
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '18px 32px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>
            {companyName ? `${companyName} — Team` : 'Team'}
          </h1>
          <button
            onClick={() => setInviteOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              background: '#F97316',
              border: 'none',
              borderRadius: '9px',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#EA6C0A')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#F97316')}
          >
            <Plus size={15} strokeWidth={2.5} />
            Invite Member
          </button>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>
            Invite team members to get started.
          </p>
        </div>
      </main>

      {/* ── Invite Member Modal ───────────────────────────────────────────── */}
      {inviteOpen && (
        <ModalOverlay onClose={closeModal}>
          <ModalBox>
            <ModalHeader title="Invite Member" onClose={closeModal} />
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 20px', lineHeight: 1.55 }}>
              Send an invitation email to your new team member.
            </p>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={modalLabelStyle}>Email Address</label>
              <input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={modalInputStyle}
              />
            </div>

            {/* Role */}
            <div style={{ marginBottom: showDept ? '16px' : '0' }}>
              <label style={modalLabelStyle}>Role</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={inviteRole}
                  onChange={(e) => { setInviteRole(e.target.value); setInviteDeptId(''); setInviteManagerId(''); setManagers([]) }}
                  style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">Select a role</option>
                  <option value="Owner">Partner</option>
                  <option value="Manager">Manager</option>
                  <option value="Employee">Employee</option>
                </select>
                <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Department (Manager or Employee only) */}
            {showDept && (
              <div style={{ marginBottom: showReportingManager ? '16px' : '0' }}>
                <label style={modalLabelStyle}>Department</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={inviteDeptId}
                    onChange={(e) => handleDeptChange(e.target.value)}
                    style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer', borderColor: deptRequired && inviteError === 'Please select a department.' ? '#FCA5A5' : '#E5E7EB' }}
                  >
                    <option value="">Select a department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
                {deptRequired && inviteError === 'Please select a department.' && (
                  <p style={{ fontSize: '0.8125rem', color: '#DC2626', margin: '4px 0 0' }}>Please select a department.</p>
                )}
              </div>
            )}

            {/* Reporting Manager (Employee + department selected) */}
            {showReportingManager && (
              <div style={{ marginBottom: '0' }}>
                <label style={modalLabelStyle}>Reporting Manager</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={inviteManagerId}
                    onChange={(e) => setInviteManagerId(e.target.value)}
                    disabled={managersLoading || noManagersInDept}
                    style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: managersLoading || noManagersInDept ? 'not-allowed' : 'pointer', opacity: managersLoading ? 0.6 : 1 }}
                  >
                    {managersLoading ? (
                      <option value="">Loading managers…</option>
                    ) : noManagersInDept ? (
                      <option value="">No managers in this department yet</option>
                    ) : (
                      <>
                        <option value="">Select a manager</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                      </>
                    )}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </div>
            )}

            {/* Partner warning */}
            {inviteRole === 'Owner' && (
              <p style={{ fontSize: '0.8125rem', color: '#F97316', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '10px 12px', margin: '16px 0 0' }}>
                This person will have full Partner access to your company.
              </p>
            )}

            {/* Error / success */}
            {inviteError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginTop: '12px' }}>
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#15803D', marginTop: '12px' }}>
                {inviteSuccess}
              </div>
            )}

            {/* Submit */}
            <div title={noManagersInDept ? 'Add a manager to this department first' : deptRequired ? 'Please select a department first' : undefined} style={{ marginTop: '20px' }}>
              <button
                onClick={handleSendInvite}
                disabled={inviteLoading || !!noManagersInDept || deptRequired}
                style={{
                  width: '100%',
                  height: '48px',
                  background: '#F97316',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: inviteLoading || noManagersInDept || deptRequired ? 'not-allowed' : 'pointer',
                  opacity: inviteLoading || noManagersInDept || deptRequired ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {inviteLoading && <Spinner size={14} />}
                Send Invite
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}
    </div>
  )
}
