// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { reportRepository } from '@/repositories/owner/reportRepository'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { DepartmentReportRow, RecruitmentHistorySummary, ReportFilters, WorkforceAnalyticsReport } from '@/types/Report'

function percent(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export const reportService = {
  async getWorkforceAnalytics(filters: ReportFilters): Promise<WorkforceAnalyticsReport> {
    const [departments, shifts, tasks, timeOffRows, swapRows] = await Promise.all([
      reportRepository.getDepartments(filters.company_id),
      reportRepository.getShifts(filters),
      reportRepository.getTasks(filters),
      reportRepository.getTimeOffRequests(filters.company_id, filters.date_from, filters.date_to),
      reportRepository.getSwapRequests(filters.company_id, filters.date_from, filters.date_to),
    ])

    const assignments = await reportRepository.getAssignmentsByShiftIds(shifts.map(s => s.id))
    const attendance = await reportRepository.getAttendanceByAssignmentIds(assignments.map(a => a.id))

    const shiftsById = new Map(shifts.map(s => [s.id, s]))
    const departmentNames = new Map(departments.map(d => [d.id, d.name]))
    const rows = new Map<string, DepartmentReportRow>()

    const ensureRow = (departmentId: string | null): DepartmentReportRow => {
      const key = departmentId ?? 'none'
      const existing = rows.get(key)
      if (existing) return existing
      const row: DepartmentReportRow = {
        department_id: departmentId,
        department_name: departmentId ? (departmentNames.get(departmentId) ?? 'Department') : 'No department',
        shifts: 0,
        assignments: 0,
        tasks: 0,
        completed_tasks: 0,
        attendance_records: 0,
        approved_attendance: 0,
        rejected_attendance: 0,
      }
      rows.set(key, row)
      return row
    }

    shifts.forEach(shift => ensureRow(shift.department_id).shifts += 1)
    assignments.forEach(assignment => {
      const shift = shiftsById.get(assignment.shift_id)
      ensureRow(shift?.department_id ?? null).assignments += 1
    })
    tasks.forEach(task => {
      const row = ensureRow(task.department_id)
      row.tasks += 1
      if (task.status === 'Complete' || task.percentage_complete >= 100) row.completed_tasks += 1
    })

    const assignmentsById = new Map(assignments.map(a => [a.id, a]))
    const attendanceByAssignmentId = new Map(attendance.map(r => [r.shift_assignment_id, r]))

    attendance.forEach(record => {
      const assignment = assignmentsById.get(record.shift_assignment_id)
      const shift = assignment ? shiftsById.get(assignment.shift_id) : null
      const row = ensureRow(shift?.department_id ?? null)
      row.attendance_records += 1
      if (record.owner_status === 'approved' || record.status === 'owner_approved') row.approved_attendance += 1
      if (record.owner_status === 'rejected' || record.status === 'owner_rejected') row.rejected_attendance += 1
    })

    // Attendance exceptions
    let lateCount = 0
    let absentCount = 0
    let overtimeCount = 0
    for (const assignment of assignments) {
      const shift = shiftsById.get(assignment.shift_id)
      const record = attendanceByAssignmentId.get(assignment.id)
      if (!record || !record.clock_in_time) {
        absentCount += 1
      } else {
        if (shift && timeToMinutes(record.clock_in_time.slice(11, 16)) > timeToMinutes(shift.start_time.slice(0, 5))) {
          lateCount += 1
        }
        if (shift && record.clock_out_time && timeToMinutes(record.clock_out_time.slice(11, 16)) > timeToMinutes(shift.end_time.slice(0, 5))) {
          overtimeCount += 1
        }
      }
    }

    // Task breakdown
    const task_breakdown = {
      assigned: tasks.filter(t => t.status === 'Assigned' || !t.status).length,
      in_progress: tasks.filter(t => t.status === 'In Progress').length,
      review: tasks.filter(t => t.status === 'Review').length,
      complete: tasks.filter(t => t.status === 'Complete' || t.percentage_complete >= 100).length,
    }

    // HR requests
    const hr_requests = {
      time_off_pending: timeOffRows.filter(r => r.status === 'pending').length,
      time_off_approved: timeOffRows.filter(r => r.status === 'approved').length,
      time_off_rejected: timeOffRows.filter(r => r.status === 'rejected').length,
      swap_pending: swapRows.filter(r => r.status === 'pending').length,
      swap_approved: swapRows.filter(r => r.status === 'approved').length,
      swap_rejected: swapRows.filter(r => r.status === 'rejected').length,
    }

    return {
      summary: {
        shifts: shifts.length,
        assignments: assignments.length,
        tasks: tasks.length,
        completed_tasks: tasks.filter(t => t.status === 'Complete' || t.percentage_complete >= 100).length,
        task_completion_rate: percent(tasks.filter(t => t.status === 'Complete' || t.percentage_complete >= 100).length, tasks.length),
        attendance_records: attendance.length,
        approved_attendance: attendance.filter(r => r.owner_status === 'approved' || r.status === 'owner_approved').length,
        rejected_attendance: attendance.filter(r => r.owner_status === 'rejected' || r.status === 'owner_rejected').length,
        pending_attendance: attendance.filter(r => r.owner_status === 'pending').length,
        late_attendance: lateCount,
        absent_count: absentCount,
        overtime_count: overtimeCount,
      },
      task_breakdown,
      hr_requests,
      departments: [...rows.values()].sort((a, b) => (b.assignments + b.tasks) - (a.assignments + a.tasks)),
      recent_activity: [
        ...shifts.slice(0, 5).map(s => ({
          type: 'shift' as const,
          title: s.title || 'Shift',
          detail: `${departmentNames.get(s.department_id) ?? 'No department'} · ${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`,
          date: s.shift_date,
        })),
        ...tasks.slice(0, 5).map(t => ({
          type: 'task' as const,
          title: t.title,
          detail: `${t.status} · ${t.percentage_complete}% complete`,
          date: t.created_at,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    }
  },

  async getRecruitmentHistory(filters: ReportFilters): Promise<RecruitmentHistorySummary> {
    const postings = await recruitmentRepository.getClosedPostingsByDateRange(
      filters.company_id,
      filters.date_from,
      filters.date_to,
    )
    if (postings.length === 0) {
      return { total_postings: 0, total_applicants: 0, accepted: 0, rejected: 0, conversion_rate: 0, postings: [] }
    }

    const postingIds = postings.map(p => p.id)
    const deptIds = [...new Set(postings.map(p => p.department_id).filter(Boolean) as string[])]

    const [applicantRows, deptRows] = await Promise.all([
      recruitmentRepository.getApplicantCounts(postingIds),
      recruitmentRepository.getDepartmentsByIds(deptIds),
    ])

    const deptMap = new Map(deptRows.map(d => [d.id, d.name]))

    const countByPosting = new Map<string, { total: number; accepted: number; rejected: number }>()
    for (const row of applicantRows) {
      const existing = countByPosting.get(row.job_id) ?? { total: 0, accepted: 0, rejected: 0 }
      existing.total += 1
      if (row.status === 'accepted') existing.accepted += 1
      if (row.status === 'rejected') existing.rejected += 1
      countByPosting.set(row.job_id, existing)
    }

    let totalApplicants = 0
    let totalAccepted = 0
    let totalRejected = 0

    const rows = postings.map(p => {
      const counts = countByPosting.get(p.id) ?? { total: 0, accepted: 0, rejected: 0 }
      totalApplicants += counts.total
      totalAccepted += counts.accepted
      totalRejected += counts.rejected
      return {
        posting_id: p.id,
        title: p.title,
        department_name: p.department_id ? (deptMap.get(p.department_id) ?? null) : null,
        status: p.status,
        total_applicants: counts.total,
        accepted: counts.accepted,
        rejected: counts.rejected,
        created_at: p.created_at,
      }
    })

    return {
      total_postings: postings.length,
      total_applicants: totalApplicants,
      accepted: totalAccepted,
      rejected: totalRejected,
      conversion_rate: percent(totalAccepted, totalApplicants),
      postings: rows,
    }
  },
}
