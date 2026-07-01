// ─── Pricing page content ─────────────────────────────────────────────────────

export const hero = {
  label: 'Pricing',
  headline: 'Simple pricing. No surprises.',
  subheadline:
    "Start free. Scale when you're ready. Every plan includes full access to core workflows — no credit card required.",
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
      'Create, edit & delete shifts',
      'Publish / unpublish schedules',
      'Create split shifts',
      'Assign, edit & delete tasks',
      'Archive tasks & create sub-tasks',
      'Department management',
      'Direct invitations & member search',
      'Remove team members',
      'Post, edit & archive job openings',
      'Save job postings as drafts',
      'Applicant list & accept/reject applicants',
      'Accept / reject job offers',
      'Clock in / clock out',
      'Attendance review & status tracking',
      'Shift swap requests & approvals',
      'Fixed day off & leave requests',
      'Internal announcements & direct messaging',
      'Account registration & authentication',
    ],
    cta: 'Get Started Free',
    ctaHref: '/get-started',
  },
  pro: {
    name: 'Pro',
    price: '$20',
    priceSub: 'per month',
    tagline: 'For teams that need more control.',
    badge: 'Most Popular',
    featuresIntro: 'Includes everything in the Free Plan, plus:',
    features: [
      'Shift templates & duplication',
      'Recurring shifts & bulk shift editor',
      'Clopening conflict warnings',
      'AI schedule suggestions',
      'Task templates & duplication',
      'Recurring tasks & task dependencies',
      'AI task assignment suggestions',
      'Workload rebalancing & stalled task alerts',
      'Activate / deactivate casual workers',
      'Invite members & import departments by CSV',
      'Job templates & duplication',
      'Job posting approval workflow',
      'AI job description suggestions',
      'AI candidate recommendations',
      'Export attendance records',
      'Workforce analytics dashboard',
      'AI anomaly detection reports',
      'Export reports as CSV',
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
    { type: 'group', label: 'Shift' },
    { type: 'row', feature: 'Create shift', free: true, pro: true },
    { type: 'row', feature: 'Edit shift', free: true, pro: true },
    { type: 'row', feature: 'Delete shift', free: true, pro: true },
    { type: 'row', feature: 'Publish / unpublish schedule', free: true, pro: true },
    { type: 'row', feature: 'Create split shift', free: true, pro: true },
    { type: 'row', feature: 'Create shift template', free: false, pro: true },
    { type: 'row', feature: 'Duplicate shift', free: false, pro: true },
    { type: 'row', feature: 'Set recurring shift', free: false, pro: true },
    { type: 'row', feature: 'View clopening conflict warning', free: false, pro: true },
    { type: 'row', feature: 'Bulk shift editor', free: false, pro: true },

    { type: 'group', label: 'AI Features' },
    { type: 'row', feature: 'AI schedule suggestion', free: false, pro: true },
    { type: 'row', feature: 'AI task assignment suggestion', free: false, pro: true },
    { type: 'row', feature: 'AI job description suggestion', free: false, pro: true },
    { type: 'row', feature: 'AI candidate recommendation', free: false, pro: true },
    { type: 'row', feature: 'AI anomaly detection report', free: false, pro: true },

    { type: 'group', label: 'Task' },
    { type: 'row', feature: 'Assign task', free: true, pro: true },
    { type: 'row', feature: 'Edit task', free: true, pro: true },
    { type: 'row', feature: 'Delete task', free: true, pro: true },
    { type: 'row', feature: 'Archive task', free: true, pro: true },
    { type: 'row', feature: 'Create sub task', free: true, pro: true },
    { type: 'row', feature: 'Create task template', free: false, pro: true },
    { type: 'row', feature: 'Duplicate task', free: false, pro: true },
    { type: 'row', feature: 'Set recurring task', free: false, pro: true },
    { type: 'row', feature: 'View workload rebalancing alert', free: false, pro: true },
    { type: 'row', feature: 'View stalled task alert', free: false, pro: true },
    { type: 'row', feature: 'Set task dependencies', free: false, pro: true },

    { type: 'group', label: 'Team / Company' },
    { type: 'row', feature: 'Create department', free: true, pro: true },
    { type: 'row', feature: 'Edit department', free: true, pro: true },
    { type: 'row', feature: 'Delete department', free: true, pro: true },
    { type: 'row', feature: 'Send direct invitation', free: true, pro: true },
    { type: 'row', feature: 'Search members', free: true, pro: true },
    { type: 'row', feature: 'Remove team member', free: true, pro: true },
    { type: 'row', feature: 'Change member department', free: true, pro: true },
    { type: 'row', feature: 'Edit company profile', free: true, pro: true },
    { type: 'row', feature: 'Activate / deactivate casual worker', free: false, pro: true },
    { type: 'row', feature: 'Invite members by CSV', free: false, pro: true },
    { type: 'row', feature: 'Import departments by CSV', free: false, pro: true },

    { type: 'group', label: 'Recruitment' },
    { type: 'row', feature: 'Post job opening', free: true, pro: true },
    { type: 'row', feature: 'Edit job opening', free: true, pro: true },
    { type: 'row', feature: 'Archive job opening', free: true, pro: true },
    { type: 'row', feature: 'Save job posting as draft', free: true, pro: true },
    { type: 'row', feature: 'Set application deadline', free: true, pro: true },
    { type: 'row', feature: 'View applicant list', free: true, pro: true },
    { type: 'row', feature: 'Accept / reject applicant', free: true, pro: true },
    { type: 'row', feature: 'Accept / reject job offer', free: true, pro: true },
    { type: 'row', feature: 'Create job template', free: false, pro: true },
    { type: 'row', feature: 'Duplicate job opening', free: false, pro: true },
    { type: 'row', feature: 'Submit job posting for approval', free: false, pro: true },
    { type: 'row', feature: 'Approve / reject job posting', free: false, pro: true },

    { type: 'group', label: 'Attendance' },
    { type: 'row', feature: 'Clock in / clock out', free: true, pro: true },
    { type: 'row', feature: 'Review attendance record', free: true, pro: true },
    { type: 'row', feature: 'View attendance status', free: true, pro: true },
    { type: 'row', feature: 'Submit shift swap request', free: true, pro: true },
    { type: 'row', feature: 'Approve shift swap request', free: true, pro: true },
    { type: 'row', feature: 'Submit fixed day off', free: true, pro: true },
    { type: 'row', feature: 'Submit leave request', free: true, pro: true },
    { type: 'row', feature: 'Approve leave request', free: true, pro: true },
    { type: 'row', feature: 'Export attendance record', free: false, pro: true },

    { type: 'group', label: 'Communication' },
    { type: 'row', feature: 'Post announcement', free: true, pro: true },
    { type: 'row', feature: 'Edit own announcement', free: true, pro: true },
    { type: 'row', feature: 'Delete own announcement', free: true, pro: true },
    { type: 'row', feature: 'Send direct message', free: true, pro: true },

    { type: 'group', label: 'Report' },
    { type: 'row', feature: 'View workforce analytics', free: false, pro: true },
    { type: 'row', feature: 'Export report as CSV', free: false, pro: true },

    { type: 'group', label: 'Account & Authentication' },
    { type: 'row', feature: 'Register account', free: true, pro: true },
    { type: 'row', feature: 'Sign in', free: true, pro: true },
    { type: 'row', feature: 'Forgot / reset password', free: true, pro: true },
    { type: 'row', feature: 'Email verification', free: true, pro: true },
    { type: 'row', feature: 'Edit own profile', free: true, pro: true },
    { type: 'row', feature: 'Accept company invitation', free: true, pro: true },
    { type: 'row', feature: 'Logout', free: true, pro: true },
  ],
};

export const faqs: { sectionTitle: string; items: { q: string; a: string }[] } = {
  sectionTitle: 'Pricing questions, answered.',
  items: [
    {
      q: 'Is the free plan really free forever?',
      a: 'Yes. No trial period, no expiry date, no credit card required. The free plan gives you full access to core scheduling, task, recruitment, attendance, and communication workflows for as long as you need.',
    },
    {
      q: 'What do I get with the Pro plan?',
      a: 'Pro unlocks advanced automation and AI-powered tools on top of everything in the Free plan — including shift and task templates, recurring shifts and tasks, AI scheduling and assignment suggestions, job posting approval workflows, AI candidate and job description suggestions, CSV imports, and workforce analytics and reporting.',
    },
    {
      q: 'How does Pro pricing work?',
      a: 'The Pro plan is a flat $20 per month for your whole team — no per-user charges. Casual workers are unlimited on both plans.',
    },
    {
      q: 'Can I start on the free plan and upgrade later?',
      a: 'Absolutely. You can start on the free plan and upgrade to Pro at any time. All your existing data, workflows, and settings carry over automatically.',
    },
    {
      q: 'Is there a contract or minimum commitment?',
      a: 'No contracts, no lock-in. The Pro plan is billed monthly and you can cancel at any time.',
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