// ─── Pricing page content ─────────────────────────────────────────────────────

export const hero = {
  label: 'Pricing',
  headline: 'Simple pricing. No surprises.',
  subheadline:
    "Start free. Scale when you're ready. Every plan includes full access to core workflows and all four AI features — no credit card required.",
};

export const plans = {
  sectionTitle: 'Find the plan that fits your team.',
  sectionSubtitle: 'Two plans. Zero hidden fees.',
  free: {
    name: 'Free',
    price: '$0',
    priceSub: 'per month, forever',
    tagline: 'Everything you need to get started.',
    badge: 'Free Forever',
    features: [
      'Full core workflow access',
      'All user roles included',
      'Unlimited casual workers',
      'Post & manage job openings',
      'AI candidate recommendation',
      'AI job description generator',
      'AI auto-approve timesheets',
      'AI anomaly detection',
      'Photo-based clock-in verification',
      'Attendance record management',
      'Smart notifications',
      'Internal announcements',
      'Basic search & filter',
    ],
    cta: 'Get Started Free',
    ctaHref: '/get-started',
  },
  pro: {
    name: 'Pro',
    price: '$6',
    priceSub: 'per user / month',
    tagline: 'For teams that need more control.',
    badge: 'Most Popular',
    featuresIntro: 'Includes everything in the Free Plan, plus:',
    features: [
      'Split shift timeline',
      'Clopening detection',
      'Recurring job posting',
      'Duplicate job posting',
      'Archive job posting',
      'Support sub-tasks',
      'Staff availability management',
      'Skills management',
      'CW performance history tracking',
      'Set CW account to Block',
      'Advanced scheduling controls',
      'Compliance enforcement',
    ],
    cta: 'Get Started',
    ctaHref: '/get-started',
  },
};

export type FeatureRow =
  | { type: 'group'; label: string }
  | { type: 'row'; feature: string; free: boolean; pro: boolean };

export const comparisonTable: {
  sectionTitle: string;
  sectionSubtitle: string;
  rows: FeatureRow[];
} = {
  sectionTitle: 'Everything side by side.',
  sectionSubtitle: "See exactly what's included in each plan.",
  rows: [
    { type: 'group', label: 'Core Workflow' },
    { type: 'row', feature: 'Post job openings', free: true, pro: true },
    { type: 'row', feature: 'View & manage applicants', free: true, pro: true },
    { type: 'row', feature: 'Send job invitations', free: true, pro: true },
    { type: 'row', feature: 'Attendance tracking', free: true, pro: true },
    { type: 'row', feature: 'Photo-based clock-in verification', free: true, pro: true },
    { type: 'row', feature: 'Smart notifications', free: true, pro: true },
    { type: 'row', feature: 'Internal announcements', free: true, pro: true },

    { type: 'group', label: 'AI Features' },
    { type: 'row', feature: 'AI candidate recommendation', free: true, pro: true },
    { type: 'row', feature: 'AI job description generator', free: true, pro: true },
    { type: 'row', feature: 'AI auto-approve timesheets', free: true, pro: true },
    { type: 'row', feature: 'AI anomaly detection', free: true, pro: true },

    { type: 'group', label: 'Advanced Scheduling' },
    { type: 'row', feature: 'Split shift timeline', free: false, pro: true },
    { type: 'row', feature: 'Clopening detection', free: false, pro: true },
    { type: 'row', feature: 'Recurring job posting', free: false, pro: true },
    { type: 'row', feature: 'Duplicate job posting', free: false, pro: true },
    { type: 'row', feature: 'Archive job posting', free: false, pro: true },
    { type: 'row', feature: 'Support sub-tasks', free: false, pro: true },

    { type: 'group', label: 'Workforce Intelligence' },
    { type: 'row', feature: 'Staff availability management', free: false, pro: true },
    { type: 'row', feature: 'Skills management', free: false, pro: true },
    { type: 'row', feature: 'CW performance history', free: false, pro: true },

    { type: 'group', label: 'Account Control' },
    { type: 'row', feature: 'Set CW account to Inactive', free: true, pro: true },
    { type: 'row', feature: 'Set CW account to Block', free: false, pro: true },
    { type: 'row', feature: 'Compliance enforcement', free: false, pro: true },
  ],
};

export const faqs: { sectionTitle: string; items: { q: string; a: string }[] } = {
  sectionTitle: 'Pricing questions, answered.',
  items: [
    {
      q: 'Is the free plan really free forever?',
      a: 'Yes. No trial period, no expiry date, no credit card required. The free plan gives you full access to core workflows and all four AI features for as long as you need.',
    },
    {
      q: 'How does per-user pricing work?',
      a: 'The paid plan is charged at $6 per user per month. You only pay for the users you have — so a team of 10 pays $60/month. Casual workers are unlimited and do not count toward your user count.',
    },
    {
      q: 'Can I start on the free plan and upgrade later?',
      a: 'Absolutely. You can start on the free plan and upgrade to the paid plan at any time. All your existing data, workflows, and settings carry over automatically.',
    },
    {
      q: 'What counts as a user in the paid plan?',
      a: 'A user refers to registered internal accounts — Owners, Managers, and Employees. Casual Workers are unlimited across both plans and are not counted as paid users.',
    },
    {
      q: 'Is there a contract or minimum commitment?',
      a: 'No contracts, no lock-in. The paid plan is billed monthly and you can cancel at any time.',
    },
  ],
};

export const cta = {
  headline: 'Start free. No commitment.',
  subheadline:
    'Join SMEs already using Tasking to manage their casual workforce — smarter, faster, and without the admin burden.',
  primaryLabel: 'Get Started Free',
  primaryHref: '/get-started',
  secondaryLabel: 'Talk to Us',
  secondaryHref: '/about',
  footnote: 'No credit card required. Cancel anytime.',
};
