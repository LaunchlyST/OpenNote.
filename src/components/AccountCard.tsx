import { useState } from 'react'
import {
  CalendarDays,
  ChevronUp,
  CreditCard,
  LogOut,
  Settings as SettingsIcon,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../auth'
import { useScreen } from '../screens'
import { useApp } from '../store'
import { useClickOutside, useEscape } from '../hooks'
import { planOf } from '../lib/plan'
import { cn } from '../lib/id'
import { Avatar } from './Avatar'

/** "14 October 2026" — unambiguous, and locale-ordered like the brief. */
function formatJoined(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5 px-1 py-1.5">
      <span className="mt-[1px] text-faint">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-ink">
          {value}
        </span>
      </span>
    </div>
  )
}

/**
 * The account card pinned to the bottom of the sidebar.
 *
 * Everything shown comes from the authenticated account record — name, email,
 * avatar, creation date and plan are read straight off `AuthUser`. Nothing is
 * hardcoded and nothing is inferred from the sign-in state, so the card shows
 * the same values the account settings screen edits.
 *
 * There is no billing backend, so the popover deliberately has no "Manage
 * subscription" action: it would have nothing real to call. The plan row says
 * so instead of pretending.
 */
export function AccountCard() {
  const { user, signOut } = useAuth()
  const { goTo } = useScreen()
  const { openSettings } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false))
  useEscape(open, () => setOpen(false))

  // Signed out: keep a discreet way back into the auth flow without the
  // heavy "save your planner" call to action this replaced.
  if (!user) {
    return (
      <button
        type="button"
        onClick={() => goTo('signin')}
        className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-surface"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-border-strong text-faint transition group-hover:border-accent group-hover:text-accent-text">
          <UserRound className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-ink-soft transition group-hover:text-ink">
            Sign in
          </span>
          <span className="block truncate text-[10.5px] text-muted">
            Sync across devices
          </span>
        </span>
      </button>
    )
  }

  const plan = planOf(user.plan)
  const paid = plan.id !== 'free'

  return (
    <div className="relative" ref={ref}>
      {open && (
        <div className="animate-pop absolute bottom-[calc(100%+10px)] left-0 z-50 w-full overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_40px_-12px_rgba(16,24,40,0.28)]">
          <div className="border-b border-line-soft bg-surface px-3.5 py-3">
            <div className="flex items-center gap-3">
              <Avatar
                size={40}
                name={user.fullName}
                src={user.avatar}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {user.fullName}
                </p>
                <p className="truncate text-[11px] text-muted">{user.email}</p>
              </div>
            </div>
            <span
              className={cn(
                'mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold',
                paid
                  ? 'bg-charcoal text-white'
                  : 'bg-accent-soft text-accent-text',
              )}
            >
              {plan.shortLabel} plan
            </span>
          </div>

          <div className="py-1.5">
            <Row
              icon={<UserRound className="h-3.5 w-3.5" />}
              label="Name"
              value={user.fullName}
            />
            <Row
              icon={<UserRound className="h-3.5 w-3.5" />}
              label="Email"
              value={user.email}
            />
            <Row
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Member since"
              value={formatJoined(user.createdAt)}
            />
            <Row
              icon={<CreditCard className="h-3.5 w-3.5" />}
              label="Plan"
              value={
                <span className="flex items-baseline gap-1.5">
                  {plan.label}
                  <span className="text-[11px] text-muted">
                    {plan.price}
                  </span>
                </span>
              }
            />
          </div>

          {!plan.purchasable && (
            <p className="mx-3 mb-2 rounded-lg bg-surface px-2.5 py-2 text-[10.5px] leading-snug text-muted">
              {plan.blurb}
            </p>
          )}

          <div className="border-t border-line-soft p-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                openSettings('profile')
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px] text-ink-soft transition hover:bg-surface hover:text-ink"
            >
              <SettingsIcon className="h-4 w-4 text-muted" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                signOut()
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px] text-red-500 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-2.5 py-2 text-left transition-all duration-150',
          'hover:border-border-strong hover:bg-white hover:shadow-sm',
          open && 'border-border-strong bg-white shadow-sm',
        )}
      >
        <Avatar size={34} name={user.fullName} src={user.avatar} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">
            {user.fullName}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span className="truncate text-[10.5px] leading-tight text-muted">
              {user.email}
            </span>
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide',
                paid
                  ? 'bg-charcoal text-white'
                  : 'bg-accent-soft text-accent-text',
              )}
            >
              {plan.shortLabel}
            </span>
          </span>
        </span>
        <ChevronUp
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-ghost transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
    </div>
  )
}
