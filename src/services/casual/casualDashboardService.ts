// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualDashboardRepository } from '@/repositories/casual/casualDashboardRepository'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'

export interface CurrentJobView {
  assignment_id: string
  shift_id: string
  company_id: string
  department_id: string
  title: string
  shift_date: string
  start_time: string
  end_time: string
  is_open_ended: boolean
  company_name: string | null
  location: string | null
  // Read LIVE from the assignment's supervisor_employee_id (never snapshotted) — if the
  // supervisor is replaced before the shift, the worker must see the current person's contact.
  supervisor: {
    id: string
    full_name: string
    phone_number: string | null
    email_address: string
  } | null
  clock_in_time: string | null
  clock_out_time: string | null
  clock_out_released_at: string | null
}

export const casualDashboardService = {
  async getDashboard(authId: string) {
    if (!authId) throw new Error('Missing user id')

    const user = await casualDashboardRepository.getUserByAuthId(authId)
    if (!user) {
      throw new Error('Casual worker not found')
    }

    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const unsortedAssignments = await casualDashboardRepository.getUpcomingAssignments(user.id, todayKey)

    // Earliest first — sorted here rather than trusted from the repository, since ordering across
    // a joined table isn't guaranteed by every query shape.
    const assignments = [...unsortedAssignments].sort((a, b) =>
      (a.shift.shift_date + a.shift.start_time).localeCompare(b.shift.shift_date + b.shift.start_time)
    )

    const records = await casualAttendanceRepository.getAttendanceRecordsByAssignmentIds(assignments.map(a => a.id))
    const recordsByAssignment = new Map(records.map(r => [r.shift_assignment_id, r]))

    // A Casual Worker only ever works one job at a time — the earliest assignment that hasn't
    // been clocked out of yet IS the current job. Once they clock out, it drops out of this list
    // and the next chronological assignment becomes current.
    const active = assignments.find(a => {
      const record = recordsByAssignment.get(a.id)
      return !record?.clock_out_time
    })

    if (!active) {
      return { user, current_job: null as CurrentJobView | null }
    }

    const record = recordsByAssignment.get(active.id) ?? null

    const jobs = active.shift.source_job_posting_id
      ? await casualDashboardRepository.getJobPostingsByIds([active.shift.source_job_posting_id])
      : []
    const job = jobs[0] ?? null

    const supervisors = active.supervisor_employee_id
      ? await casualDashboardRepository.getUsersByIds([active.supervisor_employee_id])
      : []
    const supervisor = supervisors[0] ?? null

    const current_job: CurrentJobView = {
      assignment_id: active.id,
      shift_id: active.shift.id,
      company_id: active.shift.company_id,
      department_id: active.shift.department_id,
      title: active.shift.title,
      shift_date: active.shift.shift_date,
      start_time: active.shift.start_time,
      end_time: active.shift.end_time,
      is_open_ended: active.shift.is_open_ended,
      company_name: job?.company_name ?? null,
      location: job?.location ?? null,
      supervisor: supervisor
        ? { id: supervisor.id, full_name: supervisor.full_name, phone_number: supervisor.phone_number, email_address: supervisor.email_address }
        : null,
      clock_in_time: record?.clock_in_time ?? null,
      clock_out_time: record?.clock_out_time ?? null,
      clock_out_released_at: record?.clock_out_released_at ?? null,
    }

    return { user, current_job }
  },
}
