// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { ScoredManager } from '@/types/AI'

export interface ManagerWorkload {
  id: string
  full_name: string
  active_tasks: { priority: string | null; due_at: string | null }[]
}

const PRIORITY_WEIGHT: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 }
const URGENT_DEADLINE_WINDOW_HOURS = 48

// Plain-language version of the same signal the score is built from, not a generic "lightest
// workload" line — so a candidate ranked #2 or #3 also gets a real reason, not just #1.
function describeWorkload(fullName: string, activeTaskCount: number, urgentSoonCount: number): string {
  if (activeTaskCount === 0) return `${fullName} has no active tasks right now.`
  const parts = [`${activeTaskCount} active task${activeTaskCount === 1 ? '' : 's'}`]
  if (urgentSoonCount > 0) parts.push(`${urgentSoonCount} due within ${URGENT_DEADLINE_WINDOW_HOURS} hours`)
  return `${fullName} currently has ${parts.join(', ')}.`
}

export const taskAssignmentService = {
  // Pure scoring, no AI: lower score = lighter load = better fit for a new task.
  // Ranks by active task count, weighted by existing priority mix, with a penalty for deadlines due soon.
  rankManagers(managers: ManagerWorkload[]): ScoredManager[] {
    const now = Date.now()
    return managers
      .map(m => {
        const priorityScore = m.active_tasks.reduce((sum, t) => sum + (PRIORITY_WEIGHT[t.priority ?? ''] ?? 1), 0)
        const urgentSoonCount = m.active_tasks.filter(t => {
          if (!t.due_at) return false
          const hoursLeft = (new Date(t.due_at).getTime() - now) / (1000 * 60 * 60)
          return hoursLeft <= URGENT_DEADLINE_WINDOW_HOURS
        }).length
        const score = m.active_tasks.length + priorityScore * 0.5 + urgentSoonCount * 2
        return {
          id: m.id,
          full_name: m.full_name,
          active_task_count: m.active_tasks.length,
          score,
          reason: describeWorkload(m.full_name, m.active_tasks.length, urgentSoonCount),
        }
      })
      .sort((a, b) => a.score - b.score)
  },
}
