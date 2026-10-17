import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/id'

/**
 * Building blocks for the Settings page: white rounded cards on a soft grey
 * page, hairline dividers, small Lucide icons and one accent colour for
 * active states — the same material as the rest of OpenNote.
 */

export function SettingsCard({
  title,
  description,
  icon,
  action,
  children,
  tone = 'default',
}: {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[22px] border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-24px_rgba(16,24,40,0.25)]',
        tone === 'danger' ? 'border-[#f3d4d4]' : 'border-[#ececea]',
      )}
    >
      {(title || description) && (
        <header className="flex items-start gap-3 px-5 pb-1 pt-4">
          {icon && (
            <span
              className={cn(
                'mt-[1px] grid h-8 w-8 shrink-0 place-items-center rounded-xl',
                tone === 'danger' ? 'bg-[#fdecec] text-[#b4453c]' : 'bg-[#f7fee7] text-[#4d7c0f]',
              )}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className={cn('text-[13.5px] font-semibold tracking-[-0.01em]', tone === 'danger' ? 'text-[#9c3a32]' : 'text-[#191919]')}>
                {title}
              </h3>
            )}
            {description && <p className="mt-0.5 text-[12px] leading-snug text-[#8f8e8a]">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="divide-y divide-[#f1f1ef]">{children}</div>
    </section>
  )
}

/** One labelled control inside a card. */
export function SettingsRow({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string
  hint?: ReactNode
  children?: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5">
      <div className="min-w-0 flex-1 basis-[220px]">
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-[#191919]">
          {label}
        </label>
        {hint && <p className="mt-0.5 max-w-[52ch] text-[11.5px] leading-snug text-[#8f8e8a]">{hint}</p>}
      </div>
      {children !== undefined && <div className="flex shrink-0 items-center gap-2">{children}</div>}
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
  options: Array<{ value: T; label: string; disabled?: boolean }>
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex rounded-[10px] bg-[#f1f1ef] p-[3px]">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[7px] px-3 py-[5px] text-[12px] font-medium transition',
            value === o.value
              ? 'bg-white text-[#191919] shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
              : 'text-[#6b6a66] hover:text-[#191919]',
            o.disabled && 'cursor-not-allowed opacity-40 hover:text-[#6b6a66]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  id,
  disabled = false,
}: {
  value: T
  options: Array<{ value: T; label: string; disabled?: boolean }>
  onChange: (value: T) => void
  ariaLabel: string
  id?: string
  disabled?: boolean
}) {
  return (
    <div className="relative inline-block">
      <select
        id={id}
        aria-label={ariaLabel}
        value={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const hit = options.find((o) => String(o.value) === e.target.value)
          if (hit) onChange(hit.value)
        }}
        className="h-9 min-w-[150px] appearance-none rounded-[10px] border border-[#e3e3e0] bg-white pl-3 pr-8 text-[12.5px] font-medium text-[#191919] transition hover:border-[#cfcfcb] focus:border-[var(--color-accent-deep)] disabled:cursor-not-allowed disabled:bg-[#f7f7f5] disabled:text-[#a3a29e]"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8f8e8a]" />
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative block h-[22px] w-[38px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent-deep' : 'bg-[#dcdbd7]',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-all',
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
  error,
  hint,
  maxLength,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  autoComplete?: string
  disabled?: boolean
  error?: string | null
  hint?: string
  maxLength?: number
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[#5f5e5b]">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 w-full rounded-[10px] border px-3 text-[13px] transition placeholder:text-[#b8b6ae]',
          error ? 'border-[#e5a5a0]' : 'border-[#e3e3e0] hover:border-[#cfcfcb] focus:border-[var(--color-accent-deep)]',
          disabled ? 'cursor-not-allowed bg-[#f7f7f5] text-[#8f8e8a] hover:border-[#e3e3e0]' : 'bg-white text-[#191919]',
        )}
      />
      {error ? (
        <span className="mt-1 block text-[11.5px] text-[#b4453c]">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11.5px] text-[#8f8e8a]">{hint}</span>
      ) : null}
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
  variant?: 'primary' | 'secondary' | 'danger' | 'danger-solid'
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
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-[12.5px] font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-[#191919] text-white hover:bg-[#37352f]',
        variant === 'secondary' && 'border border-[#e3e3e0] bg-white text-[#37352f] hover:border-[#cfcfcb] hover:bg-[#fafaf9]',
        variant === 'danger' && 'border border-[#f0cfcc] bg-white text-[#b4453c] hover:bg-[#fdf3f2]',
        variant === 'danger-solid' && 'bg-[#b4453c] text-white hover:bg-[#9c3a32]',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Small status pill. */
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'soon' | 'accent'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] text-[10.5px] font-semibold leading-none',
        tone === 'neutral' && 'bg-[#f1f1ef] text-[#5f5e5b]',
        tone === 'success' && 'bg-[#e8f6e9] text-[#2f6b35]',
        tone === 'warning' && 'bg-[#fdf3c4] text-[#8a6a00]',
        tone === 'danger' && 'bg-[#fdecec] text-[#9c3a32]',
        tone === 'soon' && 'bg-[#fdf3c4] text-[#8a6a00] ring-1 ring-inset ring-[#f2d66b]',
        tone === 'accent' && 'bg-accent-soft text-accent-text',
      )}
    >
      {children}
    </span>
  )
}

/** A plain explanation for something that is not available yet. */
export function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-[#f7f7f5] px-3.5 py-3">
      <span className="mt-[1px]">
        <Badge tone="soon">Coming soon</Badge>
      </span>
      <p className="text-[12px] leading-snug text-[#6b6a66]">{children}</p>
    </div>
  )
}

/** Inline status line after a save: success or error. */
export function SaveStatus({ state, error }: { state: 'idle' | 'saving' | 'saved' | 'error'; error?: string | null }) {
  if (state === 'idle') return null
  return (
    <span
      role="status"
      className={cn(
        'text-[12px] font-medium',
        state === 'error' ? 'text-[#b4453c]' : state === 'saved' ? 'text-[#2f6b35]' : 'text-[#8f8e8a]',
      )}
    >
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : error || 'Could not save. Try again.'}
    </span>
  )
}
