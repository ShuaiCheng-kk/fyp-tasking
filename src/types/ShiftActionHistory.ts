import { Shift } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'

export type ShiftActionType = 'create' | 'edit' | 'delete' | 'duplicate' | 'recurrence' | 'split' | 'bulk'

export interface ShiftActionHistory {
  id: string
  company_id: string
  performed_by: string
  action_type: ShiftActionType
  affected_shift_ids: string[]
  undo_payload: ShiftActionUndoPayload
  undone: boolean
  created_at: string
}

export interface ShiftActionUndoPayload {
  // Shifts deleted by the action (need to be re-inserted to undo) — create/duplicate/recurrence/split/bulk.
  deleted_shifts?: Shift[]
  deleted_assignments?: ShiftAssignment[]
  // Shifts created by the action (need to be deleted to undo) — create/duplicate/recurrence/split/bulk.
  created_shift_ids?: string[]
  // Shift state before an edit (need to be restored to undo) — edit.
  previous_shift?: Shift
  previous_assignments?: ShiftAssignment[]
}

export interface ShiftActionHistoryInput {
  company_id: string
  performed_by: string
  action_type: ShiftActionType
  affected_shift_ids: string[]
  undo_payload: ShiftActionUndoPayload
}
