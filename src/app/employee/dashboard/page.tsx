'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import EmployeeSidebar from '@/components/EmployeeSidebar'

const GREEN = '#16A34A'

type AssignedWork = {
  id: string
  shift_id?: string
  title: string
  instruction: string | null
  shift_date: string
  start_time: string
  end_time: string
  assignment_status: string
  casual_worker_name: string
  casual_worker_email: string
  manager_name: string
}

type GroupedAssignedWork = {
  group_key: string
  title: string
  instruction: string | null
  shift_date: string
  start_time: string
  end_time: string
  manager_name: string
  casual_workers: {
    name: string
    email: string
    status: string
  }[]
}

export default function EmployeeDashboard() {
  const router = useRouter()

  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [assignedWork, setAssignedWork] = useState<AssignedWork[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      let userId = localStorage.getItem('tasking_user_id')

      if (!userId) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const {
          data: { session },
        } = await supabase.auth.getSession()

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

      setUserName(meData.user.full_name ?? '')

      const dashRes = await fetch(`/api/employee/dashboard?user_id=${userId}`)
      const dashData = await dashRes.json()

      if (!cancelled && dashData.success) {
        setCompanyName(dashData.company_name ?? '')
        setDepartmentName(dashData.department_name ?? '')
        setAssignedWork(dashData.assigned_work ?? [])
      }

      if (!cancelled) setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [router])

  const groupedAssignedWork = useMemo(() => {
    const grouped: Record<string, GroupedAssignedWork> = {}

    assignedWork.forEach((work) => {
      const groupKey =
        work.shift_id ||
        `${work.title}-${work.shift_date}-${work.start_time}-${work.end_time}`

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          group_key: groupKey,
          title: work.title,
          instruction: work.instruction,
          shift_date: work.shift_date,
          start_time: work.start_time,
          end_time: work.end_time,
          manager_name: work.manager_name || 'Assigned Manager',
          casual_workers: [],
        }
      }

      grouped[groupKey].casual_workers.push({
        name: work.casual_worker_name,
        email: work.casual_worker_email,
        status: work.assignment_status || 'assigned',
      })
    })

    return Object.values(grouped)
  }, [assignedWork])

  const title =
    companyName && departmentName
      ? `${companyName} [${departmentName}]`
      : companyName || 'Dashboard'

  const formatDate = (dateValue: string) => {
    const date = new Date(dateValue)

    if (Number.isNaN(date.getTime())) return dateValue

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTime = (timeValue: string) => {
    const [hour, minute] = timeValue.split(':')
    const date = new Date()

    date.setHours(Number(hour), Number(minute), 0, 0)

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getAssignmentLabel = (dateValue: string) => {
    const today = new Date().toISOString().split('T')[0]
    const shiftDate = dateValue?.split('T')[0]

    if (today === shiftDate) return "Today's Assignment"

    return 'Upcoming Assignment'
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#F0FDF4',
        fontFamily: 'var(--font-body)',
      }}
    >
      <EmployeeSidebar />

      <main
        style={{
          marginLeft: '64px',
          flex: 1,
          height: '100vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 24px',
            background: GREEN,
            borderBottom: '1px solid #15803D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <h1
            style={{
              fontWeight: 700,
              fontSize: '1rem',
              color: '#FFFFFF',
              margin: 0,
              fontFamily: 'var(--font-heading)',
            }}
          >
            {loading ? '' : title}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {userName && (
              <span
                style={{
                  fontSize: '0.8rem',
                  color: '#FFFFFF',
                }}
              >
                {userName}
              </span>
            )}

            <span
              style={{
                padding: '3px 8px',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: 'rgba(255,255,255,0.2)',
                color: '#FFFFFF',
              }}
            >
              Employee
            </span>
          </div>
        </div>

        <div style={{ padding: '18px 22px', flex: 1 }}>
          {loading && (
            <p style={{ color: '#6B7280', fontSize: '0.82rem' }}>
              Loading assigned work...
            </p>
          )}

          {!loading && (
            <section
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                padding: '18px',
                border: '1px solid #DCFCE7',
                boxShadow: '0 4px 10px rgba(22, 163, 74, 0.06)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: '#14532D',
                  margin: '0 0 18px',
                }}
              >
                Assigned Work
              </h2>

              {groupedAssignedWork.length === 0 ? (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    border: '1px dashed #BBF7D0',
                    background: '#F0FDF4',
                    color: '#6B7280',
                    fontSize: '0.82rem',
                  }}
                >
                  No assigned work found.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {groupedAssignedWork.map((work) => (
                    <div
                      key={work.group_key}
                      style={{
                        padding: '18px',
                        borderRadius: '12px',
                        border: '1px solid #BBF7D0',
                        background: '#F0FDF4',
                      }}
                    >
                      <p
                        style={{
                          margin: '0 0 6px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          color: '#16A34A',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {getAssignmentLabel(work.shift_date)}
                      </p>

                      <h3
                        style={{
                          fontSize: '1rem',
                          fontWeight: 900,
                          color: '#14532D',
                          margin: '0 0 16px',
                        }}
                      >
                        {work.title}
                      </h3>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit, minmax(170px, 1fr))',
                          gap: '10px',
                          marginBottom: '18px',
                        }}
                      >
                        <InfoBox
                          label="Department"
                          value={departmentName || '-'}
                        />

                        <InfoBox
                          label="Shift"
                          value={`${formatTime(
                            work.start_time
                          )} – ${formatTime(work.end_time)}`}
                        />

                        <InfoBox
                          label="Date"
                          value={formatDate(work.shift_date)}
                        />

                        <InfoBox
                          label="Reporting Manager"
                          value={work.manager_name || 'Assigned Manager'}
                        />
                      </div>

                      <h4 style={sectionTitleStyle}>
                        Assigned Casual Workers
                      </h4>

                      <div
                        style={{
                          border: '1px solid #BBF7D0',
                          borderRadius: '10px',
                          background: '#FFFFFF',
                          marginBottom: '16px',
                          overflow: 'hidden',
                        }}
                      >
                        {work.casual_workers.map((cw, index) => (
                          <div
                            key={`${work.group_key}-${cw.name}-${index}`}
                            style={{
                              padding: '10px 12px',
                              borderBottom:
                                index === work.casual_workers.length - 1
                                  ? 'none'
                                  : '1px solid #DCFCE7',
                            }}
                          >
                            <p
                              style={{
                                margin: '0 0 2px',
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                color: '#16A34A',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              CW Name
                            </p>

                            <p
                              style={{
                                margin: 0,
                                color: '#374151',
                                fontSize: '0.84rem',
                                fontWeight: 700,
                              }}
                            >
                              {cw.name || '-'}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          background: '#FFFFFF',
                          border: '1px solid #BBF7D0',
                        }}
                      >
                        <h4 style={sectionTitleStyle}>Instructions</h4>

                        <p
                          style={{
                            margin: 0,
                            color: '#374151',
                            fontSize: '0.82rem',
                            lineHeight: 1.6,
                          }}
                        >
                          {work.instruction || 'No instructions provided.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

function InfoBox({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: '10px',
        background: '#FFFFFF',
        border: '1px solid #BBF7D0',
      }}
    >
      <p
        style={{
          margin: '0 0 5px',
          fontSize: '0.65rem',
          fontWeight: 800,
          color: '#16A34A',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: 0,
          fontSize: '0.84rem',
          fontWeight: 800,
          color: '#1F2937',
        }}
      >
        {value}
      </p>
    </div>
  )
}

const sectionTitleStyle: CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 900,
  color: '#14532D',
  margin: '0 0 10px',
}