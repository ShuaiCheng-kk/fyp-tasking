'use client'

import OwnerSidebar from '@/components/OwnerSidebar'

export default function ManagerSidebar({
  unreadMessages,
  unreadAnnouncements,
  attendanceAlertCount,
}: {
  unreadMessages?: number
  unreadAnnouncements?: number
  attendanceAlertCount?: number
}) {
  return <OwnerSidebar role="manager" unreadMessages={unreadMessages} unreadAnnouncements={unreadAnnouncements} attendanceAlertCount={attendanceAlertCount} />
}
