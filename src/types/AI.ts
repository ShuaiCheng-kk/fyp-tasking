export interface AIAnomaly {
  id: string
  area: 'Dashboard' | 'Report' | 'Attendance' | 'Recruitment'
  severity: 'low' | 'medium' | 'high'
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
  description: string
}

// Raw structured-output shape returned by the LLM call
export interface AiAssignDraft {
  steps: AiAssignStep[]
  department_id: string
  due_in_days: number
}

export interface ScoredManager {
  id: string
  full_name: string
  active_task_count: number
  score: number
}

// Full orchestrated result returned to the client: LLM draft + department resolved + managers ranked
export interface AiAssignSuggestion {
  steps: AiAssignStep[]
  department_id: string
  department_name: string
  due_at: string
  candidates: ScoredManager[]
  suggested_manager_ids: string[]
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
