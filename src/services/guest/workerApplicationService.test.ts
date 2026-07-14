import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/guest/workerApplicationRepository', () => ({
  workerApplicationRepository: {
    checkExistingApplication: vi.fn(),
    getApplicantProfile: vi.fn(),
    getApplicantCertificates: vi.fn(),
    getActiveApplicationJobs: vi.fn(),
    getFutureShiftWindows: vi.fn(),
    getBlockingCompanyIds: vi.fn(),
    createApplication: vi.fn(),
    getApplicationsByUser: vi.fn(),
    getInvitationContext: vi.fn(),
    getInvitationBasic: vi.fn(),
    updateInvitationStatus: vi.fn(),
    updateApplicantStatusById: vi.fn(),
    claimJobOpening: vi.fn(),
    countAcceptedInvitations: vi.fn(),
    closeJobPosting: vi.fn(),
    markSentInvitationsPositionFilled: vi.fn(),
    markPendingApplicantsJobClosed: vi.fn(),
    getUserContact: vi.fn(),
    promoteGuestToWorker: vi.fn(),
    addCasualWorkerToDepartment: vi.fn(),
  },
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendApplicationAcceptedEmail: vi.fn(),
    sendOfferConfirmedEmail: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    getJobPostingById: vi.fn(),
  },
}))

vi.mock('@/services/owner/shiftService', () => ({
  shiftService: {
    createShift: vi.fn(),
  },
}))

import { workerApplicationService } from './workerApplicationService'
import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { shiftService } from '@/services/owner/shiftService'
import { JobPosting } from '@/types/Recruitment'

// A far-future date keeps the "past occurrences don't count" filter out of the way.
const FUTURE_DATE = '2030-03-04'

function makeJob(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job-1',
    company_id: 'company-1',
    status: 'open',
    expires_at: null,
    form_type: 'shift',
    is_recurring: false,
    shift_date: FUTURE_DATE,
    shift_days: null,
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    job_start_time: null,
    minimum_age: null,
    ...overrides,
  } as JobPosting
}

const baseProfile = {
  id: 'user-1',
  role: 'Guest User',
  date_of_birth: '2000-01-15',
  skills: 'Customer service, Barista',
  resume_url: 'https://cdn/resume.pdf',
}

const baseInput = {
  job_id: 'job-1',
  user_id: 'user-1',
}

