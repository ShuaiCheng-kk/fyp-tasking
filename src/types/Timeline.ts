export interface TimelineShiftBlock {
  id: string
  assignment_id: string | null
  shift_date: string
  start_time: string
  end_time: string
  title: string | null
  instruction: string | null
  department_id: string
  department_name: string
  status: string
  publication_status: 'draft' | 'published'
  acceptance_deadline_at: string | null
  recurrence_group_id: string | null
  recurrence_rule: 'daily' | 'weekly' | 'custom' | null
  assignment_status: string | null
}

export interface TimelineRow {
  user_id: string | null
  full_name: string
  role: string
  department_id: string
  department_name: string
  shifts: TimelineShiftBlock[]
  profile_photo_url: string | null
}
