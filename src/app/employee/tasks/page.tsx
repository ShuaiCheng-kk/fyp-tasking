'use client'

import EmployeeSidebar from '@/components/EmployeeSidebar'
import TasksView from '@/components/tasks/TasksView'

export default function EmployeeTasksPage() {
  // UC12/13/15/19/20 — an Employee assigns/edits/deletes/sub-tasks work, including AI Assign, for
  // the Casual Workers they supervise today, never a whole department. UC14/16-18/21-23
  // (templates, duplicate, recurring, archive, workload/delay alerts, dependencies) are O/P/M-only
  // and stay hidden — see scopeToEmployeeSupervised in TasksView.
  return <TasksView sidebar={<EmployeeSidebar />} assigneeRole="Casual Worker" scopeToEmployeeSupervised />
}
