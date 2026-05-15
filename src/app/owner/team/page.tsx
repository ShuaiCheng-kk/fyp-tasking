'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import { createClient } from '@/lib/supabase'

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
      maxHeight: '90vh',
      overflowY: 'auto',
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

// ─── Types ────────────────────────────────────────────────────────────────────

type OwnedCompany = { id: string; name: string }
type Department = { id: string; name: string }
type Manager = { id: string; full_name: string }
type TeamMember = {
  id: string
  full_name: string
  email_address: string
  role: string
  department_id: string | null
}

const ROLE_LABEL: Record<string, string> = {
  Owner: 'Owner / Partner',
  Manager: 'Manager',
  Employee: 'Employee',
  'Casual Worker': 'Casual Worker',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [userId, setUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [companyName, setCompanyName] = useState('')

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
  }, [])

  const closeModal = useCallback(() => {
    setInviteOpen(false)
    resetModal()
  }, [resetModal])

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
      if (data.success) setTeamMembers(data.members)
    } catch {}
    finally { setTeamLoading(false) }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id || localStorage.getItem('tasking_user_id') || ''
      if (!uid) return
      localStorage.setItem('tasking_user_id', uid)
      setUserId(uid)

      fetch(`/api/user/me?user_id=${uid}`)
        .then(r => r.json())
        .then(d => { if (d.success) setOwnerEmail(d.user.email_address) })
        .catch(() => {})

      const storedCid = localStorage.getItem(`tasking_company_id_${uid}`) || ''
      if (storedCid) {
        setCompanyId(storedCid)
        fetchCompanyName(uid, storedCid)
        fetchTeamMembers(storedCid)
      } else {
        fetch(`/api/company/by-owner?owner_id=${uid}`)
          .then(r => r.json())
          .then(d => {
            if (d.success && d.company) {
              const cid = d.company.id
              localStorage.setItem(`tasking_company_id_${uid}`, cid)
              setCompanyId(cid)
              setCompanyName(d.company.name)
              fetchTeamMembers(cid)
            }
          })
          .catch(() => {})
      }
    })
  }, [fetchTeamMembers])

  const fetchCompanyName = async (uid: string, cid: string) => {
    try {
      const params = new URLSearchParams({ owner_id: uid })
      if (cid) params.set('company_id', cid)
      const res = await fetch(`/api/company/by-owner?${params}`)
      const data = await res.json()
      if (data.success && data.company?.name) setCompanyName(data.company.name)
    } catch {}
  }

  // Group members by role in display order
  const groupedMembers = (['Owner', 'Manager', 'Employee', 'Casual Worker'] as const).reduce(
    (acc, role) => {
      const group = teamMembers.filter((m) => m.role === role)
      if (group.length > 0) acc.push({ role, members: group })
      return acc
    },
    [] as { role: string; members: TeamMember[] }[]
  )

  const openInviteModal = async () => {
    setInviteOpen(true)
    const uid = localStorage.getItem('tasking_user_id') || userId
    if (!uid) return
    setCompaniesLoading(true)
    try {
      const res = await fetch(`/api/company/my-companies?owner_id=${uid}`)
      const data = await res.json()
      if (data.success) setOwnedCompanies(data.companies)
    } catch {}
    finally { setCompaniesLoading(false) }
  }

  const fetchDepts = async (companyId: string) => {
    setDepartments([])
    setInviteDeptId('')
    setManagers([])
    setInviteManagerId('')
    try {
      const res = await fetch(`/api/company/departments?company_id=${companyId}`)
      const data = await res.json()
      if (data.success) setDepartments(data.departments)
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
    setSelectedCompanyId('')
    setInviteDeptId('')
    setDepartments([])
    setManagers([])
    setInviteManagerId('')
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
  const showDept = (inviteRole === 'Manager' || inviteRole === 'Employee') && !!selectedCompanyId
  const showReportingManager = inviteRole === 'Employee' && !!inviteDeptId

  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteRole) {
      setInviteError('Email and role are required.')
      return
    }
    if (ownerEmail && inviteEmail.toLowerCase() === ownerEmail.toLowerCase()) {
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
          email: inviteEmail,
          role: inviteRole,
          company_id: selectedCompanyId,
          department_id: inviteRole === 'Owner' ? null : (inviteDeptId || null),
          invited_by: userId,
          reporting_manager_id: inviteRole === 'Employee' ? (inviteManagerId || null) : null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setInviteLoading(false)
    }
  }

  const sendDisabled = inviteLoading || !!noManagersInDept ||
    ((inviteRole === 'Manager' || inviteRole === 'Employee') && !inviteDeptId)

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
            onClick={openInviteModal}
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
          {teamLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '0.9375rem' }}>
              <Spinner size={16} dark /> Loading team…
            </div>
          ) : groupedMembers.length === 0 ? (
            <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>
              Invite team members to get started.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {groupedMembers.map(({ role, members }) => (
                <div key={role}>
                  <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                    {ROLE_LABEL[role] || role}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {members.map((member) => (
                      <div key={member.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: '#FFFFFF',
                        borderRadius: '10px',
                        border: '1px solid #F3F4F6',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: '#FFF7ED',
                            border: '1.5px solid #FED7AA',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            color: '#F97316',
                            flexShrink: 0,
                          }}>
                            {member.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{member.full_name}</p>
                            <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>{member.email_address}</p>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#F97316',
                          background: '#FFF7ED',
                          border: '1px solid #FED7AA',
                          borderRadius: '6px',
                          padding: '3px 10px',
                        }}>
                          {ROLE_LABEL[member.role] || member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
            <div style={{ marginBottom: '16px' }}>
              <label style={modalLabelStyle}>Role</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={inviteRole}
                  onChange={(e) => handleRoleChange(e.target.value)}
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

            {/* Company (always shown once role is selected) */}
            {inviteRole && (
              <div style={{ marginBottom: '16px' }}>
                <label style={modalLabelStyle}>Company</label>
                <div style={{ position: 'relative' }}>
                  {companiesLoading ? (
                    <div style={{ ...modalInputStyle, display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF' }}>
                      <Spinner size={14} dark /> Loading companies…
                    </div>
                  ) : (
                    <>
                      <select
                        value={selectedCompanyId}
                        onChange={(e) => handleCompanyChange(e.target.value)}
                        style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
                      >
                        <option value="">Select a company</option>
                        {ownedCompanies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Department (Manager or Employee, after company selected) */}
            {showDept && (
              <div style={{ marginBottom: '16px' }}>
                <label style={modalLabelStyle}>Department</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={inviteDeptId}
                    onChange={(e) => handleDeptChange(e.target.value)}
                    style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select a department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
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
              <p style={{ fontSize: '0.8125rem', color: '#F97316', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '10px 12px', margin: '4px 0 0' }}>
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
            <div
              title={noManagersInDept ? 'Add a manager to this department first' : undefined}
              style={{ marginTop: '20px' }}
            >
              <button
                onClick={handleSendInvite}
                disabled={sendDisabled}
                style={{
                  width: '100%',
                  height: '48px',
                  background: '#F97316',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: sendDisabled ? 'not-allowed' : 'pointer',
                  opacity: sendDisabled ? 0.5 : 1,
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
