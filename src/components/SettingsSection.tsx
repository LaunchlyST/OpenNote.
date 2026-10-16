import type { ReactNode } from 'react'
import { cn } from '../lib/id'

/**
 * Primitives shared by every section of the Settings page.
 *
 * They follow the same vocabulary as the rest of the app — hairline `line`
 * borders, `surface` fills, the lime accent for active states — so a settings
 * card reads as the same material as a note card or a sidebar row rather than
 * as a borrowed settings screen.
 */

export function SettingsCard({
  title,
  description,
  children,
}: {
  title?: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      {(title || description) && (
        <header className="border-b border-line-soft bg-surface px-5 py-3.5">
          {title && (
            <h3 className="text-[13px] font-bold tracking-[-0.01em] text-ink">
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
              {description}
            </p>
          )}
        </header>
      )}
      <div className="divide-y divide-line-soft">{children}</div>
    </section>
  )
}

/** One labelled control inside a card. */
export function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-ink">{label}</p>
        {hint && (
          <p className="mt-0.5 max-w-[46ch] text-[11px] leading-snug text-muted">
            {hint}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex rounded-lg bg-surface p-0.5 ring-1 ring-border-subtle"
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
            value === o.value
              ? 'bg-white text-ink shadow-sm'
              : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative block h-[20px] w-[36px] shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-border-strong',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all',
          checked ? 'left-[19px]' : 'left-[3px]',
        )}
      />
    </button>
  )
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  autoComplete?: string
  disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-ink-soft">
        {label}
      </span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] transition',
          'placeholder:text-ghost focus:border-accent focus:ring-2 focus:ring-accent-soft',
          disabled && 'cursor-not-allowed bg-surface text-muted',
        )}
      />
    </label>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' &&
          'bg-accent text-[#1f2937] shadow-[0_4px_12px_-4px_rgba(163,217,34,0.6)] hover:bg-accent-hover',
        variant === 'secondary' &&
          'border border-line bg-white text-ink-soft hover:border-border-strong hover:bg-surface hover:text-ink',
        variant === 'danger' && 'text-red-500 hover:bg-red-50',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * The banner used wherever a control cannot work yet. The wording is
 * deliberately plain — it says what is missing rather than showing a live-
 * looking control that does nothing.
 */
export function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-accent-soft px-3.5 py-3">
      <span
        aria-hidden="true"
        className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-deep"
      />
      <p className="text-[11.5px] leading-snug text-accent-text/85">
        {children}
      </p>
    </div>
  )
}