export interface InboxItem {
  id: string
  recipient_user_id: string
  sender_user_id: string
  company_id: string
  role: string
  department_id: string | null
  type: string
  status: string
  created_at: string
  sender_name: string
  company_name: string
}

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
