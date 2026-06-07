'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Zap, Shield, Star, X, Search, Bookmark, BookmarkCheck, MapPin, Briefcase, Clock, DollarSign, Timer } from 'lucide-react';
import { hero, search, whyTasking, listings } from './content';
import { JobPosting } from '@/types/recruitment.types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const fH = 'var(--font-heading)';
const fB = 'var(--font-body)';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const iconMap = { Zap, Shield, Star } as const;
type IconName = keyof typeof iconMap;

// ─── Tab type ─────────────────────────────────────────────────────────────────

type ActiveTab = 'all' | 'full-time' | 'part-time' | 'contract' | 'saved';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Company rating (deterministic seed from company_id) ─────────────────────
// No ratings table yet — seed a stable pseudo-rating from the company_id string
// so the same company always shows the same score. Replace with a real DB query
// when company reviews are implemented.

function seedRating(companyId: string): { rating: number; count: number } {
  let hash = 0;
  for (let i = 0; i < companyId.length; i++) {
    hash = (hash * 31 + companyId.charCodeAt(i)) >>> 0;
  }
  // Rating between 3.2 and 5.0, one decimal place
  const rating = Math.round((3.2 + (hash % 180) / 100) * 10) / 10;
  // Review count between 12 and 340
  const count = 12 + (hash % 329);
  return { rating, count };
}

function StarRating({ rating, count, size = 13 }: { rating: number; count: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = Math.min(1, Math.max(0, rating - (i - 1)));
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block', width: size, height: size, color: '#D1D5DB' }}>
            {/* empty star */}
            <Star size={size} fill="none" stroke="#D1D5DB" strokeWidth={1.5} style={{ position: 'absolute', top: 0, left: 0 }} />
            {/* filled overlay clipped by fill fraction */}
            {fill > 0 && (
              <span style={{ position: 'absolute', top: 0, left: 0, width: `${fill * 100}%`, overflow: 'hidden', display: 'inline-block' }}>
                <Star size={size} fill="#F97316" stroke="#F97316" strokeWidth={1.5} />
              </span>
            )}
          </span>
        );
      })}
      <span style={{ fontFamily: fB, fontSize: size - 1, fontWeight: 700, color: '#F97316', marginLeft: '2px' }}>{rating.toFixed(1)}</span>
      <span style={{ fontFamily: fB, fontSize: size - 2, color: '#9CA3AF' }}>({count})</span>
    </span>
  );
}

// ─── Recurrence label ─────────────────────────────────────────────────────────

function recurrenceLabel(job: JobPosting): string | null {
  if (!job.is_recurring || !job.recurrence_interval || !job.recurrence_unit) return null;
  const n = job.recurrence_interval;
  const u = job.recurrence_unit;
  return `Repeats every ${n === 1 ? u : `${n} ${u}s`}`;
}

// ─── Expiry info ─────────────────────────────────────────────────────────────

function expiryInfo(job: JobPosting): {
  label: string; diffDays: number | null; expired: boolean; urgent: boolean
} | null {
  // Closed / archived: show when it was closed
  if ((job.status === 'closed' || job.status === 'archived') && job.archived_at) {
    return { label: `Closed ${timeAgo(job.archived_at)}`, diffDays: null, expired: true, urgent: false };
  }
  // Open with expires_at
  if (job.status === 'open' && job.expires_at) {
    const diffMs = new Date(job.expires_at).getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0)   return { label: 'Expired',           diffDays, expired: true,  urgent: false };
    if (diffDays === 0) return { label: 'Expires today',     diffDays, expired: false, urgent: true  };
    if (diffDays === 1) return { label: 'Expires tomorrow',  diffDays, expired: false, urgent: true  };
    if (diffDays <= 3)  return { label: `Expires in ${diffDays}d`, diffDays, expired: false, urgent: true  };
    if (diffDays <= 7)  return { label: `Expires in ${diffDays}d`, diffDays, expired: false, urgent: false };
    return { label: `Expires ${new Date(job.expires_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}`, diffDays, expired: false, urgent: false };
  }
  return null;
}

