/**
 * Central content configuration for the public landing page.
 *
 * Everything the marketing page says about the product lives here so it can be
 * edited in one place — in particular the pricing plans, which are temporary
 * and still subject to confirmation. Nothing in this file is wired to a
 * payment provider: the pricing section is presentation only.
 */

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export interface NavLink {
  label: string
  /** In-page anchor id on the landing page. */
  section: string
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Features', section: 'features' },
  { label: 'How It Works', section: 'how-it-works' },
  { label: 'Preview', section: 'preview' },
  { label: 'Pricing', section: 'pricing' },
  { label: 'FAQ', section: 'faq' },
]

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export const HERO = {
  eyebrow: 'Calendar + Notes, in one place',
  title: 'Your day, beautifully under control.',
  description:
    'One beautiful space for your calendar, notes, and daily plans. Organise your time, stay focused, and make every day feel effortless.',
  primaryCta: { label: 'Start Planning Free', href: '/app/signup' },
  secondaryCta: { label: 'Explore Features', section: 'features' },
  authenticatedCta: { label: 'Open My Calendar', href: '/app' },
  signInCta: { label: 'Sign In', href: '/app/signin' },
  /** Skips sign-up and drops straight into the calendar (works signed out). */
  dashboardCta: { label: 'Open dashboard', href: '/app' },
  /** Small trust strip under the buttons. */
  reassurance: [
    'Free forever plan',
    'Day, week & month views',
    'No card required',
  ],
} as const

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

export interface Step {
  number: string
  icon: 'calendar' | 'clock' | 'notes'
  title: string
  description: string
}

export const HOW_IT_WORKS = {
  eyebrow: 'How OpenNote works',
  heading: 'A simpler way to plan your day.',
  description:
    'Three small steps, and the whole day makes sense at a glance.',
  steps: [
    {
      number: '01',
      icon: 'calendar',
      title: 'Choose Your Day',
      description:
        'Navigate your calendar and find the perfect time for everything that matters.',
    },
    {
      number: '02',
      icon: 'clock',
      title: 'Plan Your Time',
      description:
        'Create events and organise your activities into clear, manageable time slots.',
    },
    {
      number: '03',
      icon: 'notes',
      title: 'Keep Your Notes Together',
      description:
        'Write down ideas, save important details, and pin notes to your day.',
    },
  ] satisfies Step[],
} as const

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

export interface FeatureItem {
  id: string
  icon: string
  title: string
  description: string
  /** Tailwind grid span for the bento layout (12-column grid at `lg`). */
  colClass: string
  visual: 'week' | 'event' | 'notes' | 'colours' | 'day' | 'nav'
  /** Soft background wash used behind each card's visual. */
  wash: string
}

/**
 * Only capabilities that exist in the shipped app are listed here. Planned or
 * unimplemented behaviour deliberately has no feature card.
 */
export const FEATURES = {
  eyebrow: 'Features',
  heading: "Everything you need. Nothing you don't.",
  description:
    'Your plans, calendar and notes — together in one beautifully simple workspace.',
  items: [
    {
      id: 'calendar',
      icon: 'calendar',
      title: 'Beautiful Calendar',
      description:
        'Organise your schedule using day, week, and month views.',
      colClass: 'lg:col-span-7',
      visual: 'week',
      wash: 'from-lp-lime/70',
    },
    {
      id: 'time-based',
      icon: 'clock',
      title: 'Time-Based Planning',
      description: 'Create events for specific dates and times.',
      colClass: 'lg:col-span-5',
      visual: 'event',
      wash: 'from-lp-blue/70',
    },
    {
      id: 'notes',
      icon: 'notes',
      title: 'Notes and Ideas',
      description: 'Keep important information beside your calendar.',
      colClass: 'lg:col-span-4',
      visual: 'notes',
      wash: 'from-lp-yellow/70',
    },
    {
      id: 'colours',
      icon: 'palette',
      title: 'Colour-Coded Calendars',
      description:
        'Separate Work, Personal, Study, and Social activities using different colours.',
      colClass: 'lg:col-span-4',
      visual: 'colours',
      wash: 'from-lp-pink/70',
    },
    {
      id: 'daily',
      icon: 'sun',
      title: 'Daily Planning',
      description: "Quickly see what's scheduled for your day.",
      colClass: 'lg:col-span-4',
      visual: 'day',
      wash: 'from-lp-orange/70',
    },
    {
      id: 'navigation',
      icon: 'compass',
      title: 'Easy Navigation',
      description: 'Move smoothly between dates and calendar views.',
      colClass: 'lg:col-span-12',
      visual: 'nav',
      wash: 'from-lp-purple/70',
    },
  ] satisfies FeatureItem[],
} as const

