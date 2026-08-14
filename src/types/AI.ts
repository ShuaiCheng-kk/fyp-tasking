export interface AIAnomaly {
  id: string
  area: 'Dashboard' | 'Report' | 'Attendance' | 'Recruitment'
  severity: 'low' | 'medium' | 'high'
  // Which department the finding is about — the UI renders this as a colored badge, so the
  // title sentence never names the department itself.
  department: string
  title: string
  evidence: string[]
  recommended_action: string
}

export interface AIAutoApprovalDecision {
  record_id: string
  decision: 'auto_approve' | 'flag'
  confidence: number
  reason: string
}

export interface CandidateRecommendation {
  applicant_id: string
  applicant_name: string
  score: number
  recommendation: 'strong' | 'review' | 'weak'
  reasons: string[]
  risks: string[]
  suggested_next_step: string
  // True when the applicant supplied no skills/certificates/resume/note at all — shown as
  // "insufficient information" instead of a misleading low score, and never sent to the AI.
  insufficient?: boolean
}

export interface JobDescriptionDraft {
  title: string
  description: string
  requirements: string[]
  responsibilities: string[]
  screening_questions: string[]
}

export interface AiAssignStep {
  title: string
}

// Raw structured-output shape returned by the LLM call
export interface AiAssignDraft {
  department_id: string
  description: string
  reason: string
  steps: AiAssignStep[]
}

export interface ScoredManager {
  id: string
  full_name: string
  active_task_count: number
  score: number
  // One-sentence reason this specific candidate ranked where they did — set on every candidate in
  // the pool, not just the recommended slice, so a picker showing the full list can explain each
  // person, not only the AI's top pick(s).
  reason?: string | null
}

// Full orchestrated result returned to the client: LLM draft + department resolved + manager ranked.
// sub_tasks is only populated when the caller opted in via want_sub_tasks — the decision to
// split is made up front by the user, not offered/accepted after the fact.
export interface AiAssignSuggestion {
  department_id: string
  department_name: string
  // Polished version of the user's description, or generated from the title if they left it
  // blank — always returned so the review step has something to show alongside the title.
  description: string
  // Kept for backward compatibility — always candidates[0]?.id, i.e. recommended_ids[0].
  recommended_manager_id: string | null
  reason: string
  candidates: ScoredManager[]
  // Top pick(s), up to 3, in ranked order — what the Assignee picker pre-selects. Length equals
  // suggested_headcount, capped by however many real candidates exist.
  recommended_ids: string[]
  // How many people the AI thinks this task needs — sub-task count when there are 2+ (one
  // deliverable per person), otherwise 2 for an Urgent task due soon, else 1. A suggestion the
  // user can freely override, never a requirement.
  suggested_headcount: number
  headcount_reason: string
  sub_tasks: AiAssignStep[]
}

export interface ShiftSuggestion {
  shift_date: string
  start_time: string
  end_time: string
  title: string
  reason: string
}

export interface ShiftSchedulingDraft {
  shifts: ShiftSuggestion[]
}
