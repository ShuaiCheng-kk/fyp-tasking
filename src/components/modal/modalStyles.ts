// Canonical modal field/button/error styles — lifted from src/app/owner/team/page.tsx. Do not redesign here.

export const modalInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E5E7EB',
  borderRadius: 8,
  fontSize: '0.9375rem',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  fontWeight: 400,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#FFFFFF',
}

export const modalLabelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: '#374151',
  marginBottom: '8px',
}

// Place between the body div and footer div (margin handles spacing on both sides).
export const modalErrorBoxStyle: React.CSSProperties = {
  margin: '0 24px 8px',
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: '0.875rem',
  color: '#DC2626',
}

// Ghost / Cancel button — auto-width, used in every modal footer.
export const modalGhostButtonStyle: React.CSSProperties = {
  padding: '7px 16px',
  background: 'none',
  border: '1.5px solid #E5E7EB',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: '0.8125rem',
  color: '#6B7280',
  cursor: 'pointer',
}

// Default (non-destructive) primary action — orange gradient, lighter solid orange while disabled/loading.
export function modalPrimaryButtonStyle(disabled = false): React.CSSProperties {
  return {
    padding: '7px 18px',
    background: disabled ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: '0.8125rem',
    color: '#FFFFFF',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    opacity: disabled ? 0.65 : 1,
  }
}

// Destructive primary action (Remove/Delete confirmations) — red gradient, lighter solid red while disabled/loading.
// Pair with a Trash2 icon (size 13) per the "Remove Member" reference.
export function modalDestructiveButtonStyle(disabled = false): React.CSSProperties {
  return {
    padding: '7px 18px',
    background: disabled ? '#EF4444' : 'linear-gradient(135deg, #EF4444, #DC2626)',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: '0.8125rem',
    color: '#FFFFFF',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    opacity: disabled ? 0.65 : 1,
  }
}
