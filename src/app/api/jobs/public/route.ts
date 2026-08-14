import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { recruitmentService } from '@/services/owner/recruitmentService'
import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'

// GET /api/jobs/public?user_id=...
// Public endpoint — no auth required. Returns all open, non-archived, non-expired job postings.
// When a signed-in worker's user_id is passed, postings from any company that has banned that
// worker (marked them "inactive" on its Team page) are hidden.
export async function GET(req: NextRequest) {
  try {
    const user_id = req.nextUrl.searchParams.get('user_id')

    // No cron in this app — lazily flip any posting whose deadline just passed to 'archived'
    // before listing (see recruitmentService.sweepExpiredJobPostings). The .gt('expires_at', ...)
    // filter below is defense-in-depth so a posting never appears even in the gap before this runs.
    await recruitmentService.sweepExpiredJobPostings()

    const blockingCompanyIds = user_id
      ? await workerApplicationRepository.getBlockingCompanyIds(user_id)
      : []

    const { data, error } = await supabase
      .from('job_postings')
      .select('*, departments(name), companies(name, location, description, size, address, industry)')
      .eq('status', 'open')
      .is('archived_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const visible = blockingCompanyIds.length > 0
      ? (data ?? []).filter((row: any) => !blockingCompanyIds.includes(row.company_id))
      : (data ?? [])

    // So the board can hide/replace "Apply Now" for a posting this worker already applied to,
    // instead of only finding out after opening the apply modal.
    const appliedJobIds = user_id
      ? await workerApplicationRepository.getAppliedJobIds(user_id, visible.map((row: any) => row.id))
      : new Set<string>()

    const jobs = visible.map((row: any) => {
      const { departments, companies, ...rest } = row
      return {
        ...rest,
        already_applied: appliedJobIds.has(row.id),
        department_name: Array.isArray(departments)
          ? (departments[0]?.name ?? null)
          : (departments?.name ?? null),
        company_name: Array.isArray(companies)
          ? (companies[0]?.name ?? null)
          : (companies?.name ?? null),
        company_location: Array.isArray(companies)
          ? (companies[0]?.location ?? null)
          : (companies?.location ?? null),
        company_description: Array.isArray(companies)
          ? (companies[0]?.description ?? null)
          : (companies?.description ?? null),
        company_size: Array.isArray(companies)
          ? (companies[0]?.size ?? null)
          : (companies?.size ?? null),
        company_address: Array.isArray(companies)
          ? (companies[0]?.address ?? null)
          : (companies?.address ?? null),
        company_industry: Array.isArray(companies)
          ? (companies[0]?.industry ?? null)
          : (companies?.industry ?? null),
      }
    })

    return NextResponse.json({ success: true, jobs })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}