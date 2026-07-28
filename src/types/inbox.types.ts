export interface Message {
  id: string
  from_user_id: string
  to_user_id: string
  content: string
  created_at: string
  is_read: boolean
  company_id: string
  sender_name: string | null
}
