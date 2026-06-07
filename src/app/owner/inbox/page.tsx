'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OwnerInboxRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/owner/communication')
  }, [router])
  return null
}
