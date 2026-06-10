'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Building2, UserPlus, Eye, EyeOff, ChevronLeft, Check, X } from 'lucide-react';
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '12px' }}>
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

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ marginBottom: '36px' }}>
      <div style={{ height: '5px', background: '#F0E8D8', borderRadius: '100px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          background: '#F97316',
          borderRadius: '100px',
          width: `${(current / total) * 100}%`,
          transition: 'width 0.4s ease',
        }} />
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

// ─── Legal text ───────────────────────────────────────────────────────────────

function LegalText() {
  return (
    <p style={{ fontFamily: fB, fontSize: '0.8125rem', color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6, marginTop: '20px' }}>
      {legalText}
    </p>
  );
}

// ─── Step heading ─────────────────────────────────────────────────────────────

function StepHeading({ headline, subheadline }: { headline: string; subheadline: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '36px' }}>
      <h1 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.875rem', color: '#1C1917', marginBottom: '10px' }}>
        {headline}
      </h1>
      <p style={{ fontFamily: fB, fontSize: '1rem', color: '#78716C', lineHeight: 1.65 }}>
        {subheadline}
      </p>
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

// ─── Account form fields (shared between owner and invited) ───────────────────

function AccountFields({ form, setForm, phoneError, clearPhoneError }: {
  form: { fullName: string; email: string; password: string; phone: string };
  setForm: (f: typeof form) => void;
  phoneError?: string;
  clearPhoneError?: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={labelStyle}>Full Name</label>
        <input
          type="text"
          placeholder="John Smith"
          value={form.fullName}
          onChange={(e) => {
            const raw = e.target.value;
            if (/^ /.test(raw) || /  /.test(raw)) return;
            setForm({ ...form, fullName: raw });
          }}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Email</label>
        <input
          type="text"
          placeholder="you@company.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Password</label>
        <PasswordInput value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="Create a password" />
      </div>
      <div>
        <label style={labelStyle}>
          Phone Number <span style={{ color: '#DC2626' }}>*</span>
        </label>
        <input
          type="tel"
          placeholder="91234567"
          value={form.phone}
          onChange={(e) => {
            // Digits only, no symbols
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

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ children, maxWidth = '680px' }: { children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className="auth-card" style={{
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
  const [planLoading, setPlanLoading] = useState<'free' | 'pro' | null>(null);
  const [visible, setVisible] = useState(true);
  const [showProMsg, setShowProMsg] = useState(false);
  const [error, setError] = useState('');
  const [companyNameError, setCompanyNameError] = useState('');
  const [ownerPhoneError, setOwnerPhoneError] = useState('');
  const [invitedPhoneError, setInvitedPhoneError] = useState('');
  const [guestPhoneError, setGuestPhoneError] = useState('');

  // Owner form state
  const [ownerAccount, setOwnerAccount] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [companyName, setCompanyName] = useState('');
  const [companyDesc, setCompanyDesc] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [departments, setDepartments] = useState<string[]>(['']);

  // Invited form state
  const [invitedAccount, setInvitedAccount] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [urlCode, setUrlCode] = useState('');

  // Guest user form state
  const [guestAccount, setGuestAccount] = useState({ fullName: '', email: '', password: '', phone: '' });

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
      transition(() => setStep(1))
      return
    }

    if (code) {
      setUrlCode(code);
      setInviteCode(code);
      sessionStorage.setItem('invite_code', code);
      setPath('invitation');
      transition(() => setStep(1));
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

  // ── Transitions ───────────────────────────────────────────────────────────

  const transition = (fn: () => void) => {
    setVisible(false);
    setTimeout(() => { fn(); setVisible(true); }, 150);
  };

  const goNext = () => {
    setError('');
    transition(() => setStep((s) => s + 1));
  };

  const goBack = () => {
    setError('');
    transition(() => {
      if (step === 1) { setPath(null); setStep(0); }
      else setStep((s) => s - 1);
    });
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
    if (!ownerAccount.phone) { setOwnerPhoneError('Phone number is required.'); return; }
    if (ownerAccount.phone.length !== 8) {
      setOwnerPhoneError('Phone number must be exactly 8 digits.'); return;
    }
    setIsLoading(true);
    try {
      const [emailRes, phoneRes] = await Promise.all([
        fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: ownerAccount.email }),
        }),
        ownerAccount.phone
          ? fetch('/api/auth/check-phone', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: ownerAccount.phone }),
            })
          : Promise.resolve(null),
      ]);
      const emailData = await emailRes.json();
      if (emailData.exists) {
        setError('An account with this email already exists. Please sign in instead.');
        return;
      }
      if (phoneRes) {
        const phoneData = await phoneRes.json();
        if (phoneData.exists) {
          setError('This phone number is already registered to another account. Please use a different number.');
          return;
        }
      }
    } catch {
      // check failed — let complete-owner-setup do final validation
    } finally {
      setIsLoading(false);
    }
    sessionStorage.setItem('owner_full_name', ownerAccount.fullName);
    sessionStorage.setItem('owner_email', ownerAccount.email);
    sessionStorage.setItem('owner_password', ownerAccount.password);
    sessionStorage.setItem('owner_phone', ownerAccount.phone);
    goNext();
  };

  const handleCompanySetup = () => {
    if (!companyName.trim()) {
      setCompanyNameError('Company name is required.');
      return;
    }
    if (!companyLocation.trim()) { setError('Location is required.'); return; }
    if (!companyIndustry.trim()) { setError('Industry is required.'); return; }
    if (!companySize) { setError('Please select a company size.'); return; }
    setCompanyNameError('');
    setError('');
    sessionStorage.setItem('company_name', companyName);
    sessionStorage.setItem('company_description', companyDesc);
    sessionStorage.setItem('company_location', companyLocation);
    sessionStorage.setItem('company_industry', companyIndustry);
    sessionStorage.setItem('company_size', companySize);
    goNext();
  };

  const handleDepartments = () => {
    sessionStorage.setItem('departments', JSON.stringify(departments));
    goNext();
  };

  const handleCompletSetup = async (plan: 'Free' | 'Paid') => {
    setPlanLoading(plan === 'Free' ? 'free' : 'pro');
    setError('');
    try {
      const ownerEmail = sessionStorage.getItem('owner_email') || '';
      const ownerPassword = sessionStorage.getItem('owner_password') || '';

      const res = await fetch('/api/auth/complete-owner-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: sessionStorage.getItem('owner_full_name'),
          email: ownerEmail,
          password: ownerPassword,
          phone: sessionStorage.getItem('owner_phone'),
          company_name: sessionStorage.getItem('company_name'),
          company_description: sessionStorage.getItem('company_description'),
          company_location: sessionStorage.getItem('company_location'),
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

      ['owner_full_name', 'owner_email', 'owner_password', 'owner_phone',
        'company_name', 'company_description', 'company_location', 'company_industry',
        'company_size', 'departments'].forEach((k) =>
        sessionStorage.removeItem(k));

      if (data.requiresConfirmation) {
        setConfirmationEmail(ownerEmail);
      } else if (plan === 'Paid') {
        setShowProMsg(true);
      } else {
        router.replace('/owner/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setPlanLoading(null);
    }
  };

  const handleFreePlan = () => handleCompletSetup('Free');
  const handleProPlan = () => handleCompletSetup('Paid');

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
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FFFBF5',
      padding: '60px 24px',
    }}>
      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
      }}>

        {/* ──────── EMAIL CONFIRMATION SCREEN ──────── */}
        {confirmationEmail && (
          <Card maxWidth="480px">
            <TaskingLogo />
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64,
                height: 64,
                background: 'rgba(249,115,22,0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <h1 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.75rem', color: '#1C1917', marginBottom: '16px' }}>
                Check your email
              </h1>
              <p style={{ fontFamily: fB, fontSize: '1rem', color: '#374151', lineHeight: 1.65, marginBottom: '12px' }}>
                We&apos;ve sent a confirmation link to{' '}
                <strong>{confirmationEmail}</strong>.{' '}
                Please click the link in the email to activate your account and get started.
              </p>
              <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#9CA3AF', marginBottom: '32px' }}>
                Didn&apos;t receive it? Check your spam folder.
              </p>
              <Link href="/signin" style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#F97316', fontWeight: 600 }}>
                Back to Sign In
              </Link>
            </div>
          </Card>
        )}

        {/* ──────── STEP 0 — Choose path ──────── */}
        {!confirmationEmail && step === 0 && (
          <div style={{ width: '100%', maxWidth: '800px' }}>
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
                { data: step1.ownerCard, Icon: Building2, onClick: () => { setPath('owner'); transition(() => setStep(1)); } },
                { data: step1.invitedCard, Icon: UserPlus, onClick: () => { setPath('invitation'); transition(() => setStep(1)); } },
              ].map(({ data, Icon, onClick }) => (
                <button
                  key={data.title}
                  onClick={onClick}
                  style={{
                    background: '#FFFFFF',
                    border: '2px solid #F0E8D8',
                    borderRadius: '18px',
                    padding: '36px 32px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#F97316';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(249,115,22,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#F0E8D8';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
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

        {/* Step 2A — Create account */}
        {!confirmationEmail && path === 'owner' && step === 1 && (
          <Card>
            <TaskingLogo />
            <ProgressBar current={1} total={4} />
            <BackButton onClick={goBack} />
            <StepHeading headline={ownerStep2.headline} subheadline={ownerStep2.subheadline} />
            <AccountFields form={ownerAccount} setForm={setOwnerAccount} phoneError={ownerPhoneError} clearPhoneError={() => setOwnerPhoneError('')} />
            <div style={{ marginTop: '28px' }}>
              <InlineError message={error} />
              <PrimaryButton loading={isLoading} onClick={handleOwnerRegister}>
                {ownerStep2.button}
              </PrimaryButton>
              <LegalText />
            </div>
          </Card>
        )}

        {/* Step 3A — Company profile */}
        {!confirmationEmail && path === 'owner' && step === 2 && (
          <Card>
            <TaskingLogo />
            <ProgressBar current={2} total={4} />
            <BackButton onClick={goBack} />
            <StepHeading headline={ownerStep3.headline} subheadline={ownerStep3.subheadline} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Company Name</label>
                <input type="text" placeholder="Acme Pte Ltd" value={companyName}
                  onChange={(e) => {
                    const v = e.target.value;
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
              <div>
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
              <div>
                <label style={labelStyle}>Location <span style={{ color: '#DC2626' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Singapore, Orchard Road"
                  value={companyLocation}
                  onChange={(e) => { const v = e.target.value; if (/^ /.test(v) || /  /.test(v)) return; setCompanyLocation(v); }}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Industry <span style={{ color: '#DC2626' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Retail, Logistics, Healthcare"
                  value={companyIndustry}
                  onChange={(e) => { const v = e.target.value; if (/^ /.test(v) || /  /.test(v)) return; setCompanyIndustry(v); }}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Number of Staff <span style={{ color: '#DC2626' }}>*</span></label>
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  style={{ ...inputStyle, appearance: 'auto' }}
                >
                  <option value="">Select size…</option>
                  <option value="1-10">1–10</option>
                  <option value="11-50">11–50</option>
                  <option value="51-200">51–200</option>
                  <option value="200+">200+</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '28px' }}>
              <InlineError message={error} />
              <PrimaryButton loading={false} onClick={handleCompanySetup}>
                {ownerStep3.button}
              </PrimaryButton>
              <LegalText />
            </div>
          </Card>
        )}

        {/* Step 4A — Departments */}
        {!confirmationEmail && path === 'owner' && step === 3 && (
          <Card>
            <TaskingLogo />
            <ProgressBar current={3} total={4} />
            <BackButton onClick={goBack} />
            <StepHeading headline={ownerStep4.headline} subheadline={ownerStep4.subheadline} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {departments.map((dep, i) => (
                <div key={i}>
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
              <PrimaryButton loading={false} onClick={handleDepartments}>
                Continue
              </PrimaryButton>
              <button
                onClick={() => { sessionStorage.setItem('departments', '[]'); setError(''); goNext(); }}
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: fB,
                  fontSize: '0.9375rem',
                  color: '#9CA3AF',
                  marginTop: '14px',
                  textAlign: 'center',
                  padding: 0,
                }}
              >
                Skip for now
              </button>
              <LegalText />
            </div>
          </Card>
        )}

        {/* Step 5A — Choose plan */}
        {!confirmationEmail && path === 'owner' && step === 4 && (
          <Card maxWidth="900px">
            <TaskingLogo />
            <ProgressBar current={4} total={4} />
            <BackButton onClick={goBack} />
            <StepHeading headline={ownerStep5.headline} subheadline={ownerStep5.subheadline} />

            {showProMsg ? (
              /* Pro confirmation message */
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
                  {ownerStep5.proPlan.successMessage}
                </p>
                <button
                  onClick={() => router.push('/owner/dashboard')}
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
                    cursor: 'pointer',
                  }}
                >
                  {ownerStep5.proPlan.successButton}
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

                <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center' }}>
                  {ownerStep5.footnote}
                </p>
              </>
            )}
          </Card>
        )}

        {/* ──────── GUEST USER PATH ──────── */}

        {!confirmationEmail && path === 'guest' && step === 1 && (
          <Card>
            <TaskingLogo />
            <BackButton onClick={() => router.push('/job-board')} />
            <StepHeading
              headline="Create your applicant account"
              subheadline="Register as a Guest User to apply for this job."
            />
            <AccountFields
              form={guestAccount}
              setForm={setGuestAccount}
              phoneError={guestPhoneError}
              clearPhoneError={() => setGuestPhoneError('')}
            />
            <div style={{ marginTop: '28px' }}>
              <InlineError message={error} />
              <PrimaryButton loading={isLoading} onClick={handleGuestRegister}>
                Register
              </PrimaryButton>
              <LegalText />
            </div>
          </Card>
        )}

        {/* ──────── INVITATION PATH ──────── */}

        {/* Step 2B — Create account */}
        {!confirmationEmail && path === 'invitation' && step === 1 && (
          <Card>
            <TaskingLogo />
            <ProgressBar current={1} total={2} />
            <BackButton onClick={goBack} />
            <StepHeading headline={invitedStep2.headline} subheadline={invitedStep2.subheadline} />
            <AccountFields form={invitedAccount} setForm={setInvitedAccount} phoneError={invitedPhoneError} clearPhoneError={() => setInvitedPhoneError('')} />
            <div style={{ marginTop: '28px' }}>
              <InlineError message={error} />
              <PrimaryButton loading={isLoading} onClick={handleInvitedRegister}>
                {invitedStep2.button}
              </PrimaryButton>
              <LegalText />
            </div>
          </Card>
        )}

        {/* Step 3B — Invitation code */}
        {!confirmationEmail && path === 'invitation' && step === 2 && (() => {
          const storedCode = sessionStorage.getItem('invite_code');
          if (storedCode && !inviteCode) setInviteCode(storedCode);
          return (
          <Card>
            <TaskingLogo />
            <ProgressBar current={2} total={2} />
            <BackButton onClick={goBack} />
            <StepHeading headline={invitedStep3.headline} subheadline={invitedStep3.subheadline} />
            <div>
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
  );
}
