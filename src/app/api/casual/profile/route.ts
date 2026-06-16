import { NextRequest, NextResponse } from 'next/server'
import { casualProfileService } from '@/services/casual/casualProfileService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return NextResponse.json(
        { success: false, message: 'Missing user_id' },
        { status: 400 }
      )
    }

    const profile = await casualProfileService.getProfile(user_id)

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load casual profile',
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const { user_id, payment_method, payment_account } = b

  if (typeof user_id !== 'string' || !user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (typeof payment_method !== 'string' || !payment_method) {
    return NextResponse.json({ success: false, message: 'payment_method is required' }, { status: 400 })
  }
  if (typeof payment_account !== 'string' || !payment_account) {
    return NextResponse.json({ success: false, message: 'payment_account is required' }, { status: 400 })
  }

  try {
    await casualProfileService.savePaymentInfo(user_id, payment_method, payment_account)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save payment info',
      },
      { status: 400 }
    )
  }
}