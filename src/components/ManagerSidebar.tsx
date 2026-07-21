'use client'

import OwnerSidebar from '@/components/OwnerSidebar'

export default function ManagerSidebar({
  unreadMessages,
  unreadAnnouncements,
}: {
  unreadMessages?: number
  unreadAnnouncements?: number
}) {
  return <OwnerSidebar role="manager" unreadMessages={unreadMessages} unreadAnnouncements={unreadAnnouncements} />
}
