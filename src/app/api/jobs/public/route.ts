import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/jobs/public
// Public endpoint — no auth required. Returns all open, non-archived job postings.
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('status', 'open')
      .is('archived_at', null)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, jobs: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}