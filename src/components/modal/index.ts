/**
 * Modal design spec (canonical) — source of truth lives HERE, not in prose docs or memory.
 *
 * - Outside click does NOT close the modal. Only the X button (ModalHeader) closes it.
 * - Every transition must be animated — no abrupt jumps:
 *   - Overlay fade-in, ModalBox scale+fade in/out (modalSlideIn/modalSlideOut)
 *   - Tab/content switches: wrap changing content in a div with key={activeTab} to force remount + re-animate (tabFadeIn)
 *   - Conditional fields appearing: wrap in fadeIn
 * - Footer buttons are auto-width, right-aligned (justifyContent: flex-end), never full-width.
 * - Primary action = orange gradient (modalPrimaryButtonStyle). Destructive action (Remove/Delete) =
 *   red gradient + Trash2 icon (modalDestructiveButtonStyle) — see "Remove Member" reference.
 * - Errors render via modalErrorBoxStyle, placed between the body and footer.
 * - Loading state: swap the action icon for <Spinner size={13} />.
 */

export { default as ModalOverlay } from './ModalOverlay'
export { default as ModalBox } from './ModalBox'
export { default as ModalHeader } from './ModalHeader'
export {
  modalInputStyle,
  modalLabelStyle,
  modalErrorBoxStyle,
  modalGhostButtonStyle,
  modalPrimaryButtonStyle,
  modalDestructiveButtonStyle,
} from './modalStyles'
