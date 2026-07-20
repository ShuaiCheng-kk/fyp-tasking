'use client'

import ManagerSidebar from '@/components/ManagerSidebar'
import TasksView from '@/components/tasks/TasksView'

export default function ManagerTasksPage() {
  return <TasksView sidebar={<ManagerSidebar />} assigneeRole="Employee" scopeToManagerDepartments />
}
