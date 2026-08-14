// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { companyService } from '@/services/company/companyService'
import { taskAssignmentService } from '@/services/owner/taskAssignmentService'
import { taskRepository } from '@/repositories/owner/taskRepository'
import { AiAssignDraft, AiAssignSuggestion } from '@/types/AI'

const DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  marketing: ['marketing', 'promotion', 'poster', 'campaign', 'brand', 'advertis', 'social media', 'flyer', 'content', 'launch', 'event'],
  finance: ['finance', 'financial', 'report', 'budget', 'invoice', 'payment', 'payroll', 'expense', 'revenue', 'account', 'audit'],
  accounting: ['finance', 'financial', 'report', 'budget', 'invoice', 'payment', 'payroll', 'expense', 'revenue', 'account', 'audit'],
  operations: ['operation', 'process', 'inventory', 'logistics', 'schedule', 'workflow', 'supplier', 'facility', 'stock'],
  engineering: ['engineering', 'build', 'develop', 'software', 'bug', 'technical', 'system', 'deploy', 'feature', 'integration'],
  support: ['support', 'customer', 'ticket', 'complaint', 'helpdesk', 'service', 'client issue'],
  sales: ['sales', 'lead', 'prospect', 'deal', 'quote', 'proposal', 'customer outreach'],
  hr: ['hr', 'human resource', 'hiring', 'recruit', 'onboard', 'training', 'employee'],
}

function taskText(input: { title: string; description: string }): string {
  return `${input.title} ${input.description}`.toLowerCase()
}

function keywordScore(text: string, departmentName: string): number {
  const normalizedName = departmentName.toLowerCase()
  const nameTokens = normalizedName.split(/[^a-z0-9]+/).filter(Boolean)
  let score = nameTokens.reduce((total, token) => total + (text.includes(token) ? 3 : 0), 0)

  for (const [category, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
    if (!normalizedName.includes(category)) continue
    for (const keyword of keywords) {
      if (text.includes(keyword)) score += keyword.includes(' ') ? 4 : 2
    }
  }
  return score
}

function chooseFallbackDepartment(input: {
  title: string
  description: string
  departments: { id: string; name: string }[]
}): { id: string; name: string } {
  const text = taskText(input)
  const scored = input.departments.map((department, index) => ({
    department,
    index,
    score: keywordScore(text, department.name),
  }))
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored[0]?.department ?? input.departments[0] ?? { id: '', name: 'selected' }
}

function buildGeneratedDescription(input: { title: string; description: string; priority: string }): string {
  const existing = input.description.trim()
  if (existing) return existing

  const title = input.title.trim()
  const priority = input.priority ? `${input.priority.toLowerCase()} priority` : 'planned'
  return `Plan and complete "${title}" with clear deliverables, owner review, and any required supporting materials. This is a ${priority} task, so confirm scope early and finish it before the deadline.`
}

function maxSubTaskCountForTask(input: { title: string; description: string }): number {
  const text = taskText(input)
  const complexSignals = ['campaign', 'project', 'launch', 'integration', 'migration', 'event', 'strategy', 'website', 'system', 'multi', 'quarterly']
  const singleDeliverableSignals = ['video', 'poster', 'flyer', 'bug', 'fix', 'report', 'presentation', 'document']
  if (complexSignals.some(keyword => text.includes(keyword))) return 4
  if (singleDeliverableSignals.some(keyword => text.includes(keyword))) return 2
  return 1
}

function buildFallbackSteps(title: string, description: string): AiAssignDraft['steps'] {
  const cleanTitle = title.trim()
  const maxCount = maxSubTaskCountForTask({ title, description })
  if (maxCount === 1) return [{ title: cleanTitle }]
  if (maxCount === 2) {
    return [
      { title: `${cleanTitle} Draft` },
      { title: `${cleanTitle} Final` },
    ]
  }
  return [
    { title: `${cleanTitle} Draft` },
    { title: `${cleanTitle} Review` },
    { title: `${cleanTitle} Final Delivery` },
  ]
}

async function generateDraft(input: {
  title: string
  description: string
  priority: string
  wantSubTasks: boolean
  departments: { id: string; name: string }[]
}): Promise<AiAssignDraft> {
  let draft: AiAssignDraft

  try {
    draft = await openAIService.generateStructuredJson<AiAssignDraft>({
      schemaName: 'ai_assign_draft',
      maxOutputTokens: 500,
      instructions: [
        'You are a workforce task planner for SMEs.',
        'Pick the single best-fit department for this task from the given list of departments by id - return the exact id from the list, never invent one.',
        input.description.trim()
          ? 'Lightly polish the given description for clarity and grammar, keeping its original meaning and length - do not invent new requirements.'
          : 'No description was given - write a 1-2 sentence description for this task based on its title and priority.',
        'Give a one-sentence reason for the department choice (e.g. "This task is related to promotion, suited to the Marketing department"). Do not name a specific assignee in this reason - the best-fit assignee is chosen separately from workload data, not by you.',
        input.wantSubTasks
          ? 'Return 1 to 4 deliverable-focused sub-tasks only when useful. Simple single-deliverable work such as one video, poster, bug fix, report, or document should have 1 to 2 sub-tasks, not 4. Use 3 to 4 only for genuinely complex campaigns, launches, migrations, integrations, events, or multi-deliverable projects. Sub-tasks are child tasks, not step-by-step instructions. Each sub-task must be an outcome or deliverable title under 10 words. Do not include descriptions.'
          : 'Return an empty steps array - this task should not be split into sub-tasks.',
      ].join(' '),
      input: { title: input.title, description: input.description, priority: input.priority, departments: input.departments },
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          department_id: { type: 'string' },
          description: { type: 'string' },
          reason: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
              },
              required: ['title'],
            },
          },
        },
        required: ['department_id', 'description', 'reason', 'steps'],
      },
    })
  } catch {
    draft = buildFallbackDraft(input)
  }

  if (!input.departments.some(d => d.id === draft.department_id)) {
    draft.department_id = chooseFallbackDepartment(input).id
  }
  if (!draft.description.trim()) draft.description = buildGeneratedDescription(input)
  const maxSubTasks = maxSubTaskCountForTask(input)
  draft.steps = input.wantSubTasks
    ? draft.steps.filter(step => step.title.trim()).slice(0, maxSubTasks)
    : []
  if (input.wantSubTasks && draft.steps.length === 0) draft.steps = buildFallbackSteps(input.title, input.description)
  return draft
}

