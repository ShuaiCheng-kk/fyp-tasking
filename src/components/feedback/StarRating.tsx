"use client";

import { useState } from "react";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
}

export default function StarRating({
  value,
  onChange,
  size = 28,
  readOnly = false,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const displayValue = hovered ?? value;

  return (
    <div
      role={readOnly ? undefined : "radiogroup"}
      aria-label={readOnly ? undefined : "Rating"}
      style={{ display: "inline-flex", gap: "4px" }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            role={readOnly ? undefined : "radio"}
            aria-checked={!readOnly && star === value}
            aria-label={readOnly ? undefined : `${star} star${star > 1 ? "s" : ""}`}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readOnly && setHovered(star)}
            onMouseLeave={() => !readOnly && setHovered(null)}
            onFocus={() => !readOnly && setHovered(star)}
            onBlur={() => !readOnly && setHovered(null)}
            className={readOnly ? "" : "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: readOnly ? "default" : "pointer",
              lineHeight: 0,
              borderRadius: "4px",
            }}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              fill={filled ? "#E8A33D" : "none"}
              stroke={filled ? "#E8A33D" : "rgba(28,25,23,0.35)"}
              strokeWidth="1.5"
            >
              <path
                d="M12 2.5l2.9 6.53 7.1.62-5.4 4.73 1.63 6.98L12 17.77l-6.23 3.6 1.63-6.98-5.4-4.73 7.1-.62L12 2.5z"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}