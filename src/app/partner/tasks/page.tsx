'use client'

import PartnerSidebar from '@/components/PartnerSidebar'
import TasksView from '@/components/tasks/TasksView'

export default function PartnerTasksPage() {
  return <TasksView sidebar={<PartnerSidebar />} />
}
