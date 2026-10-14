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

/** The OpenNote app icon: a calendar page with a folded note corner. */
export function AppIcon({ className, day = '8' }: { className?: string; day?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex flex-col overflow-hidden rounded-[22%] border-[1.5px] border-lp-ink bg-white',
        className,
      )}
    >
      <span className="h-[26%] w-full bg-lp-ink" />
      <span className="grid flex-1 place-items-center font-semibold leading-none tracking-[-0.04em] text-lp-ink" style={{ fontSize: '0.5em' }}>
        {day}
      </span>
      <span className="absolute right-0 bottom-0 h-[30%] w-[30%] rounded-tl-[30%] border-t-[1.5px] border-l-[1.5px] border-lp-ink bg-[#bef264]" />
    </span>
  )
}

export function Logo({ className, size = 'md', markOnly = false, tone = 'ink' }: LogoProps) {
  const mark = { sm: 'h-6 w-6 text-[24px]', md: 'h-7 w-7 text-[28px]', lg: 'h-9 w-9 text-[36px]' }[size]
  const word = { sm: 'text-[15px]', md: 'text-[16.5px]', lg: 'text-[19px]' }[size]

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <AppIcon className={mark} />
      {!markOnly && (
        <span className={cn('font-semibold tracking-[-0.02em]', tone === 'paper' ? 'text-white' : 'text-lp-ink', word)}>
          OpenNote
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
  'group/btn relative inline-flex select-none items-center justify-center gap-2 rounded-[10px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform,border-color] duration-200 ease-out active:translate-y-px disabled:cursor-not-allowed'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-lp-ink text-white hover:bg-lp-ink-3',
  signal:
    'bg-lp-signal text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_-10px_rgba(255,77,28,0.7)] hover:bg-lp-signal-600',
  secondary:
    'border border-lp-line bg-white text-lp-ink hover:bg-lp-sunken',
  ghost: 'text-lp-body hover:bg-lp-ink/[0.06] hover:text-lp-ink',
  inverse:
    'bg-lp-surface text-lp-ink shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] hover:bg-white',
  'outline-dark':
    'border border-white/20 text-white hover:border-white/45 hover:bg-white/[0.06]',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13.5px]',
  md: 'h-9 px-3.5 text-[14px]',
  lg: 'h-11 px-5 text-[15px]',
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

/** Small square icon tile that sits above a section heading. */
export function IconTile({ children, tint = '#f1f1ef', className }: { children: ReactNode; tint?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid h-12 w-12 place-items-center rounded-[12px] border border-lp-ink/[0.08] text-lp-ink', className)}
      style={{ background: tint }}
    >
      {children}
    </span>
  )
}

/** Small uppercase label. Kept for compatibility with older call sites. */
export function Eyebrow({ children }: { children: ReactNode; index?: string; tone?: 'light' | 'dark' }) {
  return <span className="text-[13px] font-semibold text-lp-muted">{children}</span>
}

export function SectionHeading({
  icon,
  tint,
  heading,
  description,
  align = 'center',
  className,
}: {
  icon?: ReactNode
  tint?: string
  heading: ReactNode
  description?: ReactNode
  align?: 'center' | 'left'
  className?: string
  eyebrow?: string
  index?: string
  tone?: 'light' | 'dark'
}) {
  return (
    <div className={cn('flex flex-col gap-4', align === 'center' && 'items-center text-center', className)}>
      {icon && (
        <IconTile tint={tint} className="mb-2">
          {icon}
        </IconTile>
      )}
      <h2
        className={cn(
          'max-w-[20ch] text-[clamp(2rem,4.2vw,3rem)] leading-[1.08] font-semibold tracking-[-0.035em] text-lp-ink',
          align === 'center' && 'mx-auto',
        )}
      >
        {heading}
      </h2>
      {description && <p className="max-w-[52ch] text-[17px] leading-relaxed text-lp-body">{description}</p>}
    </div>
  )
}

/** Section wrapper with consistent vertical rhythm. */
export function Section({
  id,
  children,
  className,
  innerClassName,
}: {
  id?: string
  children: ReactNode
  className?: string
  innerClassName?: string
  tone?: 'light' | 'muted' | 'dark'
}) {
  return (
    <section id={id} className={cn('relative scroll-mt-24 bg-white px-5 py-20 sm:px-8 md:py-28', className)}>
      <div className={cn('mx-auto w-full max-w-[1080px]', innerClassName)}>{children}</div>
    </section>
  )
}

/** A soft grey feature card: heading top-left, interface below. */
export function FeatureCard({
  icon,
  title,
  body,
  children,
  className,
  visualClassName,
}: {
  icon?: ReactNode
  title: string
  body: string
  children?: ReactNode
  className?: string
  visualClassName?: string
}) {
  return (
    <article className={cn('flex h-full flex-col overflow-hidden rounded-[18px] bg-lp-sunken', className)}>
      <div className="p-6 sm:p-7">
        {icon && <span className="mb-3 block text-lp-ink">{icon}</span>}
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-lp-ink">{title}</h3>
        <p className="mt-1.5 max-w-[46ch] text-[15px] leading-relaxed text-lp-body">{body}</p>
      </div>
      {children && <div className={cn('mt-auto px-6 sm:px-7', visualClassName)}>{children}</div>}
    </article>
  )
}
