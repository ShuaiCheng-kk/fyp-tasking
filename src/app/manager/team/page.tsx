'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronDown } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import ManagerSidebar from '@/components/ManagerSidebar'

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(17,24,39,0.2)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 100,
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
    <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', maxHeight: '90vh', overflowY: 'auto' }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
      <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: '4px', borderRadius: '6px' }}>
        <X size={18} />
      </button>
    </div>
  )
}

const modalInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: '8px', fontSize: '0.9375rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}

const modalLabelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '8px',
}

type AssignedDept = { department_id: string; department_name: string }
type CompanyDept = { id: string; name: string }
type TeamMember = {
  id: string
  full_name: string
  email_address: string
  role: string
  department_id: string | null
}

const ROLE_LABEL: Record<string, string> = {
  Owner: 'OWNER',
  Manager: 'MANAGER',
  Employee: 'EMPLOYEE',
  'Casual Worker': 'CASUAL WORKER',
}

export default function ManagerTeamPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [primaryDeptId, setPrimaryDeptId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  const [assignedDepts, setAssignedDepts] = useState<AssignedDept[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [companyDepartments, setCompanyDepartments] = useState<CompanyDept[]>([])

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteDeptId, setInviteDeptId] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const closeModal = useCallback(() => {
    setInviteOpen(false)
    setInviteEmail('')
    setInviteDeptId('')
    setInviteError('')
    setInviteSuccess('')
  }, [])

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
    let cancelled = false
    const run = async () => {
      let uid = localStorage.getItem('tasking_user_id')
      if (!uid) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          uid = session.user.id
          localStorage.setItem('tasking_user_id', uid)
        }
      }
      if (!uid) { router.replace('/signin'); return }
      if (cancelled) return
      setUserId(uid)

      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }

      const { id: internalId, email_address, company_id, department_id } = meData.user
      if (internalId) setInternalUserId(internalId)
      if (email_address) setUserEmail(email_address)

      let cid = company_id || localStorage.getItem(`tasking_company_id_${uid}`) || ''
      if (cid) localStorage.setItem(`tasking_company_id_${uid}`, cid)
      if (cancelled) return
      setCompanyId(cid)
      setPrimaryDeptId(department_id || '')

      if (cid) {
        const compRes = await fetch(`/api/company/current?user_id=${uid}&company_id=${cid}`)
        const compData = await compRes.json()
        if (!cancelled && compData.success && compData.company?.name) {
          setCompanyName(compData.company.name)
        }

        const deptsRes = await fetch(`/api/company/departments?company_id=${cid}`)
        const deptsData = await deptsRes.json()
        if (!cancelled && deptsData.success) {
          setCompanyDepartments(deptsData.departments)
        }

        if (internalId) {
          const assignedRes = await fetch(`/api/manager/departments?manager_id=${internalId}&company_id=${cid}`)
          const assignedData = await assignedRes.json()
          if (!cancelled && assignedData.success) {
            setAssignedDepts(assignedData.departments)
            const initial = department_id || (assignedData.departments[0]?.department_id ?? '')
            setSelectedDeptId(initial)
            setInviteDeptId(initial)
          }
        }

        fetchTeamMembers(cid)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [fetchTeamMembers, router])

  const openInviteModal = () => {
    setInviteDeptId(selectedDeptId)
    setInviteOpen(true)
  }

  const handleSendInvite = async () => {
    if (!inviteEmail) { setInviteError('Email is required.'); return }
    if (userEmail && inviteEmail.toLowerCase() === userEmail.toLowerCase()) {
      setInviteError('You cannot invite yourself.')
      return
    }
    if (!inviteDeptId) { setInviteError('Please select a department.'); return }
    setInviteLoading(true)
    setInviteError('')
    try {
      const res = await fetch('/api/invitation/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: 'Employee',
          company_id: companyId,
          department_id: inviteDeptId || null,
          invited_by: userId,
          reporting_manager_id: internalUserId || null,
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

  // Filter team to show only members in the selected department
  const filteredMembers = selectedDeptId
    ? teamMembers.filter(m => m.department_id === selectedDeptId || m.role === 'Owner')
    : teamMembers

  const groupedMembers = (['Owner', 'Manager', 'Employee', 'Casual Worker'] as const).reduce(
    (acc, role) => {
      const group = filteredMembers.filter((m) => m.role === role)
      if (group.length > 0) acc.push({ role, members: group })
      return acc
    },
    [] as { role: string; members: TeamMember[] }[]
  )

  const selectedDeptName = assignedDepts.find(d => d.department_id === selectedDeptId)?.department_name ?? ''
  const title = companyName ? `${companyName} — Team` : 'Team'

  const sendDisabled = inviteLoading || !inviteEmail || !inviteDeptId

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ManagerSidebar />

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
          <div>
            <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>
              {title}
            </h1>
            {assignedDepts.length > 1 && (
              <div style={{ position: 'relative', marginTop: '6px' }}>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  style={{
                    padding: '4px 28px 4px 8px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    color: '#374151',
                    background: '#F9FAFB',
                    appearance: 'none',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {assignedDepts.map(d => (
                    <option key={d.department_id} value={d.department_id}>
                      {d.department_name}{d.department_id === primaryDeptId ? ' (Primary)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              </div>
            )}
          </div>
          <button
            onClick={openInviteModal}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 16px', background: '#3B82F6', border: 'none',
              borderRadius: '9px', fontWeight: 600, fontSize: '0.9rem', color: '#FFFFFF', cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2563EB')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#3B82F6')}
          >
            <Plus size={15} strokeWidth={2.5} />
            Invite Employee
          </button>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          {teamLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '0.9375rem' }}>
              <Spinner size={16} /> Loading team…
            </div>
          ) : groupedMembers.length === 0 ? (
            <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>
              {selectedDeptName ? `No members in ${selectedDeptName} yet.` : 'No team members yet.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {groupedMembers.map(({ role, members }) => (
                <div key={role}>
                  <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                    {ROLE_LABEL[role] || role}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {members.map((member) => {
                      const dept = member.department_id
                        ? companyDepartments.find((d) => d.id === member.department_id)
                        : undefined
                      return (
                        <div key={member.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #F3F4F6',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%',
                              background: '#EFF6FF', border: '1.5px solid #BFDBFE',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: '0.875rem', color: '#3B82F6', flexShrink: 0,
                            }}>
                              {member.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{member.full_name}</p>
                              <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>{member.email_address}</p>
                              {dept && (
                                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '2px 0 0' }}>{dept.name}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {inviteOpen && (
        <ModalOverlay onClose={closeModal}>
          <ModalBox>
            <ModalHeader title="Invite Employee" onClose={closeModal} />
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 20px', lineHeight: 1.55 }}>
              Send an invitation email to your new team member.
            </p>

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

            <div style={{ marginBottom: '16px' }}>
              <label style={modalLabelStyle}>Department</label>
              {assignedDepts.length <= 1 ? (
                <div style={{ ...modalInputStyle, color: '#6B7280', background: '#F9FAFB' }}>
                  {assignedDepts[0]?.department_name || 'Your department'}
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <select
                    value={inviteDeptId}
                    onChange={(e) => setInviteDeptId(e.target.value)}
                    style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select a department</option>
                    {assignedDepts.map(d => (
                      <option key={d.department_id} value={d.department_id}>
                        {d.department_name}{d.department_id === primaryDeptId ? ' (Primary)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              )}
            </div>

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

            <div style={{ marginTop: '20px' }}>
              <button
                onClick={handleSendInvite}
                disabled={sendDisabled}
                style={{
                  width: '100%', height: '48px',
                  background: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '10px',
                  fontWeight: 600, fontSize: '0.9375rem',
                  cursor: sendDisabled ? 'not-allowed' : 'pointer',
                  opacity: sendDisabled ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
                onMouseEnter={(e) => { if (!sendDisabled) e.currentTarget.style.background = '#2563EB' }}
                onMouseLeave={(e) => { if (!sendDisabled) e.currentTarget.style.background = '#3B82F6' }}
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
