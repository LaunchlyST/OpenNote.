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
        'grid h-8 w-8 place-items-center rounded-lg text-[#565d70] transition',
        'hover:bg-[#f2f3f6] hover:text-[#1f2330] active:scale-95',
        active && 'bg-[#eaf9bf] text-[#4b6410] hover:bg-[#e3f6ad] hover:text-[#4b6410]',
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
    <section className="border-b border-[#eceef2] px-3 py-3">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="group flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8b90a0] transition hover:text-[#5b6172]"
        >
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-150',
              !open && '-rotate-90',
            )}
            strokeWidth={2.4}
          />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="mt-2.5">{children}</div>}
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
        className="animate-fade absolute inset-0 bg-[#0b0f19]/25"
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
  return <div className="h-px w-full bg-[#eceef2]" />
}
