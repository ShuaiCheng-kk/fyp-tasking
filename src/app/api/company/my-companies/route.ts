// LAYER: Controller only
import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/companyService'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const owner_id = searchParams.get('owner_id')

  if (!owner_id) {
    return NextResponse.json({ success: false, message: 'owner_id is required' }, { status: 400 })
  }

  try {
    const companies = await companyService.getCompaniesByOwner(owner_id)
    return NextResponse.json({ success: true, companies })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch companies'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
