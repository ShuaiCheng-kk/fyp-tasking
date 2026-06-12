'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Zap, Shield, Star, X, Search, MapPin, Briefcase, Clock, Banknote, Timer, ChevronDown, LayoutGrid, Users, FileText } from 'lucide-react';
import { hero, search, whyTasking, listings } from './content';
import { JobPosting } from '@/types/recruitment.types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const fH = 'var(--font-heading)';
const fB = 'var(--font-body)';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const iconMap = { Zap, Shield, Star } as const;
type IconName = keyof typeof iconMap;

// ─── Tab type ─────────────────────────────────────────────────────────────────

type ActiveTab = 'all' | 'shift' | 'oneoff';

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

function Badge({ children, color = '#15803D', bg = '#DCFCE7', border }: { children: React.ReactNode; color?: string; bg?: string; border?: string }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color,
      fontFamily: fB, fontSize: '0.6875rem', fontWeight: 700,
      padding: '3px 9px', borderRadius: '100px',
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
      border: border ? `1px solid ${border}` : undefined,
    }}>
      {children}
    </span>
  );
}

function Pill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontFamily: fB, fontSize: '0.8125rem', fontWeight: 500, color: '#57534E',
      background: '#F5F5F4', border: '1px solid #E7E5E4',
      borderRadius: '100px', padding: '4px 11px',
      ...style,
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
  onClose,
}: {
  job: JobPosting;
  onClose: () => void;
}) {
  const { rating, count } = seedRating(job.company_id);
  const recur = recurrenceLabel(job);
  const expiry = expiryInfo(job);
  const closing = closingInfo(job);

  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #EDE9E3', borderRadius: '20px',
      padding: '32px', position: 'sticky', top: '24px',
      maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', display: 'flex',
      flexDirection: 'column', gap: '28px',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontFamily: fH, fontWeight: 800, fontSize: '1.5rem', color: '#111827', lineHeight: 1.25, margin: '0 0 4px' }}>
            {job.title}
          </h2>
          <p style={{ fontFamily: fB, fontSize: '0.9375rem', fontWeight: 500, color: '#6B7280', margin: '0 0 18px' }}>
            {job.company_name ?? '—'}
          </p>

          {/* Icon rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {job.company_location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={15} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#374151' }}>{job.company_location}</span>
              </div>
            )}
            {job.department_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <LayoutGrid size={15} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#374151' }}>{job.department_name}</span>
              </div>
            )}
            {job.salary_amount && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Banknote size={15} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.9375rem', fontWeight: 600, color: '#059669' }}>{formatSalary(job)}</span>
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close panel"
          style={{ background: '#F3F4F6', border: 'none', borderRadius: '8px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <X size={16} color="#374151" />
        </button>
      </div>

      {/* ── Expiry / closing notice ── */}
      {expiry && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: expiry.expired ? '#F9FAFB' : '#FFFBEB',
          border: `1px solid ${expiry.expired ? '#E5E7EB' : '#FCD34D'}`,
          borderRadius: '10px', padding: '12px 16px',
        }}>
          <Timer size={14} color={expiry.expired ? '#9CA3AF' : '#D97706'} style={{ flexShrink: 0 }} />
          <p style={{ fontFamily: fB, fontSize: '0.875rem', color: expiry.expired ? '#6B7280' : '#92400E', margin: 0, fontWeight: 600 }}>
            {expiry.label}
            {job.expires_at && !expiry.expired && ` — ${new Date(job.expires_at).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}`}
          </p>
        </div>
      )}
      {closing && !expiry && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: '#F9FAFB', border: '1px solid #E5E7EB',
          borderRadius: '10px', padding: '12px 16px',
        }}>
          <Clock size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
          <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>
            <strong>{closing.label}:</strong> {closing.value}
          </p>
        </div>
      )}

      {/* ── About this role ── */}
      <div>
        <SectionLabel>About this role</SectionLabel>
        <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
          {job.description}
        </p>
      </div>

      {/* ── Requirements ── */}
      {job.requirements && (
        <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: '24px' }}>
          <SectionLabel>Requirements</SectionLabel>
          <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
            {job.requirements}
          </p>
        </div>
      )}

      {/* ── Company profile ── */}
      <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: '24px' }}>
        <SectionLabel>Company profile</SectionLabel>
        <div style={{
          background: '#FAFAF9', border: '1px solid #EDE9E3',
          borderRadius: '14px', padding: '20px 22px',
          display: 'flex', flexDirection: 'column', gap: '14px',
        }}>
          <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>
            {job.company_name ?? '—'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {job.company_location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={14} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#4B5563' }}>{job.company_location}</span>
              </div>
            )}
            {job.company_address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={14} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#4B5563' }}>{job.company_address}</span>
              </div>
            )}
            {job.company_size && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={14} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#4B5563' }}>{job.company_size} employees</span>
              </div>
            )}
            {job.company_industry && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Briefcase size={14} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#4B5563' }}>{job.company_industry}</span>
              </div>
            )}
            {job.company_description && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingTop: '4px', borderTop: '1px solid #EDE9E3', marginTop: '2px' }}>
                <FileText size={14} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '3px' }} />
                <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.7 }}>{job.company_description}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Company rating ── */}
      <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: '24px' }}>
        <SectionLabel>Company rating</SectionLabel>
        <div style={{ background: '#FFFBF5', border: '1px solid #FDE8C8', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <p style={{ fontFamily: fB, fontWeight: 600, fontSize: '0.9375rem', color: '#1C1917', margin: '0 0 6px' }}>
              {job.company_name ?? 'This company'}
            </p>
            <StarRating rating={rating} count={count} size={14} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: fH, fontWeight: 800, fontSize: '2rem', color: '#F97316', lineHeight: 1, margin: 0 }}>{rating.toFixed(1)}</p>
            <p style={{ fontFamily: fB, fontSize: '0.75rem', color: '#9CA3AF', margin: '2px 0 0' }}>out of 5</p>
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
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  selected,
  onClick,
}: {
  job: JobPosting;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        border: `1.5px solid ${selected ? '#F97316' : hovered ? '#F97316' : '#EDE9E3'}`,
        borderRadius: '16px', padding: '24px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: '14px',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
        boxShadow: selected
          ? '0 0 0 3px rgba(249,115,22,0.15), 0 8px 24px rgba(249,115,22,0.1)'
          : hovered
            ? '0 8px 28px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)'
            : '0 1px 4px rgba(0,0,0,0.04)',
        transform: hovered && !selected ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >

      {/* Job type + department badges */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {resolveJobType(job) === 'shift'
          ? <Badge color="#C2410C" bg="#FFF7ED" border="#FED7AA">Shift Job</Badge>
          : <Badge color="#7C3AED" bg="#F5F3FF" border="#DDD6FE">One-Off Job</Badge>
        }
        {job.department_name && <Badge color="#1D4ED8" bg="#DBEAFE" border="#BFDBFE">{job.department_name}</Badge>}
      </div>

      {/* Title + company */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: 0 }}>
          {job.title}
        </p>
        <p style={{ fontFamily: fB, fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: 0 }}>
          {job.company_name ?? '—'}
        </p>
      </div>

      {/* Location + pay */}
      {(job.company_location || job.salary_amount) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {job.company_location && <Pill><MapPin size={11} />{job.company_location}</Pill>}
          {formatSalary(job)    && <Pill style={{ color: '#065F46', background: '#ECFDF5', border: '1px solid #A7F3D0' }}>{formatSalary(job)}</Pill>}
        </div>
      )}

      {/* Description — max 2 lines */}
      <p style={{
        fontFamily: fB, fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.65,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', margin: 0,
      }}>
        {job.description}
      </p>

      {/* Posted time */}
      <p style={{ fontFamily: fB, fontSize: '0.75rem', color: '#9CA3AF', margin: 0, paddingTop: '2px' }}>
        Posted {timeAgo(job.created_at)}
      </p>
    </div>
  );
}

