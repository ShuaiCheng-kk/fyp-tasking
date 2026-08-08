// ─── Pricing page content ─────────────────────────────────────────────────────

export const hero = {
  label: 'Pricing',
  headline: 'Transparent pricing. Zero surprises.',
  subheadline: 'Start for free. Scale as you grow. Get full access to all core workflows.',
};

export const plans = {
  sectionTitle: 'Find the plan that fits your team.',
  sectionSubtitle: 'Two plans. Zero hidden fees.',
  free: {
    name: 'Free',
    price: '$0',
    priceSub: '/ month',
    tagline: 'Everything you need to get started.',
    badge: 'Free Forever',
    featuresIntro: 'Core tools to run your workforce:',
    features: [
      'Shift Scheduling & Publishing',
      'Task Assignment & Workload Alerts',
      'Team & Department Management',
      'Job Posting & Applicant Management',
      'Attendance & Leave Management',
      'Team Communication',
    ],
    cta: 'Get Started Free',
    ctaHref: '/get-started',
  },
  pro: {
    name: 'Pro',
    price: '$20',
    priceSub: '/ month',
    tagline: 'For teams that need more control.',
    badge: 'Most Popular',
    featuresIntro: 'Everything in Free, plus:',
    features: [
      'AI Schedule Suggestions',
      'AI Task Assignment Suggestions',
      'AI Job Description Suggestions',
      'AI Candidate Recommendations',
      'AI Anomaly Detection',
      'Workforce Analytics',
    ],
    cta: 'Get Started',
    ctaHref: '/get-started',
  },
};

export type ComparisonFeature = { feature: string; free: boolean; pro: boolean };
export type ComparisonModule = { title: string; rows: ComparisonFeature[] };

