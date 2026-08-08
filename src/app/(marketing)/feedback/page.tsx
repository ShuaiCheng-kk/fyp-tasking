import FeedbackForm from "@/components/feedback/FeedbackForm";
import ReviewsCarousel from "@/components/feedback/ReviewsCarousel";
import { reviewsService } from "@/services/marketing/reviewsService";

export const metadata = {
  title: "Feedback | Tasking",
  description: "Share your experience with Tasking or get in touch with the team.",
};

export default async function FeedbackPage() {
  const reviews = await reviewsService.getFeaturedReviews(12);

  return (
    <main style={{ background: "#FFFBF5" }}>
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "80px 24px 100px",
        }}
      >
        {/* ── Header ── */}
        <div style={{ maxWidth: "640px", marginBottom: "56px" }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "2.25rem",
              color: "#1C1917",
              marginBottom: "16px",
            }}
          >
            Leave a feedback
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1.0625rem",
              lineHeight: 1.6,
              color: "rgba(28,25,23,0.6)",
            }}
          >
            Tell us what's working, what isn't, or what you'd like to see next. Rate your
            experience, write a review, and leave your email if you'd like us to follow up.
          </p>
        </div>

        {/* ── Form + Reviews ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "48px",
            alignItems: "start",
          }}
        >
          <FeedbackForm />

          <div>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "1.375rem",
                color: "#1C1917",
                marginBottom: "16px",
              }}
            >
              What people are saying
            </h2>
            <ReviewsCarousel reviews={reviews} />
          </div>
        </div>
      </div>
    </main>
  );
}