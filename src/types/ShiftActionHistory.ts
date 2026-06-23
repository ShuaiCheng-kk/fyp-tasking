import { Shift } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'

export type ShiftActionType = 'create' | 'edit' | 'delete' | 'duplicate' | 'recurrence' | 'split' | 'bulk' | 'bulk_edit' | 'publish'

export interface ShiftPublicationStatusSnapshot {
  id: string
  publication_status: 'draft' | 'published'
}

export interface ShiftActionHistory {
  id: string
  company_id: string
  performed_by: string
  action_type: ShiftActionType
  affected_shift_ids: string[]
  undo_payload: ShiftActionUndoPayload
  redo_payload?: ShiftActionRedoPayload | null
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
  // Shift state before a bulk edit (need to be restored to undo) — bulk.
  previous_shifts?: Shift[]
  // Sibling occurrences' state before a recurrence-original edit cascaded to them — edit.
  previous_cascaded_shifts?: Shift[]
  // Sibling occurrences' assignments before a recurrence-original reassign cascaded to them — edit.
  previous_cascaded_assignments?: ShiftAssignment[]
  // Per-shift publication_status before a publish/unpublish toggle — publish.
  previous_publication_statuses?: ShiftPublicationStatusSnapshot[]
}

export interface ShiftActionHistoryInput {
  company_id: string
  performed_by: string
  action_type: ShiftActionType
  affected_shift_ids: string[]
  undo_payload: ShiftActionUndoPayload
}

export interface ShiftActionRedoPayload {
  // Forward shift state captured right before an undo restores it — edit.
  next_shift?: Shift
  next_assignments?: ShiftAssignment[]
  next_cascaded_shifts?: Shift[]
  // Forward shifts captured right before an undo restores them — bulk_edit.
  next_shifts?: Shift[]
  // Full shift/assignment snapshot captured right before an undo deletes them — create/duplicate/recurrence/split/bulk.
  recreate_shifts?: Shift[]
  recreate_assignments?: ShiftAssignment[]
  // Per-shift publication_status captured right before an undo reverts it — publish.
  next_publication_statuses?: ShiftPublicationStatusSnapshot[]
}