describe('workerApplicationService.submitApplication — apply gates + snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(makeJob())
    vi.mocked(workerApplicationRepository.checkExistingApplication).mockResolvedValue(null)
    vi.mocked(workerApplicationRepository.getApplicantProfile).mockResolvedValue(baseProfile)
    vi.mocked(workerApplicationRepository.getApplicantCertificates).mockResolvedValue([
      { name: 'Food Hygiene Certificate', file_url: 'https://cdn/cert.pdf' },
    ])
    vi.mocked(workerApplicationRepository.getActiveApplicationJobs).mockResolvedValue([])
    vi.mocked(workerApplicationRepository.getFutureShiftWindows).mockResolvedValue([])
    vi.mocked(workerApplicationRepository.getBlockingCompanyIds).mockResolvedValue([])
    vi.mocked(workerApplicationRepository.createApplication).mockResolvedValue({ id: 'app-1' })
  })

  it('snapshots the worker profile onto the application at apply time', async () => {
    await workerApplicationService.submitApplication({ ...baseInput, additional_note: '  Worked at Starbucks for a year.  ' })

    expect(workerApplicationRepository.createApplication).toHaveBeenCalledWith({
      job_id: 'job-1',
      user_id: 'user-1',
      resume_url: 'https://cdn/resume.pdf',
      relevant_experience: null,
      additional_note: 'Worked at Starbucks for a year.',
      skills_snapshot: 'Customer service, Barista',
      certificates_snapshot: [{ name: 'Food Hygiene Certificate', file_url: 'https://cdn/cert.pdf' }],
      age_at_apply: expect.any(Number),
    })
  })

  describe('experience gate (worker confirms the posting minimum, not a picker)', () => {
    it.each(['6+ Months', '1+ Year', '2+ Years'])(
      'rejects when the job requires %s and the worker has not confirmed meeting it',
      async (experienceRequired) => {
        vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(
          makeJob({ experience_required: experienceRequired })
        )

        await expect(workerApplicationService.submitApplication(baseInput))
          .rejects.toThrow('relevant experience')
        expect(workerApplicationRepository.createApplication).not.toHaveBeenCalled()
      },
    )

    it('allows the application once the worker confirms the requirement', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(
        makeJob({ experience_required: '1+ Year' })
      )

      await workerApplicationService.submitApplication({ ...baseInput, meets_experience_requirement: true })

      expect(workerApplicationRepository.createApplication).toHaveBeenCalled()
    })

    it.each(['Not Required', 'Preferred', null])(
      'does not gate when experience_required is %s',
      async (experienceRequired) => {
        vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(
          makeJob({ experience_required: experienceRequired })
        )

        await workerApplicationService.submitApplication(baseInput)

        expect(workerApplicationRepository.createApplication).toHaveBeenCalled()
      },
    )
  })

  it('rejects when the job is closed or expired', async () => {
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(makeJob({ status: 'closed' }))
    await expect(workerApplicationService.submitApplication(baseInput))
      .rejects.toThrow('no longer accepting applications')

    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(
      makeJob({ expires_at: '2020-01-01T00:00:00.000Z' })
    )
    await expect(workerApplicationService.submitApplication(baseInput))
      .rejects.toThrow('no longer accepting applications')
  })

  it('rejects a duplicate application', async () => {
    vi.mocked(workerApplicationRepository.checkExistingApplication).mockResolvedValue({ id: 'existing' })
    await expect(workerApplicationService.submitApplication(baseInput))
      .rejects.toThrow('already applied')
  })

  // The board hides a banned company's jobs; this is the server-side backstop for a stale link.
  it('rejects an application to a company that has banned the worker', async () => {
    vi.mocked(workerApplicationRepository.getBlockingCompanyIds).mockResolvedValue(['company-1'])

    await expect(workerApplicationService.submitApplication(baseInput))
      .rejects.toThrow('no longer accepting applications')
    expect(workerApplicationRepository.createApplication).not.toHaveBeenCalled()
  })

  it('allows the application when the worker is banned by a different company', async () => {
    vi.mocked(workerApplicationRepository.getBlockingCompanyIds).mockResolvedValue(['some-other-company'])

    await workerApplicationService.submitApplication(baseInput)

    expect(workerApplicationRepository.createApplication).toHaveBeenCalled()
  })

  // The job board hides Apply from company staff; this is the server-side backstop against a
  // direct API call.
  it.each(['Owner', 'Partner', 'Manager', 'Employee', 'Marketing Admin'])(
    'rejects an application from a %s account',
    async (role) => {
      vi.mocked(workerApplicationRepository.getApplicantProfile).mockResolvedValue({ ...baseProfile, role })

      await expect(workerApplicationService.submitApplication(baseInput))
        .rejects.toThrow('Company staff accounts cannot apply for jobs')
      expect(workerApplicationRepository.createApplication).not.toHaveBeenCalled()
    },
  )

  it('allows a Casual Worker to keep applying to new jobs', async () => {
    vi.mocked(workerApplicationRepository.getApplicantProfile).mockResolvedValue({ ...baseProfile, role: 'Casual Worker' })

    await workerApplicationService.submitApplication(baseInput)

    expect(workerApplicationRepository.createApplication).toHaveBeenCalled()
  })

  describe('age gate (deterministic, not AI)', () => {
    it('rejects an underage applicant', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(makeJob({ minimum_age: 21 }))
      // 16 years old relative to any test run date after 2026
      vi.mocked(workerApplicationRepository.getApplicantProfile).mockResolvedValue({
        ...baseProfile, date_of_birth: '2011-01-01',
      })

      await expect(workerApplicationService.submitApplication(baseInput))
        .rejects.toThrow('at least 21 years old')
    })

    it('rejects when the job has a minimum age but the profile has no date of birth', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(makeJob({ minimum_age: 18 }))
      vi.mocked(workerApplicationRepository.getApplicantProfile).mockResolvedValue({
        ...baseProfile, date_of_birth: null,
      })

      await expect(workerApplicationService.submitApplication(baseInput))
        .rejects.toThrow('date of birth')
    })

    it('allows an of-age applicant through', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(makeJob({ minimum_age: 18 }))

      await workerApplicationService.submitApplication(baseInput)

      expect(workerApplicationRepository.createApplication).toHaveBeenCalled()
    })
  })

  describe('schedule-conflict gate (2h travel buffer, cross-company)', () => {
    it('rejects when a confirmed shift overlaps the applied job', async () => {
      vi.mocked(workerApplicationRepository.getFutureShiftWindows).mockResolvedValue([
        { shift_date: FUTURE_DATE, start_time: '10:00', end_time: '16:00', is_open_ended: false },
      ])

      await expect(workerApplicationService.submitApplication(baseInput))
        .rejects.toThrow('clashes')
    })

    it('rejects when the gap to an existing shift is under 2 hours', async () => {
      // applied job ends 17:00; existing shift starts 18:00 — only 1h to travel
      vi.mocked(workerApplicationRepository.getFutureShiftWindows).mockResolvedValue([
        { shift_date: FUTURE_DATE, start_time: '18:00', end_time: '22:00', is_open_ended: false },
      ])

      await expect(workerApplicationService.submitApplication(baseInput))
        .rejects.toThrow('at least 2 hours')
    })

    it('allows a same-day shift with a 2-hour gap', async () => {
      // applied job ends 17:00; existing shift starts 19:00 — exactly the required buffer
      vi.mocked(workerApplicationRepository.getFutureShiftWindows).mockResolvedValue([
        { shift_date: FUTURE_DATE, start_time: '19:00', end_time: '22:00', is_open_ended: false },
      ])

      await workerApplicationService.submitApplication(baseInput)

      expect(workerApplicationRepository.createApplication).toHaveBeenCalled()
    })

    it('rejects when another ACTIVE APPLICATION (not yet a shift) occupies the slot', async () => {
      vi.mocked(workerApplicationRepository.getActiveApplicationJobs).mockResolvedValue([
        {
          form_type: 'shift', is_recurring: false, shift_date: FUTURE_DATE, shift_days: null,
          shift_start_time: '08:00', shift_end_time: '12:00', job_start_time: null,
        },
      ])

      await expect(workerApplicationService.submitApplication(baseInput))
        .rejects.toThrow('clashes')
    })

    it('treats a one-off job as occupying its start time to end of day', async () => {
      // existing one-off application starts 14:00 -> reserved until 23:59;
      // applying to an evening shift the same day must clash.
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(makeJob({
        shift_start_time: '20:00', shift_end_time: '22:00',
      }))
      vi.mocked(workerApplicationRepository.getActiveApplicationJobs).mockResolvedValue([
        {
          form_type: 'oneoff', is_recurring: false, shift_date: FUTURE_DATE, shift_days: null,
          shift_start_time: null, shift_end_time: null, job_start_time: '14:00',
        },
      ])

      await expect(workerApplicationService.submitApplication(baseInput))
        .rejects.toThrow('clashes')
    })

    it('allows jobs on different days', async () => {
      vi.mocked(workerApplicationRepository.getFutureShiftWindows).mockResolvedValue([
        { shift_date: '2030-03-05', start_time: '09:00', end_time: '17:00', is_open_ended: false },
      ])

      await workerApplicationService.submitApplication(baseInput)

      expect(workerApplicationRepository.createApplication).toHaveBeenCalled()
    })
  })
})