// How many people this task probably needs — a suggestion the user can freely override at
// assignment time, never a requirement. Sub-tasks already encode "this splits into N
// deliverables", so when there are 2+, that count IS the headcount signal (one person per
// deliverable) and takes priority over the priority/deadline heuristic below. Capped by 3 (the
// review UI only ever surfaces the top 3 candidates) and by however many real candidates exist.
const HEADCOUNT_URGENT_WINDOW_HOURS = 48
function suggestHeadcount(input: { priority: string; due_at?: string | null; subTaskCount: number; poolSize: number }): { headcount: number; reason: string } {
  const cap = Math.max(1, Math.min(3, input.poolSize || 1))
  if (input.subTaskCount >= 2) {
    return {
      headcount: Math.min(input.subTaskCount, cap),
      reason: `Split into ${input.subTaskCount} deliverables, so ${Math.min(input.subTaskCount, cap)} people can each own one.`,
    }
  }
  const hoursLeft = input.due_at ? (new Date(input.due_at).getTime() - Date.now()) / (1000 * 60 * 60) : Infinity
  if (input.priority === 'Urgent' && hoursLeft <= HEADCOUNT_URGENT_WINDOW_HOURS && cap >= 2) {
    return { headcount: 2, reason: 'Urgent and due soon — a second pair of hands helps it land on time.' }
  }
  return { headcount: 1, reason: 'A single deliverable with no tight deadline pressure — one person is enough.' }
}

function buildFallbackDraft(input: {
  title: string
  description: string
  priority: string
  wantSubTasks: boolean
  departments: { id: string; name: string }[]
}): AiAssignDraft {
  const department = chooseFallbackDepartment(input)
  return {
    department_id: department.id,
    description: buildGeneratedDescription(input),
    reason: `This task best matches the ${department.name} department based on the task title and description.`,
    steps: input.wantSubTasks ? buildFallbackSteps(input.title, input.description) : [],
  }
}

