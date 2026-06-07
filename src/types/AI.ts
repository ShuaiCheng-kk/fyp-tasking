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
