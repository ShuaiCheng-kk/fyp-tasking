'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Building2, UserPlus, Eye, EyeOff, ChevronLeft, ChevronDown, Check, X } from 'lucide-react';
import {
  step1,
  ownerStep2,
  ownerStep3,
  ownerStep4,
  ownerStep5,
  invitedStep2,
  invitedStep3,
  legalText,
} from './content';

// ─── Design tokens ────────────────────────────────────────────────────────────

const fH = 'var(--font-heading)';
const fB = 'var(--font-body)';

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 18 18" style={{ display: 'inline-block' }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function TaskingLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '28px' }}>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#F97316" />
        <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="white" />
        <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="white" />
        <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="white" />
        <circle cx="22" cy="10.25" r="3.5" fill="#10B981" />
        <path d="M20.3 10.25L21.5 11.5L23.8 9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.25rem', color: '#1C1917' }}>Tasking</span>
    </div>
  );
}

// ─── Shared field styles ───────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: fB,
  fontWeight: 600,
  fontSize: '0.9375rem',
  color: '#374151',
  marginBottom: '10px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: fB,
  fontSize: '1rem',
  color: '#1C1917',
  border: '1.5px solid #E5E7EB',
  borderRadius: '10px',
  padding: '14px 16px',
  background: '#FFFFFF',
  outline: 'none',
  boxSizing: 'border-box',
};

async function readJsonSafe(res: Response) {
  const text = await res.text()

  if (!text) {
    throw new Error(`Empty response from ${res.url}`)
  }

  try {
    return JSON.parse(text)
  } catch {
    console.error('Non-JSON response:', text)
    throw new Error('Server returned non-JSON response')
  }
}

// ─── Progress bar (visual only, no text) ─────────────────────────────────────