export const comparisonTable: {
  sectionTitle: string;
  sectionSubtitle: string;
  modules: ComparisonModule[];
} = {
  sectionTitle: 'Compare our plans',
  sectionSubtitle: "See exactly what's included in each plan.",
  modules: [
    {
      title: 'Shift Management',
      rows: [
        { feature: 'Create Shift', free: true, pro: true },
        { feature: 'Create Shift Template', free: false, pro: true },
        { feature: 'Edit Shift', free: true, pro: true },
        { feature: 'Delete Shift', free: true, pro: true },
        { feature: 'Publish Shift', free: true, pro: true },
        { feature: 'Duplicate Shift', free: false, pro: true },
        { feature: 'Set Recurring Shift', free: false, pro: true },
        { feature: 'Create Split Shift', free: true, pro: true },
        { feature: 'Bulk Edit Shifts', free: false, pro: true },
        { feature: 'Generate AI Schedule Suggestion', free: false, pro: true },
      ],
    },
    {
      title: 'Task Management',
      rows: [
        { feature: 'Assign Task', free: true, pro: true },
        { feature: 'Edit Task', free: true, pro: true },
        { feature: 'Create Task Template', free: false, pro: true },
        { feature: 'Delete Task', free: true, pro: true },
        { feature: 'Duplicate Task', free: false, pro: true },
        { feature: 'Set Recurring Task', free: false, pro: true },
        { feature: 'Archive Task', free: true, pro: true },
        { feature: 'Create Sub Task', free: false, pro: true },
        { feature: 'Generate AI Task Assignment Suggestion', free: false, pro: true },
        { feature: 'Rebalance Task Workload', free: true, pro: true },
        { feature: 'Set Task Dependencies', free: false, pro: true },
      ],
    },
    {
      title: 'Company Management',
      rows: [
        { feature: 'Create Department', free: true, pro: true },
        { feature: 'Edit Department', free: true, pro: true },
        { feature: 'Delete Department', free: true, pro: true },
        { feature: 'Send Direct Invitation', free: true, pro: true },
        { feature: 'Search Members', free: true, pro: true },
        { feature: 'Activate Casual Worker', free: false, pro: true },
        { feature: 'Deactivate Casual Worker', free: false, pro: true },
        { feature: 'Remove Team Member', free: true, pro: true },
        { feature: 'Change Member Department', free: true, pro: true },
        { feature: 'Invite Members by CSV', free: false, pro: true },
        { feature: 'Import Departments by CSV', free: false, pro: true },
        { feature: 'Edit Company Profile', free: true, pro: true },
      ],
    },
    {
      title: 'Recruitment',
      rows: [
        { feature: 'Publish Job Opening', free: true, pro: true },
        { feature: 'Create Job Template', free: false, pro: true },
        { feature: 'Edit Job Template', free: false, pro: true },
        { feature: 'Archive Job Opening', free: true, pro: true },
        { feature: 'Duplicate Draft Job', free: false, pro: true },
        { feature: 'Save Job as Draft', free: true, pro: true },
        { feature: 'Submit Job Posting for Approval', free: true, pro: true },
        { feature: 'Approve Job Posting', free: true, pro: true },
        { feature: 'Reject Job Posting', free: true, pro: true },
        { feature: 'Set Application Deadline', free: true, pro: true },
        { feature: 'Accept Applicant', free: true, pro: true },
        { feature: 'Reject Applicant', free: true, pro: true },
        { feature: 'Accept Job Offer', free: true, pro: true },
        { feature: 'Reject Job Offer', free: true, pro: true },
        { feature: 'Generate AI Job Description Suggestion', free: false, pro: true },
        { feature: 'Recommend Candidates via AI', free: false, pro: true },
      ],
    },
    {
      title: 'Attendance',
      rows: [
        { feature: 'Clock In', free: true, pro: true },
        { feature: 'Clock Out', free: true, pro: true },
        { feature: 'Break In', free: true, pro: true },
        { feature: 'Break Out', free: true, pro: true },
        { feature: 'Submit Shift Swap Request', free: true, pro: true },
        { feature: 'Approve Shift Swap Request', free: true, pro: true },
        { feature: 'Reject Shift Swap Request', free: true, pro: true },
        { feature: 'Submit Day Off Request', free: true, pro: true },
        { feature: 'Approve Day Off Request', free: true, pro: true },
        { feature: 'Modify Day Off Request', free: true, pro: true },
        { feature: 'Modify Clock Time', free: true, pro: true },
        { feature: 'Generate AI Day Off Suggestion', free: false, pro: true },
      ],
    },
    {
      title: 'Communication',
      rows: [
        { feature: 'Post Announcement', free: true, pro: true },
        { feature: 'Edit Announcement', free: true, pro: true },
        { feature: 'Delete Announcement', free: true, pro: true },
        { feature: 'Send Direct Message', free: true, pro: true },
      ],
    },
    {
      title: 'Reports & Insights',
      rows: [
        { feature: 'Generate Workforce Analytics Report', free: false, pro: true },
        { feature: 'Generate AI Report Insight', free: false, pro: true },
        { feature: 'Export Report', free: false, pro: true },
      ],
    },
  ],
};

export const faqs: { sectionTitle: string; items: { q: string; a: string }[] } = {
  sectionTitle: 'Pricing FAQs',
  items: [
    {
      q: 'Can I change or upgrade my plan anytime?',
      a: 'Yes. You can upgrade from Free to Pro at any time, and all your existing data, workflows, and settings carry over automatically. There are no contracts or lock-in, so you can cancel anytime too.',
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept all major credit and debit cards, processed securely through Stripe.',
    },
    {
      q: 'How does pricing work for team members?',
      a: 'The Pro plan is a flat $20 per month for your whole team, not billed per user. Casual workers are unlimited on both the Free and Pro plans.',
    },
  ],
};

export const cta = {
  headline: 'Start free. No commitment.',
  subheadline:
    'Join SMEs already using Tasking to manage their casual workforce — smarter, faster, and without the admin burden.',
  primaryLabel: 'Get Started Free',
  primaryHref: '/get-started',
  footnote: 'No credit card required. Cancel anytime.',
};