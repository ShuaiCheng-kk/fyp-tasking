import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/casual/shiftReminderRepository', () => ({
  shiftReminderRepository: {
    getShiftsStartingOn: vi.fn(),
    markReminderSent: vi.fn(),
  },
}))

vi.mock('@/repositories/casual/casualDashboardRepository', () => ({
  casualDashboardRepository: {
    getJobPostingsByIds: vi.fn(),
    getUsersByIds: vi.fn(),
  },
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendShiftReminderEmail: vi.fn(),
  },
}))

import { shiftReminderService } from './shiftReminderService'
import { shiftReminderRepository } from '@/repositories/casual/shiftReminderRepository'
import { casualDashboardRepository } from '@/repositories/casual/casualDashboardRepository'
import { emailService } from '@/services/email/emailService'

const CASUAL_WORKER = {
  id: 'worker-1',
  full_name: 'Jamie Lee',
  role: 'Casual Worker',
  phone_number: '+65 9000 0001',
  email_address: 'jamie@test.local',
  profile_photo_url: null,
}

const EMPLOYEE_ASSIGNEE = {
  id: 'employee-1',
  full_name: 'Sam Tan',
  role: 'Employee',
  phone_number: null,
  email_address: 'sam@test.local',
  profile_photo_url: null,
}

const SUPERVISOR = {
  id: 'supervisor-1',
  full_name: 'John Tan',
  role: 'Employee',
  phone_number: '+65 9123 4567',
  email_address: 'john@test.local',
  profile_photo_url: null,
}

const DUE_SHIFT = {
  id: 'shift-1',
  company_id: 'company-1',
  shift_date: '2026-07-23',
  start_time: '09:00:00',
  supervisor_employee_id: 'supervisor-1',
  source_job_posting_id: 'job-1',
  assignedUserIds: ['worker-1'],
}

const POSTING = { id: 'job-1', title: 'Warehouse Assistant', company_name: 'Acme Events', location: '123 Warehouse Rd', created_by: 'owner-1' }

describe('shiftReminderService.sendDueShiftReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(shiftReminderRepository.getShiftsStartingOn).mockResolvedValue([DUE_SHIFT])
    vi.mocked(casualDashboardRepository.getJobPostingsByIds).mockResolvedValue([POSTING])
    vi.mocked(casualDashboardRepository.getUsersByIds).mockResolvedValue([CASUAL_WORKER, SUPERVISOR])
    vi.mocked(emailService.sendShiftReminderEmail).mockResolvedValue(undefined)
    vi.mocked(shiftReminderRepository.markReminderSent).mockResolvedValue(undefined)
  })

  it('does nothing when no shift is due tomorrow', async () => {
    vi.mocked(shiftReminderRepository.getShiftsStartingOn).mockResolvedValue([])

    const result = await shiftReminderService.sendDueShiftReminders()

    expect(result).toEqual({ sent: 0, skipped: 0 })
    expect(emailService.sendShiftReminderEmail).not.toHaveBeenCalled()
    expect(shiftReminderRepository.markReminderSent).not.toHaveBeenCalled()
  })

  it('sends the reminder to a Casual Worker assignee with the shift/location/supervisor details, and marks the shift sent', async () => {
    const result = await shiftReminderService.sendDueShiftReminders()

    expect(emailService.sendShiftReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jamie@test.local',
        fullName: 'Jamie Lee',
        jobTitle: 'Warehouse Assistant',
        companyName: 'Acme Events',
        shiftDate: '2026-07-23',
        startTime: '09:00',
        location: '123 Warehouse Rd',
        supervisorName: 'John Tan',
        supervisorPhone: '+65 9123 4567',
        supervisorEmail: 'john@test.local',
      }),
    )
    expect(shiftReminderRepository.markReminderSent).toHaveBeenCalledWith(['shift-1'])
    expect(result).toEqual({ sent: 1, skipped: 0 })
  })

  it('skips an assignee who is not a Casual Worker and does not email them', async () => {
    vi.mocked(shiftReminderRepository.getShiftsStartingOn).mockResolvedValue([
      { ...DUE_SHIFT, assignedUserIds: ['employee-1'] },
    ])
    vi.mocked(casualDashboardRepository.getUsersByIds).mockResolvedValue([EMPLOYEE_ASSIGNEE, SUPERVISOR])

    const result = await shiftReminderService.sendDueShiftReminders()

    expect(emailService.sendShiftReminderEmail).not.toHaveBeenCalled()
    expect(shiftReminderRepository.markReminderSent).toHaveBeenCalledWith([])
    expect(result).toEqual({ sent: 0, skipped: 1 })
  })

  it('a failed email for one shift does not block markReminderSent for other due shifts', async () => {
    const secondShift = { ...DUE_SHIFT, id: 'shift-2', assignedUserIds: ['worker-2'] }
    const secondWorker = { ...CASUAL_WORKER, id: 'worker-2', email_address: 'worker2@test.local' }
    vi.mocked(shiftReminderRepository.getShiftsStartingOn).mockResolvedValue([DUE_SHIFT, secondShift])
    vi.mocked(casualDashboardRepository.getUsersByIds).mockResolvedValue([CASUAL_WORKER, secondWorker, SUPERVISOR])
    vi.mocked(emailService.sendShiftReminderEmail)
      .mockRejectedValueOnce(new Error('resend down'))
      .mockResolvedValueOnce(undefined)

    const result = await shiftReminderService.sendDueShiftReminders()

    expect(shiftReminderRepository.markReminderSent).toHaveBeenCalledWith(['shift-2'])
    expect(result).toEqual({ sent: 1, skipped: 0 })
  })
})
