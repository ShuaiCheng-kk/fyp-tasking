// src/app/api/guest/profile/route.ts
import { NextResponse } from 'next/server'
import { workerProfileService } from '@/services/guest/workerProfileService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing user_id',
          profile: null,
        },
        { status: 400 }
      )
    }

    const session = await getServerSessionUser()
    if (!session) {
      return NextResponse.json({ success: false, message: 'Not authenticated', profile: null }, { status: 401 })
    }
    if (user_id !== session.auth_id && user_id !== session.user.id) {
      return NextResponse.json({ success: false, message: 'You can only view your own profile', profile: null }, { status: 403 })
    }

    const profile = await workerProfileService.getProfile(session.auth_id)

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Guest profile not found',
          profile: null,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    console.error('GET guest profile error:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to load guest profile',
        profile: null,
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return NextResponse.json(
        { success: false, message: 'Missing user_id', profile: null },
        { status: 400 }
      )
    }

    const session = await getServerSessionUser()
    if (!session) {
      return NextResponse.json({ success: false, message: 'Not authenticated', profile: null }, { status: 401 })
    }
    if (user_id !== session.auth_id && user_id !== session.user.id) {
      return NextResponse.json({ success: false, message: 'You can only edit your own profile', profile: null }, { status: 403 })
    }

    const body = await req.json()

    const profile = await workerProfileService.updateProfile(session.auth_id, {
      full_name: body.full_name,
      phone_number: body.phone_number,
      date_of_birth: body.date_of_birth ?? null,
      profile_photo_url: body.profile_photo_url ?? null,
    })

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to update guest profile',
        profile: null,
      },
      { status: 500 }
    )
  }
}