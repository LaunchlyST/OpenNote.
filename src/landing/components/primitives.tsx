import { useRef } from 'react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { StickyNote } from 'lucide-react'
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
}

export function Logo({ className, size = 'md', markOnly = false }: LogoProps) {
  const mark = {
    sm: 'h-7 w-7 rounded-lg',
    md: 'h-9 w-9 rounded-[10px]',
    lg: 'h-11 w-11 rounded-xl',
  }[size]
  const icon = { sm: 15, md: 17, lg: 20 }[size]
  const word = {
    sm: 'text-[15px]',
    md: 'text-[17px]',
    lg: 'text-[20px]',
  }[size]

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid shrink-0 place-items-center bg-gradient-to-br from-[#f5c518] to-[#e5b800] text-[#1a1a2e] shadow-[0_4px_16px_rgba(245,197,24,0.35)]',
          mark,
        )}
      >
        <StickyNote style={{ width: icon, height: icon }} strokeWidth={2.3} />
      </span>
      {!markOnly && (
        <span className={cn('font-bold tracking-[-0.03em] text-lp-ink', word)}>
          OpenNote
        </span>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-3 disabled:cursor-not-allowed'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-[#f5c518] to-[#e5b800] text-[#1a1a2e] shadow-[0_8px_32px_rgba(245,197,24,0.35),inset_0_-1px_0_rgba(180,150,0,0.3)] hover:shadow-[0_12px_40px_rgba(245,197,24,0.45),inset_0_-1px_0_rgba(180,150,0,0.3)] hover:brightness-110 active:scale-[0.985] disabled:bg-lp-line disabled:text-lp-muted disabled:shadow-none',
  secondary:
    'border border-lp-line bg-lp-surface text-lp-ink shadow-[0_1px_2px_rgba(0,0,0,0.3)] hover:border-[#3a3f52] hover:bg-lp-sunken hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] active:scale-[0.985] disabled:border-lp-line disabled:bg-lp-surface disabled:text-lp-muted disabled:shadow-none',
  ghost:
    'text-lp-body hover:bg-lp-sunken hover:text-lp-ink active:scale-[0.985]',
  dark: 'bg-lp-charcoal text-[#1a1a2e] shadow-[0_8px_22px_rgba(240,242,248,0.15)] hover:bg-lp-charcoal-2 hover:shadow-[0_12px_28px_rgba(240,242,248,0.2)] active:scale-[0.985] disabled:bg-lp-line disabled:text-lp-muted disabled:shadow-none',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[14px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-[52px] px-7 text-[16px]',
}

interface CommonButtonProps {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  /** Leading icon. */
  icon?: ReactNode
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

export function Button(props: ButtonProps) {
  const { children, variant = 'primary', size = 'md', className, icon } = props
  const { go, goSection } = useLandingNav()

  const classes = cn(
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  )
  const content = (
    <>
      {icon}
      {children}
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
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
    >
      {content}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Section furniture                                                   */
/* ------------------------------------------------------------------ */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-lp-line bg-lp-surface/80 px-3.5 py-1.5 text-[12.5px] font-semibold tracking-[0.08em] text-[#f5c518] uppercase shadow-[0_1px_2px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-[#f5c518]" aria-hidden="true" />
      {children}
    </span>
  )
}

export function SectionHeading({
  eyebrow,
  heading,
  description,
  align = 'center',
  tone = 'light',
  className,
}: {
  eyebrow?: string
  heading: string
  description?: string
  align?: 'center' | 'left'
  tone?: 'light' | 'dark'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        className={cn(
          'max-w-[18ch] text-[clamp(1.9rem,4.4vw,3.1rem)] leading-[1.06] font-bold',
          tone === 'dark' ? 'text-[#1a1a2e]' : 'text-lp-ink',
          align === 'center' && 'mx-auto',
        )}
      >
        {heading}
      </h2>
      {description && (
        <p
          className={cn(
            'max-w-[58ch] text-[17px] leading-relaxed',
            tone === 'dark' ? 'text-[#1a1a2e]/70' : 'text-lp-body',
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
  tone = 'light',
}: {
  id?: string
  children: ReactNode
  className?: string
  tone?: 'light' | 'muted' | 'dark'
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative scroll-mt-24 px-5 py-20 sm:px-8 md:py-28',
        tone === 'light' && 'bg-lp-bg',
        tone === 'muted' && 'bg-[#0c0e13]',
        tone === 'dark' && 'bg-[#0c0e13]',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1180px]">{children}</div>
    </section>
  )
}

/** Thin hairline used between major blocks. */
export function Hairline({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('mx-auto h-px w-full max-w-[1180px] bg-lp-line', className)}
    />
  )
}