import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'
import { shiftService } from '@/services/owner/shiftService'

type SubmitApplicationInput = {
  job_id: string
  user_id: string
  resume_file: File
  cover_letter_file: File
}

const allowedFileTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const MAX_FILE_SIZE = 5 * 1024 * 1024

function validateFile(file: File, label: string) {
  if (!allowedFileTypes.includes(file.type)) {
    throw new Error(`${label} must be PDF, DOC, or DOCX`)
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${label} must be smaller than 5MB`)
  }
}

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

export const workerApplicationService = {
  async submitApplication(input: SubmitApplicationInput) {
    if (!input.job_id) throw new Error('Job ID is required')
    if (!input.user_id) throw new Error('User ID is required')

    validateFile(input.resume_file, 'Resume')
    validateFile(input.cover_letter_file, 'Cover letter')

    const existing = await workerApplicationRepository.checkExistingApplication(
      input.job_id,
      input.user_id
    )

    if (existing) {
      throw new Error('You have already applied for this job.')
    }

    const timestamp = Date.now()

    const resumePath = `applications/${input.user_id}/${input.job_id}/${timestamp}-resume-${cleanFileName(input.resume_file.name)}`
    const coverLetterPath = `applications/${input.user_id}/${input.job_id}/${timestamp}-cover-letter-${cleanFileName(input.cover_letter_file.name)}`

    const resumeUrl = await workerApplicationRepository.uploadApplicationFile(
      input.resume_file,
      resumePath
    )

    const coverLetterUrl = await workerApplicationRepository.uploadApplicationFile(
      input.cover_letter_file,
      coverLetterPath
    )

    return await workerApplicationRepository.createApplication({
      job_id: input.job_id,
      user_id: input.user_id,
      resume_url: resumeUrl,
      cover_letter: coverLetterUrl,
    })
  },

  async getApplicationsByUser(userId: string) {
    if (!userId) throw new Error('User ID is required')

    return await workerApplicationRepository.getApplicationsByUser(userId)
  },

  async respondToInvitation(invitationId: string, response: 'accepted' | 'declined'): Promise<void> {
    if (!invitationId) throw new Error('Invitation ID is required')
    if (response !== 'accepted' && response !== 'declined') throw new Error('Invalid response')
    await workerApplicationRepository.respondToInvitation(invitationId, response)
    if (response !== 'accepted') return

    const context = await workerApplicationRepository.getInvitationContext(invitationId)
    if (!context) return
    await workerApplicationRepository.promoteGuestToWorker(context.user_id)
    if (context.job.department_id) {
      await workerApplicationRepository.addCasualWorkerToDepartment(context.user_id, context.job.department_id, context.job.company_id)
    }

    // UC49 gates Clock In/Out off a real shifts row — the moment the Casual Worker accepts,
    // create that shift (published immediately, since both sides already agreed to the work)
    // and assign them to it, mirroring how Manager/Employee shifts already work.
    const { job } = context
    if (!job.department_id || !job.shift_date) return

    let start_time: string | null = null
    let end_time: string | null = null
    let is_open_ended = false
    if (job.form_type === 'shift' && job.shift_start_time && job.shift_end_time) {
      start_time = job.shift_start_time
      end_time = job.shift_end_time
    } else if (job.form_type === 'oneoff' && job.job_start_time) {
      start_time = job.job_start_time
      end_time = addOneHour(job.job_start_time)
      is_open_ended = true
    }
    if (!start_time || !end_time) return

    await shiftService.createShift({
      company_id: job.company_id,
      department_id: job.department_id,
      title: job.title,
      shift_date: job.shift_date,
      start_time,
      end_time,
      created_by: job.created_by,
      publication_status: 'published',
      assigned_user_id: context.user_id,
      is_open_ended,
      source_job_posting_id: job.id,
    })
  },
}

// One-off jobs have an open-ended finish (the worker decides when the task is done, pay is
// flat-rate regardless), but the shifts table requires a non-null end_time — this is only a
// structural placeholder, never used to gate or limit Clock Out.
function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const next = (h + 1) % 24
  return `${String(next).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`
}