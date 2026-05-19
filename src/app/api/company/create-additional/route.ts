// LAYER: Controller only
import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/companyService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { owner_id, name, description, departments, location, industry, size, logo_url, website } = body as Record<string, unknown>

  if (!owner_id || typeof owner_id !== 'string') {
    return NextResponse.json({ success: false, message: 'owner_id is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  }

  try {
    const existingCompanies = await companyService.getCompaniesByOwner(owner_id)
    const plan = existingCompanies.length > 0 ? existingCompanies[0].plan : 'Free'

    const company = await companyService.createAdditionalCompany({
      owner_id,
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() || null : null,
      plan,
      departments: Array.isArray(departments) ? (departments as string[]) : [],
      location: typeof location === 'string' ? location.trim() || null : null,
      industry: typeof industry === 'string' ? industry.trim() || null : null,
      size: typeof size === 'string' ? size.trim() || null : null,
      logo_url: typeof logo_url === 'string' ? logo_url.trim() || null : null,
      website: typeof website === 'string' ? website.trim() || null : null,
    })
    return NextResponse.json({ success: true, company }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create company'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
