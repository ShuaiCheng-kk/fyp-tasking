import { NextRequest, NextResponse } from 'next/server'
import { getCompanyDetail } from '@/services/userAdmin/userAdminService'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const detail = await getCompanyDetail(id)
    if (!detail) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    return NextResponse.json({ company: detail })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
