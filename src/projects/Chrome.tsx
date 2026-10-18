import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { LogOut, Settings as Cog } from 'lucide-react'
import { useAuth } from '../auth'
import { useScreen } from '../screens'
import { Avatar } from '../components/Avatar'
import { Logo } from '../landing/components/primitives'

/** Shared page frame for the workspace picker and project dashboard. */
export function PageChrome({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  const { user, signOut } = useAuth()
  const { goTo } = useScreen()
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-[#f7f7f5]">
      <header className="sticky top-0 z-20 border-b border-[#ececea] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <a href="/" aria-label="Desknoty home" className="shrink-0">
            <Logo size="sm" />
          </a>
          <div className="min-w-0 flex-1">{nav}</div>
          {user && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => goTo('account')}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-[#f3f3f1]"
                title="Account settings"
              >
                <Avatar size={28} name={user.fullName} src={user.avatar} />
                <span className="hidden max-w-[160px] truncate text-[13px] font-medium text-[#37352f] md:block">
                  {user.fullName || user.email}
                </span>
                <Cog className="hidden h-4 w-4 text-[#8f8e8a] md:block" />
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                aria-label="Sign out"
                title="Sign out"
                className="grid h-9 w-9 place-items-center rounded-lg text-[#6b6a66] transition hover:bg-[#f3f3f1] hover:text-[#191919]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  )
}

/** Centered modal used by the project dialogs. */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="animate-scrim fixed inset-0 z-[60] flex items-center justify-center bg-[#0b0f19]/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-rise w-full max-w-md rounded-2xl border border-[#ececea] bg-white p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]"
      >
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#191919]">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="flex flex-col items-center gap-3">
        <span className="h-1 w-24 overflow-hidden rounded-full bg-[#e3e3e0]" aria-hidden="true">
          <span className="block h-full w-2/5 animate-pulse rounded-full bg-[#bef264]" />
        </span>
        <span className="text-[13px] text-[#8f8e8a]" role="status">
          {label}
        </span>
      </div>
    </div>
  )
}

export const btn = {
  primary:
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#191919] px-4 text-[13.5px] font-semibold text-white transition hover:bg-[#37352f] disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#e3e3e0] bg-white px-4 text-[13.5px] font-medium text-[#37352f] transition hover:bg-[#f7f7f5] disabled:opacity-50',
  danger:
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#dc2626] px-4 text-[13.5px] font-semibold text-white transition hover:bg-[#b91c1c] disabled:opacity-50',
}
