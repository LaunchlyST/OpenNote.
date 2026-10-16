import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/id'

interface IconButtonProps {
  label: string
  onClick?: () => void
  children: ReactNode
  active?: boolean
  className?: string
}

export function IconButton({
  label,
  onClick,
  children,
  active = false,
  className,
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition',
        'hover:bg-surface hover:text-ink active:scale-95',
        active && 'bg-accent-soft text-accent-text hover:bg-accent-soft hover:text-accent-text',
        className,
      )}
    >
      {children}
    </button>
  )
}

interface SectionProps {
  title: string
  action?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

export function Section({
  title,
  action,
  defaultOpen = true,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-line px-3 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="group flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-faint transition hover:text-ink-soft"
        >
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform duration-200',
              !open && '-rotate-90',
            )}
            strokeWidth={2.6}
          />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="mt-2">{children}</div>}
    </section>
  )
}

interface DrawerProps {
  side: 'left' | 'right'
  onClose: () => void
  children: ReactNode
  hideFrom?: 'lg' | 'xl'
}

export function Drawer({
  side,
  onClose,
  children,
  hideFrom = 'lg',
}: DrawerProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex',
        hideFrom === 'xl' ? 'xl:hidden' : 'lg:hidden',
      )}
    >
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-black/20"
      />
      <div
        className={cn(
          'relative z-10 flex h-full w-[280px] bg-white shadow-2xl',
          side === 'left' ? 'mr-auto' : 'ml-auto',
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function Divider() {
  return <div className="h-px w-full bg-line" />
}