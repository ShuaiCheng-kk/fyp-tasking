import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'

// GET /api/jobs/public
// Public endpoint — no auth required. Returns all open, non-archived, non-expired job postings.
export async function GET() {
  try {
    // No cron in this app — lazily flip any posting whose deadline just passed to 'archived'
    // before listing (see recruitmentRepository.sweepExpiredJobPostings). The .gt('expires_at', ...)
    // filter below is defense-in-depth so a posting never appears even in the gap before this runs.
    await recruitmentRepository.sweepExpiredJobPostings()

    const { data, error } = await supabase
      .from('job_postings')
      .select('*, departments(name), companies(location, description, size, address, industry)')
      .eq('status', 'open')
      .is('archived_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const jobs = (data ?? []).map((row: any) => {
      const { departments, companies, ...rest } = row
      return {
        ...rest,
        department_name: Array.isArray(departments)
          ? (departments[0]?.name ?? null)
          : (departments?.name ?? null),
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