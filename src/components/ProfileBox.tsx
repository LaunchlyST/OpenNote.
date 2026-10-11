import { useState } from 'react'
import {
  CalendarDays,
  ChevronUp,
  LogOut,
  Settings as SettingsIcon,
} from 'lucide-react'
import { useAuth } from '../auth'
import { useScreen } from '../screens'
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
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false))
  useEscape(open, () => setOpen(false))

  // Signed out — invite the visitor to sign in or register.
  if (!user) {
    return (
      <button
        type="button"
        onClick={() => goTo('signin')}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-[#e8eaef] bg-white px-2.5 py-2 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:border-[#d9dde6] hover:bg-[#f9fafb] active:scale-[0.99]"
      >
        <Avatar size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-[#1f2330]">
            Sign In / Sign Up
          </span>
          <span className="block truncate text-[10.5px] text-[#8b90a0]">
            Save your planner to an account
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className="relative" ref={ref}>
      {open && (
        <div className="animate-pop absolute bottom-[calc(100%+8px)] left-0 z-50 w-full overflow-hidden rounded-2xl border border-[#e8eaef] bg-white shadow-[0_12px_32px_rgba(16,24,40,0.16)]">
          <div className="flex items-center gap-3 border-b border-[#f0f1f4] p-3">
            <Avatar size={42} name={user.fullName} src={user.avatar} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#1f2330]">
                {user.fullName}
              </p>
              <p className="truncate text-[11px] text-[#8b90a0]">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-[#8b90a0]">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span>Member since {formatJoined(user.createdAt)}</span>
          </div>

          <div className="border-t border-[#f0f1f4] p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                goTo('account')
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12.5px] text-[#3d4354] transition hover:bg-[#f5f6f9]"
            >
              <SettingsIcon className="h-4 w-4 text-[#8b90a0]" />
              Account Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                signOut()
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12.5px] text-[#c0392b] transition hover:bg-[#fdf1f1]"
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
          'flex w-full items-center gap-2.5 rounded-2xl border border-[#e8eaef] bg-white px-2.5 py-2 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:border-[#d9dde6] hover:bg-[#f9fafb] active:scale-[0.99]',
          open && 'border-[#d9dde6] bg-[#f9fafb]',
        )}
      >
        <Avatar size={34} name={user.fullName} src={user.avatar} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-[#1f2330]">
            {user.fullName}
          </span>
          <span className="block truncate text-[10.5px] text-[#8b90a0]">
            Joined {formatJoined(user.createdAt)}
          </span>
        </span>
        <ChevronUp
          className={cn(
            'h-4 w-4 shrink-0 text-[#b6bbc7] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
    </div>
  )
}
