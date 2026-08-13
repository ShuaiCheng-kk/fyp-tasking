'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const fH = 'var(--font-heading)';
const fB = 'var(--font-body, system-ui, sans-serif)';

export default function EmailVerifiedPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [continueHref, setContinueHref] = useState('/get-started?verified=true');
  // Whether the registration in progress is actually reachable from THIS tab.
  const [canContinueHere, setCanContinueHere] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === '1') {
      setStatus('error');
    } else {
      setStatus('success');
    }
    const continueParams = new URLSearchParams({ verified: 'true' });
    const jobId = params.get('job_id');
    const email = params.get('email');
    if (jobId) continueParams.set('job_id', jobId);
    if (email) continueParams.set('guest_email', email);
    setContinueHref(`/get-started?${continueParams.toString()}`);

    // Owner registration keeps its half-finished wizard in sessionStorage, which is per-tab. Email
    // links normally open in a NEW tab, where none of that exists — so sending the user to
    // /get-started there silently restarted the whole wizard and lost everything they had typed.
    // Only offer to continue here when the progress is genuinely in this tab. Guest registration
    // stores its state in localStorage, which does survive a new tab, so it always can.
    const isGuestFlow = !!jobId || !!email;
    let hasOwnerProgress = false;
    try { hasOwnerProgress = !!sessionStorage.getItem('owner_user_id'); } catch { hasOwnerProgress = false; }
    setCanContinueHere(isGuestFlow || hasOwnerProgress);
  }, []);

  if (status === 'loading') {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FFFBF5',
      }} />
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FFFBF5',
      padding: '60px 24px',
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #F0E8D8',
        borderRadius: '20px',
        padding: '56px 52px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 4px 40px rgba(0,0,0,0.07)',
        textAlign: 'center',
      }}>
        {status === 'error' ? (
          <>
            <div style={{
              width: 64, height: 64,
              background: 'rgba(220,38,38,0.1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 28px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <h1 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.875rem', color: '#1C1917', marginBottom: '12px' }}>
              Link expired
            </h1>
            <p style={{ fontFamily: fB, fontSize: '1rem', color: '#78716C', lineHeight: 1.65, marginBottom: '36px' }}>
              This confirmation link is invalid or has expired. Please go back and request a new one.
            </p>
            <Link
              href="/get-started"
              style={{
                display: 'inline-block',
                background: '#F97316',
                color: '#FFFFFF',
                fontFamily: fB,
                fontWeight: 700,
                fontSize: '1rem',
                padding: '14px 36px',
                borderRadius: '10px',
                textDecoration: 'none',
              }}
            >
              Back to registration
            </Link>
          </>
        ) : (
          <>
            <div style={{
              width: 64, height: 64,
              background: 'rgba(34,197,94,0.1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 28px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#22C55E" />
                <path d="M7 12.5L10.5 16L17 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.875rem', color: '#1C1917', marginBottom: '12px' }}>
              Email verified!
            </h1>
            {canContinueHere ? (
              <>
                <p style={{ fontFamily: fB, fontSize: '1rem', color: '#78716C', lineHeight: 1.65, marginBottom: '36px' }}>
                  Your email has been confirmed. Continue to finish setting up your company and choose a plan.
                </p>
                <Link
                  href={continueHref}
                  style={{
                    display: 'inline-block',
                    background: '#F97316',
                    color: '#FFFFFF',
                    fontFamily: fB,
                    fontWeight: 700,
                    fontSize: '1rem',
                    padding: '14px 36px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                  }}
                >
                  Continue Registration
                </Link>
              </>
            ) : (
              <>
                <p style={{ fontFamily: fB, fontSize: '1rem', color: '#78716C', lineHeight: 1.65, marginBottom: '12px' }}>
                  Your email has been confirmed.
                </p>
                <p style={{ fontFamily: fB, fontSize: '1rem', color: '#78716C', lineHeight: 1.65, marginBottom: '32px' }}>
                  Go back to the tab where you started signing up and continue from there. Everything
                  you already filled in is still waiting.
                </p>
                <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#A8A29E', lineHeight: 1.6, margin: 0 }}>
                  Closed that tab?{' '}
                  <Link href="/get-started" style={{ color: '#F97316', fontWeight: 600, textDecoration: 'underline' }}>
                    Start registration again
                  </Link>
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
