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
  subheadline: '',
  button: 'Create Account',
}

export const ownerStep3 = {
  headline: 'Your company',
  subheadline: '',
  button: 'Save & Continue',
}

export const ownerStep4 = {
  headline: 'Create department',
  subheadline: '',
  addAnotherLabel: '+ Add department',
  button: 'Save & Continue',
}

export const ownerStep5 = {
  headline: 'Choose your plan',
  subheadline: '',
  footnote: '',
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
    price: '$20',
    priceSub: '/ month',
    featuresIntro: 'Everything in Free, plus:',
    features: [
      'Split shift timeline',
      'Clopening detection',
      'Advanced scheduling controls',
      'Skills & availability management',
      'CW performance history',
    ],
    button: 'Choose Pro',
    successMessage:
      'You\'re all set! Your Pro account has been activated. Sign in to start using Tasking.',
    successButton: 'Sign in',
  },
}

export const invitedStep2 = {
  headline: 'Create your account',
  subheadline: '',
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
