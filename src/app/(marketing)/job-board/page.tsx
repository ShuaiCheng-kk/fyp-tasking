'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, Briefcase, ChevronDown, LogIn, UserPlus } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { hero, search, listings } from './content';
import { JobPosting as BaseJobPosting } from '@/types/Recruitment';
import ApplyJobModal from '@/components/guest/ApplyJobModal';
import Toast from '@/components/Toast';
import { JobCard, JobDetailPanel, resolveJobType } from '@/components/jobs/JobPresentation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
import {
  ModalOverlay, ModalBox, ModalHeader,
  modalGhostButtonStyle, modalPrimaryButtonStyle,
} from '@/components/modal';

// The public jobs API joins the department name onto each posting (see
// src/app/api/jobs/public/route.ts) — not part of the base JobPosting shape.
// job_type is a real job_postings column that the shared type doesn't declare yet.
type JobPosting = BaseJobPosting & { department_name: string | null; job_type: string | null };

// ─── Design tokens ────────────────────────────────────────────────────────────

const fH = 'var(--font-heading)';
const fB = 'var(--font-body)';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type ActiveTab = 'all' | 'shift' | 'oneoff';

// ─── DropdownField ────────────────────────────────────────────────────────────

function DropdownField({ value, options, onChange }: {
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const DROPDOWN_H = Math.min(options.length * 37 + 8, 208);
      const fitsBelow = r.bottom + DROPDOWN_H + 4 <= window.innerHeight;
      setPos({ top: fitsBelow ? r.bottom + 4 : r.top - DROPDOWN_H - 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', border: `1px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: '#FFFFFF', cursor: 'pointer', fontFamily: fB, fontSize: '0.9375rem',
          color: '#374151', fontWeight: 400, outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s', minHeight: 42, minWidth: 160, whiteSpace: 'nowrap',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
          {value}
        </span>
        <ChevronDown size={14} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div ref={dropdownRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 9999, maxHeight: 208, overflowY: 'auto',
          padding: '4px 0',
        }}>
          {options.map(opt => {
            const isSel = opt === value;
            return (
              <button key={opt} type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left',
                  border: 'none', background: isSel ? '#FFF7ED' : 'transparent',
                  color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400,
                  fontFamily: fB, fontSize: '0.9375rem', cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
              >{opt}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobBoardPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [selectedIndustry, setSelectedIndustry] = useState('All Industries');
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [industryOptions, setIndustryOptions] = useState<string[]>(['All Industries']);
  const [locationOptions, setLocationOptions] = useState<string[]>(['All Locations']);

  // Apply-in-place for signed-in workers; everyone else first gets a "do you have an account?"
  // fork, because the generic Get Started page only offers Business Owner / Invitation Code —
  // an applicant has no way in from there.
  const [applyJobId, setApplyJobId] = useState<string | null>(null);
  const [authChoiceJob, setAuthChoiceJob] = useState<JobPosting | null>(null);
  // True while fading out under the cream cover on the way to signin/get-started.
  const [authLeaving, setAuthLeaving] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only the two worker roles can apply. Company staff (Owner/Partner/Manager/Employee) and
  // platform admins are signed in to run the business, not to take casual jobs — they don't get
  // an Apply button at all. Signed-out visitors still see it (they get the sign-in/register fork).
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // localStorage's tasking_user_id/tasking_user_role only get cleared by the explicit
    // /signout flow — a session that simply expires (or a browser closed without signing out)
    // leaves them stale. Trusting them blindly would misreport a signed-out visitor as still
    // being whatever staff account they last used on this browser, hiding Apply for no reason.
    // The real Supabase session (same source the navbar's Sign In/Dashboard state uses) is the
    // only trustworthy signal.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setViewerRole(localStorage.getItem('tasking_user_role'));
      } else {
        localStorage.removeItem('tasking_user_id');
        localStorage.removeItem('tasking_user_role');
        localStorage.removeItem('tasking_company_id');
        setViewerRole(null);
      }
      setAuthChecked(true);
    });
  }, []);

  const canApply = !viewerRole || viewerRole === 'Guest User' || viewerRole === 'Casual Worker';

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  };

  const handleApply = (job: JobPosting) => {
    // Both worker roles (Guest User and Casual Worker) share the same application flow — a
    // signed-in worker applies straight away, with no account questions.
    const authId = typeof window !== 'undefined' ? localStorage.getItem('tasking_user_id') : null;
    const role = typeof window !== 'undefined' ? localStorage.getItem('tasking_user_role') : null;
    if (authId && (role === 'Guest User' || role === 'Casual Worker')) {
      setApplyJobId(job.id);
    } else {
      setAuthChoiceJob(job);
    }
  };

  // Remember the posting across the sign-in / registration round-trip so the apply modal
  // reopens on this exact job when the worker comes back.
  const goToAuth = (job: JobPosting, destination: 'signin' | 'register') => {
    localStorage.setItem('apply_job_id', job.id);
    const href = destination === 'signin'
      ? `/signin?job_id=${job.id}`
      : `/get-started?role=guest&job_id=${job.id}`;
    // Fade the board out under a cream cover (matching the auth pages' background) before the
    // full-page navigation, so the hand-off doesn't cut hard from modal to sign-in form.
    setAuthLeaving(true);
    setTimeout(() => { window.location.href = href; }, 300);
  };

  // ── Fetch open jobs ──────────────────────────────────────────────────────
  // Pass the signed-in worker's id so the board can hide postings from any company that has
  // banned them (marked them "inactive"). Anonymous visitors see every open posting.
  useEffect(() => {
    const authId = typeof window !== 'undefined' ? localStorage.getItem('tasking_user_id') : null;
    const url = authId ? `/api/jobs/public?user_id=${encodeURIComponent(authId)}` : '/api/jobs/public';
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.success) setJobs(d.jobs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Reopen the apply modal after a sign-in / registration round-trip ───────
  // The worker clicked Apply while logged out (or had no account); once they're back and
  // authenticated, ?job_id= brings them straight to that posting's apply form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('job_id') || localStorage.getItem('apply_job_id');
    const authId = localStorage.getItem('tasking_user_id');
    const role = localStorage.getItem('tasking_user_role');
    if (jobId && authId && (role === 'Guest User' || role === 'Casual Worker')) {
      setApplyJobId(jobId);
      localStorage.removeItem('apply_job_id');
      window.history.replaceState(null, '', '/job-board');
    }
  }, []);

  // ── Fetch filter options from companies ──────────────────────────────────
  useEffect(() => {
    fetch('/api/jobs/public/filters')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setIndustryOptions(['All Industries', ...(d.industries as string[])]);
          setLocationOptions(['All Locations', ...(d.locations as string[])]);
        }
      })
      .catch(() => {});
  }, []);

  // ── Keyboard close ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedJob(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Card-list viewport: fill the screen with as many FULL cards as fit ────
  // Card heights vary with how many badge rows wrap, so measure the rendered cards and grow
  // the container card-by-card while it still fits in the viewport — it always cuts cleanly
  // on a card boundary (never slices a card in half) while wasting no vertical space.
  const listRef = useRef<HTMLDivElement | null>(null);
  const [listMaxHeight, setListMaxHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedJob) { setListMaxHeight(null); return; }
    const measure = () => {
      const el = listRef.current;
      if (!el) return;
      const cards = Array.from(el.children) as HTMLElement[];
      if (cards.length === 0) return;
      const gap = 16;
      const available = window.innerHeight - 48; // sticky top offset + bottom breathing room
      let height = 8; // top/bottom padding of the scroll container (4px each)
      let fitted = 0;
      for (const card of cards) {
        const next = height + card.offsetHeight + (fitted > 0 ? gap : 0);
        if (fitted > 0 && next > available) break;
        height = next;
        fitted++;
      }
      setListMaxHeight(height);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [selectedJob]);

  // ── Filter logic ─────────────────────────────────────────────────────────
  const filtered = jobs.filter(job => {
    const q = searchQuery.toLowerCase();
    if (activeTab === 'shift' && resolveJobType(job) !== 'shift') return false;
    if (activeTab === 'oneoff' && resolveJobType(job) !== 'oneoff') return false;
    if (selectedLocation !== 'All Locations' && job.company_location !== selectedLocation) return false;
    if (selectedIndustry !== 'All Industries' && job.company_industry !== selectedIndustry) return false;
    if (q && ![job.title, job.responsibilities, job.company_location, job.company_industry, job.company_name]
      .filter(Boolean).some(v => v!.toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => {
    // Closing soonest first — an applicant's window matters more than posting recency.
    // Jobs without a deadline sit after all deadlined ones, newest posted first.
    if (a.expires_at && b.expires_at) return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
    if (a.expires_at) return -1;
    if (b.expires_at) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const countByFormType = useCallback((type: string) =>
    jobs.filter(j => resolveJobType(j) === type).length, [jobs]);

  const tabs: { key: ActiveTab; label: string; count: number }[] = [
    { key: 'all',    label: 'All Jobs',   count: jobs.length },
    { key: 'shift',  label: 'Shift Job',  count: countByFormType('shift') },
    { key: 'oneoff', label: 'One-Off Job', count: countByFormType('oneoff') },
  ];

  return (
    <>
      {/* ========== HERO ========== */}
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h1 className="sub-hero-h1" style={{
            fontFamily: fH, fontWeight: 700, fontSize: '3.25rem',
            lineHeight: 1.15, color: '#FFFFFF', marginBottom: '24px',
          }}>
            {hero.headline}
          </h1>
          <p style={{
            fontFamily: fB, fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.75, maxWidth: '620px', margin: '0 auto',
          }}>
            {hero.subheadline}
          </p>
        </div>
      </section>

      {/* ========== JOB LISTINGS ========== */}
      <section className="page-section" style={{ background: '#FFFBF5', padding: '40px 0 80px' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>

          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 className="sub-h2" style={{ fontFamily: fH, fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>
              {listings.sectionTitle}
            </h2>
            <p style={{ fontFamily: fB, fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7 }}>
              {listings.sectionSubtitle}
            </p>
          </div>

          {/* Search & filter bar */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #F0E8D8',
            borderRadius: '12px', padding: '16px 20px', marginBottom: '24px',
          }}>
            <div className="search-filter-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder={search.placeholder}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', fontFamily: fB, fontSize: '0.9375rem', color: '#1C1917',
                    border: '1px solid #E5E7EB', borderRadius: '8px',
                    padding: '10px 14px 10px 36px', background: '#FFFFFF', outline: 'none',
                  }}
                />
              </div>
              <DropdownField
                value={selectedIndustry}
                options={industryOptions}
                onChange={setSelectedIndustry}
              />
              <DropdownField
                value={selectedLocation}
                options={locationOptions}
                onChange={setSelectedLocation}
              />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '7px 16px', borderRadius: '100px', cursor: 'pointer',
                  fontFamily: fB, fontWeight: 600, fontSize: '0.8125rem',
                  border: `1.5px solid ${activeTab === t.key ? '#F97316' : '#E5E7EB'}`,
                  background: activeTab === t.key ? '#FFF7ED' : '#FFFFFF',
                  color: activeTab === t.key ? '#C2410C' : '#6B7280',
                  display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700, padding: '1px 6px',
                    borderRadius: '100px', background: activeTab === t.key ? '#FFEDD5' : '#F3F4F6',
                    color: activeTab === t.key ? '#C2410C' : '#9CA3AF',
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Main content */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontFamily: fB, fontSize: '0.9375rem' }}>
              Loading jobs…
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontFamily: fB, fontSize: '0.9375rem' }}>
              No job openings available right now. Check back soon!
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontFamily: fB, fontSize: '0.9375rem' }}>
              No jobs match your search. Try adjusting the filters.
            </div>
          ) : (
            /* Two-column layout: card list + sticky detail panel. With a job open, the list
               collapses to a single column of cards at the same one-third width they have in the
               closed grid, and the detail panel takes the remaining two thirds — the reader's
               attention is on the detail, not the list. */
            <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? 'minmax(360px, 1fr) minmax(0, 1.6fr)' : '1fr', gap: '24px', alignItems: 'flex-start' }}>

              {/* Card list — with a job open it becomes its own scroll container (like JobStreet):
                  at most 4 full cards tall, scrolling the list never moves the detail panel. */}
              <div ref={listRef} style={selectedJob
                ? { display: 'grid', gridTemplateColumns: '1fr', gap: '16px', alignContent: 'start', position: 'sticky', top: '24px', maxHeight: listMaxHeight != null ? `${listMaxHeight}px` : 'calc(100vh - 48px)', overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: '6px', paddingLeft: '4px', paddingTop: '4px', paddingBottom: '4px' }
                : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {filtered.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    selected={selectedJob?.id === job.id}
                    onClick={() => setSelectedJob(prev => prev?.id === job.id ? null : job)}
                  />
                ))}
              </div>

              {/* Sticky detail panel */}
              {selectedJob && (
                <JobDetailPanel
                  job={selectedJob}
                  onClose={() => setSelectedJob(null)}
                  onApply={(j) => handleApply(j as JobPosting)}
                  canApply={authChecked && canApply}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Account fork — shown when a signed-out visitor clicks Apply. Existing accounts (Guest
          User or Casual Worker) go to the shared sign-in; new applicants go straight to the
          guest registration form, bypassing the owner/invitation role picker. */}
      {authChoiceJob && (
        <ModalOverlay onClose={() => setAuthChoiceJob(null)} maxWidth="480px">
          <ModalBox>
            {/* Fixed header title with the job as a subtitle below — a long posting name
                ("Senior Food & Beverage Service Operations Assistant") would otherwise wrap the
                header onto two lines. */}
            <ModalHeader
              title="Apply for Position"
              icon={<Briefcase size={15} color="#fff" strokeWidth={2.5} />}
              onClose={() => setAuthChoiceJob(null)}
            />
            <div style={{ padding: '20px 24px 0' }}>
              <p style={{ margin: '0 0 6px', color: '#111827', fontSize: '1rem', fontWeight: 700, lineHeight: 1.4 }}>
                {authChoiceJob.title}
              </p>
              <p style={{ margin: 0, color: '#6B7280', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Sign in or create an account to apply for this position.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '20px 24px' }}>
              <button
                onClick={() => goToAuth(authChoiceJob, 'register')}
                style={{ ...modalGhostButtonStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 160, height: 42 }}
              >
                <UserPlus size={13} /> Create Account
              </button>
              <button
                onClick={() => goToAuth(authChoiceJob, 'signin')}
                style={{ ...modalPrimaryButtonStyle(), justifyContent: 'center', minWidth: 160, height: 42 }}
              >
                <LogIn size={13} /> Sign In
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Apply modal — logged-in workers apply without leaving the board */}
      {applyJobId && (
        <ApplyJobModal
          jobId={applyJobId}
          onClose={() => setApplyJobId(null)}
          onApplied={(jobTitle) => showToast(`Application submitted for ${jobTitle}. Track it from your dashboard.`)}
        />
      )}

      {/* Cream cover that fades in over everything while the auth navigation kicks in */}
      {authLeaving && <div className="auth-leave-cover" />}

      <Toast message={toast} />
    </>
  );
}