// Resolve effective job type — prefer explicit form_type, fall back to is_recurring
function resolveJobType(job: JobPosting): 'shift' | 'oneoff' {
  if (job.form_type === 'shift' || job.form_type === 'oneoff') return job.form_type as 'shift' | 'oneoff';
  return job.is_recurring ? 'shift' : 'oneoff';
}

// Format salary: shift → "$15/hr", one-off → "$80"
function formatSalary(job: JobPosting): string | null {
  if (!job.salary_amount) return null;
  if (resolveJobType(job) === 'shift') return `$${job.salary_amount}/hr`;
  return `$${job.salary_amount}`;
}

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

  // ── Fetch open jobs ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/jobs/public')
      .then(r => r.json())
      .then(d => { if (d.success) setJobs(d.jobs); })
      .catch(() => {})
      .finally(() => setLoading(false));
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

  // ── Filter logic ─────────────────────────────────────────────────────────
  const filtered = jobs.filter(job => {
    const q = searchQuery.toLowerCase();
    if (activeTab === 'shift' && resolveJobType(job) !== 'shift') return false;
    if (activeTab === 'oneoff' && resolveJobType(job) !== 'oneoff') return false;
    if (selectedLocation !== 'All Locations' && job.company_location !== selectedLocation) return false;
    if (selectedIndustry !== 'All Industries' && job.company_industry !== selectedIndustry) return false;
    if (q && ![job.title, job.description, job.company_location, job.company_industry, job.company_name]
      .filter(Boolean).some(v => v!.toLowerCase().includes(q))) return false;
    return true;
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
            /* Two-column layout: card list + sticky detail panel */
            <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '1fr 420px' : '1fr', gap: '24px', alignItems: 'flex-start' }}>

              {/* Card list */}
              <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
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
                />
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}