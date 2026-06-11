'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OwnerAnnouncementsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/partner/communication')
  }, [router])
  return null
}
