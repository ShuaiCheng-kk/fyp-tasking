import { NextRequest, NextResponse } from 'next/server'
import { listCompanies } from '@/services/userAdmin/userAdminService'

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search') ?? undefined
    const companies = await listCompanies(search)
    return NextResponse.json({ companies })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
