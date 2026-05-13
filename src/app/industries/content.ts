export const hero = {
  headline: 'One platform. Every industry.',
  subheadline:
    'Whether you\'re running a retail floor, a restaurant, a warehouse, or an event — Tasking is built to handle the way your workforce actually operates. No industry-specific version required.',
  cta: 'Get Started Free',
};

export const intro = {
  title: 'The workforce challenge looks different in every industry. The solution doesn\'t.',
  body: 'Every business that relies on casual workers faces the same core problems — finding the right people fast, confirming they showed up, and keeping the whole operation running without constant manual effort. Tasking solves all of it, regardless of what industry you\'re in.',
};

export type Industry = {
  id: string;
  badge: string;
  question: string;
  painPoint: string;
  solutionHeading: string;
  solution: string;
};

export const industries: Industry[] = [
  {
    id: 'retail',
    badge: 'Retail',
    question: 'Still scrambling to fill shifts when the weekend rush hits?',
    painPoint:
      'Retail doesn\'t wait. Peak hours, holiday seasons, and last-minute no-shows create constant chaos — and most managers are still coordinating through WhatsApp and spreadsheets while the floor falls apart around them.',
    solutionHeading: 'How Tasking helps',
    solution:
      'Tasking gives retail managers a public recruitment page to fill shifts fast, photo-verified clock-ins to confirm who actually showed up, and AI anomaly detection to flag irregular attendance before it hits the floor. When a casual worker goes quiet, the system chases them for you — so you\'re never caught short-staffed on your busiest day.',
  },
  {
    id: 'fnb',
    badge: 'Food & Beverage',
    question: 'How many times have you started a service one person short?',
    painPoint:
      'F&B runs on tight margins and tighter schedules. Split shifts, back-to-back clopening conflicts, and last-minute cancellations are daily realities — and one missed confirmation can throw off an entire service before it even begins.',
    solutionHeading: 'How Tasking helps',
    solution:
      'With split shift timeline visualisation and clopening detection built in, Tasking helps F&B managers schedule smarter and protect their team from burnout. Recurring job postings mean you\'re not recreating the same roles every week, and the 12-hour acceptance deadline ensures every shift is confirmed well before the first table is seated.',
  },
  {
    id: 'logistics',
    badge: 'Logistics',
    question: 'What happens to your delivery chain when one worker doesn\'t show up?',
    painPoint:
      'Logistics runs on precision. A no-show doesn\'t just cause inconvenience — it delays entire operations downstream. Manual tracking can\'t keep up with the speed and scale that logistics demands, and by the time you notice something\'s wrong, it\'s already too late.',
    solutionHeading: 'How Tasking helps',
    solution:
      'Photo-based clock-in verification ensures every worker is physically present before a shift begins. AI auto-approve timesheets clear clean records instantly, while anomaly detection flags anything suspicious the moment it appears. Managers get notified the second an attendance record is submitted — keeping operations moving without a single manual follow-up.',
  },
  {
    id: 'event-management',
    badge: 'Event Management',
    question: 'Got three days to staff an entire event. Sound familiar?',
    painPoint:
      'Events are one-time, high-stakes operations. You need the right people, in the right roles, at the right time — and you\'re usually working against a deadline that doesn\'t move. Coordinating dozens of casual workers across multiple roles with no central system isn\'t just stressful. It\'s a liability.',
    solutionHeading: 'How Tasking helps',
    solution:
      'Tasking\'s public recruitment portal lets event managers post multiple roles and receive applications instantly — no account needed for applicants to browse and apply. AI candidate recommendation ranks applicants by fit so you always shortlist the best people first, sub-tasks let you assign specific duties within each shift, and automatic notifications keep your entire crew aligned from briefing to wrap.',
  },
];

export const closing = {
  title: 'Different industry. Same result.',
  body: 'Less time coordinating. Fewer no-shows. A casual workforce that runs itself — so you can focus on what actually grows your business.',
};

export const cta = {
  headline: 'Ready to see Tasking in your industry?',
  subheadline:
    'Join SMEs across retail, F&B, logistics, and events already using Tasking to manage their casual workforce.',
  primaryBtn: 'Get Started Free',
  secondaryBtn: 'View Pricing',
  footnote: 'No credit card required. Free forever.',
};
