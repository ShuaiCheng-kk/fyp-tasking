export type ActivityLog = {
  id: string
  company_id: string
  actor_id: string | null
  action: string
  target_id: string | null
  target_name: string | null
  detail: string | null
  created_at: string
  actor?: { full_name: string } | null
}

export type ActivityLogInput = {
  company_id: string
  actor_id: string
  action: string
  target_id?: string | null
  target_name?: string | null
  detail?: string | null
}
