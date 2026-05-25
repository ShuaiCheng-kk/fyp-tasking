'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, Shield, Star, X } from 'lucide-react';
import { hero, search, whyTasking, listings } from './content';
import { JobPosting } from '@/types/recruitment.types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const fH = 'var(--font-heading)';
const fB = 'var(--font-body)';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const iconMap = { Zap, Shield, Star } as const;
type IconName = keyof typeof iconMap;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobBoardPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [filtered, setFiltered] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [modalJob, setModalJob] = useState<JobPosting | null>(null);

  // ── Fetch all open jobs ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/jobs/public')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setJobs(d.jobs);
          setFiltered(d.jobs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Filter jobs ──────────────────────────────────────────────────────────
  useEffect(() => {
    let result = jobs;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q)
      );
    }
    if (selectedType !== 'All Types') {
      result = result.filter(j => j.employment_type === selectedType.toLowerCase());
    }
    if (selectedLocation !== 'All Locations') {
      result = result.filter(j => j.location === selectedLocation);
    }
    setFiltered(result);
  }, [searchQuery, selectedType, selectedLocation, jobs]);

  // ── Modal keyboard close ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalJob(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = modalJob !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modalJob]);

  // ── Derive dynamic filter options from real data ─────────────────────────
  const locationOptions = ['All Locations', ...Array.from(new Set(jobs.map(j => j.location).filter(Boolean) as string[]))]
  const typeOptions = ['All Types', ...Array.from(new Set(jobs.map(j => j.employment_type).filter(Boolean) as string[]))]

  return (
    <>
      {/* ========== HERO SECTION ========== */}
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

      {/* ========== WHY TASKING SECTION ========== */}
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

      {/* ========== JOB LISTINGS SECTION ========== */}
      <section className="page-section" style={{ background: '#FFFBF5', padding: '40px 0 80px' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>

          {/* Section heading */}
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
            borderRadius: '12px', padding: '16px 20px', marginBottom: '40px',
          }}>
            <div className="search-filter-row">
              <input
                type="text"
                placeholder={search.placeholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1, fontFamily: fB, fontSize: '0.9375rem', color: '#1C1917',
                  border: '1px solid #E5E7EB', borderRadius: '8px',
                  padding: '10px 14px', background: '#FFFFFF', outline: 'none',
                }}
              />
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                style={{
                  fontFamily: fB, fontSize: '0.9375rem', color: '#374151',
                  border: '1px solid #E5E7EB', borderRadius: '8px',
                  padding: '10px 14px', background: '#FFFFFF', cursor: 'pointer',
                  minWidth: '150px', outline: 'none',
                }}
              >
                {typeOptions.map(o => <option key={o}>{o}</option>)}
              </select>
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                style={{
                  fontFamily: fB, fontSize: '0.9375rem', color: '#374151',
                  border: '1px solid #E5E7EB', borderRadius: '8px',
                  padding: '10px 14px', background: '#FFFFFF', cursor: 'pointer',
                  minWidth: '150px', outline: 'none',
                }}
              >
                {locationOptions.map(o => <option key={o}>{o}</option>)}
              </select>
              <button
                className="btn-press"
                style={{
                  background: '#F97316', color: '#FFFFFF', padding: '10px 24px',
                  borderRadius: '8px', fontFamily: fB, fontWeight: 600,
                  fontSize: '0.9375rem', border: 'none', cursor: 'pointer', flexShrink: 0,
                }}
              >
                {search.button}
              </button>
            </div>
          </div>

          {/* Cards grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontFamily: fB, fontSize: '0.9375rem' }}>
              Loading jobs…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontFamily: fB, fontSize: '0.9375rem' }}>
              {jobs.length === 0 ? 'No job openings available right now. Check back soon!' : 'No jobs match your search.'}
            </div>
          ) : (
            <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              {filtered.map(job => (
                <div key={job.id} style={{
                  background: '#FFFFFF', border: '1px solid #F0E8D8',
                  borderRadius: '16px', padding: '24px',
                  display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                  {/* Status badge */}
                  <span style={{
                    display: 'inline-block', alignSelf: 'flex-start',
                    background: '#DCFCE7', color: '#15803D', fontFamily: fB,
                    fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px',
                    borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {capitalize(job.status)}
                  </span>

                  {/* Title */}
                  <div style={{ borderBottom: '1px solid #F0E8D8', paddingBottom: '12px' }}>
                    <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.0625rem', color: '#1C1917' }}>
                      {job.title}
                    </p>
                    {job.employment_type && (
                      <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#78716C', marginTop: '4px' }}>
                        {capitalize(job.employment_type)}
                      </p>
                    )}
                  </div>

                  {/* Meta */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    {job.location && (
                      <p style={{ fontFamily: fB, fontSize: '0.8125rem', color: '#78716C' }}>{job.location}</p>
                    )}
                    {job.industry && (
                      <p style={{ fontFamily: fB, fontSize: '0.8125rem', color: '#78716C' }}>{job.industry}</p>
                    )}
                    {job.employment_type && (
                      <p style={{ fontFamily: fB, fontSize: '0.8125rem', color: '#78716C' }}>
                        {capitalize(job.employment_type)}
                      </p>
                    )}
                    {job.salary_amount && (
                      <p style={{ fontFamily: fB, fontSize: '0.8125rem', color: '#78716C' }}>
                        ${job.salary_amount} {job.salary_type}
                      </p>
                    )}
                    <p style={{ fontFamily: fB, fontSize: '0.8125rem', color: '#78716C', lineHeight: 1.5 }}>
                      {job.description.length > 80 ? job.description.slice(0, 80) + '…' : job.description}
                    </p>
                    <p style={{ fontFamily: fB, fontSize: '0.75rem', color: '#9CA3AF', marginTop: '4px' }}>
                      Posted {formatDate(job.created_at)} · {timeAgo(job.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button
                      onClick={() => setModalJob(job)}
                      style={{
                        flex: 1, padding: '10px 0', background: 'transparent',
                        border: '1.5px solid #D1D5DB', borderRadius: '8px',
                        fontFamily: fB, fontWeight: 600, fontSize: '0.875rem',
                        color: '#374151', cursor: 'pointer',
                      }}
                    >
                      View Details
                    </button>
                    <Link
                      href="/get-started"
                      className="btn-press"
                      style={{
                        flex: 1, display: 'block', textAlign: 'center',
                        padding: '10px 0', background: '#F97316', borderRadius: '8px',
                        fontFamily: fB, fontWeight: 600, fontSize: '0.875rem', color: '#FFFFFF',
                      }}
                    >
                      Apply Now
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ========== VIEW DETAILS MODAL ========== */}
      {modalJob !== null && (
        <div
          onClick={() => setModalJob(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            zIndex: 1000, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#FFFFFF', borderRadius: '20px', padding: '40px',
              maxWidth: '600px', width: '100%', maxHeight: '80vh',
              overflowY: 'auto', position: 'relative',
            }}
          >
            <button
              onClick={() => setModalJob(null)}
              style={{
                position: 'absolute', top: '20px', right: '20px',
                background: '#F3F4F6', border: 'none', borderRadius: '8px',
                width: 36, height: 36, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <X size={18} color="#374151" />
            </button>

            {modalJob.employment_type && (
              <p style={{
                fontFamily: fB, fontSize: '0.75rem', fontWeight: 700, color: '#F97316',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
              }}>
                {capitalize(modalJob.employment_type)}
              </p>
            )}
            <h2 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.5rem', color: '#1C1917', marginBottom: '24px' }}>
              {modalJob.title}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              {[
                { label: 'Company', value: modalJob.company_name },
                { label: 'Description', value: modalJob.description },
                ...(modalJob.requirements ? [{ label: 'Requirements', value: modalJob.requirements }] : []),
                ...(modalJob.location ? [{ label: 'Location', value: modalJob.location }] : []),
                ...(modalJob.industry ? [{ label: 'Industry', value: modalJob.industry }] : []),
                ...(modalJob.employment_type ? [{ label: 'Job Type', value: capitalize(modalJob.employment_type) }] : []),
                ...(modalJob.salary_amount ? [{ label: 'Salary', value: `$${modalJob.salary_amount} ${modalJob.salary_type}` }] : []),
                { label: 'Date Posted', value: `${formatDate(modalJob.created_at)} · ${timeAgo(modalJob.created_at)}` },
              ].filter(item => item.value).map(({ label, value }) => (
                <div key={label} style={{ borderBottom: '1px solid #F0E8D8', paddingBottom: '16px' }}>
                  <p style={{
                    fontFamily: fB, fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
                  }}>
                    {label}
                  </p>
                  <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#1C1917', lineHeight: 1.6 }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/get-started"
              className="btn-press cta-shimmer"
              style={{
                display: 'block', textAlign: 'center', background: '#F97316',
                color: '#FFFFFF', padding: '14px', borderRadius: '10px',
                fontFamily: fB, fontWeight: 700, fontSize: '0.9375rem',
              }}
            >
              Apply Now
            </Link>
          </div>
        </div>
      )}
    </>
  );
}