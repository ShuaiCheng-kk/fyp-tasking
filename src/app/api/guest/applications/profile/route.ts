// src/app/api/worker/profile/route.ts
import { NextResponse } from 'next/server'
import { workerProfileService } from '@/services/guest/workerProfileService'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing user_id' },
        { status: 400 }
      )
    }

    const profile = await workerProfileService.getProfile(user_id)

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('GET worker profile error:', error)
    return NextResponse.json(
      { error: 'Failed to load worker profile' },
      { status: 500 }
    )
  }
}