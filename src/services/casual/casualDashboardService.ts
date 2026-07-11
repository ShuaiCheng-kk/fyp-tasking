// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualDashboardRepository } from '@/repositories/casual/casualDashboardRepository'

export interface UpcomingShiftView {
  id: string
  title: string
  shift_date: string
  start_time: string
  end_time: string
  is_open_ended: boolean
  company_name: string | null
  location: string | null
  // Read LIVE from the source job posting's responsible employee (never snapshotted) — if the
  // supervisor is replaced before the shift, the worker must see the current person's contact.
  supervisor: {
    full_name: string
    phone_number: string | null
    email_address: string
  } | null
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
    const shifts = await casualDashboardRepository.getUpcomingShifts(user.id, todayKey)

    // Trace each shift back to the job posting it was hired from, then to that posting's
    // responsible employee — the on-site contact the worker reports to.
    const jobIds = [...new Set(shifts.map(s => s.source_job_posting_id).filter((id): id is string => Boolean(id)))]
    const jobs = await casualDashboardRepository.getJobPostingsByIds(jobIds)
    const jobMap = new Map(jobs.map(job => [job.id, job]))
    const supervisorIds = [...new Set(jobs.map(job => job.assigned_employee_id).filter((id): id is string => Boolean(id)))]
    const supervisors = await casualDashboardRepository.getUsersByIds(supervisorIds)
    const supervisorMap = new Map(supervisors.map(s => [s.id, s]))

    const upcoming_shifts: UpcomingShiftView[] = shifts
      .map(shift => {
        const job = shift.source_job_posting_id ? jobMap.get(shift.source_job_posting_id) : undefined
        const supervisor = job?.assigned_employee_id ? supervisorMap.get(job.assigned_employee_id) : undefined
        return {
          id: shift.id,
          title: shift.title,
          shift_date: shift.shift_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          is_open_ended: shift.is_open_ended,
          company_name: job?.company_name ?? null,
          location: job?.location ?? null,
          supervisor: supervisor
            ? { full_name: supervisor.full_name, phone_number: supervisor.phone_number, email_address: supervisor.email_address }
            : null,
        }
      })
      .sort((a, b) => (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time))

    return { user, upcoming_shifts }
  },
}
