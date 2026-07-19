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
  recurrence_group_id: string | null
  recurrence_rule: 'daily' | 'weekly' | 'custom' | null
  source_shift_id: string | null
  split_group_id: string | null
  assignment_status: string | null
  template_id: string | null
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
