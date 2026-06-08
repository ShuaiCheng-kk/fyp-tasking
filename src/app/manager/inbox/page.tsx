'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ManagerInboxRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/manager/communication') }, [router])
  return null
}
