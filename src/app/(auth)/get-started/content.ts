export const step1 = {
  headline: "Let's get you set up.",
  subheadline: 'How would you like to get started?',
  ownerCard: {
    icon: 'Building2' as const,
    title: "I'm a Business Owner",
    body: 'Set up your company on Tasking and start managing your casual workforce.',
  },
  invitedCard: {
    icon: 'UserPlus' as const,
    title: 'I have an invitation code',
    body: 'Join your company on Tasking using the invitation code sent to you.',
  },
}

export const ownerStep2 = {
  headline: 'Create your account',
  subheadline: "You'll use this to sign in to Tasking.",
  button: 'Create Account',
}

export const ownerStep3 = {
  headline: 'Tell us about your company',
  subheadline: 'This helps your team identify your organisation on Tasking.',
  button: 'Save & Continue',
}

export const ownerStep4 = {
  headline: 'Create your first department',
  subheadline: 'Departments help you organise your team. You can add more later.',
  addAnotherLabel: '+ Add another department',
  button: 'Save & Continue',
}

export const ownerStep5 = {
  headline: 'Choose your plan',
  subheadline: 'Start free and upgrade anytime. No commitment required.',
  footnote: 'You can change your plan at any time from your dashboard settings.',
  freePlan: {
    badge: 'Free Forever',
    price: '$0',
    priceSub: '/ month',
    features: [
      'Full core workflow access',
      'All user roles included',
      'Unlimited casual workers',
      'All 4 AI features included',
      'Photo-based clock-in verification',
      'Smart notifications',
    ],
    button: 'Start with Free',
  },
  proPlan: {
    badge: 'Most Popular',
    price: '$6',
    priceSub: '/ user / month',
    featuresIntro: 'Everything in Free, plus:',
    features: [
      'Split shift timeline',
      'Clopening detection',
      'Advanced scheduling controls',
      'Skills & availability management',
      'CW performance history',
      'Compliance enforcement',
    ],
    button: 'Choose Pro',
    successMessage:
      'Great choice! Our team will reach out to you within 24 hours to complete your Pro subscription setup.',
    successButton: 'Go to Dashboard',
  },
}

export const invitedStep2 = {
  headline: 'Create your account',
  subheadline: "You'll use this to sign in to Tasking.",
  button: 'Create Account',
}

export const invitedStep3 = {
  headline: 'Enter your invitation code',
  subheadline: 'Your manager or owner should have shared this code with you.',
  codeHelp: 'Code not working? Contact the person who invited you.',
  button: 'Join Now',
}

export const legalText =
  'By continuing, you agree to our Terms of Service and Privacy Policy'