const baseJob = {
  id: 'job-1', company_id: 'company-1', department_id: 'dept-1', title: 'Warehouse Assistant',
  company_name: 'Acme Events', location: '1 Raffles Place', created_by: 'owner-1',
  form_type: 'shift', is_recurring: false, shift_date: '2030-07-10', shift_days: null,
  shift_start_time: '09:00', shift_end_time: '17:00', job_start_time: null,
  openings: 2, assigned_employee_id: 'emp-1',
}

const baseContext = {
  user_id: 'user-1',
  applicant_id: 'applicant-1',
  sent_at: '2026-07-01T00:00:00.000Z',
  job: baseJob,
}

import { emailService } from '@/services/email/emailService'

describe('workerApplicationService.respondToInvitation — two-way confirm chain (UC46)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workerApplicationRepository.getInvitationContext).mockResolvedValue(baseContext as any)
    vi.mocked(workerApplicationRepository.claimJobOpening).mockResolvedValue('accepted')
    vi.mocked(workerApplicationRepository.countAcceptedInvitations).mockResolvedValue(1)
    vi.mocked(workerApplicationRepository.getUserContact).mockResolvedValue({
      full_name: 'John Tan', email_address: 'john@test.local', phone_number: '+65 9123 4567',
    })
    vi.mocked(shiftService.createShift).mockResolvedValue({} as any)
  })

  it('declining voids the invitation and hides the application from the employer', async () => {
    vi.mocked(workerApplicationRepository.getInvitationBasic).mockResolvedValue({
      applicant_id: 'applicant-1', job_id: 'job-1', status: 'declined',
    })

    await workerApplicationService.respondToInvitation('inv-1', 'declined')

    expect(workerApplicationRepository.updateInvitationStatus).toHaveBeenCalledWith('inv-1', 'declined')
    expect(workerApplicationRepository.updateApplicantStatusById).toHaveBeenCalledWith('applicant-1', 'withdrawn')
    expect(workerApplicationRepository.promoteGuestToWorker).not.toHaveBeenCalled()
    expect(workerApplicationRepository.claimJobOpening).not.toHaveBeenCalled()
  })

  it('promotes the guest and gives them a stable department membership on accept', async () => {
    await workerApplicationService.respondToInvitation('inv-1', 'accepted')

    expect(workerApplicationRepository.claimJobOpening).toHaveBeenCalledWith('inv-1')
    expect(workerApplicationRepository.promoteGuestToWorker).toHaveBeenCalledWith('user-1')
    // casualworker_departments mirrors employee_departments/manager_departments — without this,
    // the new Casual Worker's department_id resolves to null everywhere (getTeamByCompany etc.),
    // hiding them from every department-scoped member picker (e.g. an Employee assigning tasks).
    expect(workerApplicationRepository.addCasualWorkerToDepartment).toHaveBeenCalledWith('user-1', 'dept-1', 'company-1')
    // The job posting's responsible employee must carry through onto the new shift assignment as
    // its supervisor — without this, Task assignment (taskRepository.getSupervisedCasualWorkerIds)
    // and the Dashboard's message/task-board widgets have no one to scope the worker to.
    expect(shiftService.createShift).toHaveBeenCalledWith(
      expect.objectContaining({ supervisor_employee_id: 'emp-1' })
    )
  })

  it('skips the department membership insert when the job has no department', async () => {
    vi.mocked(workerApplicationRepository.getInvitationContext).mockResolvedValue({
      ...baseContext,
      job: { ...baseJob, department_id: null },
    } as any)

    await workerApplicationService.respondToInvitation('inv-1', 'accepted')

    expect(workerApplicationRepository.promoteGuestToWorker).toHaveBeenCalledWith('user-1')
    expect(workerApplicationRepository.addCasualWorkerToDepartment).not.toHaveBeenCalled()
  })

  it('voids an invitation whose shift has already started instead of accepting it', async () => {
    vi.mocked(workerApplicationRepository.getInvitationContext).mockResolvedValue({
      ...baseContext,
      job: { ...baseJob, shift_date: '2020-01-01' },
    } as any)

    await expect(workerApplicationService.respondToInvitation('inv-1', 'accepted'))
      .rejects.toThrow('expired')
    expect(workerApplicationRepository.updateInvitationStatus).toHaveBeenCalledWith('inv-1', 'expired')
    expect(workerApplicationRepository.claimJobOpening).not.toHaveBeenCalled()
    expect(workerApplicationRepository.promoteGuestToWorker).not.toHaveBeenCalled()
  })

  it('first-come-first-served: a losing claim throws and produces no side effects', async () => {
    vi.mocked(workerApplicationRepository.claimJobOpening).mockResolvedValue('position_filled')

    await expect(workerApplicationService.respondToInvitation('inv-1', 'accepted'))
      .rejects.toThrow('already been filled')
    expect(workerApplicationRepository.promoteGuestToWorker).not.toHaveBeenCalled()
    expect(shiftService.createShift).not.toHaveBeenCalled()
  })

  it('a double-click on an already-accepted invitation does not re-run the side effects', async () => {
    vi.mocked(workerApplicationRepository.claimJobOpening).mockResolvedValue('already_accepted')

    await expect(workerApplicationService.respondToInvitation('inv-1', 'accepted'))
      .rejects.toThrow('no longer available')
    expect(workerApplicationRepository.promoteGuestToWorker).not.toHaveBeenCalled()
    expect(shiftService.createShift).not.toHaveBeenCalled()
  })

  it('closes the job and resolves leftovers when the last opening is confirmed', async () => {
    vi.mocked(workerApplicationRepository.countAcceptedInvitations).mockResolvedValue(2) // openings = 2

    await workerApplicationService.respondToInvitation('inv-1', 'accepted')

    expect(workerApplicationRepository.closeJobPosting).toHaveBeenCalledWith('job-1')
    expect(workerApplicationRepository.markSentInvitationsPositionFilled).toHaveBeenCalledWith('job-1')
    expect(workerApplicationRepository.markPendingApplicantsJobClosed).toHaveBeenCalledWith('job-1')
  })

  it('leaves the job open while openings remain', async () => {
    vi.mocked(workerApplicationRepository.countAcceptedInvitations).mockResolvedValue(1) // openings = 2

    await workerApplicationService.respondToInvitation('inv-1', 'accepted')

    expect(workerApplicationRepository.closeJobPosting).not.toHaveBeenCalled()
  })

  it('sends the confirmation email with the supervisor contact', async () => {
    await workerApplicationService.respondToInvitation('inv-1', 'accepted')

    expect(emailService.sendOfferConfirmedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'john@test.local',
        jobTitle: 'Warehouse Assistant',
        companyName: 'Acme Events',
        supervisorName: 'John Tan',
        supervisorPhone: '+65 9123 4567',
      }),
    )
  })

  it('a failed confirmation email never rolls back the confirmation', async () => {
    vi.mocked(emailService.sendOfferConfirmedEmail).mockRejectedValue(new Error('resend down'))

    await expect(workerApplicationService.respondToInvitation('inv-1', 'accepted')).resolves.toBeUndefined()
    expect(workerApplicationRepository.promoteGuestToWorker).toHaveBeenCalled()
  })
})
