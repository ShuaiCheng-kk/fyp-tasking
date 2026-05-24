'use client'

import { useEffect, useMemo, useState } from 'react'
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
        fontFamily: 'system-ui, -apple-system, sans-serif',
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
            padding: '18px 32px',
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
              fontSize: '1.1875rem',
              color: '#FFFFFF',
              margin: 0,
            }}
          >
            {loading ? '' : title}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userName && (
              <span
                style={{
                  fontSize: '0.9rem',
                  color: '#FFFFFF',
                }}
              >
                {userName}
              </span>
            )}

            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'rgba(255,255,255,0.2)',
                color: '#FFFFFF',
              }}
            >
              Employee
            </span>
          </div>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          {loading && (
            <p style={{ color: '#6B7280', fontSize: '0.95rem' }}>
              Loading assigned work...
            </p>
          )}

          {!loading && (
            <section
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #DCFCE7',
                boxShadow: '0 8px 20px rgba(22, 163, 74, 0.08)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: '#14532D',
                  margin: '0 0 24px',
                }}
              >
                Assigned Work
              </h2>

              {groupedAssignedWork.length === 0 ? (
                <div
                  style={{
                    padding: '18px',
                    borderRadius: '12px',
                    border: '1px dashed #BBF7D0',
                    background: '#F0FDF4',
                    color: '#6B7280',
                    fontSize: '0.95rem',
                  }}
                >
                  No assigned work found.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '18px' }}>
                  {groupedAssignedWork.map((work) => (
                    <div
                      key={work.group_key}
                      style={{
                        padding: '24px',
                        borderRadius: '14px',
                        border: '1px solid #BBF7D0',
                        background: '#F0FDF4',
                      }}
                    >
                      <p
                        style={{
                          margin: '0 0 8px',
                          fontSize: '0.85rem',
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
                          fontSize: '1.45rem',
                          fontWeight: 900,
                          color: '#14532D',
                          margin: '0 0 22px',
                        }}
                      >
                        {work.title}
                      </h3>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '14px',
                          marginBottom: '24px',
                        }}
                      >
                        <InfoBox label="Department" value={departmentName || '-'} />
                        <InfoBox
                          label="Shift"
                          value={`${formatTime(work.start_time)} – ${formatTime(
                            work.end_time
                          )}`}
                        />
                        <InfoBox label="Date" value={formatDate(work.shift_date)} />
                        <InfoBox
                          label="Reporting Manager"
                          value={work.manager_name || 'Assigned Manager'}
                        />
                      </div>

                      <h4 style={sectionTitleStyle}>Assigned Casual Workers</h4>

                      <div
                        style={{
                          overflowX: 'auto',
                          border: '1px solid #BBF7D0',
                          borderRadius: '12px',
                          background: '#FFFFFF',
                          marginBottom: '22px',
                        }}
                      >
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.92rem',
                          }}
                        >
                          <thead>
                            <tr style={{ background: '#DCFCE7' }}>
                              <th style={tableHeaderStyle}>CW Name</th>
                              <th style={tableHeaderStyle}>Email</th>
                              <th style={tableHeaderStyle}>Role</th>
                              <th style={tableHeaderStyle}>Status</th>
                            </tr>
                          </thead>

                          <tbody>
                            {work.casual_workers.map((cw, index) => (
                              <tr key={`${work.group_key}-${cw.email}-${index}`}>
                                <td style={tableCellStyle}>{cw.name || '-'}</td>
                                <td style={tableCellStyle}>{cw.email || '-'}</td>
                                <td style={tableCellStyle}>Casual Worker</td>
                                <td style={tableCellStyle}>
                                  <span
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '999px',
                                      background: '#DCFCE7',
                                      color: '#166534',
                                      fontSize: '0.8rem',
                                      fontWeight: 800,
                                      textTransform: 'capitalize',
                                    }}
                                  >
                                    {cw.status || 'assigned'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          background: '#FFFFFF',
                          border: '1px solid #BBF7D0',
                        }}
                      >
                        <h4 style={sectionTitleStyle}>Instructions</h4>

                        <p
                          style={{
                            margin: 0,
                            color: '#374151',
                            fontSize: '0.95rem',
                            lineHeight: 1.7,
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

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '12px',
        background: '#FFFFFF',
        border: '1px solid #BBF7D0',
      }}
    >
      <p
        style={{
          margin: '0 0 8px',
          fontSize: '0.78rem',
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
          fontSize: '1.05rem',
          fontWeight: 800,
          color: '#1F2937',
        }}
      >
        {value}
      </p>
    </div>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 900,
  color: '#14532D',
  margin: '0 0 12px',
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  color: '#14532D',
  fontWeight: 900,
  borderBottom: '1px solid #BBF7D0',
}

const tableCellStyle: React.CSSProperties = {
  padding: '12px 14px',
  color: '#374151',
  borderBottom: '1px solid #DCFCE7',
}