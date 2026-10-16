/**
 * Central content configuration for the public landing page.
 *
 * Everything the marketing page says about the product lives here so it can be
 * edited in one place — in particular the pricing plans, which are temporary
 * and still subject to confirmation. Nothing in this file is wired to a
 * payment provider: the pricing section is presentation only.
 *
 * Copy rule: only describe what the shipped app does today. No testimonials,
 * user counts, awards or integrations that do not exist.
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
  eyebrow: 'Calendar & notes, side by side',
  titleLead: 'Plan the day.',
  titleEmphasis: 'Keep the thought.',
  description:
    'OpenNote is a calendar with your notes built in. Plan by day, week or month, and keep every note next to the day it belongs to.',
  primaryCta: { label: 'Start Planning Free', href: '/app/signup' },
  secondaryCta: { label: 'See it in action', section: 'preview' },
  authenticatedCta: { label: 'Open My Calendar', href: '/app' },
  signInCta: { label: 'Sign In', href: '/app/signin' },
  /** Small trust strip under the buttons — every item is true of the Free plan. */
  reassurance: ['Free plan, no card required', 'Day, week & month views', 'Built for desktop'],
} as const

/** Facts strip under the hero showcase. Descriptive, never numerical claims. */
export const HERO_FACTS = [
  { label: 'Views', value: 'Day · Full Week · Month' },
  { label: 'Calendars', value: 'Work · Personal · Study · Social' },
  { label: 'Notes', value: 'Pinned to the day they belong to' },
  { label: 'Price', value: 'Free plan, free forever' },
] as const

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

export interface Step {
  number: string
  title: string
  description: string
  detail: string
}

export const HOW_IT_WORKS = {
  eyebrow: 'How it works',
  heading: 'From a blank week to a plan.',
  description:
    'No setup and no learning curve. If you have used a paper diary, you already know how OpenNote works.',
  steps: [
    {
      number: '01',
      title: 'Pick the day',
      description:
        'Jump to any date from the mini calendar, or step through days, weeks and months with the arrows.',
      detail: 'Mini calendar · Today button',
    },
    {
      number: '02',
      title: 'Block the time',
      description:
        'Give an event a title, a calendar, a date and a start and end time. It lands on the grid in its colour.',
      detail: 'Title · Calendar · Start & end',
    },
    {
      number: '03',
      title: 'Pin the thought',
      description:
        'Write a note in the side panel and pin it to a day. It sits beside your schedule instead of in another app.',
      detail: 'Notes panel · Pin to day',
    },
  ] satisfies Step[],
} as const

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

/**
 * Only capabilities that exist in the shipped app are listed here. Planned or
 * unimplemented behaviour deliberately has no feature entry.
 */
export const FEATURES = {
  eyebrow: 'Features',
  heading: 'Built around how a day actually unfolds.',
  description:
    'Plan your time and keep your notes in the same place, so nothing important lives in a different app.',
  notes: {
    kicker: 'Notes beside the calendar',
    title: 'The thought stays next to the plan.',
    body: 'Lists, call-backs and ideas live in a notes panel beside your schedule. Pin a note to a date and it stays with that day.',
    points: ['Notes panel on every view', 'Pin a note to any day', 'Edit in place — no extra app'],
  },
  categories: {
    kicker: 'Colour-coded calendars',
    title: 'See the shape of your week in colour.',
    body: 'Work, Personal, Study and Social each get their own colour. Switch them on and off to focus. Try it here.',
  },
  daily: {
    kicker: 'Daily schedules',
    title: 'Hour by hour, without the clutter.',
    body: 'Day view lays out events on a clean timeline with a start and an end, so the day reads like a plan instead of a list.',
  },
  compact: [
    {
      id: 'month',
      title: 'Month at a glance',
      body: 'Every event in the month on a single grid, in its calendar colour.',
    },
    {
      id: 'navigate',
      title: 'Move through time',
      body: 'Previous, next and Today. Switch between Day, Full Week and Month in one click.',
    },
    {
      id: 'create',
      title: 'Create in seconds',
      body: 'Title, calendar, date, start and end — then Add event. That is the whole form.',
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
  /** Shown once under the grid, covering all three plans at once. */
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
        { label: 'Personal calendar', status: 'available' },
        { label: 'Day, week, and month views', status: 'available' },
        { label: 'Create and manage events', status: 'available' },
        { label: 'Basic notes', status: 'available' },
        { label: 'Daily scheduling', status: 'available' },
        { label: 'Colour-coded calendars', status: 'available' },
        { label: 'Desktop access in your browser', status: 'available' },
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
      badge: 'Coming Soon',
      features: [
        { label: 'Everything in Free', status: 'available' },
        { label: 'Unlimited notes', status: 'planned' },
        { label: 'Unlimited calendar events', status: 'planned' },
        { label: 'Advanced event organisation', status: 'planned' },
        { label: 'Custom calendar categories', status: 'planned' },
        { label: 'Enhanced note management', status: 'planned' },
        { label: 'Priority access to future Pro features', status: 'planned' },
      ],
      cta: {
        label: 'Coming Soon',
        kind: 'unavailable',
        note: 'OpenNote Pro isn’t available yet. Nothing can be purchased and you won’t be charged.',
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
        { label: 'Everything in Pro', status: 'planned' },
        { label: 'Shared team calendars', status: 'planned' },
        { label: 'Team member management', status: 'planned' },
        { label: 'Collaborative scheduling', status: 'planned' },
        { label: 'Task assignments', status: 'planned' },
        { label: 'Business workspace', status: 'planned' },
        { label: 'Team productivity overview', status: 'planned' },
        { label: 'Advanced permissions', status: 'planned' },
        { label: 'More business tools coming soon', status: 'planned' },
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
  heading: 'Questions & answers',
  items: [
    {
      question: 'What is OpenNote?',
      answer:
        'OpenNote is an all-in-one platform to manage your business, organise schedules, track tasks, and keep everything in one place.',
    },
    {
      question: 'Is OpenNote free?',
      answer: 'Yes. OpenNote offers a Free plan for everyday planning.',
    },
    {
      question: 'What does OpenNote Pro include?',
      answer:
        'OpenNote Pro will include advanced business tools, better team communication, and smarter workplace management features.',
    },
    {
      question: 'How much does OpenNote Pro cost?',
      answer:
        'Pricing details are coming soon. Stay tuned!',
    },
    {
      question: 'Is OpenNote Pro a monthly subscription?',
      answer:
        'OpenNote Pro will offer a monthly subscription with access to premium business tools, advanced features, and regular updates.',
    },
    {
      question: 'Can I use OpenNote on my phone?',
      answer:
        'No. OpenNote is designed for desktop only.',
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
  headingLead: 'Get OpenNote',
  headingEmphasis: 'for free.',
  description:
    'Your schedule, plans and notes in one place. The Free plan stays free.',
  primary: { label: 'Start Planning for Free', href: '/app/signup' },
  secondary: { label: 'Sign In', href: '/app/signin' },
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
        { label: 'Preview', section: 'preview' },
        { label: 'Pricing', section: 'pricing' },
        { label: 'FAQ', section: 'faq' },
      ],
    },
    {
      heading: 'Account',
      links: [
        { label: 'Sign In', href: '/app/signin' },
        { label: 'Create an account', href: '/app/signup' },
        { label: 'Open calendar', href: '/app' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        {
          label: 'Privacy Policy',
          unavailableNote: 'Coming before launch',
        },
        {
          label: 'Terms of Service',
          unavailableNote: 'Coming before launch',
        },
      ],
    },
  ] satisfies FooterColumn[],
} as const
