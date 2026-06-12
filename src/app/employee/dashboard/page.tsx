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
  assigned_cw_id?: string | null
  title: string
  instruction: string | null
  shift_date: string
  start_time: string
  end_time: string
  assignment_status: string
  casual_worker_name: string
  casual_worker_email: string
  casual_worker_phone: string
  manager_name: string
}

type CasualWorker = {
  id?: string | null
  name: string
  email: string
  phone: string
  status: string
}

type GroupedAssignedWork = {
  group_key: string
  title: string
  instruction: string | null
  shift_date: string
  start_time: string
  end_time: string
  manager_name: string
  casual_workers: CasualWorker[]
}

export default function EmployeeDashboard() {
  const router = useRouter()

  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [assignedWork, setAssignedWork] = useState<AssignedWork[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getTodayKey())
  const [selectedCW, setSelectedCW] = useState<CasualWorker | null>(null)

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

        if (dashData.assigned_work?.length > 0) {
          setSelectedDate(getDateKey(dashData.assigned_work[0].shift_date))
        }
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
          shift_date: getDateKey(work.shift_date),
          start_time: work.start_time,
          end_time: work.end_time,
          manager_name: work.manager_name || 'Assigned Manager',
          casual_workers: [],
        }
      }

      if (work.assigned_cw_id) {
        grouped[groupKey].casual_workers.push({
          id: work.assigned_cw_id,
          name: work.casual_worker_name || 'Unknown Casual Worker',
          email: work.casual_worker_email || '-',
          phone: work.casual_worker_phone || '-',
          status: work.assignment_status || 'assigned',
        })
      }
    })

    return Object.values(grouped).sort((a, b) =>
      `${a.shift_date} ${a.start_time}`.localeCompare(
        `${b.shift_date} ${b.start_time}`
      )
    )
  }, [assignedWork])

  const workByDate = useMemo(() => {
    const map: Record<string, GroupedAssignedWork[]> = {}

    groupedAssignedWork.forEach((work) => {
      const key = getDateKey(work.shift_date)
      if (!map[key]) map[key] = []
      map[key].push(work)
    })

    return map
  }, [groupedAssignedWork])

  const selectedDateWorks = workByDate[selectedDate] ?? []

  const title =
    companyName && departmentName
      ? `${companyName} [${departmentName}]`
      : companyName || 'Dashboard'

  return (
    <div style={pageStyle}>
      <EmployeeSidebar />

      <main style={mainStyle}>
        <Header title={loading ? '' : title} userName={userName} />

        <div style={{ padding: '18px 22px', flex: 1 }}>
          {loading ? (
            <p style={{ color: '#6B7280', fontSize: '0.82rem' }}>
              Loading assigned work...
            </p>
          ) : (
            <section style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={headingStyle}>Assigned Work Schedule</h2>
                </div>
              </div>

              {groupedAssignedWork.length === 0 ? (
                <EmptyState />
              ) : (
                <div style={layoutStyle}>
                  <CalendarPanel
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    workByDate={workByDate}
                  />

                  <TimelinePanel
                    selectedDate={selectedDate}
                    works={selectedDateWorks}
                    departmentName={departmentName}
                    setSelectedCW={setSelectedCW}
                  />
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {selectedCW && (
        <CWDetailsModal cw={selectedCW} onClose={() => setSelectedCW(null)} />
      )}
    </div>
  )
}

function Header({ title, userName }: { title: string; userName: string }) {
  return (
    <div style={headerStyle}>
      <h1 style={headerTitleStyle}>{title}</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {userName && (
          <span style={{ fontSize: '0.8rem', color: '#FFFFFF' }}>
            {userName}
          </span>
        )}

        <span style={roleBadgeStyle}>Employee</span>
      </div>
    </div>
  )
}

function CalendarPanel({
  selectedDate,
  setSelectedDate,
  workByDate,
}: {
  selectedDate: string
  setSelectedDate: (date: string) => void
  workByDate: Record<string, GroupedAssignedWork[]>
}) {
  const baseDate = parseLocalDate(selectedDate)
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const days = buildCalendarDays(year, month)

  const monthTitle = baseDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div style={calendarCardStyle}>
      <h3 style={cardTitleStyle}>{monthTitle}</h3>

      <div style={weekGridStyle}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} style={weekDayStyle}>
            {day}
          </div>
        ))}
      </div>

      <div style={calendarGridStyle}>
        {days.map((day) => {
          const dateKey = getDateKey(day.date)
          const hasWork = Boolean(workByDate[dateKey]?.length)
          const isSelected = dateKey === selectedDate
          const isCurrentMonth = day.date.getMonth() === month

          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDate(dateKey)}
              style={{
                ...calendarDayStyle,
                opacity: isCurrentMonth ? 1 : 0.35,
                background: isSelected ? GREEN : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : '#14532D',
                border: isSelected ? `1px solid ${GREEN}` : '1px solid #DCFCE7',
              }}
            >
              <span>{day.date.getDate()}</span>

              {hasWork && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '999px',
                    background: isSelected ? '#FFFFFF' : GREEN,
                    marginTop: '5px',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TimelinePanel({
  selectedDate,
  works,
  departmentName,
  setSelectedCW,
}: {
  selectedDate: string
  works: GroupedAssignedWork[]
  departmentName: string
  setSelectedCW: (cw: CasualWorker) => void
}) {
  return (
    <div style={timelineCardStyle}>
      <h3 style={cardTitleStyle}>{formatDate(selectedDate)}</h3>

      {works.length === 0 ? (
        <div style={emptyBoxStyle}>No assigned work on this date.</div>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          {works.map((work) => (
            <div key={work.group_key} style={timelineItemStyle}>
              <div style={timeColumnStyle}>
                <strong>{formatTime(work.start_time)}</strong>
                <span>{formatTime(work.end_time)}</span>
              </div>

              <div style={timelineLineStyle}>
                <span style={timelineDotStyle} />
              </div>

              <div style={workCardStyle}>
                <p style={labelStyle}>Assigned Work</p>

                <h4 style={workTitleStyle}>{work.title}</h4>

                <div style={infoGridStyle}>
                  <InfoBox label="Department" value={departmentName || '-'} />
                  <InfoBox label="Manager" value={work.manager_name || '-'} />
                  <InfoBox
                    label="Shift Time"
                    value={`${formatTime(work.start_time)} – ${formatTime(
                      work.end_time
                    )}`}
                  />
                  <InfoBox
                    label="Casual Workers"
                    value={`${work.casual_workers.length}`}
                  />
                </div>

                <h5 style={smallTitleStyle}>Assigned Casual Workers</h5>

                {work.casual_workers.length === 0 ? (
                  <div style={emptyBoxStyle}>
                    No casual workers assigned yet.
                  </div>
                ) : (
                  <div style={cwListStyle}>
                    {work.casual_workers.map((cw, index) => (
                      <div key={`${cw.id ?? cw.name}-${index}`} style={cwRowStyle}>
                        <p style={cwNameStyle}>{cw.name}</p>

                        <button
                          type="button"
                          onClick={() => setSelectedCW(cw)}
                          style={viewButtonStyle}
                        >
                          View Details
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <h5 style={smallTitleStyle}>Instructions</h5>

                <p style={instructionStyle}>
                  {work.instruction || 'No instructions provided.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CWDetailsModal({
  cw,
  onClose,
}: {
  cw: CasualWorker
  onClose: () => void
}) {
  return (
    <div style={modalOverlayStyle}>
      <div style={modalBoxStyle}>
        <h3 style={modalTitleStyle}>Casual Worker Details</h3>

        <InfoBox label="Name" value={cw.name} />
        <InfoBox label="Email" value={cw.email} />
        <InfoBox label="Phone" value={cw.phone} />
        <InfoBox label="Status" value={cw.status} />

        <button type="button" onClick={onClose} style={closeButtonStyle}>
          Close
        </button>
      </div>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBoxStyle}>
      <p style={infoLabelStyle}>{label}</p>
      <p style={infoValueStyle}>{value}</p>
    </div>
  )
}

function EmptyState() {
  return <div style={emptyBoxStyle}>No assigned work found.</div>
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    return { date }
  })
}

function parseLocalDate(dateValue: string) {
  const cleanDate = dateValue.split('T')[0]
  const [year, month, day] = cleanDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getTodayKey() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getDateKey(dateValue: string | Date) {
  if (typeof dateValue === 'string') {
    return dateValue.split('T')[0]
  }

  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, '0')
  const day = String(dateValue.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDate(dateValue: string) {
  const date = parseLocalDate(dateValue)

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(timeValue: string) {
  if (!timeValue) return '-'

  const [hour, minute] = timeValue.split(':')
  const date = new Date()

  date.setHours(Number(hour), Number(minute), 0, 0)

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const pageStyle: CSSProperties = {
  display: 'flex',
  height: '100vh',
  background: '#F0FDF4',
  fontFamily: 'var(--font-body)',
}

const mainStyle: CSSProperties = {
  marginLeft: '64px',
  flex: 1,
  height: '100vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
}

const headerStyle: CSSProperties = {
  padding: '19px 24px',
  background: GREEN,
  borderBottom: '1px solid #15803D',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'sticky',
  top: 0,
  zIndex: 10,
}

const headerTitleStyle: CSSProperties = {
  fontWeight: 700, 
  fontSize: '1.1875rem',
  color: '#FFFFFF',
  margin: 0,
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const roleBadgeStyle: CSSProperties = {
  padding: '6px 14px 6px 8px',
  borderRadius: '999px',
  fontSize: '0.875rem',
  fontWeight: 700,
  background: 'rgba(255,255,255,0.2)',
  boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
  color: '#FFFFFF',
}

const sectionStyle: CSSProperties = {
  background: '#FFFFFF',
  borderRadius: '12px',
  padding: '18px',
  border: '1px solid #DCFCE7',
  boxShadow: '0 4px 10px rgba(22, 163, 74, 0.06)',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '18px',
}

const headingStyle: CSSProperties = {
  fontWeight: 600, 
  fontSize: '0.8125rem', 
  color: '#6B7280', 
  textTransform: 'uppercase', 
  letterSpacing: '0.05em',
  margin: 0,
}

const subTextStyle: CSSProperties = {
  margin: 0,
  color: '#6B7280',
  fontSize: '0.8rem',
}

const layoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '360px 1fr',
  gap: '18px',
  alignItems: 'start',
}

const calendarCardStyle: CSSProperties = {
  border: '1px solid #BBF7D0',
  borderRadius: '14px',
  padding: '16px',
  background: '#F0FDF4',
}

const timelineCardStyle: CSSProperties = {
  border: '1px solid #BBF7D0',
  borderRadius: '14px',
  padding: '16px',
  background: '#FFFFFF',
}

const cardTitleStyle: CSSProperties = {
  margin: '0 0 14px',
  color: '#14532D',
  fontSize: '1rem',
  fontWeight: 900,
}

const weekGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '6px',
  marginBottom: '8px',
}

const weekDayStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '0.7rem',
  fontWeight: 800,
  color: GREEN,
}

const calendarGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '6px',
}

const calendarDayStyle: CSSProperties = {
  height: '42px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 800,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}

const timelineItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '82px 24px 1fr',
  gap: '10px',
}

const timeColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: '0.74rem',
  color: '#14532D',
  paddingTop: '4px',
}

const timelineLineStyle: CSSProperties = {
  position: 'relative',
  borderLeft: '2px solid #BBF7D0',
  minHeight: '100%',
}

const timelineDotStyle: CSSProperties = {
  position: 'absolute',
  left: '-7px',
  top: '6px',
  width: '12px',
  height: '12px',
  borderRadius: '999px',
  background: GREEN,
  border: '2px solid #FFFFFF',
}

const workCardStyle: CSSProperties = {
  padding: '14px',
  borderRadius: '12px',
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
}

const labelStyle: CSSProperties = {
  margin: '0 0 4px',
  fontSize: '0.65rem',
  fontWeight: 900,
  color: GREEN,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const workTitleStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: '1rem',
  fontWeight: 900,
  color: '#14532D',
}

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '10px',
  marginBottom: '14px',
}

const infoBoxStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: '10px',
  background: '#FFFFFF',
  border: '1px solid #BBF7D0',
}

const infoLabelStyle: CSSProperties = {
  margin: '0 0 5px',
  fontSize: '0.65rem',
  fontWeight: 800,
  color: GREEN,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const infoValueStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.82rem',
  fontWeight: 800,
  color: '#1F2937',
}

const smallTitleStyle: CSSProperties = {
  margin: '12px 0 8px',
  color: '#14532D',
  fontSize: '0.84rem',
  fontWeight: 900,
}

const cwListStyle: CSSProperties = {
  border: '1px solid #BBF7D0',
  borderRadius: '10px',
  background: '#FFFFFF',
  overflow: 'hidden',
}

const cwRowStyle: CSSProperties = {
  padding: '10px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  borderBottom: '1px solid #DCFCE7',
}

const cwNameStyle: CSSProperties = {
  margin: 0,
  color: '#1F2937',
  fontSize: '0.82rem',
  fontWeight: 800,
}

const viewButtonStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: `1px solid ${GREEN}`,
  background: '#FFFFFF',
  color: GREEN,
  fontSize: '0.72rem',
  fontWeight: 800,
  cursor: 'pointer',
}

const instructionStyle: CSSProperties = {
  margin: 0,
  color: '#374151',
  fontSize: '0.82rem',
  lineHeight: 1.6,
}

const emptyBoxStyle: CSSProperties = {
  padding: '14px',
  borderRadius: '10px',
  border: '1px dashed #BBF7D0',
  background: '#F0FDF4',
  color: '#6B7280',
  fontSize: '0.82rem',
}

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999,
}

const modalBoxStyle: CSSProperties = {
  width: '360px',
  background: '#FFFFFF',
  borderRadius: '14px',
  padding: '18px',
  border: '1px solid #BBF7D0',
  boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
  display: 'grid',
  gap: '10px',
}

const modalTitleStyle: CSSProperties = {
  margin: '0 0 6px',
  fontSize: '1rem',
  fontWeight: 900,
  color: '#14532D',
}

const closeButtonStyle: CSSProperties = {
  marginTop: '8px',
  padding: '9px 12px',
  borderRadius: '8px',
  border: 'none',
  background: GREEN,
  color: '#FFFFFF',
  fontSize: '0.8rem',
  fontWeight: 800,
  cursor: 'pointer',
}