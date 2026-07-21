'use client'

import OwnerSidebar from '@/components/OwnerSidebar'
import TasksView from '@/components/tasks/TasksView'

export default function OwnerTasksPage() {
  return <TasksView sidebar={<OwnerSidebar />} />
}
