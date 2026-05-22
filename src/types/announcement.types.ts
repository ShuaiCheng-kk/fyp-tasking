export interface Announcement {
  id: string
  title: string
  content: string
  from_user_id: string
  company_id: string
  department_id: string | null
  created_at: string
  created_by_name?: string | null
}
