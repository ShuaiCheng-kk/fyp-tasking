'use client'

import OwnerSidebar from '@/components/OwnerSidebar'

export default function PartnerSidebar({
  unreadMessages,
  unreadAnnouncements,
}: {
  unreadMessages?: number
  unreadAnnouncements?: number
}) {
  return <OwnerSidebar role="partner" unreadMessages={unreadMessages} unreadAnnouncements={unreadAnnouncements} />
}
