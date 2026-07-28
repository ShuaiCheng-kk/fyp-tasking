import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  const { data, error } = await supabase
    .from('job_postings')
    .select('id, title, companies(name)')
    .eq('id', jobId)
    .single()

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }

  const { companies, ...rest } = data as any
  const co = Array.isArray(companies) ? companies[0] : companies
  return NextResponse.json({ success: true, job: { ...rest, company_name: co?.name ?? null } })
}