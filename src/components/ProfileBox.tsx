import { useState } from 'react'
import {
  ChevronUp,
  CreditCard,
  LogOut,
  Settings as SettingsIcon,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../auth'
import { useScreen } from '../screens'
import { useOptionalApp } from '../store'
import { useClickOutside, useEscape } from '../hooks'
import { cn } from '../lib/id'
import { Avatar } from './Avatar'

function formatJoined(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ProfileBox() {
  const { user, signOut } = useAuth()
  const { goTo } = useScreen()
  // Inside a project, Profile and Settings open the Settings page in the main
  // area (sidebar stays); elsewhere they fall back to the account screen.
  const app = useOptionalApp()
  const openAccount = (section: 'profile' | 'account') =>
    app ? app.openSettings(section) : goTo('account')
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false))
  useEscape(open, () => setOpen(false))

  // Signed out — invite the visitor to sign in or register.
  if (!user) {
    return (
      <button
        type="button"
        onClick={() => goTo('signin')}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-[#e9e9e7] bg-white px-2.5 py-2 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:border-[#dcdbd7] hover:bg-[#fafaf9] active:scale-[0.99]"
      >
        <Avatar size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-[#191919]">
            Sign In / Sign Up
          </span>
          <span className="block truncate text-[10.5px] text-[#8f8e8a]">
            Save your planner to an account
          </span>
        </span>
      </button>
    )
  }

  const item =
    'flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[14px] font-medium text-[#191919] transition-all duration-150 hover:bg-white hover:shadow-[0_6px_18px_-6px_rgba(0,0,0,0.25)] hover:ring-1 hover:ring-black/[0.04]'
  const close = () => setOpen(false)

  return (
    <div className="relative" ref={ref}>
      {open && (
        <div
          role="menu"
          className="animate-pop absolute bottom-[calc(100%+10px)] left-0 z-50 w-[248px] overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold tracking-[-0.02em] text-[#191919]">{user.fullName}</p>
              <p className="truncate text-[12.5px] text-[#5f5e5b]">{user.email}</p>
            </div>
            <span className="shrink-0 rounded-full ring-2 ring-[#191919] ring-offset-2">
              <Avatar size={40} name={user.fullName} src={user.avatar} />
            </span>
          </div>

          <div className="space-y-0.5 px-2.5 pb-2.5">
            <button type="button" role="menuitem" className={item} onClick={() => { close(); openAccount('profile') }}>
              <UserRound className="h-[18px] w-[18px]" />
              Profile
            </button>
            <a role="menuitem" href="/#pricing" className={item} onClick={close}>
              <CreditCard className="h-[18px] w-[18px]" />
              <span>
                Subscription
                <span className="ml-1 -translate-y-1.5 inline-block rounded-[5px] bg-[#f6c90e] px-1 text-[8.5px] font-bold italic tracking-wide text-white">
                  PRO
                </span>
              </span>
            </a>
            <button type="button" role="menuitem" className={item} onClick={() => { close(); openAccount('account') }}>
              <SettingsIcon className="h-[18px] w-[18px]" />
              Settings
            </button>
          </div>

          <div className="border-t border-[#ececea] px-2.5 py-2.5">
            <p className="px-3 pb-1.5 text-[11px] text-[#a3a29e]">Member since {formatJoined(user.createdAt)}</p>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                close()
                void signOut()
              }}
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign out
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
          'group flex w-full items-center gap-3 rounded-[14px] border border-[#ececea] bg-white px-2.5 py-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-[#dcdbd7] hover:shadow-[0_4px_14px_-6px_rgba(0,0,0,0.18)]',
          open && 'border-[#dcdbd7] shadow-[0_4px_14px_-6px_rgba(0,0,0,0.18)]',
        )}
      >
        <Avatar size={36} name={user.fullName} src={user.avatar} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[#191919]">{user.fullName}</span>
          <span className="block truncate text-[11px] text-[#8f8e8a]">{user.email}</span>
        </span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#8f8e8a] transition group-hover:bg-[#f3f3f1] group-hover:text-[#191919]"><ChevronUp className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} /></span>
      </button>
    </div>
  )
}