/* ------------------------------------------------------------------ */
/* Why OpenNote                                                        */
/* ------------------------------------------------------------------ */

export const WHY = {
  eyebrow: 'Why OpenNote',
  heading: 'Less chaos. More clarity.',
  description:
    'Your calendar and notes should work together, not live in separate places.',
  benefits: [
    {
      title: 'One organised workspace',
      body: 'Your schedule and your notes sit side by side instead of in two apps.',
    },
    {
      title: 'Simple daily planning',
      body: 'Open the current time block and see exactly what is coming up.',
    },
    {
      title: 'Clear schedules',
      body: 'Events carry a start and an end, so a day reads like a plan.',
    },
    {
      title: 'Notes beside your calendar',
      body: 'Pin a note to a date and it appears on the timeline with your events.',
    },
    {
      title: 'Less clutter',
      body: 'Thin lines, calm surfaces, and colour used only where it carries meaning.',
    },
    {
      title: 'More control over your time',
      body: 'Move between days and views until the shape of the week feels right.',
    },
  ],
} as const

/* ------------------------------------------------------------------ */
/* Pricing — TEMPORARY. Edit here, nowhere else.                       */
/* ------------------------------------------------------------------ */

/**
 * `status` drives how a line is rendered:
 *   available → ticked normally
 *   planned   → ticked, but explicitly labelled as not yet shipped
 *
 * No plan in this file is purchasable. `cta.kind` is deliberately limited to
 * navigation, an unavailable state, or a hard-disabled state.
 */
export type FeatureStatus = 'available' | 'planned'

export interface PlanFeature {
  label: string
  status: FeatureStatus
}

export type CtaKind = 'signup' | 'unavailable' | 'disabled'

export interface Plan {
  id: 'free' | 'pro' | 'business'
  name: string
  tagline: string
  description: string
  /** `amount: null` renders the status word instead of a figure. */
  price: {
    amount: number | null
    currency: string
    /** Shown next to the figure. Intentionally neutral — billing period is unconfirmed. */
    period: string
    /** Small print under the figure. */
    footnote: string
  }
  badge?: string
  features: PlanFeature[]
  cta: {
    label: string
    kind: CtaKind
    /** Rendered under the button when the plan cannot be bought yet. */
    note?: string
  }
  /** Extra reassurance shown at the bottom of the card. */
  footnote?: string
  featured?: boolean
  /** Visual treatment: neutral card, lime-accented, or charcoal. */
  theme: 'neutral' | 'lime' | 'charcoal'
}

export const PRICING = {
  eyebrow: 'Pricing',
  heading: 'Simple plans. Better planning.',
  subtitle:
    'Start for free, unlock more when you’re ready, and grow with OpenNote.',
  /** Shown on the Pro card, where it is most relevant. */
  membershipNote:
    'Already a member of our main platform? OpenNote Pro may be included with your membership.',
  /** Shonce under the grid, covering all three plans at once. */
  billingNote:
    'Prices shown are introductory and not yet final. Billing periods, Pro availability and membership integration will be announced before anything is charged.',
  plans: [
    {
      id: 'free',
      name: 'Free',
      tagline: '£0 — Free Forever',
      description: 'Your everyday planning essentials, completely free.',
      price: {
        amount: 0,
        currency: '£',
        period: 'forever',
        footnote: 'Free for as long as you need it.',
      },
      features: [
        { label: 'Personal calendar planning', status: 'available' },
        { label: 'Day, Week and Month views', status: 'available' },
        { label: 'Create and manage events', status: 'available' },
        { label: 'Organise your daily schedule', status: 'available' },
        { label: 'Essential notes and planning', status: 'available' },
        { label: 'Get started at no cost', status: 'available' },
      ],
      cta: { label: 'Get Started Free', kind: 'signup' },
      theme: 'neutral',
    },
    {
      id: 'pro',
      name: 'OpenNote Pro',
      tagline: '£9 — Introductory Price',
      description: 'More freedom to plan, organise, and stay productive.',
      price: {
        amount: 9,
        currency: '£',
        period: 'introductory price',
        footnote:
          'This price is temporary. Billing period and terms will be confirmed before launch.',
      },
      badge: 'Most Popular',
      features: [
        { label: 'Everything in Free', status: 'available' },
        { label: 'Enhanced calendar organisation', status: 'planned' },
        { label: 'Plan work, study and personal life', status: 'planned' },
        { label: 'Organise notes alongside your schedule', status: 'planned' },
        { label: 'A more complete planning workspace', status: 'planned' },
        { label: 'Access included for eligible website members', status: 'planned' },
      ],
      cta: {
        label: 'Get OpenNote Pro',
        kind: 'unavailable',
        note: 'Payments coming soon — checkout is not switched on yet.',
      },
      featured: true,
      theme: 'lime',
    },
    {
      id: 'business',
      name: 'OpenNote Business',
      tagline: 'Coming Soon',
      description:
        'Smarter scheduling and organisation for growing teams and businesses.',
      price: {
        amount: null,
        currency: '£',
        period: '',
        footnote: 'Pricing has not been set.',
      },
      badge: 'Built for Teams',
      features: [
        { label: 'Designed for growing businesses', status: 'planned' },
        { label: 'Team calendars and shared planning', status: 'planned' },
        { label: 'Organise projects and deadlines', status: 'planned' },
        { label: 'Business scheduling tools', status: 'planned' },
        { label: 'Collaborative workspace features', status: 'planned' },
        { label: 'More powerful productivity tools', status: 'planned' },
      ],
      cta: { label: 'Coming Soon', kind: 'disabled' },
      footnote: 'These capabilities are planned and not yet available.',
      theme: 'charcoal',
    },
  ] satisfies Plan[],
} as const

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

