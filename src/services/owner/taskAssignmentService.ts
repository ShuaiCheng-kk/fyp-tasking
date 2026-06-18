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
        }
      })
      .sort((a, b) => a.score - b.score)
  },
}
