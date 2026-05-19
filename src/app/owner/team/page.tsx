'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronDown } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
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
type ChangeDeptModal = { member: TeamMember } | null
type ManageDeptModal = { member: TeamMember } | null
type EditManagerModal = { member: TeamMember } | null

const ROLE_LABEL: Record<string, string> = {
  Owner: 'OWNER',
  Manager: 'MANAGER',
  Employee: 'EMPLOYEE',
  'Casual Worker': 'CASUAL WORKER',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyOwnerId, setCompanyOwnerId] = useState('')
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

  // Current user's role (to gate Edit buttons)
  const [currentUserRole, setCurrentUserRole] = useState('')
  const [userDeptId, setUserDeptId] = useState('')

  // Departments for the whole company (for display + change dept modal)
  const [companyDepartments, setCompanyDepartments] = useState<Department[]>([])

  // Change Department modal
  const [changeDeptModal, setChangeDeptModal] = useState<ChangeDeptModal>(null)
  const [changeDeptSelectedId, setChangeDeptSelectedId] = useState('')
  const [changeDeptLoading, setChangeDeptLoading] = useState(false)
  const [changeDeptError, setChangeDeptError] = useState('')

  // Remove Member modal
  const [removeModal, setRemoveModal] = useState<TeamMember | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState('')

  // Manage Departments modal (legacy — kept for internal logic reuse)
  const [manageDeptModal, setManageDeptModal] = useState<ManageDeptModal>(null)
  const [manageDeptAssigned, setManageDeptAssigned] = useState<{ department_id: string; department_name: string }[]>([])
  const [manageDeptChecked, setManageDeptChecked] = useState<Set<string>>(new Set())
  const [manageDeptLoading, setManageDeptLoading] = useState(false)
  const [manageDeptSaving, setManageDeptSaving] = useState(false)
  const [manageDeptToast, setManageDeptToast] = useState('')

  // Edit Manager modal (combined home dept + dept access)
  const [editManagerModal, setEditManagerModal] = useState<EditManagerModal>(null)
  const [editHomeDeptId, setEditHomeDeptId] = useState('')
  const [editDeptChecked, setEditDeptChecked] = useState<Set<string>>(new Set())
  const [editDeptAssigned, setEditDeptAssigned] = useState<{ department_id: string; department_name: string }[]>([])
  const [editDeptLoading, setEditDeptLoading] = useState(false)
  const [editManagerSaving, setEditManagerSaving] = useState(false)
  const [editManagerError, setEditManagerError] = useState('')

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
      if (!uid) {
        router.replace('/signin')
        return
      }
      if (cancelled) return
      setUserId(uid)

      fetch(`/api/user/me?user_id=${uid}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setInternalUserId(d.user.id)
            setOwnerEmail(d.user.email_address)
            setCurrentUserRole(d.user.role)
            setUserDeptId(d.user.department_id || '')
          }
        })
        .catch(() => {})

      let storedCid = localStorage.getItem(`tasking_company_id_${uid}`) || ''

      if (!storedCid) {
        // Fallback 1: fetch from /api/user/me (works for invited users)
        try {
          const meRes = await fetch(`/api/user/me?user_id=${uid}`)
          const meData = await meRes.json()
          if (meData.success && meData.user?.company_id) {
            storedCid = meData.user.company_id
            localStorage.setItem(`tasking_company_id_${uid}`, storedCid)
          }
        } catch {}
      }

      if (!storedCid) {
        // Fallback 2: fetch default company for owner
        try {
          const res = await fetch(`/api/company/by-owner?owner_id=${uid}`)
          const d = await res.json()
          if (cancelled) return
          if (d.success && d.company) {
            storedCid = d.company.id
            localStorage.setItem(`tasking_company_id_${uid}`, storedCid)
          }
        } catch {}
      }

      if (storedCid) {
        setCompanyId(storedCid)
        fetchCompanyName(uid, storedCid)
        fetchTeamMembers(storedCid)
        fetchCompanyDepartments(storedCid)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [fetchTeamMembers, router])

  const fetchCompanyName = async (uid: string, cid: string) => {
    try {
      const params = new URLSearchParams({ user_id: uid, company_id: cid })
      const res = await fetch(`/api/company/current?${params}`)
      const data = await res.json()
      if (data.success && data.company?.name) {
        setCompanyName(data.company.name)
        setCompanyOwnerId(data.company.owner_id || '')
      }
    } catch {}
  }

  const fetchCompanyDepartments = async (cid: string) => {
    try {
      const res = await fetch(`/api/company/departments?company_id=${cid}`)
      const data = await res.json()
      if (data.success) setCompanyDepartments(data.departments)
    } catch {}
  }

  // When invite modal opens: fetch companies for owner (session); default to active company
  useEffect(() => {
    if (!inviteOpen) return
    let cancelled = false
    const load = async () => {
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
      if (!uid || cancelled) return
      setCompaniesLoading(true)
      try {
        const res = await fetch(`/api/company/my-companies?owner_id=${uid}`)
        const data = await res.json()
        if (cancelled || !data.success || !data.companies) return
        setOwnedCompanies(
          data.companies.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
        )
        const currentCid = localStorage.getItem(`tasking_company_id_${uid}`) || companyId
        if (currentCid && data.companies.some((c: { id: string }) => c.id === currentCid)) {
          setSelectedCompanyId(currentCid)
        } else if (data.companies.length === 1) {
          setSelectedCompanyId(data.companies[0].id)
        }
      } catch {}
      finally {
        if (!cancelled) setCompaniesLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [inviteOpen, companyId])

  // Group members by role in display order
  const groupedMembers = (['Owner', 'Manager', 'Employee', 'Casual Worker'] as const).reduce(
    (acc, role) => {
      const group = teamMembers.filter((m) => m.role === role)
      if (group.length > 0) acc.push({ role, members: group })
      return acc
    },
    [] as { role: string; members: TeamMember[] }[]
  )

  const openInviteModal = () => {
    if (currentUserRole === 'Manager') {
      setInviteRole('Employee')
      setSelectedCompanyId(companyId)
      setInviteDeptId(userDeptId)
      if (companyId && userDeptId) fetchManagers(companyId, userDeptId)
    }
    setInviteOpen(true)
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
    setInviteDeptId('')
    setDepartments([])
    setManagers([])
    setInviteManagerId('')
    // Preserve auto-selected company; fetch depts if the new role requires it
    if (selectedCompanyId && (role === 'Manager' || role === 'Employee')) {
      fetchDepts(selectedCompanyId)
    }
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

  const handleChangeDept = async () => {
    if (!changeDeptModal || !changeDeptSelectedId) return
    setChangeDeptLoading(true)
    setChangeDeptError('')
    try {
      const res = await fetch('/api/user/update-department', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: changeDeptModal.member.id, department_id: changeDeptSelectedId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setChangeDeptModal(null)
      setChangeDeptSelectedId('')
      fetchTeamMembers(companyId)
    } catch (err) {
      setChangeDeptError(err instanceof Error ? err.message : 'Failed to update department')
    } finally {
      setChangeDeptLoading(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!removeModal) return
    setRemoveLoading(true)
    setRemoveError('')
    try {
      const res = await fetch('/api/team/remove-member', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          user_id_to_remove: removeModal.id,
          requesting_user_id: userId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setRemoveModal(null)
      fetchTeamMembers(companyId)
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemoveLoading(false)
    }
  }

  const openManageDeptModal = async (member: TeamMember) => {
    setManageDeptModal({ member })
    setManageDeptToast('')
    setManageDeptLoading(true)
    try {
      const res = await fetch(`/api/manager/departments?manager_id=${member.id}&company_id=${companyId}`)
      const data = await res.json()
      if (data.success) {
        setManageDeptAssigned(data.departments)
        setManageDeptChecked(new Set(data.departments.map((d: { department_id: string }) => d.department_id)))
      }
    } catch {}
    finally { setManageDeptLoading(false) }
  }

  const handleManageDeptToggle = (deptId: string) => {
    if (!manageDeptModal) return
    if (deptId === manageDeptModal.member.department_id) return // primary — cannot uncheck
    setManageDeptChecked(prev => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  const handleManageDeptSave = async () => {
    if (!manageDeptModal) return
    const member = manageDeptModal.member
    const originalIds = new Set(manageDeptAssigned.map(d => d.department_id))
    const toAdd = [...manageDeptChecked].filter(id => !originalIds.has(id))
    const toRemove = [...originalIds].filter(id => !manageDeptChecked.has(id))
    setManageDeptSaving(true)
    try {
      await Promise.all([
        ...toAdd.map(dept_id =>
          fetch('/api/manager/departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manager_id: member.id, company_id: companyId, department_id: dept_id, assigned_by: internalUserId }),
          })
        ),
        ...toRemove.map(dept_id =>
          fetch('/api/manager/departments', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manager_id: member.id, department_id: dept_id }),
          })
        ),
      ])
      setManageDeptToast('Departments updated')
      setTimeout(() => {
        setManageDeptModal(null)
        setManageDeptToast('')
      }, 1200)
    } catch {}
    finally { setManageDeptSaving(false) }
  }

  const openEditManagerModal = async (member: TeamMember) => {
    setEditManagerModal({ member })
    setEditHomeDeptId(member.department_id ?? '')
    setEditManagerError('')
    setEditDeptLoading(true)
    try {
      const res = await fetch(`/api/manager/departments?manager_id=${member.id}&company_id=${companyId}`)
      const data = await res.json()
      if (data.success) {
        setEditDeptAssigned(data.departments)
        setEditDeptChecked(new Set(data.departments.map((d: { department_id: string }) => d.department_id)))
      }
    } catch {}
    finally { setEditDeptLoading(false) }
  }

  const handleEditDeptToggle = (deptId: string) => {
    setEditDeptChecked(prev => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  const handleEditManagerSave = async () => {
    if (!editManagerModal) return
    const member = editManagerModal.member
    setEditManagerSaving(true)
    setEditManagerError('')
    try {
      const originalIds = new Set(editDeptAssigned.map(d => d.department_id))
      const toAdd = [...editDeptChecked].filter(id => !originalIds.has(id))
      const toRemove = [...originalIds].filter(id => !editDeptChecked.has(id))

      await Promise.all([
        // Home department
        fetch('/api/user/update-department', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: member.id, department_id: editHomeDeptId }),
        }),
        // Department access additions
        ...toAdd.map(dept_id =>
          fetch('/api/manager/departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manager_id: member.id, company_id: companyId, department_id: dept_id, assigned_by: internalUserId }),
          })
        ),
        // Department access removals
        ...toRemove.map(dept_id =>
          fetch('/api/manager/departments', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manager_id: member.id, department_id: dept_id }),
          })
        ),
      ])
      setEditManagerModal(null)
      fetchTeamMembers(companyId)
    } catch (err) {
      setEditManagerError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setEditManagerSaving(false)
    }
  }

  const isCreator = !!internalUserId && !!companyOwnerId && internalUserId === companyOwnerId

  const canRemove = (member: TeamMember): boolean => {
    if (member.id === internalUserId) return false
    if (member.id === companyOwnerId) return false
    if (isCreator) return true
    // Partner (Owner role but not creator) can only remove Manager/Employee
    if (currentUserRole === 'Owner' && member.role !== 'Owner') return true
    return false
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
              background: currentUserRole === 'Manager' ? '#3B82F6' : '#F97316',
              border: 'none',
              borderRadius: '9px',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = currentUserRole === 'Manager' ? '#2563EB' : '#EA6C0A')}
            onMouseLeave={(e) => (e.currentTarget.style.background = currentUserRole === 'Manager' ? '#3B82F6' : '#F97316')}
          >
            <Plus size={15} strokeWidth={2.5} />
            {currentUserRole === 'Manager' ? 'Invite Employee' : 'Invite Member'}
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
                    {members.map((member) => {
                      const deptName = member.department_id
                        ? companyDepartments.find((d) => d.id === member.department_id)?.name
                        : undefined
                      const canEdit = currentUserRole === 'Owner' && (member.role === 'Manager' || member.role === 'Employee')
                      const showRemove = canRemove(member)
                      return (
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
                              {deptName && (
                                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '2px 0 0' }}>{deptName}</p>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {canEdit && (
                              <button
                                onClick={() => {
                                  if (member.role === 'Manager') {
                                    openEditManagerModal(member)
                                  } else {
                                    setChangeDeptModal({ member }); setChangeDeptSelectedId(member.department_id ?? ''); setChangeDeptError('')
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '7px',
                                  background: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  color: '#6B7280',
                                  fontWeight: 500,
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#9CA3AF')}
                                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                              >
                                Edit
                              </button>
                            )}
                            {showRemove && (
                              <button
                                onClick={() => { setRemoveModal(member); setRemoveError('') }}
                                style={{
                                  padding: '5px 10px',
                                  border: '1px solid #FECACA',
                                  borderRadius: '7px',
                                  background: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  color: '#DC2626',
                                  fontWeight: 500,
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#FCA5A5' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#FECACA' }}
                              >
                                Remove
                              </button>
                            )}
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

      {/* ── Edit Manager Modal ──────────────────────────────────────────── */}
      {editManagerModal && (
        <ModalOverlay onClose={() => { if (!editManagerSaving) { setEditManagerModal(null); setEditManagerError('') } }}>
          <ModalBox>
            <ModalHeader
              title="Edit Manager"
              onClose={() => { if (!editManagerSaving) { setEditManagerModal(null); setEditManagerError('') } }}
            />

            {/* Section 1 — Home Department */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: '0 0 2px' }}>Home Department</p>
              <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '0 0 10px' }}>The department this manager belongs to</p>
              <div style={{ position: 'relative' }}>
                <select
                  value={editHomeDeptId}
                  onChange={(e) => setEditHomeDeptId(e.target.value)}
                  style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">Select a department</option>
                  {companyDepartments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Section 2 — Department Access */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: '0 0 2px' }}>Department Access</p>
              <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '0 0 10px' }}>Departments this manager can view and manage</p>
              {editDeptLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '0.875rem', padding: '8px 0' }}>
                  <Spinner size={14} dark /> Loading…
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {companyDepartments.map((dept) => {
                    const checked = editDeptChecked.has(dept.id)
                    return (
                      <label key={dept.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: '8px',
                        border: `1.5px solid ${checked ? '#BFDBFE' : '#E5E7EB'}`,
                        background: checked ? '#F0F9FF' : '#FFFFFF',
                        cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleEditDeptToggle(dept.id)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#3B82F6' }}
                        />
                        <span style={{ fontSize: '0.9rem', color: '#111827', fontWeight: checked ? 600 : 400 }}>
                          {dept.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {editManagerError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginBottom: '12px' }}>
                {editManagerError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setEditManagerModal(null); setEditManagerError('') }}
                disabled={editManagerSaving}
                style={{ flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: editManagerSaving ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditManagerSave}
                disabled={editManagerSaving || editDeptLoading || !editHomeDeptId}
                style={{
                  flex: 1, padding: '10px', background: '#111827', border: 'none', borderRadius: '8px',
                  fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
                  cursor: (editManagerSaving || editDeptLoading || !editHomeDeptId) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  opacity: (editManagerSaving || editDeptLoading || !editHomeDeptId) ? 0.65 : 1,
                }}
              >
                {editManagerSaving && <Spinner size={14} />}
                Save Changes
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Change Department Modal ──────────────────────────────────────── */}
      {changeDeptModal && (
        <ModalOverlay onClose={() => { setChangeDeptModal(null); setChangeDeptSelectedId(''); setChangeDeptError('') }}>
          <ModalBox>
            <ModalHeader
              title="Change Department"
              onClose={() => { setChangeDeptModal(null); setChangeDeptSelectedId(''); setChangeDeptError('') }}
            />
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
              Move <strong>{changeDeptModal.member.full_name}</strong> to a different department.
            </p>
            {companyDepartments.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', margin: '8px 0 16px' }}>
                No departments found.
              </p>
            ) : (
              <>
                <label style={modalLabelStyle}>Department</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={changeDeptSelectedId}
                    onChange={(e) => setChangeDeptSelectedId(e.target.value)}
                    style={{ ...modalInputStyle, paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select a department</option>
                    {companyDepartments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </>
            )}
            {changeDeptError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginTop: '12px' }}>
                {changeDeptError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => { setChangeDeptModal(null); setChangeDeptSelectedId(''); setChangeDeptError('') }}
                style={{ flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleChangeDept}
                disabled={changeDeptLoading || !changeDeptSelectedId}
                style={{
                  flex: 1, padding: '10px', background: '#111827', border: 'none', borderRadius: '8px',
                  fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
                  cursor: (changeDeptLoading || !changeDeptSelectedId) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  opacity: (changeDeptLoading || !changeDeptSelectedId) ? 0.65 : 1,
                }}
              >
                {changeDeptLoading && <Spinner size={14} />}
                Save
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Manage Departments Modal ─────────────────────────────────────── */}
      {manageDeptModal && (
        <div
          onClick={() => { if (!manageDeptSaving) { setManageDeptModal(null); setManageDeptToast('') } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '560px' }}>
            <ModalBox>
              <ModalHeader
                title={`Manage Departments — ${manageDeptModal.member.full_name}`}
                onClose={() => { if (!manageDeptSaving) { setManageDeptModal(null); setManageDeptToast('') } }}
              />
              <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
                Select which departments this manager can access. The primary department cannot be removed.
              </p>

              {manageDeptLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '0.875rem', padding: '8px 0' }}>
                  <Spinner size={14} dark /> Loading…
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {companyDepartments.map((dept) => {
                      const isPrimary = dept.id === manageDeptModal.member.department_id
                      const checked = manageDeptChecked.has(dept.id)
                      return (
                        <label key={dept.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px', borderRadius: '8px',
                          border: `1.5px solid ${checked ? '#BFDBFE' : '#E5E7EB'}`,
                          background: checked ? '#F0F9FF' : '#FFFFFF',
                          cursor: isPrimary ? 'not-allowed' : 'pointer',
                          opacity: isPrimary ? 0.8 : 1,
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isPrimary}
                            onChange={() => handleManageDeptToggle(dept.id)}
                            style={{ width: 16, height: 16, cursor: isPrimary ? 'not-allowed' : 'pointer', accentColor: '#3B82F6' }}
                          />
                          <span style={{ fontSize: '0.9rem', color: '#111827', fontWeight: checked ? 600 : 400 }}>
                            {dept.name}
                            {isPrimary && (
                              <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#6B7280', fontWeight: 400 }}>(Primary)</span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Currently assigned:</p>
                    {companyDepartments.filter(d => manageDeptChecked.has(d.id)).length === 0 ? (
                      <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>None</p>
                    ) : (
                      <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0 }}>
                        {companyDepartments
                          .filter(d => manageDeptChecked.has(d.id))
                          .map(d => d.id === manageDeptModal.member.department_id ? `${d.name} (Primary)` : d.name)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </>
              )}

              {manageDeptToast && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#15803D', marginBottom: '12px' }}>
                  {manageDeptToast}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setManageDeptModal(null); setManageDeptToast('') }}
                  disabled={manageDeptSaving}
                  style={{ flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: manageDeptSaving ? 'not-allowed' : 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleManageDeptSave}
                  disabled={manageDeptSaving || manageDeptLoading}
                  style={{
                    flex: 1, padding: '10px', background: '#3B82F6', border: 'none', borderRadius: '8px',
                    fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
                    cursor: (manageDeptSaving || manageDeptLoading) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                    opacity: (manageDeptSaving || manageDeptLoading) ? 0.65 : 1,
                  }}
                >
                  {manageDeptSaving && <Spinner size={14} />}
                  Save
                </button>
              </div>
            </ModalBox>
          </div>
        </div>
      )}

      {/* ── Remove Member Modal ──────────────────────────────────────────── */}
      {removeModal && (
        <ModalOverlay onClose={() => { if (!removeLoading) { setRemoveModal(null); setRemoveError('') } }}>
          <ModalBox>
            <ModalHeader
              title="Remove Member"
              onClose={() => { if (!removeLoading) { setRemoveModal(null); setRemoveError('') } }}
            />
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
              Remove <strong>{removeModal.full_name}</strong> from <strong>{companyName}</strong>? They will lose access to this company.
            </p>
            {removeError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginBottom: '12px' }}>
                {removeError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                onClick={() => { setRemoveModal(null); setRemoveError('') }}
                disabled={removeLoading}
                style={{ flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: removeLoading ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={removeLoading}
                style={{
                  flex: 1, padding: '10px', background: '#DC2626', border: 'none', borderRadius: '8px',
                  fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
                  cursor: removeLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  opacity: removeLoading ? 0.65 : 1,
                }}
              >
                {removeLoading && <Spinner size={14} />}
                Remove
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

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
            {currentUserRole !== 'Manager' && (
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
            )}

            {/* Company (always shown once role is selected) */}
            {inviteRole && currentUserRole !== 'Manager' && (
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

            {/* Department */}
            {currentUserRole === 'Manager' ? (
              <div style={{ marginBottom: '16px' }}>
                <label style={modalLabelStyle}>Department</label>
                <div style={{ ...modalInputStyle, color: '#6B7280', background: '#F9FAFB' }}>
                  {companyDepartments.find(d => d.id === userDeptId)?.name || 'Your department'}
                </div>
              </div>
            ) : showDept && (
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
                  background: currentUserRole === 'Manager' ? '#3B82F6' : '#F97316',
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
