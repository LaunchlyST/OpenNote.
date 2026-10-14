import { useRef } from 'react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/id'
import { useLandingNav, useRevealEffect } from '../hooks'

/* ------------------------------------------------------------------ */
/* Scroll reveal                                                       */
/* ------------------------------------------------------------------ */

export interface RevealProps {
  children: ReactNode
  /** Stagger, in milliseconds. */
  delay?: number
  className?: string
  as?: ElementType
}

/**
 * Fades content up the first time it scrolls into view.
 *
 * Content is only ever hidden via CSS, and the reduced-motion rules in
 * `index.css` force it visible again — so the page degrades to fully readable
 * if the observer never fires.
 */
export function Reveal({ children, delay = 0, className, as }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useRef<HTMLElement | null>(null)

  useRevealEffect(ref)

  return (
    <Tag
      ref={ref}
      className={cn('lp-reveal', className)}
      style={delay ? ({ animationDelay: `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------------ */
/* Brand                                                               */
/* ------------------------------------------------------------------ */

interface LogoProps {
  className?: string
  /** Wordmark size. */
  size?: 'sm' | 'md' | 'lg'
  /** Hide the wordmark and render the mark alone. */
  markOnly?: boolean
  tone?: 'ink' | 'paper'
}

/**
 * The mark is a page from a planner: an ink tile with a single signal-red
 * "now" line across it. The wordmark pairs the serif with a roman "Note".
 */
export function Logo({ className, size = 'md', markOnly = false, tone = 'ink' }: LogoProps) {
  const mark = { sm: 'h-7 w-7 rounded-[8px]', md: 'h-8 w-8 rounded-[9px]', lg: 'h-11 w-11 rounded-xl' }[size]
  const word = { sm: 'text-[19px]', md: 'text-[22px]', lg: 'text-[28px]' }[size]
  const paper = tone === 'paper'

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'relative grid shrink-0 place-items-center overflow-hidden',
          paper ? 'bg-lp-surface' : 'bg-lp-ink',
          mark,
        )}
      >
        <span className={cn('absolute inset-x-[22%] top-[30%] h-[1.5px] rounded-full', paper ? 'bg-lp-ink/25' : 'bg-white/25')} />
        <span className="absolute inset-x-[22%] top-[49%] h-[2px] rounded-full bg-lp-signal" />
        <span className={cn('absolute inset-x-[22%] top-[68%] h-[1.5px] w-[34%] rounded-full', paper ? 'bg-lp-ink/25' : 'bg-white/25')} />
      </span>
      {!markOnly && (
        <span
          className={cn(
            'font-display leading-none tracking-[-0.01em]',
            paper ? 'text-lp-surface' : 'text-lp-ink',
            word,
          )}
        >
          Open<span className="italic">Note</span>
        </span>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'signal' | 'secondary' | 'ghost' | 'inverse' | 'outline-dark'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_BASE =
  'group/btn relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform,border-color] duration-200 ease-out active:translate-y-px disabled:cursor-not-allowed'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-lp-ink text-lp-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(20,21,15,0.3),0_8px_20px_-8px_rgba(20,21,15,0.5)] hover:bg-lp-ink-3 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(20,21,15,0.3),0_14px_28px_-10px_rgba(20,21,15,0.55)]',
  signal:
    'bg-lp-signal text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_-10px_rgba(255,77,28,0.7)] hover:bg-lp-signal-600',
  secondary:
    'border border-lp-ink/15 bg-lp-surface/70 text-lp-ink backdrop-blur hover:border-lp-ink/35 hover:bg-lp-surface',
  ghost: 'text-lp-body hover:bg-lp-ink/[0.06] hover:text-lp-ink',
  inverse:
    'bg-lp-surface text-lp-ink shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] hover:bg-white',
  'outline-dark':
    'border border-white/20 text-white hover:border-white/45 hover:bg-white/[0.06]',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[14px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-[54px] px-7 text-[16px]',
}

/** Arrow that nudges forward on hover — the only flourish buttons get. */
export function ButtonArrow() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-4 w-4 transition-transform duration-300 ease-out group-hover/btn:translate-x-[3px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

interface CommonButtonProps {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  /** Leading icon. */
  icon?: ReactNode
  /** Trailing arrow. */
  arrow?: boolean
}

type ButtonProps =
  | (CommonButtonProps & {
      /** Internal route, e.g. `/app/signup`. */
      href: string
      section?: never
      onClick?: never
      disabled?: never
    })
  | (CommonButtonProps & {
      /** In-page anchor, e.g. `features`. */
      section: string
      href?: never
      onClick?: never
      disabled?: never
    })
  | (CommonButtonProps & {
      onClick?: () => void
      href?: never
      section?: never
      disabled?: boolean
    })

/**
 * A link when it navigates, a button when it acts. Keeps keyboard and
 * screen-reader semantics correct without duplicating markup at call sites.
 */
export function Button(props: ButtonProps) {
  const { children, variant = 'primary', size = 'md', className, icon, arrow } = props
  const { go, goSection } = useLandingNav()

  const classes = cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)
  const content = (
    <>
      {icon}
      {children}
      {arrow && <ButtonArrow />}
    </>
  )

  if ('href' in props && props.href) {
    return (
      <a
        href={props.href}
        className={classes}
        onClick={(e) => {
          e.preventDefault()
          go(props.href as string)
        }}
      >
        {content}
      </a>
    )
  }

  if ('section' in props && props.section) {
    return (
      <a
        href={`#${props.section}`}
        className={classes}
        onClick={(e) => {
          e.preventDefault()
          goSection(props.section as string)
        }}
      >
        {content}
      </a>
    )
  }

  const onClick = 'onClick' in props ? props.onClick : undefined
  const disabled = 'disabled' in props ? Boolean(props.disabled) : false

  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Section furniture                                                   */
/* ------------------------------------------------------------------ */

/** Monospaced chapter marker, e.g. `02 — Features`. */
export function Eyebrow({
  children,
  index,
  tone = 'light',
}: {
  children: ReactNode
  index?: string
  tone?: 'light' | 'dark'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-3 font-mono text-[12px] tracking-[0.14em] uppercase',
        tone === 'dark' ? 'text-white/60' : 'text-lp-muted',
      )}
    >
      {index && <span className="text-lp-signal">{index}</span>}
      {index && <span aria-hidden="true" className={cn('h-px w-6', tone === 'dark' ? 'bg-white/25' : 'bg-lp-ink/20')} />}
      {children}
    </span>
  )
}

export function SectionHeading({
  eyebrow,
  index,
  heading,
  description,
  align = 'left',
  tone = 'light',
  className,
}: {
  eyebrow?: string
  index?: string
  heading: ReactNode
  description?: string
  align?: 'center' | 'left'
  tone?: 'light' | 'dark'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-5', align === 'center' && 'items-center text-center', className)}>
      {eyebrow && (
        <Eyebrow index={index} tone={tone}>
          {eyebrow}
        </Eyebrow>
      )}
      <h2
        className={cn(
          'max-w-[17ch] font-display text-[clamp(2.5rem,5.6vw,4.4rem)] leading-[0.98] font-normal tracking-[-0.02em]',
          tone === 'dark' ? 'text-lp-surface' : 'text-lp-ink',
          align === 'center' && 'mx-auto',
        )}
      >
        {heading}
      </h2>
      {description && (
        <p
          className={cn(
            'max-w-[52ch] text-[17px] leading-relaxed',
            tone === 'dark' ? 'text-white/65' : 'text-lp-body',
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}

/** Section wrapper with consistent vertical rhythm. */
export function Section({
  id,
  children,
  className,
  innerClassName,
  tone = 'light',
}: {
  id?: string
  children: ReactNode
  className?: string
  innerClassName?: string
  tone?: 'light' | 'muted' | 'dark'
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative scroll-mt-24 px-5 py-24 sm:px-8 md:py-32',
        tone === 'light' && 'bg-lp-bg',
        tone === 'muted' && 'bg-lp-sunken',
        tone === 'dark' && 'bg-lp-ink text-lp-surface',
        className,
      )}
    >
      <div className={cn('mx-auto w-full max-w-[1240px]', innerClassName)}>{children}</div>
    </section>
  )
}

/** A browser frame for product shots. */
export function BrowserFrame({
  children,
  label = 'opennote — calendar',
  tone = 'light',
  className,
}: {
  children: ReactNode
  label?: string
  tone?: 'light' | 'dark'
  className?: string
}) {
  const dark = tone === 'dark'
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[14px] border',
        dark
          ? 'border-white/10 bg-lp-ink-2 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.8)]'
          : 'border-lp-ink/10 bg-lp-surface shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_50px_90px_-40px_rgba(40,30,10,0.35),0_18px_36px_-20px_rgba(40,30,10,0.2)]',
        className,
      )}
    >
      <div className={cn('flex h-9 items-center gap-1.5 border-b px-3.5', dark ? 'border-white/10' : 'border-lp-ink/[0.08]')}>
        <span className={cn('h-2.5 w-2.5 rounded-full', dark ? 'bg-white/15' : 'bg-lp-ink/15')} />
        <span className={cn('h-2.5 w-2.5 rounded-full', dark ? 'bg-white/15' : 'bg-lp-ink/15')} />
        <span className={cn('h-2.5 w-2.5 rounded-full', dark ? 'bg-white/15' : 'bg-lp-ink/15')} />
        <span
          className={cn(
            'mx-auto truncate rounded-md px-3 py-0.5 font-mono text-[10.5px]',
            dark ? 'bg-white/5 text-white/45' : 'bg-lp-ink/[0.05] text-lp-muted',
          )}
        >
          {label}
        </span>
        <span className="w-[42px]" aria-hidden="true" />
      </div>
      {children}
    </div>
  )
}
