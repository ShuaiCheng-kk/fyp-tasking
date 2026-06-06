'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EmployeeSidebar from '@/components/EmployeeSidebar'

const GREEN = '#16A34A'
const GREEN_LIGHT = '#DCFCE7'
const GREEN_BORDER = '#BBF7D0'

type TeamMember = {
  id: string
  full_name: string
  email_address: string
  role: string
}

function RoleBadge({ role }: { role: string }) {
  const isManager = role === 'Manager'
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: isManager ? '#EFF6FF' : GREEN_LIGHT,
      color: isManager ? '#2563EB' : GREEN,
      border: `1px solid ${isManager ? '#BFDBFE' : GREEN_BORDER}`,
    }}>
      {role}
    </span>
  )
}

function MemberCard({
  member,
  showViewButton = false,
}: {
  member: TeamMember
  showViewButton?: boolean
}) {
  const router = useRouter()
  const initials = member.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const isManager = member.role === 'Manager'
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      padding: '14px 18px',
      background: '#FFFFFF',
      borderRadius: '12px',
      border: `1px solid ${isManager ? '#BFDBFE' : '#E5E7EB'}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: '50%',
        background: isManager ? '#EFF6FF' : GREEN_LIGHT,
        border: `1.5px solid ${isManager ? '#BFDBFE' : GREEN_BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.9375rem',
        color: isManager ? '#2563EB' : GREEN,
        flexShrink: 0,
      }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{member.full_name}</span>
          <RoleBadge role={member.role} />
        </div>
        {member.email_address && (
          <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>{member.email_address}</span>
        )}
      </div>

      {showViewButton && (
        <button
          onClick={() => router.push(`/employee/casual-workers/${member.id}`)}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: 'none',
            background: GREEN,
            color: '#FFFFFF',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          View Details
        </button>
      )}
    </div>
  )
}

export default function EmployeeTeamPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [manager, setManager] = useState<TeamMember | null>(null)
  const [teammates, setTeammates] = useState<TeamMember[]>([])
  const [casualWorkers, setCasualWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const userId = localStorage.getItem('tasking_user_id')
      if (!userId) { router.replace('/signin'); return }

      const meRes = await fetch(`/api/user/me?user_id=${userId}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }
      setUserName(meData.user.full_name ?? '')
      if (meData.user.company_id) localStorage.setItem(`tasking_company_id_${userId}`, meData.user.company_id)

      const [dashRes, teamRes] = await Promise.all([
        fetch(`/api/employee/dashboard?user_id=${userId}`),
        fetch(`/api/employee/team?user_id=${userId}`),
      ])
      const [dashData, teamData] = await Promise.all([dashRes.json(), teamRes.json()])

      if (!cancelled && dashData.success) {
        setCompanyName(dashData.company_name ?? '')
        setDepartmentName(dashData.department_name ?? '')
      }
      if (!cancelled && teamData.success) {
        setManager(teamData.manager ?? null)
        setTeammates(teamData.employees ?? [])
        setCasualWorkers(teamData.casual_workers ?? [])
      }
      if (!cancelled) setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F0FDF4', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <EmployeeSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '18px 32px',
          background: GREEN,
          borderBottom: '1px solid #15803D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#FFFFFF', margin: 0 }}>
            {loading ? 'Team' : [companyName, departmentName ? `[${departmentName}]` : '', '— Team'].filter(Boolean).join(' ')}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userName && <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>{userName}</span>}
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }}>
              Employee
            </span>
          </div>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280', fontSize: '0.9375rem' }}>
              <svg className="animate-spin" width={16} height={16} viewBox="0 0 18 18">
                <circle cx="9" cy="9" r="7" stroke="rgba(17,24,39,0.2)" strokeWidth="2.5" fill="none" />
                <path d="M9 2a7 7 0 0 1 7 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
              Loading…
            </div>
          ) : (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* My Manager */}
              <section>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px', margin: '0 0 12px' }}>
                  My Manager
                </p>
                {manager ? (
                  <MemberCard member={manager} />
                ) : (
                  <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>No manager assigned to your department.</p>
                )}
              </section>

              {/* Employees */}
              <section>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
                  Employees
                </p>
                {teammates.length === 0 ? (
                  <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>No other employees in your department.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teammates.map(m => <MemberCard key={m.id} member={m} />)}
                  </div>
                )}
              </section>

              {/* Assigned Casual Workers */}
              <section>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
                  Assigned Casual Workers
                </p>
                {casualWorkers.length === 0 ? (
                  <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>No assigned casual workers in your department.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {casualWorkers.map(cw => (
                      <MemberCard key={cw.id} member={cw} showViewButton />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}