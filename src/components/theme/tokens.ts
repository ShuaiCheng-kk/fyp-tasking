// Shared style tokens used by modal/panel/toast primitives.
// Lifted verbatim from src/app/owner/team/page.tsx — do not redesign here.

export const modalKeyframes = `
  @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes modalSlideIn  { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
  @keyframes modalSlideOut { from { opacity: 1; transform: scale(1) translateY(0) } to { opacity: 0; transform: scale(0.97) translateY(8px) } }
  @keyframes tabFadeIn     { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeIn        { from { opacity: 0 } to { opacity: 1 } }
  @keyframes profileFieldsIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
`

export const toastKeyframes = `
  @keyframes fadeSlideUpToast {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
`
