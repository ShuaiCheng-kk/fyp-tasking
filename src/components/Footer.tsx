import Link from "next/link";

const columns = [
  {
    title: "Products",
    links: [
      { label: "AI Features", href: "/products/ai-features" },
      { label: "Recruitment", href: "/products/recruitment" },
      { label: "Attendance", href: "/products/attendance" },
      { label: "Team Management", href: "/products/team-management" },
      { label: "Smart Notifications", href: "/products/smart-notifications" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "Mission", href: "/about/mission" },
      { label: "Problem & Solution", href: "/about/problem-solution" },
      { label: "Team", href: "/about/team" },
      { label: "FAQ", href: "/about/faq" },
    ],
  },
  {
    title: "Industries",
    links: [
      { label: "Retail", href: "/industries#retail" },
      { label: "F&B", href: "/industries#fnb" },
      { label: "Logistics", href: "/industries#logistics" },
      { label: "Event Management", href: "/industries#event-management" },
    ],
  },
  {
    title: "Other",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Job Board", href: "/job-board" },
      { label: "Leave a Feedback", href: "/feedback" },
    ],
  },
];

export default function Footer() {
  return (
    <footer style={{ background: "#1C1917", color: "#FFFBF5" }}>
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "60px 24px 40px",
        }}
      >
        {/* ── Columns ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "40px",
            marginBottom: "48px",
          }}
        >
          {columns.map((col) => (
            <div key={col.title}>
              <h3
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#FFFBF5",
                  marginBottom: "16px",
                }}
              >
                {col.title}
              </h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      style={{
                        color: "rgba(255,251,245,0.6)",
                        fontSize: "0.875rem",
                        fontFamily: "var(--font-body)",
                        transition: "color 0.15s",
                      }}
                      className="hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div
          style={{
            borderTop: "1px solid rgba(255,251,245,0.1)",
            paddingTop: "24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "rgba(255,251,245,0.4)",
              fontSize: "0.875rem",
              fontFamily: "var(--font-body)",
            }}
          >
            © 2025 Tasking. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}