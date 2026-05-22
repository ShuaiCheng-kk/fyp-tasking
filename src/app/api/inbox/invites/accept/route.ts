import { NextRequest, NextResponse } from 'next/server'
import { ownerInboxService } from '@/services/owner/ownerInboxService'
import { authRepository as userRepository } from '@/repositories/auth/authRepository'
import { companyRepository } from '@/repositories/company/companyRepository'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { inbox_id, user_id } = body
    if (!inbox_id || !user_id) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const invite = await ownerInboxService.getInboxItemById(inbox_id)

    if (invite.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Invitation is no longer pending' }, { status: 400 })
    }

    const user = await userRepository.findById(user_id)
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const existing = await companyRepository.findCompanyMember(user_id, invite.company_id)
    if (existing) {
      return NextResponse.json({ success: false, error: 'Already a member of this company' }, { status: 400 })
    }

    const roleMap: Record<string, string> = {
      owner: 'Owner',
      manager: 'Manager',
      employee: 'Employee',
      casual_worker: 'Casual Worker',
      partner: 'Partner',
    }
    const normalizedRole = roleMap[invite.role?.toLowerCase()] ?? invite.role

    await companyRepository.insertCompanyMember(user_id, invite.company_id, normalizedRole)

    await ownerInboxService.updateInboxStatus(inbox_id, 'accepted')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
