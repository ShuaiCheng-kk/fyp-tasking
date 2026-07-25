'use client'

import OwnerSidebar from '@/components/OwnerSidebar'

export default function EmployeeSidebar({
  unreadMessages,
  unreadAnnouncements,
  attendanceAlertCount,
}: {
  unreadMessages?: number
  unreadAnnouncements?: number
  attendanceAlertCount?: number
}) {
  return <OwnerSidebar role="employee" unreadMessages={unreadMessages} unreadAnnouncements={unreadAnnouncements} attendanceAlertCount={attendanceAlertCount} />
}
