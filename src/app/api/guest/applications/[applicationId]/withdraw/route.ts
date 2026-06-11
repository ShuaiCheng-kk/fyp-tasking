import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await params

    const { data, error } = await supabase
      .from('job_applicants')
      .update({ status: 'withdrawn' })
      .eq('id', applicationId)
      .eq('status', 'pending')
      .select()
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Application not found or already processed.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      application: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to withdraw application',
      },
      { status: 500 }
    )
  }
}