function ProgressBar({ current, steps }: { current: number; steps: string[] }) {
  const n = steps.length;
  return (
    <div style={{ marginBottom: '36px' }}>
      {/* Single flex row: [circle-col] [connector] [circle-col] ...
          Each circle-col is position:relative so the label can hang below via absolute */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', paddingBottom: '22px' }}>
        {steps.map((label, i) => {
          const num = i + 1;
          const done = num < current;
          const active = num === current;
          const isLast = i === n - 1;
          return (
            <div key={num} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1, minWidth: 0 }}>
              {/* Circle + label anchored below it */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: done ? '#F97316' : active ? '#F97316' : '#F0E8D8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.3s',
                }}>
                  {done ? (
                    <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                      <path d="M1.5 5L5 8.5L11.5 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span style={{ fontFamily: fB, fontWeight: 700, fontSize: '0.75rem', color: active ? '#FFFFFF' : '#A8A29E' }}>
                      {num}
                    </span>
                  )}
                </div>
                {/* Label: centred on the circle's midpoint (left=14px) via translateX(-50%) */}
                <span style={{
                  position: 'absolute', top: '34px', left: '14px',
                  transform: 'translateX(-50%)',
                  fontFamily: fB, fontSize: '0.6875rem', fontWeight: active ? 700 : 400,
                  color: active ? '#F97316' : done ? '#78716C' : '#A8A29E',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              </div>
              {/* Connector stretches between circles */}
              {!isLast && (
                <div style={{
                  flex: 1, height: '2px',
                  background: done ? '#F97316' : '#F0E8D8',
                  transition: 'background 0.3s',
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Primary CTA button ───────────────────────────────────────────────────────

function PrimaryButton({ onClick, loading, children }: {
  onClick: () => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="btn-press"
      style={{
        width: '100%',
        background: '#F97316',
        color: '#FFFFFF',
        padding: '16px',
        borderRadius: '10px',
        fontFamily: fB,
        fontWeight: 700,
        fontSize: '1rem',
        border: 'none',
        cursor: loading ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        opacity: loading ? 0.85 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

// ─── Back button ──────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: fB,
        fontSize: '0.9375rem',
        color: '#78716C',
        padding: '0',
        marginBottom: '12px',
      }}
    >
      <ChevronLeft size={16} />
      Back
    </button>
  );
}

// ─── Password field with toggle ───────────────────────────────────────────────

function PasswordInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, paddingRight: '52px' }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        style={{
          position: 'absolute',
          right: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#9CA3AF',
          display: 'flex',
          alignItems: 'center',
          padding: 0,
        }}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

// ─── Legal text (used on non-account steps) ───────────────────────────────────

function LegalText() {
  return (
    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6, marginTop: '20px' }}>
      {legalText}
    </p>
  );
}

// ─── Legal modals ─────────────────────────────────────────────────────────────

const modalH2Style: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: '0.9375rem',
  color: '#1C1917',
  marginTop: '14px',
  marginBottom: '4px',
};

const modalPStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.875rem',
  lineHeight: 1.75,
  color: '#57534E',
  margin: 0,
};

const modalUlStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.875rem',
  lineHeight: 1.75,
  color: '#57534E',
  paddingLeft: '18px',
  margin: '6px 0 0 0',
};

function LegalModal({ title, onClose, onAgree, children }: {
  title: string;
  onClose: () => void;
  onAgree: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(28,25,23,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(28,25,23,0.18)',
          border: '1px solid #F0E8D8',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 14px',
          borderBottom: '1.5px solid #F5F0E8',
          flexShrink: 0,
        }}>
          <h2 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.25rem', color: '#1C1917', margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#A8A29E', display: 'flex', alignItems: 'center',
              padding: '6px', borderRadius: '8px', flexShrink: 0,
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#1C1917'; e.currentTarget.style.background = '#F5F0E8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A8A29E'; e.currentTarget.style.background = 'none'; }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{
          padding: '4px 20px 8px',
          overflowY: 'auto',
          flex: 1,
          scrollbarWidth: 'thin',
          scrollbarColor: '#E5E7EB transparent',
        }}>
          {children}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1.5px solid #F5F0E8', flexShrink: 0 }}>
          <button
            onClick={onAgree}
            className="btn-press"
            style={{
              display: 'block',
              width: '100%',
              backgroundColor: '#F97316',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '14px',
              fontFamily: fB,
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            I Agree
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TermsContent() {
  return (
    <>
      <p style={modalPStyle}>Last updated: June 2026</p>

      <h3 style={modalH2Style}>1. Acceptance of Terms</h3>
      <p style={modalPStyle}>By creating an account on Tasking ("Platform"), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the Platform.</p>

      <h3 style={modalH2Style}>2. Description of Service</h3>
      <p style={modalPStyle}>Tasking is a smart task and workforce management platform designed for small and medium enterprises (SMEs). It enables business owners, managers, and employees to manage shifts, tasks, attendance, and recruitment.</p>

      <h3 style={modalH2Style}>3. User Accounts and Roles</h3>
      <p style={modalPStyle}>Users are assigned one of the following roles: Owner, Partner, Manager, Employee, Casual Worker, or Guest User. Each role has defined access permissions. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.</p>

      <h3 style={modalH2Style}>4. Acceptable Use</h3>
      <p style={modalPStyle}>You agree not to:</p>
      <ul style={modalUlStyle}>
        <li>Use the Platform for any unlawful purpose</li>
        <li>Attempt to gain unauthorised access to any part of the Platform</li>
        <li>Interfere with or disrupt the integrity or performance of the Platform</li>
        <li>Upload or transmit any harmful, offensive, or misleading content</li>
      </ul>

      <h3 style={modalH2Style}>5. Data and Privacy</h3>
      <p style={modalPStyle}>Your use of the Platform is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Platform, you consent to the collection and use of your data as described therein.</p>

      <h3 style={modalH2Style}>6. Intellectual Property</h3>
      <p style={modalPStyle}>All content, trademarks, and software on the Platform are the property of Tasking or its licensors. You may not reproduce, distribute, or create derivative works without express written permission.</p>

      <h3 style={modalH2Style}>7. Subscription and Payments</h3>
      <p style={modalPStyle}>Certain features require a paid subscription. Payments are processed securely via Stripe. Subscription fees are non-refundable except where required by applicable law. We reserve the right to change pricing with 30 days' notice.</p>

      <h3 style={modalH2Style}>8. Termination</h3>
      <p style={modalPStyle}>We reserve the right to suspend or terminate your account at any time if you breach these Terms. You may also delete your account at any time from your account settings.</p>

      <h3 style={modalH2Style}>9. Limitation of Liability</h3>
      <p style={modalPStyle}>To the maximum extent permitted by law, Tasking shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform.</p>

      <h3 style={modalH2Style}>10. Governing Law</h3>
      <p style={modalPStyle}>These Terms are governed by the laws of Singapore. Any disputes shall be subject to the exclusive jurisdiction of the courts of Singapore.</p>

      <h3 style={modalH2Style}>11. Changes to Terms</h3>
      <p style={modalPStyle}>We may update these Terms from time to time. Continued use of the Platform after changes constitutes acceptance of the updated Terms.</p>

      <h3 style={modalH2Style}>12. Contact</h3>
      <p style={modalPStyle}>For any questions about these Terms, contact us at support@gettasking.com</p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <p style={modalPStyle}>Last updated: June 2026</p>

      <h3 style={modalH2Style}>1. Introduction</h3>
      <p style={modalPStyle}>Tasking ("we", "us", "our") is committed to protecting your personal data in accordance with the Singapore Personal Data Protection Act 2012 (PDPA).</p>

      <h3 style={modalH2Style}>2. Data We Collect</h3>
      <ul style={modalUlStyle}>
        <li>Full name and email address</li>
        <li>Phone number</li>
        <li>Company information</li>
        <li>GPS location data (for clock-in verification only)</li>
        <li>Payment information (processed securely via Stripe)</li>
        <li>Usage data and activity logs</li>
      </ul>

      <h3 style={modalH2Style}>3. How We Use Your Data</h3>
      <ul style={modalUlStyle}>
        <li>To operate and maintain your account</li>
        <li>To verify attendance via GPS and photo clock-in</li>
        <li>To process subscription payments</li>
        <li>To send system notifications and updates</li>
        <li>To improve the Platform</li>
      </ul>

      <h3 style={modalH2Style}>4. Data Sharing</h3>
      <p style={modalPStyle}>We do not sell your personal data. We share data only with:</p>
      <ul style={modalUlStyle}>
        <li>Stripe (payment processing)</li>
        <li>Supabase (secure database hosting)</li>
        <li>Your company&apos;s authorised administrators (Owner, Manager)</li>
      </ul>

      <h3 style={modalH2Style}>5. Data Retention</h3>
      <p style={modalPStyle}>Your data is retained for as long as your account is active. Upon account deletion, data is retained for 30 days before permanent removal, except where required by law.</p>

      <h3 style={modalH2Style}>6. Your Rights</h3>
      <p style={modalPStyle}>Under the PDPA, you have the right to:</p>
      <ul style={modalUlStyle}>
        <li>Access your personal data</li>
        <li>Correct inaccurate data</li>
        <li>Withdraw consent for data processing</li>
        <li>Request deletion of your data</li>
      </ul>
      <p style={{ ...modalPStyle, marginTop: '8px' }}>To exercise these rights, contact us at support@gettasking.com</p>

      <h3 style={modalH2Style}>7. Cookies</h3>
      <p style={modalPStyle}>We use essential cookies only to maintain your session. No tracking or advertising cookies are used.</p>

      <h3 style={modalH2Style}>8. Contact</h3>
      <p style={modalPStyle}>For any privacy-related queries:<br />Email: support@gettasking.com<br />Website: www.gettasking.com</p>
    </>
  );
}

// ─── Terms checkbox ───────────────────────────────────────────────────────────

function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [openModal, setOpenModal] = useState<'terms' | 'privacy' | null>(null);

  const agree = () => {
    onChange(true);
    setOpenModal(null);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}>
        <div
          onClick={() => onChange(!checked)}
          style={{
            flexShrink: 0,
            width: '18px',
            height: '18px',
            marginTop: '2px',
            border: `2px solid ${checked ? '#F97316' : '#D1D5DB'}`,
            borderRadius: '4px',
            background: checked ? '#F97316' : '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          {checked && (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
              <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
          I have read and agree to the{' '}
          <button
            type="button"
            onClick={() => setOpenModal('terms')}
            style={{ background: 'none', border: 'none', padding: 0, color: '#F97316', fontWeight: 600, textDecoration: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}
          >
            Terms and Conditions
          </button>
          {' '}and{' '}
          <button
            type="button"
            onClick={() => setOpenModal('privacy')}
            style={{ background: 'none', border: 'none', padding: 0, color: '#F97316', fontWeight: 600, textDecoration: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}
          >
            Privacy Policy
          </button>
        </span>
      </div>

      {openModal === 'terms' && (
        <LegalModal title="Terms and Conditions" onClose={() => setOpenModal(null)} onAgree={agree}>
          <TermsContent />
        </LegalModal>
      )}
      {openModal === 'privacy' && (
        <LegalModal title="Privacy Policy" onClose={() => setOpenModal(null)} onAgree={agree}>
          <PrivacyContent />
        </LegalModal>
      )}
    </>
  );
}

// ─── Step heading ─────────────────────────────────────────────────────────────

function StepHeading({ headline, subheadline, onBack }: { headline: string; subheadline: string; onBack?: () => void }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      {/* Top row: back button left, title centred */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '36px', marginBottom: subheadline ? '8px' : '0' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              position: 'absolute', left: 0,
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: fB, fontSize: '0.9375rem', color: '#78716C',
              padding: '0',
            }}
          >
            <ChevronLeft size={16} />
            Back
          </button>
        )}
        <h1 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.875rem', color: '#1C1917', margin: 0 }}>
          {headline}
        </h1>
      </div>
      {subheadline && (
        <p style={{ fontFamily: fB, fontSize: '1rem', color: '#78716C', lineHeight: 1.65, textAlign: 'center', margin: 0 }}>
          {subheadline}
        </p>
      )}
    </div>
  );
}

// ─── Inline error ─────────────────────────────────────────────────────────────

function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div style={{
      background: '#FEF2F2',
      border: '1px solid #FECACA',
      borderRadius: '10px',
      padding: '12px 16px',
      fontFamily: fB,
      fontSize: '0.875rem',
      color: '#DC2626',
      lineHeight: 1.5,
      marginBottom: '16px',
    }}>
      {message}
    </div>
  );
}

// ─── Custom Dropdown ──────────────────────────────────────────────────────────

function DropdownField({ value, options, onChange, placeholder }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const recalcPos = () => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const DROPDOWN_H = Math.min(options.length * 37 + 8, 208)
    const fitsBelow = r.bottom + DROPDOWN_H + 4 <= window.innerHeight
    setPos({ top: fitsBelow ? r.bottom + 4 : r.top - DROPDOWN_H - 4, left: r.left, width: r.width })
  }

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      // Also keep open if click is within the dropdown's bounding rect (scrollbar drag)
      if (dropdownRef.current) {
        const r = dropdownRef.current.getBoundingClientRect()
        const { clientX: x, clientY: y } = e
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return
      }
      setOpen(false)
    }
    const onScroll = (e: Event) => {
      // Only close when the page itself scrolls, not the dropdown's internal scroll
      if (dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  const handleOpen = () => {
    if (!open) recalcPos()
    setOpen(o => !o)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: '10px',
          background: '#FFFFFF', cursor: 'pointer', fontFamily: fB, fontSize: '1rem',
          color: selected ? '#1C1917' : '#9CA3AF', fontWeight: selected ? 400 : 400,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronDown size={16} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && createPortal(
        <div ref={dropdownRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 9999, maxHeight: 208, overflowY: 'auto',
          padding: '4px 0',
        }}>
          {options.map(opt => {
            const isSel = opt.value === value
            return (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left',
                  border: 'none', background: isSel ? '#FFF7ED' : 'transparent',
                  color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400,
                  fontFamily: fB, fontSize: '1rem', cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >{opt.label}</button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Account form fields (shared between owner and invited) ───────────────────

function AccountFields({ form, setForm, phoneError, clearPhoneError }: {
  form: { fullName: string; email: string; password: string; confirmPassword: string; phone: string };
  setForm: (f: typeof form) => void;
  phoneError?: string;
  clearPhoneError?: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="gs-field">
        <label style={labelStyle}>Full Name</label>
        <input
          type="text"
          placeholder="John Smith"
          value={form.fullName}
          onChange={(e) => {
            const raw = e.target.value;
            if (/[^a-zA-Z\s']/.test(raw)) return;
            if (/^ /.test(raw) || /  /.test(raw)) return;
            setForm({ ...form, fullName: raw });
          }}
          style={inputStyle}
        />
      </div>
      <div className="gs-field">
        <label style={labelStyle}>Email</label>
        <input
          type="text"
          placeholder="you@company.com"
          value={form.email}
          onChange={(e) => {
            const raw = e.target.value;
            if (/\s/.test(raw)) return;
            setForm({ ...form, email: raw });
          }}
          style={inputStyle}
        />
      </div>
      <div className="gs-field">
        <label style={labelStyle}>Password</label>
        <PasswordInput value={form.password} onChange={(v) => { if (/\s/.test(v)) return; setForm({ ...form, password: v }); }} placeholder="Create a password" />
      </div>
      <div className="gs-field">
        <label style={labelStyle}>Confirm Password</label>
        <PasswordInput value={form.confirmPassword} onChange={(v) => { if (/\s/.test(v)) return; setForm({ ...form, confirmPassword: v }); }} placeholder="Re-enter your password" />
      </div>
      <div className="gs-field">
        <label style={labelStyle}>Phone Number</label>
        <input
          type="tel"
          placeholder="91234567"
          value={form.phone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            setForm({ ...form, phone: digits });
            clearPhoneError?.();
          }}
          maxLength={8}
          style={inputStyle}
        />
        {phoneError && (
          <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#DC2626', marginTop: '6px' }}>
            {phoneError}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Verify email step ────────────────────────────────────────────────────────

function VerifyEmailStep({
  email,
  verified,
  linkError,
  onContinue,
  onResend,
}: {
  email: string;
  verified: boolean;
  linkError: boolean;
  onContinue: () => void;
  onResend: () => Promise<void>;
}) {
  const [checking, setChecking] = useState(false);
  const [notVerifiedYet, setNotVerifiedYet] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleContinue = async () => {
    if (verified) { onContinue(); return; }
    setChecking(true);
    setNotVerifiedYet(false);
    try {
      const res = await fetch(`/api/auth/check-verified?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.verified) {
        onContinue();
      } else {
        setNotVerifiedYet(true);
      }
    } catch {
      setNotVerifiedYet(true);
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await onResend();
      setResent(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', paddingTop: '8px' }}>
      {/* Green success banner */}
      {verified && (
        <div style={{
          background: '#F0FDF4',
          border: '1px solid #86EFAC',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="8" fill="#22C55E" />
            <path d="M4.5 8L7 10.5L11.5 5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#166534', fontWeight: 600 }}>
            Email verified successfully! You can now continue.
          </span>
        </div>
      )}

      {/* Red error banner */}
      {linkError && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
          fontFamily: fB,
          fontSize: '0.9375rem',
          color: '#DC2626',
          lineHeight: 1.5,
        }}>
          This confirmation link is invalid or has expired. Please request a new one.
        </div>
      )}

      <div style={{
        width: 64, height: 64,
        background: verified ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke={verified ? '#22C55E' : '#F97316'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </div>

      <p style={{ fontFamily: fB, fontSize: '1rem', color: '#374151', lineHeight: 1.65, marginBottom: '6px' }}>
        We&apos;ve sent a confirmation link to <strong>{email}</strong>.
      </p>
      <p style={{ fontFamily: fB, fontSize: '1rem', color: '#374151', lineHeight: 1.65, marginBottom: '32px' }}>
        Please click the link in the email to activate your account and get started.
      </p>

      {notVerifiedYet && (
        <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#DC2626', marginBottom: '16px' }}>
          Your email hasn&apos;t been verified yet. Please click the link in the email first.
        </p>
      )}

      {resent && (
        <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#22C55E', marginBottom: '16px' }}>
          Confirmation email resent! Check your inbox.
        </p>
      )}

      <PrimaryButton loading={checking} onClick={handleContinue}>
        I&apos;ve verified
      </PrimaryButton>

      {(linkError || notVerifiedYet) && (
        <button
          onClick={handleResend}
          disabled={resending || resent}
          style={{
            marginTop: '16px',
            background: 'none',
            border: 'none',
            cursor: resending || resent ? 'default' : 'pointer',
            fontFamily: fB,
            fontSize: '0.9375rem',
            color: resent ? '#9CA3AF' : '#F97316',
            fontWeight: 600,
            padding: 0,
            opacity: resending ? 0.7 : 1,
          }}
        >
          {resending ? 'Sending…' : resent ? 'Email sent' : 'Resend confirmation email'}
        </button>
      )}
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ children, maxWidth = '680px' }: { children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className="auth-card gs-card-enter" style={{
      background: '#FFFFFF',
      border: '1px solid #F0E8D8',
      borderRadius: '20px',
      padding: '56px 52px',
      width: '100%',
      maxWidth,
      boxShadow: '0 4px 40px rgba(0,0,0,0.07)',
    }}>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Path = 'owner' | 'invitation' | 'guest' | null;

export default function GetStartedPage() {
  const router = useRouter();

  const [path, setPath] = useState<Path>(null);
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [verifiedFromUrl, setVerifiedFromUrl] = useState(false);
  const [linkErrorFromUrl, setLinkErrorFromUrl] = useState(false);
  const [planLoading, setPlanLoading] = useState<'free' | 'pro' | null>(null);
  const [showProMsg, setShowProMsg] = useState(false);
  const [showFreeMsg, setShowFreeMsg] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState('');
  const [companyNameError, setCompanyNameError] = useState('');
  const [ownerPhoneError, setOwnerPhoneError] = useState('');
  const [invitedPhoneError, setInvitedPhoneError] = useState('');
  const [guestPhoneError, setGuestPhoneError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Owner form state
  const [ownerAccount, setOwnerAccount] = useState({ fullName: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [companyName, setCompanyName] = useState('');
  const [companyDesc, setCompanyDesc] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPostal, setCompanyPostal] = useState('');
  const [postalLoading, setPostalLoading] = useState(false);
  const [postalError, setPostalError] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');
  const [companyIndustryOther, setCompanyIndustryOther] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [departments, setDepartments] = useState<string[]>(['']);

  // Invited form state
  const [invitedAccount, setInvitedAccount] = useState({ fullName: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [urlCode, setUrlCode] = useState('');

  // Guest user form state
  const [guestAccount, setGuestAccount] = useState({ fullName: '', email: '', password: '', confirmPassword: '', phone: '' });

  // ── Read URL code on mount ────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    const jobId = sessionStorage.getItem('apply_job_id');
    const code = params.get('code');

    if (jobId) {
      sessionStorage.setItem('apply_job_id', jobId);
    }

    if (role === 'guest') {
      if (jobId) sessionStorage.setItem('apply_job_id', jobId)
      setPath('guest')
      setStep(1)
      return
    }

    if (code) {
      setUrlCode(code);
      setInviteCode(code);
      sessionStorage.setItem('invite_code', code);
      setPath('invitation');
      setStep(1);
      return;
    }

    // Return from Stripe cancel — restore plan step
    if (params.get('step') === 'plan' &&
        (sessionStorage.getItem('owner_user_id') || sessionStorage.getItem('owner_company_id'))) {
      setPath('owner');
      setStep(5);
      return;
    }

    // Return from Stripe success — mark plan as Paid then show completion screen
    if (params.get('verify') === '1') {
      const companyId = sessionStorage.getItem('owner_company_id');
      if (companyId) {
        fetch('/api/company/update-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, plan: 'Paid' }),
        }).catch(() => {});
      }
      ['owner_user_id', 'owner_email', 'owner_password', 'owner_company_id',
        'company_name', 'company_description', 'company_location', 'company_address', 'company_postal',
        'company_industry', 'company_size', 'departments'].forEach((k) => sessionStorage.removeItem(k));
      setPath('owner');
      setStep(5);
      setShowProMsg(true);
      return;
    }

    // Return from Supabase email confirmation link
    const storedEmail = sessionStorage.getItem('owner_email');
    if (params.get('verified') === 'true' && storedEmail) {
      setConfirmationEmail(storedEmail);
      setVerifiedFromUrl(true);
      setPath('owner');
      setStep(2);
      return;
    }
    if (params.get('error') === 'invalid_link' && storedEmail) {
      setConfirmationEmail(storedEmail);
      setLinkErrorFromUrl(true);
      setPath('owner');
      setStep(2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (path !== 'invitation') return
    let cancelled = false
    const clearPrevSession = async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      if (cancelled) return
      localStorage.removeItem('tasking_user_id')
      localStorage.removeItem('tasking_company_id')
      localStorage.removeItem('tasking_active_session')
      localStorage.removeItem('tasking_user_role')
      sessionStorage.removeItem('tasking_session_active')
    }
    void clearPrevSession()
    return () => { cancelled = true }
  }, [path])

  // ── OneMap postal code autofill ───────────────────────────────────────────

  useEffect(() => {
    if (companyPostal.length !== 6) { setPostalError(''); return; }
    let cancelled = false;
    const lookup = async () => {
      setPostalLoading(true);
      setPostalError('');
      try {
        const res = await fetch(
          `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${companyPostal}&returnGeom=Y&getAddrDetails=Y`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!data.results || data.results.length === 0) {
          setPostalError('Postal code not found. Please enter manually.');
          return;
        }
        const r = data.results[0];
        setCompanyAddress(r.ADDRESS ?? '');
        setCompanyLocation(
          r.BUILDING && r.BUILDING !== 'NIL'
            ? r.BUILDING
            : `${r.ROAD_NAME ?? ''}, Singapore`
        );
      } catch {
        if (!cancelled) setPostalError('Postal code not found. Please enter manually.');
      } finally {
        if (!cancelled) setPostalLoading(false);
      }
    };
    void lookup();
    return () => { cancelled = true; };
  }, [companyPostal]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const goNext = () => {
    setError('');
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setError('');
    if (step === 1) { setPath(null); setStep(0); setTermsAccepted(false); }
    else setStep((s) => s - 1);
  };

  // ── Departments ───────────────────────────────────────────────────────────

  const addDepartment = () => { if (departments.length < 5) setDepartments((d) => [...d, '']); };
  const updateDepartment = (i: number, v: string) =>
    setDepartments((d) => d.map((dep, idx) => (idx === i ? v : dep)));

  // ── API Handlers ──────────────────────────────────────────────────────────

  const handleOwnerRegister = async () => {
    setError('');
    setOwnerPhoneError('');
    const trimmedName = ownerAccount.fullName.trim();
    if (!trimmedName) { setError('Please enter your full name.'); return; }
    if (/\s{2,}/.test(ownerAccount.fullName) || ownerAccount.fullName !== ownerAccount.fullName.trimEnd()) {
      setError('Full name cannot have consecutive spaces or trailing spaces.'); return;
    }
    if (!ownerAccount.email.trim()) { setError('Please enter your email.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerAccount.email.trim())) {
      setError('Please enter a valid email address (e.g. you@company.com).'); return;
    }
    if (!ownerAccount.password) { setError('Please create a password.'); return; }
    if (ownerAccount.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (!ownerAccount.confirmPassword) { setError('Please confirm your password.'); return; }
    if (ownerAccount.password !== ownerAccount.confirmPassword) { setError('Passwords do not match.'); return; }
    if (!ownerAccount.phone) { setOwnerPhoneError('Phone number is required.'); return; }
    if (ownerAccount.phone.length !== 8) {
      setOwnerPhoneError('Phone number must be exactly 8 digits.'); return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: ownerAccount.fullName,
          email: ownerAccount.email,
          password: ownerAccount.password,
          phone: ownerAccount.phone,
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }

      sessionStorage.setItem('owner_user_id', data.user_id);
      sessionStorage.setItem('owner_email', ownerAccount.email);
      sessionStorage.setItem('owner_password', ownerAccount.password);
      setConfirmationEmail(ownerAccount.email);
      goNext();
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySetup = () => {
    if (!companyName.trim()) {
      setCompanyNameError('Company name is required.');
      return;
    }
    if (!companyLocation.trim()) { setError('Location is required.'); return; }
    if (!companyIndustry) { setError('Industry is required.'); return; }
    if (companyIndustry === 'Other' && !companyIndustryOther.trim()) { setError('Please specify your industry.'); return; }
    if (!companySize) { setError('Please select a company size.'); return; }
    setCompanyNameError('');
    setError('');
    const resolvedIndustry = companyIndustry === 'Other' ? companyIndustryOther.trim() : companyIndustry;
    sessionStorage.setItem('company_name', companyName);
    sessionStorage.setItem('company_description', companyDesc);
    sessionStorage.setItem('company_location', companyLocation);
    sessionStorage.setItem('company_address', companyAddress);
    sessionStorage.setItem('company_postal', companyPostal);
    sessionStorage.setItem('company_industry', resolvedIndustry);
    sessionStorage.setItem('company_size', companySize);
    setStep(4);
  };

  const handleDepartments = () => {
    sessionStorage.setItem('departments', JSON.stringify(departments));
    setStep(5);
  };

  const runCompanySetup = async (plan: 'Free' | 'Paid', clearSession = true) => {
    const userId = sessionStorage.getItem('owner_user_id') || '';
    const ownerEmail = sessionStorage.getItem('owner_email') || '';

    const res = await fetch('/api/owner/complete-company-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        company_name: sessionStorage.getItem('company_name'),
        company_description: sessionStorage.getItem('company_description'),
        company_location: sessionStorage.getItem('company_location'),
        company_address: sessionStorage.getItem('company_address'),
        company_postal_code: sessionStorage.getItem('company_postal'),
        company_industry: sessionStorage.getItem('company_industry'),
        company_size: sessionStorage.getItem('company_size'),
        company_website: null,
        company_logo_url: null,
        departments: JSON.parse(sessionStorage.getItem('departments') || '[]'),
        plan,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    if (clearSession) {
      ['owner_user_id', 'owner_email', 'owner_password',
        'company_name', 'company_description', 'company_location', 'company_address', 'company_postal',
        'company_industry', 'company_size', 'departments'].forEach((k) =>
        sessionStorage.removeItem(k));
    }

    return { ownerEmail, company_id: data.company_id as string, user_id: userId };
  };

  const handleFreePlan = async () => {
    setPlanLoading('free');
    setError('');
    try {
      // If company was already created (user came back from Stripe cancel), skip re-creation
      if (sessionStorage.getItem('owner_company_id')) {
        ['owner_user_id', 'owner_email', 'owner_password', 'owner_company_id',
          'company_name', 'company_description', 'company_location', 'company_address', 'company_postal',
          'company_industry', 'company_size', 'departments'].forEach(k => sessionStorage.removeItem(k));
      } else {
        await runCompanySetup('Free');
      }
      setShowFreeMsg(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setPlanLoading(null);
    }
  };

  const handleProPlan = async () => {
    setPlanLoading('pro');
    setError('');
    try {
      let company_id = sessionStorage.getItem('owner_company_id') || '';
      let user_id = sessionStorage.getItem('owner_user_id') || '';
      let ownerEmail = sessionStorage.getItem('owner_email') || '';

      if (!company_id) {
        // Company not yet created — create it now, keep sessionStorage for cancel
        const result = await runCompanySetup('Free', false);
        company_id = result.company_id;
        user_id = result.user_id;
        ownerEmail = result.ownerEmail;
        sessionStorage.setItem('owner_company_id', company_id);
      }

      if (!company_id || !user_id) {
        throw new Error('Missing company or user ID from setup response');
      }

      const checkoutRes = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company_id, userId: user_id, email: ownerEmail }),
      });
      const checkoutData = await checkoutRes.json();

      if (!checkoutData.success) {
        throw new Error(checkoutData.message || 'Failed to create Stripe checkout session');
      }
      if (!checkoutData.url) {
        throw new Error('Stripe returned no checkout URL');
      }

      // Navigate away to Stripe — do not call setPlanLoading(null)
      window.location.href = checkoutData.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed. Please try again.');
      setPlanLoading(null);
    }
  };

  const handleSignIn = () => {
    setNavigating(true);
    setTimeout(() => router.push('/signin'), 350);
  };

  const handleResendEmail = async () => {
    if (!confirmationEmail) return;
    await fetch('/api/auth/resend-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: confirmationEmail }),
    });
  };

  const handleInvitedRegister = () => {
    setError('');
    setInvitedPhoneError('');
    if (!invitedAccount.fullName.trim()) { setError('Please enter your full name.'); return; }
    if (/\s{2,}/.test(invitedAccount.fullName) || invitedAccount.fullName !== invitedAccount.fullName.trimEnd()) {
      setError('Full name cannot have consecutive spaces or trailing spaces.'); return;
    }
    if (!invitedAccount.email.trim()) { setError('Please enter your email.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedAccount.email.trim())) {
      setError('Please enter a valid email address (e.g. you@company.com).'); return;
    }
    if (!invitedAccount.password) { setError('Please create a password.'); return; }
    if (invitedAccount.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (!invitedAccount.confirmPassword) { setError('Please confirm your password.'); return; }
    if (invitedAccount.password !== invitedAccount.confirmPassword) { setError('Passwords do not match.'); return; }
    if (!invitedAccount.phone) { setInvitedPhoneError('Phone number is required.'); return; }
    if (invitedAccount.phone.length !== 8) {
      setInvitedPhoneError('Phone number must be exactly 8 digits.'); return;
    }
    goNext();
  };

  const handleGuestRegister = async () => {
  setError('');
  setGuestPhoneError('');

  if (!guestAccount.fullName.trim()) { setError('Please enter your full name.'); return; }
  if (/\s{2,}/.test(guestAccount.fullName) || guestAccount.fullName !== guestAccount.fullName.trimEnd()) {
    setError('Full name cannot have consecutive spaces or trailing spaces.'); return;
  }
  if (!guestAccount.email.trim()) { setError('Please enter your email.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestAccount.email.trim())) {
    setError('Please enter a valid email address (e.g. you@example.com).'); return;
  }
  if (!guestAccount.password) { setError('Please create a password.'); return; }
  if (guestAccount.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
  if (!guestAccount.confirmPassword) { setError('Please confirm your password.'); return; }
  if (guestAccount.password !== guestAccount.confirmPassword) { setError('Passwords do not match.'); return; }
  if (!guestAccount.phone) { setGuestPhoneError('Phone number is required.'); return; }
  if (guestAccount.phone.length !== 8) {
    setGuestPhoneError('Phone number must be exactly 8 digits.'); return;
  }

  setIsLoading(true);

  try {
    const [emailRes, phoneRes] = await Promise.all([
      fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: guestAccount.email.trim() }),
      }),
      fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: guestAccount.phone }),
      }),
    ]);

    const emailData = await readJsonSafe(emailRes);
    if (emailData.exists) {
      setError('An account with this email already exists. Please sign in instead.');
      return;
    }

    const phoneData = await readJsonSafe(phoneRes);
    if (phoneData.exists) {
      setError('This phone number is already registered to another account. Please use a different number.');
      return;
    }

    const registerRes = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: guestAccount.fullName.trim(),
        email_address: guestAccount.email.trim(),
        password: guestAccount.password,
        phone_number: guestAccount.phone,
        role: 'Guest User',
      }),
    });

    const registerData = await readJsonSafe(registerRes);
    if (!registerData.success) throw new Error(registerData.message);

    const signinRes = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_address: guestAccount.email.trim(),
        password: guestAccount.password,
      }),
    });

    const signinData = await readJsonSafe(signinRes);
    if (!signinData.success) throw new Error(signinData.message);

    const authUid = signinData.user.auth_id;

    localStorage.setItem('tasking_user_id', authUid);
    localStorage.setItem('tasking_user_role', signinData.user.role);
    localStorage.removeItem('tasking_company_id');

    const params = new URLSearchParams(window.location.search)
    const urlJobId = params.get('job_id')
    const storedJobId = sessionStorage.getItem('apply_job_id')
    const jobId = urlJobId || storedJobId

    if (jobId) {
      sessionStorage.setItem('apply_job_id', jobId)
      window.location.href = `/guest/applications?apply=true&job_id=${jobId}`
    } else {
      window.location.href = '/guest/applications'
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Registration failed');
  } finally {
    setIsLoading(false);
  }
};

  const handleRedeemCode = async () => {
    setIsLoading(true);
    setError('');
    try {
      const code = inviteCode || sessionStorage.getItem('invite_code') || '';
      if (!code.trim()) { setError('Please enter your invitation code.'); setIsLoading(false); return; }

      const redeemRes = await fetch('/api/invitation/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          full_name: invitedAccount.fullName,
          email: invitedAccount.email,
          password: invitedAccount.password,
          phone_number: invitedAccount.phone || null,
        }),
      });
      const redeemData = await redeemRes.json();
      if (!redeemData.success) throw new Error(redeemData.message);

      const supabase = createClient();
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: invitedAccount.email,
        password: invitedAccount.password,
      });
      if (signInError) throw new Error(signInError.message);

      const authUser = signInData.user;
      if (!authUser?.id) throw new Error('Sign in failed');

      localStorage.setItem(`tasking_company_id_${authUser.id}`, redeemData.company_id);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session not established');

      localStorage.setItem('tasking_user_role', redeemData.user.role);
      localStorage.setItem('tasking_user_id', authUser.id);

      sessionStorage.setItem('tasking_session_active', 'true');
      localStorage.setItem('tasking_active_session', 'true');

      sessionStorage.removeItem('invite_code');

      setIsLoading(false);
      router.replace('/signin?joined=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired invitation code');
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FFFBF5',
      padding: '60px 24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '900px',
        display: 'flex',
        justifyContent: 'center',
      }}>
      <div
        key={`${path}-${step}-${confirmationEmail ?? ''}`}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}
      >

        {/* ──────── OWNER: STEP 2 — Verify Email ──────── */}
        {path === 'owner' && step === 2 && confirmationEmail && (
          <Card>
            <StepHeading headline="Check your email" subheadline="" onBack={() => {
              setStep(1);
              setConfirmationEmail(null);
            }} />
            <ProgressBar current={2} steps={['Account', 'Verify', 'Company', 'Departments', 'Plan']} />
            <VerifyEmailStep
              email={confirmationEmail}
              verified={verifiedFromUrl}
              linkError={linkErrorFromUrl}
              onContinue={() => setStep(3)}
              onResend={handleResendEmail}
            />
          </Card>
        )}

        {/* ──────── STEP 0 — Choose path ──────── */}
        {step === 0 && (
          <div className="gs-card-enter" style={{ width: '100%', maxWidth: '800px' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <TaskingLogo />
              <h1 style={{ fontFamily: fH, fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>
                {step1.headline}
              </h1>
              <p style={{ fontFamily: fB, fontSize: '1.0625rem', color: '#78716C' }}>
                {step1.subheadline}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {[
                { data: step1.ownerCard, Icon: Building2, onClick: () => { setPath('owner'); setStep(1); } },
                { data: step1.invitedCard, Icon: UserPlus, onClick: () => { setPath('invitation'); setStep(1); } },
              ].map(({ data, Icon, onClick }) => (
                <button
                  key={data.title}
                  className="gs-choice"
                  onClick={onClick}
                  style={{
                    background: '#FFFFFF',
                    border: '2px solid #F0E8D8',
                    borderRadius: '18px',
                    padding: '36px 32px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 56,
                    height: 56,
                    background: 'rgba(249,115,22,0.1)',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '22px',
                  }}>
                    <Icon size={26} color="#F97316" strokeWidth={2} />
                  </div>
                  <h3 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>
                    {data.title}
                  </h3>
                  <p style={{ fontFamily: fB, fontSize: '1rem', color: '#78716C', lineHeight: 1.65 }}>
                    {data.body}
                  </p>
                </button>
              ))}
            </div>

            <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#78716C', textAlign: 'center', marginTop: '32px' }}>
              Already have an account?{' '}
              <Link href="/signin" style={{ color: '#F97316', fontWeight: 600 }}>Sign in</Link>
            </p>
          </div>
        )}

        {/* ──────── OWNER PATH ──────── */}

        {/* Step 1A — Create account */}
        {path === 'owner' && step === 1 && (
          <Card>
            <StepHeading headline={ownerStep2.headline} subheadline={ownerStep2.subheadline} onBack={goBack} />
            <ProgressBar current={1} steps={['Account', 'Verify', 'Company', 'Departments', 'Plan']} />
            <AccountFields form={ownerAccount} setForm={setOwnerAccount} phoneError={ownerPhoneError} clearPhoneError={() => setOwnerPhoneError('')} />
            <div style={{ marginTop: '28px' }}>
              <InlineError message={error} />
              <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />
              <div style={{ opacity: termsAccepted ? 1 : 0.45, pointerEvents: termsAccepted ? 'auto' : 'none', transition: 'opacity 0.15s' }}>
                <PrimaryButton loading={isLoading} onClick={handleOwnerRegister}>
                  {ownerStep2.button}
                </PrimaryButton>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3A — Company profile */}
        {path === 'owner' && step === 3 && (
          <Card>
            <StepHeading headline={ownerStep3.headline} subheadline={ownerStep3.subheadline} onBack={() => setStep(2)} />
            <ProgressBar current={3} steps={['Account', 'Verify', 'Company', 'Departments', 'Plan']} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="gs-field">
                <label style={labelStyle}>Company Name</label>
                <input type="text" placeholder="Acme Pte Ltd" value={companyName}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/[^a-zA-Z\s'&.,()-]/.test(v)) return;
                    if (/^ /.test(v) || /  /.test(v)) return;
                    setCompanyName(v);
                    if (v.trim()) setCompanyNameError('');
                  }}
                  style={inputStyle} />
                {companyNameError && (
                  <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#DC2626', marginTop: '6px' }}>
                    {companyNameError}
                  </p>
                )}
              </div>
              <div className="gs-field">
                <label style={labelStyle}>Company Description</label>
                <textarea
                  placeholder="Brief description of your company..."
                  value={companyDesc}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^ /.test(v) || /  /.test(v)) return;
                    setCompanyDesc(v);
                  }}
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '110px', lineHeight: 1.65 }}
                />
              </div>
              <div className="gs-field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Postal Code</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="e.g. 238858"
                      value={companyPostal}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setPostalError('');
                        setCompanyPostal(digits);
                        if (digits.length < 6) {
                          setCompanyAddress('');
                          setCompanyLocation('');
                        }
                      }}
                      maxLength={6}
                      style={{ ...inputStyle, paddingRight: postalLoading ? '40px' : undefined }}
                    />
                    {postalLoading && (
                      <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 18 18" style={{ display: 'block' }}>
                          <circle cx="9" cy="9" r="7" stroke="#F0E8D8" strokeWidth="2.5" fill="none" />
                          <path d="M9 2a7 7 0 0 1 7 7" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {postalError && (
                    <p style={{ fontFamily: fB, fontSize: '0.8125rem', color: '#DC2626', marginTop: '6px' }}>
                      {postalError}
                    </p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 123 Orchard Road"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div className="gs-field">
                <label style={labelStyle}>Location</label>
                <input
                  type="text"
                  placeholder="e.g. Singapore, Orchard Road"
                  value={companyLocation}
                  onChange={(e) => { const v = e.target.value; if (/^ /.test(v) || /  /.test(v)) return; setCompanyLocation(v); }}
                  style={inputStyle}
                />
              </div>
              <div className="gs-field">
                <label style={labelStyle}>Industry</label>
                <DropdownField
                  value={companyIndustry}
                  onChange={v => { setCompanyIndustry(v); if (v !== 'Other') setCompanyIndustryOther(''); }}
                  placeholder="Select industry"
                  options={[
                    'Retail', 'F&B', 'Logistics', 'Event Management', 'Healthcare',
                    'Education', 'Technology', 'Finance', 'Construction', 'Hospitality',
                    'Manufacturing', 'Other',
                  ].map(i => ({ value: i, label: i }))}
                />
                {companyIndustry === 'Other' && (
                  <input
                    type="text"
                    placeholder="Please specify your industry"
                    value={companyIndustryOther}
                    onChange={e => setCompanyIndustryOther(e.target.value)}
                    style={{ ...inputStyle, marginTop: '10px' }}
                    autoFocus
                  />
                )}
              </div>
              <div className="gs-field">
                <label style={labelStyle}>Number of Staff</label>
                <DropdownField
                  value={companySize}
                  onChange={setCompanySize}
                  placeholder="Select size…"
                  options={[
                    { value: '1-10', label: '1–10' },
                    { value: '11-50', label: '11–50' },
                    { value: '51-200', label: '51–200' },
                    { value: '200+', label: '200+' },
                  ]}
                />
              </div>
            </div>
            <div style={{ marginTop: '28px' }}>
              <InlineError message={error} />
              {(() => {
                const complete = !!companyName.trim() && !!companyLocation.trim() && !!companyIndustry && !!companySize;
                return (
                  <div style={{ opacity: complete ? 1 : 0.45, pointerEvents: complete ? 'auto' : 'none', transition: 'opacity 0.15s' }}>
                    <PrimaryButton loading={false} onClick={handleCompanySetup}>
                      {ownerStep3.button}
                    </PrimaryButton>
                  </div>
                );
              })()}
            </div>
          </Card>
        )}

        {/* Step 4A — Departments */}
        {path === 'owner' && step === 4 && (
          <Card>
            <StepHeading headline={ownerStep4.headline} subheadline={ownerStep4.subheadline} onBack={() => setStep(3)} />
            <ProgressBar current={4} steps={['Account', 'Verify', 'Company', 'Departments', 'Plan']} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {departments.map((dep, i) => (
                <div key={i} className="gs-field">
                  <label style={labelStyle}>Department {i + 1}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="text" placeholder="Operations" value={dep}
                      onChange={(e) => updateDepartment(i, e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    {i > 0 && (
                      <button
                        onClick={() => setDepartments((d) => d.filter((_, j) => j !== i))}
                        style={{
                          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '36px', height: '36px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
                          background: 'none', cursor: 'pointer', color: '#9CA3AF',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#EF4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#9CA3AF'; }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {departments.length < 5 && (
                <button
                  onClick={addDepartment}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: fB,
                    fontWeight: 600,
                    fontSize: '1rem',
                    color: '#F97316',
                    padding: '4px 0',
                    textAlign: 'left',
                    marginTop: '4px',
                  }}
                >
                  {ownerStep4.addAnotherLabel}
                </button>
              )}
            </div>
            <div style={{ marginTop: '28px' }}>
              <InlineError message={error} />
              {(() => {
                const hasOneDept = departments.some(d => d.trim().length > 0);
                return (
                  <div style={{ opacity: hasOneDept ? 1 : 0.45, pointerEvents: hasOneDept ? 'auto' : 'none', transition: 'opacity 0.15s' }}>
                    <PrimaryButton loading={false} onClick={handleDepartments}>
                      Continue
                    </PrimaryButton>
                  </div>
                );
              })()}
            </div>
          </Card>
        )}

        {/* Step 5A — Choose plan */}
        {path === 'owner' && step === 5 && (
          <Card maxWidth="900px">
            <StepHeading headline={ownerStep5.headline} subheadline={ownerStep5.subheadline} onBack={() => setStep(4)} />
            <ProgressBar current={5} steps={['Account', 'Verify', 'Company', 'Departments', 'Plan']} />

            {(showProMsg || showFreeMsg) ? (
              /* Account registered confirmation */
              <div style={{
                background: '#FFFBF5',
                border: '1.5px solid #F97316',
                borderRadius: '16px',
                padding: '40px',
                textAlign: 'center',
              }}>
                <div style={{
                  width: 56,
                  height: 56,
                  background: 'rgba(249,115,22,0.1)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <Check size={26} color="#F97316" strokeWidth={2.5} />
                </div>
                <p style={{ fontFamily: fB, fontSize: '1.0625rem', color: '#374151', lineHeight: 1.75, marginBottom: '28px' }}>
                  {showProMsg ? ownerStep5.proPlan.successMessage : ownerStep5.freePlan.successMessage}
                </p>
                <button
                  onClick={handleSignIn}
                  disabled={navigating}
                  className="btn-press"
                  style={{
                    background: '#F97316',
                    color: '#FFFFFF',
                    padding: '14px 40px',
                    borderRadius: '10px',
                    fontFamily: fB,
                    fontWeight: 700,
                    fontSize: '1rem',
                    border: 'none',
                    cursor: navigating ? 'default' : 'pointer',
                    opacity: navigating ? 0.8 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  {showProMsg ? ownerStep5.proPlan.successButton : ownerStep5.freePlan.successButton}
                </button>
              </div>
            ) : (
              <>
                <InlineError message={error} />
                {/* Plan cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

                  {/* Free plan */}
                  <div style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #F0E8D8',
                    borderRadius: '18px',
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', top: '18px', right: '18px',
                      background: '#F3F4F6', color: '#6B7280',
                      fontFamily: fB, fontSize: '0.75rem', fontWeight: 700,
                      padding: '3px 10px', borderRadius: '100px',
                    }}>
                      {ownerStep5.freePlan.badge}
                    </span>
                    <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>
                      Free
                    </p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '20px' }}>
                      <span style={{ fontFamily: fH, fontWeight: 800, fontSize: '2.5rem', color: '#1C1917' }}>
                        {ownerStep5.freePlan.price}
                      </span>
                      <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#78716C' }}>
                        {ownerStep5.freePlan.priceSub}
                      </span>
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '28px' }}>
                      {ownerStep5.freePlan.features.map((f) => (
                        <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <Check size={16} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#374151' }}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={handleFreePlan}
                      disabled={planLoading !== null}
                      className="btn-press"
                      style={{
                        width: '100%',
                        padding: '13px',
                        background: 'transparent',
                        border: '2px solid #F97316',
                        borderRadius: '10px',
                        fontFamily: fB,
                        fontWeight: 700,
                        fontSize: '0.9375rem',
                        color: '#F97316',
                        cursor: planLoading !== null ? 'default' : 'pointer',
                        opacity: planLoading !== null ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      {planLoading === 'free' && <Spinner />}
                      {ownerStep5.freePlan.button}
                    </button>
                  </div>

                  {/* Pro plan */}
                  <div style={{
                    background: '#FFFFFF',
                    border: '2px solid #F97316',
                    borderRadius: '18px',
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    boxShadow: '0 8px 32px rgba(249,115,22,0.12)',
                  }}>
                    <span style={{
                      position: 'absolute', top: '18px', right: '18px',
                      background: '#F97316', color: '#FFFFFF',
                      fontFamily: fB, fontSize: '0.75rem', fontWeight: 700,
                      padding: '3px 10px', borderRadius: '100px',
                    }}>
                      {ownerStep5.proPlan.badge}
                    </span>
                    <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>
                      Pro
                    </p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '20px' }}>
                      <span style={{ fontFamily: fH, fontWeight: 800, fontSize: '2.5rem', color: '#F97316' }}>
                        {ownerStep5.proPlan.price}
                      </span>
                      <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#78716C' }}>
                        {ownerStep5.proPlan.priceSub}
                      </span>
                    </div>
                    <p style={{ fontFamily: fB, fontWeight: 600, fontSize: '0.8125rem', color: '#9CA3AF', marginBottom: '10px' }}>
                      {ownerStep5.proPlan.featuresIntro}
                    </p>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '28px' }}>
                      {ownerStep5.proPlan.features.map((f) => (
                        <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <Check size={16} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#374151' }}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={handleProPlan}
                      disabled={planLoading !== null}
                      className="btn-press cta-shimmer"
                      style={{
                        width: '100%',
                        padding: '13px',
                        background: '#F97316',
                        border: 'none',
                        borderRadius: '10px',
                        fontFamily: fB,
                        fontWeight: 700,
                        fontSize: '0.9375rem',
                        color: '#FFFFFF',
                        cursor: planLoading !== null ? 'default' : 'pointer',
                        opacity: planLoading !== null ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      {planLoading === 'pro' && <Spinner />}
                      {ownerStep5.proPlan.button}
                    </button>
                  </div>
                </div>

              </>
            )}
          </Card>
        )}

        {/* ──────── GUEST USER PATH ──────── */}

        {path === 'guest' && step === 1 && (
          <Card>
            <StepHeading
              headline="Create your applicant account"
              subheadline="Register as a Guest User to apply for this job."
              onBack={() => router.push('/job-board')}
            />
            <AccountFields
              form={guestAccount}
              setForm={setGuestAccount}
              phoneError={guestPhoneError}
              clearPhoneError={() => setGuestPhoneError('')}
            />
            <div style={{ marginTop: '28px' }}>
              <InlineError message={error} />
              <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />
              <div style={{ opacity: termsAccepted ? 1 : 0.45, pointerEvents: termsAccepted ? 'auto' : 'none', transition: 'opacity 0.15s' }}>
                <PrimaryButton loading={isLoading} onClick={handleGuestRegister}>
                  Register
                </PrimaryButton>
              </div>
            </div>
          </Card>
        )}

        {/* ──────── INVITATION PATH ──────── */}

        {/* Step 2B — Create account */}
        {path === 'invitation' && step === 1 && (
          <Card>
            <StepHeading headline={invitedStep2.headline} subheadline={invitedStep2.subheadline} onBack={goBack} />
            <ProgressBar current={1} steps={['Account', 'Join']} />
            <AccountFields form={invitedAccount} setForm={setInvitedAccount} phoneError={invitedPhoneError} clearPhoneError={() => setInvitedPhoneError('')} />
            <div style={{ marginTop: '28px' }}>
              <InlineError message={error} />
              <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />
              <div style={{ opacity: termsAccepted ? 1 : 0.45, pointerEvents: termsAccepted ? 'auto' : 'none', transition: 'opacity 0.15s' }}>
                <PrimaryButton loading={isLoading} onClick={handleInvitedRegister}>
                  {invitedStep2.button}
                </PrimaryButton>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3B — Invitation code */}
        {path === 'invitation' && step === 2 && (() => {
          const storedCode = sessionStorage.getItem('invite_code');
          if (storedCode && !inviteCode) setInviteCode(storedCode);
          return (
          <Card>
            <StepHeading headline={invitedStep3.headline} subheadline={invitedStep3.subheadline} onBack={goBack} />
            <ProgressBar current={2} steps={['Account', 'Join']} />
            <div className="gs-field">
              <label style={labelStyle}>Invitation Code</label>
              <input
                type="text"
                placeholder="e.g. ABC12345"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={10}
                style={{
                  ...inputStyle,
                  textAlign: 'center',
                  fontSize: '1.75rem',
                  fontFamily: fH,
                  fontWeight: 700,
                  letterSpacing: '0.25em',
                  padding: '20px',
                }}
              />
              <p style={{ fontFamily: fB, fontSize: '0.875rem', color: (urlCode || sessionStorage.getItem('invite_code')) ? '#F97316' : '#9CA3AF', marginTop: '12px', textAlign: 'center' }}>
                {(urlCode || sessionStorage.getItem('invite_code')) ? 'Code applied from your invitation link.' : invitedStep3.codeHelp}
              </p>
            </div>
            <div style={{ marginTop: '28px' }}>
              <InlineError message={error} />
              <PrimaryButton loading={isLoading} onClick={handleRedeemCode}>
                {invitedStep3.button}
              </PrimaryButton>
              <LegalText />
            </div>
          </Card>
          );
        })()}

      </div>
      </div>
    </div>

    {/* Page transition overlay */}
    {navigating && typeof window !== 'undefined' && createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#fff',
        animation: 'gsPageFadeIn 0.35s ease forwards',
      }} />,
      document.body
    )}

    <style>{`
      @keyframes gsPageFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `}</style>
    </>
  );
}