export interface FaqItem {
  question: string
  answer: string
}

export const FAQ = {
  eyebrow: 'FAQ',
  heading: 'Questions, answered.',
  items: [
    {
      question: 'What is OpenNote?',
      answer:
        'OpenNote is a calendar and notes workspace designed to help organise daily schedules, events, and ideas.',
    },
    {
      question: 'Is OpenNote free?',
      answer: 'Yes. OpenNote offers a Free plan for everyday planning.',
    },
    {
      question: 'What does OpenNote Pro include?',
      answer:
        'Pro is planned to provide additional organisation and customisation features. Its final feature set will be confirmed later.',
    },
    {
      question: 'How much does OpenNote Pro cost?',
      answer:
        'The currently proposed introductory price is £9. Final billing details will be announced later.',
    },
    {
      question: 'Is OpenNote included with my existing membership?',
      answer:
        'Eligible members of our main platform are planned to receive OpenNote Pro at no additional cost. Integration details will be announced later.',
    },
    {
      question: 'Can I use OpenNote on my phone?',
      answer:
        'OpenNote is being designed to work across desktop, tablet, and mobile devices.',
    },
    {
      question: 'When is OpenNote Business launching?',
      answer:
        'OpenNote Business is coming soon. Its release date has not been announced.',
    },
  ] satisfies FaqItem[],
} as const

/* ------------------------------------------------------------------ */
/* Final CTA + footer                                                  */
/* ------------------------------------------------------------------ */

export const FINAL_CTA = {
  heading: 'Make room for what matters.',
  description:
    'Spend less time figuring out your schedule and more time making the most of your day.',
  primary: { label: 'Start Planning Free', href: '/app/signup' },
  secondary: { label: 'Explore OpenNote', section: 'preview' },
} as const

export interface FooterLink {
  label: string
  href?: string
  section?: string
  /**
   * Rendered as plain text instead of a link. Used where the destination does
   * not exist yet, so the page never shows a dead link.
   */
  unavailableNote?: string
}

export interface FooterColumn {
  heading: string
  links: FooterLink[]
}

export const FOOTER = {
  description:
    'A calendar and notes workspace for people who want their day to make sense.',
  columns: [
    {
      heading: 'Product',
      links: [
        { label: 'Features', section: 'features' },
        { label: 'How It Works', section: 'how-it-works' },
        { label: 'Pricing', section: 'pricing' },
      ],
    },
    {
      heading: 'Account',
      links: [
        { label: 'Sign In', href: '/app/signin' },
        { label: 'Get Started Free', href: '/app/signup' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        {
          label: 'Privacy Policy',
          unavailableNote: 'Not published yet — this page is not ready.',
        },
        {
          label: 'Terms of Service',
          unavailableNote: 'Not published yet — this page is not ready.',
        },
      ],
    },
    {
      heading: 'Support',
      links: [
        {
          label: 'Contact',
          unavailableNote: 'Support details will be added before launch.',
        },
      ],
    },
  ] satisfies FooterColumn[],
} as const