'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
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

type Department = { department_id: string; department_name: string }

export default function ManagerDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)

  const [managerId, setManagerId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [primaryDeptId, setPrimaryDeptId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [plan, setPlan] = useState<string>('')
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false)
  const deptDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setDeptDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let userId = localStorage.getItem('tasking_user_id')
      if (!userId) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          userId = session.user.id
          localStorage.setItem('tasking_user_id', userId)
        }
      }
      if (!userId) {
        router.replace('/signin')
        return
      }

      const meRes = await fetch(`/api/user/me?user_id=${userId}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) {
        router.replace('/signin')
        return
      }

      const { id: internalId, full_name, company_id, department_id } = meData.user
      if (full_name) setUserName(full_name)
      if (internalId) setManagerId(internalId)
      if (department_id) setPrimaryDeptId(department_id)

      if (company_id) {
        setCompanyId(company_id)
        localStorage.setItem(`tasking_company_id_${userId}`, company_id)

        const compRes = await fetch(`/api/company/current?user_id=${userId}&company_id=${company_id}`)
        const compData = await compRes.json()
        if (!cancelled && compData.success && compData.company) {
          if (compData.company.name) setCompanyName(compData.company.name)
          if (compData.company.plan) setPlan(compData.company.plan === 'Paid' ? 'Pro' : 'Free')
        }

        if (internalId) {
          const deptRes = await fetch(`/api/manager/departments?manager_id=${internalId}&company_id=${company_id}`)
          const deptData = await deptRes.json()
          if (cancelled) return

          if (deptData.success && deptData.departments.length > 0) {
            setDepartments(deptData.departments)
            setSelectedDeptId(deptData.departments[0].department_id)
          } else if (department_id) {
            // fallback: manager_departments empty, resolve name from users.department_id
            const allDeptsRes = await fetch(`/api/company/departments?company_id=${company_id}`)
            const allDeptsData = await allDeptsRes.json()
            if (!cancelled && allDeptsData.success) {
              const match = allDeptsData.departments.find(
                (d: { id: string; name: string }) => d.id === department_id
              )
              if (match) {
                setDepartments([{ department_id: match.id, department_name: match.name }])
                setSelectedDeptId(match.id)
              }
            }
          }
        }
      }

      if (!cancelled) setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  const selectedDeptName = departments.find(d => d.department_id === selectedDeptId)?.department_name ?? ''
  const title = companyName && selectedDeptName
    ? `${companyName} [${selectedDeptName}]`
    : companyName || 'Dashboard'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ManagerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '18px 32px',
          background: '#1E3A5F',
          borderBottom: '1px solid #163050',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          {!loading && departments.length > 1 ? (
            <div ref={deptDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={() => setDeptDropdownOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontWeight: 700, fontSize: '1.1875rem', color: '#FFFFFF',
                  userSelect: 'none',
                }}
              >
                {companyName ? `${companyName} [${selectedDeptName}]` : selectedDeptName}
                <ChevronDown
                  size={16}
                  strokeWidth={2.5}
                  style={{ color: 'rgba(255,255,255,0.7)', transition: 'transform 0.15s', transform: deptDropdownOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>
              {deptDropdownOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '6px',
                  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: '200px', zIndex: 50, overflow: 'hidden',
                }}>
                  {departments.map(d => (
                    <button
                      key={d.department_id}
                      type="button"
                      onClick={() => { setSelectedDeptId(d.department_id); setDeptDropdownOpen(false) }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px',
                        background: d.department_id === selectedDeptId ? '#EFF6FF' : 'none',
                        border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                        color: d.department_id === selectedDeptId ? '#2563EB' : '#374151',
                        fontWeight: d.department_id === selectedDeptId ? 600 : 400,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { if (d.department_id !== selectedDeptId) e.currentTarget.style.background = '#F3F4F6' }}
                      onMouseLeave={(e) => { if (d.department_id !== selectedDeptId) e.currentTarget.style.background = 'none' }}
                    >
                      {d.department_name}{d.department_id === primaryDeptId ? ' (Primary)' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#FFFFFF', margin: 0 }}>
              {loading ? '' : title}
            </h1>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userName && (
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>{userName}</span>
            )}
            <span style={{
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.15)',
              color: '#FFFFFF',
            }}>
              Manager
            </span>
          </div>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '0.9375rem' }}>
              <Spinner /> Loading…
            </div>
          ) : (
            <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>
              Your team and schedule will appear here.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
