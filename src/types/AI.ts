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

export interface TaskSuggestion {
  title: string
  description: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
}

export interface TaskBreakdownDraft {
  tasks: TaskSuggestion[]
}

export interface TaskAssignmentRecommendation {
  candidate_id: string
  candidate_name: string
  score: number
  fit: 'strong' | 'good' | 'fair'
  workload_level: 'light' | 'balanced' | 'heavy'
  skill_match: 'strong' | 'partial' | 'weak'
  skill_evidence: string[]
  reason: string
  workload_reason: string
}

export interface TaskAssignmentDraft {
  recommendations: TaskAssignmentRecommendation[]
}
