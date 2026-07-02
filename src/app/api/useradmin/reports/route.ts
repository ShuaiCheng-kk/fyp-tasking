import { NextResponse } from 'next/server'
import { getReportStats } from '@/services/userAdmin/userAdminService'

export async function GET() {
  try {
    const stats = await getReportStats()
    return NextResponse.json(stats)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