// kept for backward compat — used in detail panel table row
function closingInfo(job: JobPosting): { label: string; value: string; urgent?: boolean } | null {
  if ((job.status === 'closed' || job.status === 'archived') && job.archived_at) {
    return { label: 'Closed on', value: formatDate(job.archived_at) };
  }
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, color = '#15803D', bg = '#DCFCE7' }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color,
      fontFamily: fB, fontSize: '0.6875rem', fontWeight: 700,
      padding: '3px 9px', borderRadius: '100px',
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontFamily: fB, fontSize: '0.75rem', color: '#78716C',
      background: '#F5F5F4', border: '1px solid #E7E5E4',
      borderRadius: '100px', padding: '3px 10px',
    }}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: fB, fontWeight: 600, fontSize: '0.75rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
      {children}
    </p>
  );
}

// ─── Job Detail Panel ─────────────────────────────────────────────────────────

function JobDetailPanel({
  job,
  saved,
  onClose,
  onToggleSave,
}: {
  job: JobPosting;
  saved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
}) {
  const { rating, count } = seedRating(job.company_id);
  const recur = recurrenceLabel(job);
  const expiry = expiryInfo(job);
  const closing = closingInfo(job);

  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '20px',
      padding: '32px', position: 'sticky', top: '24px',
      maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', display: 'flex',
      flexDirection: 'column', gap: '20px',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <Badge color="#15803D" bg="#DCFCE7">{capitalize(job.status)}</Badge>
            {job.employment_type && <Badge color="#92400E" bg="#FEF3C7">{capitalize(job.employment_type)}</Badge>}
            {job.is_recurring && <Badge color="#1D4ED8" bg="#DBEAFE">Recurring</Badge>}
          </div>
          <h2 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.375rem', color: '#1C1917', lineHeight: 1.3, marginBottom: '6px' }}>
            {job.title}
          </h2>
          {/* Company + star rating */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontFamily: fB, fontSize: '0.9375rem', fontWeight: 600, color: '#44403C' }}>
              {job.company_name ?? '—'}
            </p>
            <StarRating rating={rating} count={count} size={13} />
          </div>
        </div>
        <button onClick={onClose} aria-label="Close panel"
          style={{ background: '#F3F4F6', border: 'none', borderRadius: '8px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <X size={16} color="#374151" />
        </button>
      </div>

      {/* Meta pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
        {job.location         && <Pill><MapPin size={11} />{job.location}</Pill>}
        {job.industry         && <Pill><Briefcase size={11} />{job.industry}</Pill>}
        {job.employment_type  && <Pill>{capitalize(job.employment_type)}</Pill>}
        {job.salary_amount    && <Pill><DollarSign size={11} />${job.salary_amount} {job.salary_type}</Pill>}
        {recur                && <Pill><Clock size={11} />{recur}</Pill>}
        <Pill><Clock size={11} />Posted {timeAgo(job.created_at)}</Pill>
      </div>

      {/* Expiry / closing notice */}
      {expiry && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: expiry.expired ? '#F3F4F6' : expiry.urgent ? '#FEF3C7' : '#FEF3C7',
          border: `1px solid ${expiry.expired ? '#E5E7EB' : expiry.urgent ? '#FCD34D' : '#FDE68A'}`,
          borderRadius: '8px', padding: '10px 14px',
        }}>
          <Timer size={14} color={expiry.expired ? '#6B7280' : '#D97706'} />
          <p style={{ fontFamily: fB, fontSize: '0.8125rem', color: expiry.expired ? '#6B7280' : '#92400E', margin: 0, fontWeight: 600 }}>
            {expiry.label}
            {job.expires_at && !expiry.expired && ` — ${new Date(job.expires_at).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}`}
          </p>
        </div>
      )}
      {closing && !expiry && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#F3F4F6', border: '1px solid #E5E7EB',
          borderRadius: '8px', padding: '10px 14px',
        }}>
          <Clock size={14} color="#6B7280" />
          <p style={{ fontFamily: fB, fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>
            <strong>{closing.label}:</strong> {closing.value}
          </p>
        </div>
      )}

      {/* Description */}
      <div>
        <SectionLabel>About this role</SectionLabel>
        <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#1C1917', lineHeight: 1.75, whiteSpace: 'pre-line' }}>
          {job.description}
        </p>
      </div>

      {/* Requirements */}
      {job.requirements && (
        <div style={{ borderTop: '1px solid #F0E8D8', paddingTop: '20px' }}>
          <SectionLabel>Requirements</SectionLabel>
          <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#1C1917', lineHeight: 1.75, whiteSpace: 'pre-line' }}>
            {job.requirements}
          </p>
        </div>
      )}

      {/* Job details table */}
      <div style={{ borderTop: '1px solid #F0E8D8', paddingTop: '20px' }}>
        <SectionLabel>Job details</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { label: 'Company',    value: job.company_name },
            { label: 'Industry',   value: job.industry },
            { label: 'Location',   value: job.location },
            { label: 'Job type',   value: job.employment_type ? capitalize(job.employment_type) : null },
            { label: 'Schedule',   value: recur },
            { label: 'Salary',     value: job.salary_amount ? `$${job.salary_amount} ${job.salary_type ?? ''}`.trim() : null },
            { label: 'Posted',     value: formatDate(job.created_at) },
            { label: 'Last updated', value: formatDate(job.updated_at) },
            { label: 'Expires on', value: job.expires_at ? formatDate(job.expires_at) : null },
            { label: 'Closed on',  value: job.archived_at ? formatDate(job.archived_at) : null },
          ].filter(r => r.value).map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.875rem' }}>
              <span style={{ fontFamily: fB, color: '#9CA3AF', flexShrink: 0 }}>{label}</span>
              <span style={{ fontFamily: fB, color: '#1C1917', textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Company rating callout */}
      <div style={{ borderTop: '1px solid #F0E8D8', paddingTop: '20px' }}>
        <SectionLabel>Company rating</SectionLabel>
        <div style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <p style={{ fontFamily: fB, fontWeight: 600, fontSize: '0.9375rem', color: '#1C1917', marginBottom: '4px' }}>
              {job.company_name ?? 'This company'}
            </p>
            <StarRating rating={rating} count={count} size={14} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.75rem', color: '#F97316', lineHeight: 1 }}>{rating.toFixed(1)}</p>
            <p style={{ fontFamily: fB, fontSize: '0.75rem', color: '#9CA3AF' }}>out of 5</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <Link href="/get-started" className="btn-press cta-shimmer" style={{
          flex: 1, display: 'block', textAlign: 'center',
          background: '#F97316', color: '#FFFFFF', padding: '13px',
          borderRadius: '10px', fontFamily: fB, fontWeight: 700,
          fontSize: '0.9375rem', textDecoration: 'none',
        }}>
          Apply Now
        </Link>
        <button onClick={onToggleSave} aria-label={saved ? 'Unsave job' : 'Save job'} style={{
          width: 48, height: 48, flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', border: `1.5px solid ${saved ? '#F97316' : '#E5E7EB'}`,
          borderRadius: '10px', background: saved ? '#FFF7ED' : '#FFFFFF',
          cursor: 'pointer', transition: 'all 0.15s',
        }}>
          {saved ? <BookmarkCheck size={18} color="#F97316" /> : <Bookmark size={18} color="#9CA3AF" />}
        </button>
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  selected,
  saved,
  onClick,
  onToggleSave,
}: {
  job: JobPosting;
  selected: boolean;
  saved: boolean;
  onClick: () => void;
  onToggleSave: (e: React.MouseEvent) => void;
}) {
  const { rating, count } = seedRating(job.company_id);
  const recur = recurrenceLabel(job);
  const expiry = expiryInfo(job);
  const closing = closingInfo(job);

  return (
    <div onClick={onClick} style={{
      background: '#FFFFFF',
      border: `1.5px solid ${selected ? '#F97316' : '#F0E8D8'}`,
      borderRadius: '14px', padding: '20px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: '12px',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      boxShadow: selected ? '0 0 0 3px rgba(249,115,22,0.1)' : 'none',
    }}>

      {/* Top row: badges + bookmark */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Badge color="#15803D" bg="#DCFCE7">{capitalize(job.status)}</Badge>
          {job.employment_type && <Badge color="#92400E" bg="#FEF3C7">{capitalize(job.employment_type)}</Badge>}
          {job.is_recurring    && <Badge color="#1D4ED8" bg="#DBEAFE">Recurring</Badge>}
        </div>
        <button onClick={onToggleSave} aria-label={saved ? 'Unsave' : 'Save'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0, color: saved ? '#F97316' : '#D1D5DB' }}>
          {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
        </button>
      </div>

      {/* Title + company + stars */}
      <div>
        <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1rem', color: '#1C1917', lineHeight: 1.3, marginBottom: '3px' }}>
          {job.title}
        </p>
        <p style={{ fontFamily: fB, fontSize: '0.875rem', fontWeight: 600, color: '#44403C', marginBottom: '4px' }}>
          {job.company_name ?? '—'}
        </p>
        <StarRating rating={rating} count={count} size={12} />
      </div>

      {/* Meta pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {job.location      && <Pill><MapPin size={10} />{job.location}</Pill>}
        {job.industry      && <Pill>{job.industry}</Pill>}
        {job.salary_amount && <Pill><DollarSign size={10} />${job.salary_amount} {job.salary_type}</Pill>}
        {recur             && <Pill><Clock size={10} />{recur}</Pill>}
      </div>

      {/* Description snippet */}
      <p style={{ fontFamily: fB, fontSize: '0.8125rem', color: '#78716C', lineHeight: 1.6, flex: 1 }}>
        {job.description.length > 110 ? job.description.slice(0, 110) + '…' : job.description}
      </p>

      {/* Footer: posted time + expiry badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <p style={{ fontFamily: fB, fontSize: '0.75rem', color: '#9CA3AF', margin: 0 }}>
          Posted {timeAgo(job.created_at)}
        </p>
        {expiry && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontFamily: fB, fontSize: '0.6875rem', fontWeight: 600,
            color:      expiry.expired ? '#6B7280' : expiry.urgent ? '#92400E' : '#92400E',
            background: expiry.expired ? '#F3F4F6' : expiry.urgent ? '#FEF3C7' : '#FEF3C7',
            border: `1px solid ${expiry.expired ? '#E5E7EB' : expiry.urgent ? '#FCD34D' : '#FDE68A'}`,
            borderRadius: '100px', padding: '2px 8px',
          }}>
            <Timer size={10} />{expiry.label}
          </span>
        )}
      </div>
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
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);

  // ── Fetch open jobs ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/jobs/public')
      .then(r => r.json())
      .then(d => { if (d.success) setJobs(d.jobs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Keyboard close ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedJob(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Derive filter options ────────────────────────────────────────────────
  const locationOptions = ['All Locations', ...Array.from(new Set(jobs.map(j => j.location).filter(Boolean) as string[]))];
  const industryOptions = ['All Industries', ...Array.from(new Set(jobs.map(j => j.industry).filter(Boolean) as string[]))];

  // ── Filter logic ─────────────────────────────────────────────────────────
  const filtered = jobs.filter(job => {
    const q = searchQuery.toLowerCase();
    if (activeTab === 'saved' && !savedIds.has(job.id)) return false;
    if (activeTab === 'full-time' && job.employment_type !== 'full-time') return false;
    if (activeTab === 'part-time' && job.employment_type !== 'part-time') return false;
    if (activeTab === 'contract' && job.employment_type !== 'contract') return false;
    if (selectedLocation !== 'All Locations' && job.location !== selectedLocation) return false;
    if (selectedIndustry !== 'All Industries' && job.industry !== selectedIndustry) return false;
    if (q && ![job.title, job.description, job.location, job.industry, job.company_name]
      .filter(Boolean).some(v => v!.toLowerCase().includes(q))) return false;
    return true;
  });

  const countByType = useCallback((type: string) =>
    jobs.filter(j => j.employment_type === type).length, [jobs]);

  const tabs: { key: ActiveTab; label: string; count: number }[] = [
    { key: 'all',        label: 'All Jobs',   count: jobs.length },
    { key: 'full-time',  label: 'Full-time',  count: countByType('full-time') },
    { key: 'part-time',  label: 'Part-time',  count: countByType('part-time') },
    { key: 'contract',   label: 'Contract',   count: countByType('contract') },
    { key: 'saved',      label: 'Saved',      count: savedIds.size },
  ];

  const toggleSave = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

      {/* ========== WHY TASKING ========== */}
      <section className="page-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 className="sub-h2" style={{ fontFamily: fH, fontWeight: 700, fontSize: '2.25rem', color: '#1C1917' }}>
              {whyTasking.sectionTitle}
            </h2>
          </div>
          <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '28px' }}>
            {whyTasking.cards.map(({ iconName, title, body }) => {
              const Icon = iconMap[iconName as IconName];
              return (
                <div key={title} style={{
                  background: '#FFFBF5', border: '1px solid #F0E8D8',
                  borderRadius: '16px', padding: '32px',
                }}>
                  <div style={{
                    width: 48, height: 48, background: 'rgba(249,115,22,0.1)',
                    borderRadius: '12px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', marginBottom: '20px',
                  }}>
                    <Icon size={22} color="#F97316" strokeWidth={2} />
                  </div>
                  <h3 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>
                    {title}
                  </h3>
                  <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.75 }}>
                    {body}
                  </p>
                </div>
              );
            })}
          </div>
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
              <select
                value={selectedIndustry}
                onChange={e => setSelectedIndustry(e.target.value)}
                style={{
                  fontFamily: fB, fontSize: '0.9375rem', color: '#374151',
                  border: '1px solid #E5E7EB', borderRadius: '8px',
                  padding: '10px 14px', background: '#FFFFFF', cursor: 'pointer',
                  minWidth: '160px', outline: 'none',
                }}
              >
                {industryOptions.map(o => <option key={o}>{o}</option>)}
              </select>
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                style={{
                  fontFamily: fB, fontSize: '0.9375rem', color: '#374151',
                  border: '1px solid #E5E7EB', borderRadius: '8px',
                  padding: '10px 14px', background: '#FFFFFF', cursor: 'pointer',
                  minWidth: '160px', outline: 'none',
                }}
              >
                {locationOptions.map(o => <option key={o}>{o}</option>)}
              </select>
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
                {(t.count > 0 || t.key === 'saved') && (
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

          {/* Results count */}
          {!loading && jobs.length > 0 && (
            <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#9CA3AF', marginBottom: '16px' }}>
              {filtered.length} {filtered.length === 1 ? 'role' : 'roles'} found
            </p>
          )}

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
            /* Two-column layout: card list + sticky detail panel */
            <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '1fr 420px' : '1fr', gap: '24px', alignItems: 'flex-start' }}>

              {/* Card list */}
              <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {filtered.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    selected={selectedJob?.id === job.id}
                    saved={savedIds.has(job.id)}
                    onClick={() => setSelectedJob(prev => prev?.id === job.id ? null : job)}
                    onToggleSave={e => toggleSave(e, job.id)}
                  />
                ))}
              </div>

              {/* Sticky detail panel */}
              {selectedJob && (
                <JobDetailPanel
                  job={selectedJob}
                  saved={savedIds.has(selectedJob.id)}
                  onClose={() => setSelectedJob(null)}
                  onToggleSave={() => setSavedIds(prev => {
                    const next = new Set(prev);
                    next.has(selectedJob.id) ? next.delete(selectedJob.id) : next.add(selectedJob.id);
                    return next;
                  })}
                />
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}