"use client";

import { useState } from "react";
import StarRating from "./StarRating";
import { ReviewSummary } from "@/types/Review";

interface ReviewsCarouselProps {
  reviews: ReviewSummary[];
}

export default function ReviewsCarousel({ reviews }: ReviewsCarouselProps) {
  const [index, setIndex] = useState(0);

  if (reviews.length === 0) {
    return (
      <div
        style={{
          border: "1px dashed rgba(28,25,23,0.2)",
          borderRadius: "12px",
          padding: "32px",
          textAlign: "center",
        }}
      >
        <p style={{ fontFamily: "var(--font-body)", color: "rgba(28,25,23,0.5)", fontSize: "0.9375rem" }}>
          No reviews to show yet — be the first to leave one.
        </p>
      </div>
    );
  }

  const current = reviews[index];
  const goPrev = () => setIndex((i) => (i - 1 + reviews.length) % reviews.length);
  const goNext = () => setIndex((i) => (i + 1) % reviews.length);

  return (
    <div>
      <div
        style={{
          background: "#1C1917",
          color: "#FFFBF5",
          borderRadius: "12px",
          padding: "36px 32px",
          minHeight: "180px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <StarRating value={current.rating} readOnly size={18} />
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1.0625rem",
              lineHeight: 1.6,
              marginTop: "16px",
              color: "#FFFBF5",
            }}
          >
            "{current.review}"
          </p>
        </div>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "rgba(255,251,245,0.5)",
            marginTop: "20px",
          }}
        >
          {current.name || "Anonymous"}
        </p>
      </div>

      {reviews.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous review"
            className="hover:opacity-70"
            style={navButtonStyle}
          >
            ←
          </button>
          <div style={{ display: "flex", gap: "6px" }}>
            {reviews.map((r, i) => (
              <button
                key={r.id}
                type="button"
                aria-label={`Go to review ${i + 1}`}
                onClick={() => setIndex(i)}
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "999px",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background: i === index ? "#1C1917" : "rgba(28,25,23,0.2)",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next review"
            className="hover:opacity-70"
            style={navButtonStyle}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

const navButtonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid rgba(28,25,23,0.15)",
  borderRadius: "999px",
  width: "36px",
  height: "36px",
  cursor: "pointer",
  fontSize: "1rem",
  color: "#1C1917",
};