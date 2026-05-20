import { NextRequest, NextResponse } from 'next/server'
import { getInboxItemById, updateInboxStatus } from '@/repositories/inboxRepository'
import { userRepository } from '@/repositories/userRepository'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { inbox_id, user_id } = body
    if (!inbox_id || !user_id) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const invite = await getInboxItemById(inbox_id)

    if (invite.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Invitation is no longer pending' }, { status: 400 })
    }

    const user = await userRepository.findById(user_id)
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (user.company_id === invite.company_id) {
      return NextResponse.json({ success: false, error: 'Already a member of this company' }, { status: 400 })
    }

    await userRepository.updateCompanyAndDepartment(user_id, invite.company_id, invite.department_id ?? null)

    const roleMap: Record<string, string> = {
      owner: 'Owner',
      manager: 'Manager',
      employee: 'Employee',
    }
    const normalizedRole = roleMap[invite.role?.toLowerCase()] ?? invite.role
    await userRepository.updateRole(user_id, normalizedRole as any)

    await updateInboxStatus(inbox_id, 'accepted')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
