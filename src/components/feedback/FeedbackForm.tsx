"use client";

import { useState } from "react";
import StarRating from "./StarRating";

type Status = "idle" | "submitting" | "success" | "error";

export default function FeedbackForm() {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [review, setReview] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (rating === 0) {
      setErrorMessage("Please choose a star rating.");
      return;
    }
    if (review.trim().length === 0) {
      setErrorMessage("Please write a short review.");
      return;
    }
    if (email.trim().length > 0 && !isValidEmail(email.trim())) {
      setErrorMessage("That email doesn't look right. Double-check it or leave it blank.");
      return;
    }

    setStatus("submitting");

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        rating,
        review: review.trim(),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus("error");
      setErrorMessage(body?.error || "Something went wrong sending your feedback. Please try again.");
      return;
    }

    setStatus("success");
    setRating(0);
    setName("");
    setEmail("");
    setReview("");
  }

  if (status === "success") {
    return (
      <div
        style={{
          background: "#FFFBF5",
          border: "1px solid rgba(28,25,23,0.1)",
          borderRadius: "12px",
          padding: "40px 32px",
          textAlign: "center",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "1.25rem",
            color: "#1C1917",
            marginBottom: "8px",
          }}
        >
          Thanks for the feedback
        </h3>
        <p style={{ fontFamily: "var(--font-body)", color: "rgba(28,25,23,0.6)", fontSize: "0.9375rem" }}>
          We read every review. If you left an email, we'll reach out if we have questions.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="hover:opacity-80"
          style={{
            marginTop: "20px",
            background: "#1C1917",
            color: "#FFFBF5",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Leave another review
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#FFFBF5",
        border: "1px solid rgba(28,25,23,0.1)",
        borderRadius: "12px",
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div>
        <label
          style={{
            display: "block",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#1C1917",
            marginBottom: "8px",
          }}
        >
          Your rating
        </label>
        <StarRating value={rating} onChange={setRating} />
      </div>

      <div>
        <label
          htmlFor="review"
          style={{
            display: "block",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#1C1917",
            marginBottom: "8px",
          }}
        >
          Your review
        </label>
        <textarea
          id="review"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="What's working well? What could be better?"
          className="focus:outline-none focus:ring-2"
          style={{
            width: "100%",
            resize: "vertical",
            border: "1px solid rgba(28,25,23,0.15)",
            borderRadius: "8px",
            padding: "12px 14px",
            fontFamily: "var(--font-body)",
            fontSize: "0.9375rem",
            color: "#1C1917",
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <label
            htmlFor="name"
            style={{
              display: "block",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#1C1917",
              marginBottom: "8px",
            }}
          >
            Name <span style={{ fontWeight: 400, color: "rgba(28,25,23,0.4)" }}>(optional)</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="focus:outline-none focus:ring-2"
            style={{
              width: "100%",
              border: "1px solid rgba(28,25,23,0.15)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              color: "#1C1917",
            }}
          />
        </div>
        <div>
          <label
            htmlFor="email"
            style={{
              display: "block",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#1C1917",
              marginBottom: "8px",
            }}
          >
            Email <span style={{ fontWeight: 400, color: "rgba(28,25,23,0.4)" }}>(if you'd like a reply)</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            className="focus:outline-none focus:ring-2"
            style={{
              width: "100%",
              border: "1px solid rgba(28,25,23,0.15)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              color: "#1C1917",
            }}
          />
        </div>
      </div>

      {errorMessage && (
        <p style={{ color: "#B3261E", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="hover:opacity-90"
        style={{
          background: "#1C1917",
          color: "#FFFBF5",
          border: "none",
          borderRadius: "8px",
          padding: "12px 24px",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: "0.9375rem",
          cursor: status === "submitting" ? "default" : "pointer",
          opacity: status === "submitting" ? 0.6 : 1,
          alignSelf: "flex-start",
        }}
      >
        {status === "submitting" ? "Sending..." : "Submit feedback"}
      </button>
    </form>
  );
}