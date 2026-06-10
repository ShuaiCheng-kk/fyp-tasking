'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ManagerAnnouncementsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/manager/communication') }, [router])
  return null
}