export const aiTaskAssignService = {
  async generateAssignmentSuggestion(input: {
    company_id: string
    title: string
    description: string
    priority: string
    want_sub_tasks: boolean
    task_date?: string
    // Known at generate time (the New Task modal collects it before Generate is clickable) — the
    // headcount suggestion's "due soon" signal needs it; nothing else here does.
    due_at?: string
    // Manager viewer (resolved server-side from manager_scope_id in the route): their own
    // department(s), forced — skips the AI's department guess entirely, since there's nothing to
    // guess between. Omitted for Owner/Partner, who pick from every company department.
    department_ids?: string[]
    // Which tier to recommend a candidate from — 'Employee' for a Manager viewer, 'Casual Worker'
    // for an Employee viewer (assignment is strictly one level down), 'Manager' (default) for
    // Owner/Partner.
    candidate_role?: 'Manager' | 'Employee' | 'Casual Worker'
    // Pre-resolved candidate pool (resolved server-side in the route, e.g. from
    // employeeDashboardService.getSupervisedTaskScope) — used as-is instead of querying by
    // department. Required for candidate_role: 'Casual Worker', since "the Casual Workers this
    // Employee supervises today" isn't a department-membership query like the other two tiers.
    candidate_pool?: { id: string; full_name: string }[]
  }): Promise<AiAssignSuggestion> {
    if (!input.title.trim()) throw new Error('title is required')

    const allDepartments = await companyService.getDepartments(input.company_id)
    const departments = input.department_ids
      ? allDepartments.filter(d => input.department_ids!.includes(d.id))
      : allDepartments
    if (departments.length === 0) throw new Error('No departments found for this company')

    const draft = await generateDraft({
      title: input.title,
      description: input.description,
      priority: input.priority,
      wantSubTasks: input.want_sub_tasks,
      departments: departments.map(d => ({ id: d.id, name: d.name })),
    })

    const department = departments.find(d => d.id === draft.department_id) ?? departments[0]
    const candidateRole = input.candidate_role ?? 'Manager'
    // Task assignment is independent of shift scheduling (see taskService.assignTask/editTask) —
    // every candidate in the department is real regardless of whether they have a shift on the
    // task's date. Casual Worker candidates come pre-resolved instead (see candidate_pool above).
    const candidatePool = input.candidate_pool
      ? input.candidate_pool
      : candidateRole === 'Employee'
        ? await taskRepository.getEmployeesByDepartment(input.company_id, department.id)
        : await companyService.getManagersByDepartment(input.company_id, department.id)

    let candidates: AiAssignSuggestion['candidates'] = []
    if (candidatePool.length > 0) {
      const tasks = await taskRepository.getActiveTasksByAssignees(candidatePool.map(m => m.id))
      candidates = taskAssignmentService.rankManagers(
        candidatePool.map(m => ({
          id: m.id,
          full_name: m.full_name,
          active_tasks: tasks.filter(t => t.assigned_user_id === m.id),
        })),
      )
    }

    const recommended = candidates[0] ?? null
    const roleLabel = candidateRole === 'Employee' ? 'employees' : candidateRole === 'Casual Worker' ? 'casual workers' : 'managers'
    // A Manager viewer's department was forced, not chosen by the AI — draft.reason would be
    // justifying a "decision" that was never actually made, so it's dropped; only the
    // workload-based candidate pick is explained.
    const reason = recommended
      ? (input.department_ids
          ? `${recommended.full_name} currently has the lightest workload among ${roleLabel} in this department.`
          : `${draft.reason} ${recommended.full_name} currently has the lightest workload among ${roleLabel} in this department.`)
      : (input.department_ids ? `No ${roleLabel} available in this department yet.` : draft.reason)

    const { headcount, reason: headcountReason } = suggestHeadcount({
      priority: input.priority,
      due_at: input.due_at,
      subTaskCount: draft.steps.length,
      poolSize: candidates.length,
    })
    const recommendedIds = candidates.slice(0, headcount).map(c => c.id)

    return {
      department_id: department.id,
      department_name: department.name,
      description: draft.description,
      recommended_manager_id: recommended?.id ?? null,
      reason,
      candidates,
      recommended_ids: recommendedIds,
      suggested_headcount: recommendedIds.length,
      headcount_reason: headcountReason,
      sub_tasks: draft.steps,
    }
  },
}
