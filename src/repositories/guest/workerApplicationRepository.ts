// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { ApplicantCertificateSnapshot } from '@/types/Recruitment'

export const workerApplicationRepository = {
  async checkExistingApplication(jobId: string, userId: string) {
    // 'withdrawn' means the WORKER walked away on their own (declined an offer, withdrew a
    // pending application, or cancelled a confirmed shift) — that's their call to unmake, so it
    // must never lock them out of applying to the same job again.
    const { data, error } = await supabase
      .from('job_applicants')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .neq('status', 'withdrawn')
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  },

  // The profile fields that get snapshotted onto an application, keyed by internal user id.
  // role comes along so the service can reject company staff trying to apply for casual jobs.
  async getApplicantProfile(userId: string): Promise<{
    id: string
    role: string
    date_of_birth: string | null
    skills: string | null
    resume_url: string | null
  } | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, role, date_of_birth, skills, resume_url')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  },

  async getApplicantCertificates(userId: string): Promise<{ name: string; file_url: string | null }[]> {
    const { data, error } = await supabase
      .from('user_certificates')
      .select('name, file_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)
    return data ?? []
  },

  // The worker's other still-active applications (pending, or accepted and awaiting the worker's
  // confirmation) on open jobs — these occupy their timeline for the schedule-conflict gate.
  async getActiveApplicationJobs(userId: string): Promise<{
    form_type: string | null
    is_recurring: boolean | null
    shift_date: string | null
    shift_days: string[] | null
    shift_start_time: string | null
    shift_end_time: string | null
    job_start_time: string | null
  }[]> {
    const { data, error } = await supabase
      .from('job_applicants')
      .select('status, job_postings!inner(status, form_type, is_recurring, shift_date, shift_days, shift_start_time, shift_end_time, job_start_time)')
      .eq('user_id', userId)
      .in('status', ['pending', 'accepted'])
      .eq('job_postings.status', 'open')

    if (error) throw new Error(error.message)
    return (data ?? []).map(row => (row as unknown as { job_postings: never }).job_postings)
  },

  // Confirmed future shifts across ALL companies — the other half of the conflict timeline.
  async getFutureShiftWindows(userId: string): Promise<{
    shift_date: string
    start_time: string
    end_time: string
    is_open_ended: boolean
  }[]> {
    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('shifts!inner(shift_date, start_time, end_time, is_open_ended, status)')
      .eq('user_id', userId)
      .gte('shifts.shift_date', todayKey)
      .neq('shifts.status', 'cancelled')

    if (error) throw new Error(error.message)
    return (data ?? []).map(row => (row as unknown as { shifts: never }).shifts)
  },

  async createApplication(application: {
    job_id: string
    user_id: string
    resume_url: string | null
    relevant_experience: string | null
    additional_note: string | null
    skills_snapshot: string | null
    certificates_snapshot: ApplicantCertificateSnapshot[]
    age_at_apply: number | null
  }) {
    const { data, error } = await supabase
      .from('job_applicants')
      .insert({
        job_id: application.job_id,
        user_id: application.user_id,
        resume_url: application.resume_url,
        relevant_experience: application.relevant_experience,
        additional_note: application.additional_note,
        skills_snapshot: application.skills_snapshot,
        certificates_snapshot: application.certificates_snapshot,
        age_at_apply: application.age_at_apply,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  },

  async getApplicationsByUser(userId: string) {
    const { data, error } = await supabase
      .from('job_applicants')
      .select(`
        id,
        status,
        applied_at,
        decided_at,
        resume_url,
        cover_letter,
        relevant_experience,
        additional_note,
        job_postings (
          *,
          departments ( name ),
          companies ( location, description, size, address, industry )
        ),
        job_invitations (
          id,
          status,
          message,
          sent_at,
          responded_at
        )
      `)
      .eq('user_id', userId)
      .order('applied_at', { ascending: false })

    if (error) throw new Error(error.message)

    return data
  },

  // Company ids that have banned this worker (Owner set them "inactive" on the Team page). Used to
  // hide those companies' jobs from the board and to hard-block applying to them. Accepts either an
  // internal users.id (what the apply flow passes) or a supabase_auth_id (what the board passes),
  // resolving to the internal id that casualworker_departments.casual_worker_id references.
  async getBlockingCompanyIds(userId: string): Promise<string[]> {
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id')
      .or(`id.eq.${userId},supabase_auth_id.eq.${userId}`)
      .maybeSingle()
    if (userErr) throw new Error(userErr.message)
    if (!user) return []

    const { data, error } = await supabase
      .from('casualworker_departments')
      .select('company_id')
      .eq('casual_worker_id', user.id)
      .not('blocked_at', 'is', null)
    if (error) throw new Error(error.message)
    return [...new Set((data ?? []).map((row: { company_id: string | null }) => row.company_id).filter((id): id is string => !!id))]
  },

  // Every status this is ever called with ('declined', 'expired') is a terminal one, so the offer
  // is resolved here — stamp when, for the applicant's timeline.
  async updateInvitationStatus(invitationId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('job_invitations')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', invitationId)
    if (error) throw new Error(error.message)
  },

  async getInvitationBasic(invitationId: string): Promise<{ applicant_id: string; job_id: string; status: string } | null> {
    const { data, error } = await supabase
      .from('job_invitations')
      .select('applicant_id, job_id, status')
      .eq('id', invitationId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  async updateApplicantStatusById(applicantId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('job_applicants')
      .update({ status, decided_at: new Date().toISOString() })
      .eq('id', applicantId)
    if (error) throw new Error(error.message)
  },

  // The .eq('status', 'pending') guard is what makes this safe to call blind: an application the
  // employer has already decided on (or one already withdrawn) matches nothing and comes back
  // null, which the service turns into "not found or already processed".
  async withdrawPendingApplication(applicantId: string) {
    const { data, error } = await supabase
      .from('job_applicants')
      .update({ status: 'withdrawn', decided_at: new Date().toISOString() })
      .eq('id', applicantId)
      .eq('status', 'pending')
      .select()
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  // Atomic first-come-first-served claim — the DB function locks the posting row so two workers
  // confirming simultaneously can never oversubscribe the openings.
  async claimJobOpening(invitationId: string): Promise<string> {
    const { data, error } = await supabase.rpc('accept_job_invitation', { p_invitation_id: invitationId })
    if (error) throw new Error(error.message)
    return data as string
  },

  async countAcceptedInvitations(jobId: string): Promise<number> {
    const { count, error } = await supabase
      .from('job_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('status', 'accepted')
    if (error) throw new Error(error.message)
    return count ?? 0
  },

  async closeJobPosting(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('job_postings')
      .update({ status: 'closed', archived_at: new Date().toISOString() })
      .eq('id', jobId)
    if (error) throw new Error(error.message)
  },

  async markSentInvitationsPositionFilled(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('job_invitations')
      .update({ status: 'position_filled', responded_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .eq('status', 'sent')
    if (error) throw new Error(error.message)
  },

  async markPendingApplicantsJobClosed(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('job_applicants')
      .update({ status: 'job_closed', decided_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .eq('status', 'pending')
    if (error) throw new Error(error.message)
  },

  async getUserContact(userId: string): Promise<{ full_name: string; email_address: string; phone_number: string | null } | null> {
    const { data, error } = await supabase
      .from('users')
      .select('full_name, email_address, phone_number')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  async getUserIdFromInvitation(invitationId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('job_invitations')
      .select('applicant_id')
      .eq('id', invitationId)
      .single()
    if (error || !data) return null
    const { data: applicant, error: appErr } = await supabase
      .from('job_applicants')
      .select('user_id')
      .eq('id', data.applicant_id)
      .single()
    if (appErr || !applicant) return null
    return applicant.user_id
  },

  // UC49 needs a real shifts row to gate Clock In/Out for a newly-promoted Casual Worker —
  // this resolves invitation -> applicant -> job posting in one hop so the service can read
  // the job's company/department/time fields and create that shift right after promotion.
  async getInvitationContext(invitationId: string): Promise<{
    user_id: string
    applicant_id: string
    sent_at: string
    job: {
      id: string
      company_id: string
      department_id: string | null
      title: string
      company_name: string | null
      location: string | null
      created_by: string
      form_type: string | null
      is_recurring: boolean | null
      shift_date: string | null
      shift_days: string[] | null
      shift_start_time: string | null
      shift_end_time: string | null
      job_start_time: string | null
      openings: number | null
      assigned_employee_id: string | null
    }
  } | null> {
    const { data: invitation, error } = await supabase
      .from('job_invitations')
      .select('applicant_id, sent_at')
      .eq('id', invitationId)
      .single()
    if (error || !invitation) return null

    const { data: applicant, error: appErr } = await supabase
      .from('job_applicants')
      .select('user_id, job_id')
      .eq('id', invitation.applicant_id)
      .single()
    if (appErr || !applicant) return null

    const { data: job, error: jobErr } = await supabase
      .from('job_postings')
      .select('id, company_id, department_id, title, company_name, location, created_by, form_type, is_recurring, shift_date, shift_days, shift_start_time, shift_end_time, job_start_time, openings, assigned_employee_id')
      .eq('id', applicant.job_id)
      .single()
    if (jobErr || !job) return null

    return { user_id: applicant.user_id, applicant_id: invitation.applicant_id, sent_at: invitation.sent_at as string, job }
  },

  async promoteGuestToWorker(userId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ role: 'Casual Worker', worker_status: 'active' })
      .eq('id', userId)
      .eq('role', 'Guest User')
    if (error) throw new Error(error.message)
  },

  // Mirrors employee_departments/manager_departments — gives the newly-promoted Casual Worker a
  // stable department membership instead of leaving it derivable only from shift history.
  async addCasualWorkerToDepartment(userId: string, departmentId: string, companyId: string): Promise<void> {
    const { error } = await supabase
      .from('casualworker_departments')
      .upsert(
        { casual_worker_id: userId, department_id: departmentId, company_id: companyId },
        { onConflict: 'casual_worker_id,department_id', ignoreDuplicates: true },
      )
    if (error) throw new Error(error.message)
  },
}