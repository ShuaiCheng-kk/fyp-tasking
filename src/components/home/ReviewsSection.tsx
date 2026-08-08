'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import StarRating from '@/components/feedback/StarRating';
import { ReviewSummary } from '@/types/Review';

// Same fixed-4-visible, scroll-snap carousel mechanics as the Home page's Industries
// section (IndustryCarousel in src/app/(marketing)/page.tsx) — kept as its own copy
// here since the card content/shape is different enough (stars + quote + name, no
// icon, no link) that sharing one generic component would need more props than it's
// worth. Exists so the section's height stays fixed no matter how many reviews pile
// up over time, instead of the old CSS grid that grew taller with every new review.
function ReviewsCarousel({ reviews }: { reviews: ReviewSummary[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef(0);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One clone of the first card appended at the end — scrolling onto it looks identical to
  // being back at item 0, so the loop can snap back there instantly with no visible jump.
  const displayReviews = [...reviews, reviews[0]];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = itemRefs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setActive(idx % reviews.length);
          }
        });
      },
      { root: track, threshold: 0.6 },
    );
    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [reviews.length]);

  const scrollToIndex = (i: number, instant = false) => {
    const track = trackRef.current;
    const item = itemRefs.current[i];
    if (!track || !item) return;
    const target = item.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    track.scrollTo({ left: target, behavior: instant ? 'auto' : 'smooth' });
  };

  const goTo = (i: number) => {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    posRef.current = i;
    scrollToIndex(i);
  };

  useEffect(() => {
    if (paused || reviews.length <= 4) return;
    const timer = setInterval(() => {
      const next = posRef.current + 1;
      scrollToIndex(next);
      if (next === reviews.length) {
        resetTimeoutRef.current = setTimeout(() => {
          posRef.current = 0;
          scrollToIndex(0, true);
        }, 550);
      } else {
        posRef.current = next;
      }
    }, 3500);
    return () => {
      clearInterval(timer);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, [paused, reviews.length]);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div
        ref={trackRef}
        className="reviews-carousel-track"
        style={{
          display: 'flex',
          gap: '24px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          paddingBottom: '8px',
          marginBottom: '32px',
        }}
      >
        {displayReviews.map((review, i) => (
          <div
            key={`${review.id}-${i}`}
            ref={(el) => { itemRefs.current[i] = el; }}
            style={{
              scrollSnapAlign: 'start',
              flex: '0 0 calc(25% - 18px)',
              minWidth: '260px',
              background: '#FFFBF5',
              border: '1px solid #F0E8D8',
              borderRadius: '12px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <StarRating value={review.rating} readOnly size={16} />
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9375rem',
                  lineHeight: 1.6,
                  color: '#1C1917',
                  marginTop: '14px',
                }}
              >
                "{review.review}"
              </p>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                color: '#78716C',
                marginTop: '20px',
              }}
            >
              {review.name || 'Anonymous'}
            </p>
          </div>
        ))}
      </div>

      {reviews.length > 4 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
          {reviews.map((review, i) => (
            <button
              key={review.id}
              type="button"
              aria-label={`Go to review ${i + 1}`}
              onClick={() => goTo(i)}
              style={{
                width: active === i ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: active === i ? '#F97316' : '#E7DFCE',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/reviews?limit=24')
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setReviews(data.reviews ?? []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <section id="reviews" className="page-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
      <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '52px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: '2.25rem',
              color: '#1C1917',
              marginBottom: '12px',
            }}
          >
            What Our Users Say
          </h2>
          {reviews.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <StarRating value={Math.round(average)} readOnly size={18} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C' }}>
                {average.toFixed(1)} from {reviews.length} review{reviews.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>

        {!loading && reviews.length === 0 && (
          <div
            style={{
              border: '1px dashed rgba(28,25,23,0.2)',
              borderRadius: '12px',
              padding: '48px 32px',
              textAlign: 'center',
              maxWidth: '520px',
              margin: '0 auto',
            }}
          >
            <p style={{ fontFamily: 'var(--font-body)', color: '#78716C', fontSize: '0.9375rem', marginBottom: '20px' }}>
              No reviews yet — be the first to share your experience.
            </p>
            <Link
              href="/feedback"
              className="btn-press"
              style={{
                display: 'inline-block',
                background: '#F97316',
                color: '#FFFFFF',
                padding: '12px 26px',
                borderRadius: '10px',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.9375rem',
              }}
            >
              Leave a Review
            </Link>
          </div>
        )}

        {reviews.length > 0 && (
          <>
            <ReviewsCarousel reviews={reviews} />

            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <Link
                href="/feedback"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  color: '#F97316',
                }}
              >
                Share your experience →
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
