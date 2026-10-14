import { CalendarDays, Clock, Pin, X } from 'lucide-react'
import { COLORS } from '../../../lib/colors'
import type { EventColorId } from '../../../lib/colors'
import { cn } from '../../../lib/id'
import { DEMO_CALENDARS } from '../../demo'

/**
 * Close-up details of the real OpenNote interface, drawn at a readable size.
 *
 * Each one mirrors a live component — the event editor (`EventModal`), a note
 * from the notes rail (`NotesPanel`) — so a visitor sees the actual controls
 * they will use, not an invented UI. Read-only and data-free.
 */

/** The "new event" editor, mid-typing. */
export function EventComposer({
  className,
  title = 'Design review',
  calendar = 'lime',
  caret = true,
}: {
  className?: string
  title?: string
  calendar?: EventColorId
  caret?: boolean
}) {
  return (
    <div
      className={cn(
        'w-[300px] rounded-[18px] border border-black/[0.07] bg-white p-4 text-[#1f2330] shadow-[0_30px_60px_-24px_rgba(40,30,10,0.45),0_8px_20px_-10px_rgba(40,30,10,0.2)]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.12em] text-[#8b90a0] uppercase">New event</span>
        <span className="grid h-6 w-6 place-items-center rounded-md text-[#a5aab8]">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-2 flex items-center text-[19px] font-semibold tracking-[-0.02em]">
        {title}
        {caret && <span aria-hidden="true" className="lp-caret ml-0.5 inline-block h-[20px] w-[2px] bg-[#ff4d1c]" />}
      </p>

      <p className="mt-3.5 text-[10.5px] font-semibold text-[#8b90a0]">Calendar</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {DEMO_CALENDARS.map((c) => {
          const col = COLORS[c.color]
          const on = c.color === calendar
          return (
            <span
              key={c.name}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={
                on
                  ? { background: col.bg, color: col.text, boxShadow: `inset 0 0 0 1px ${col.border}` }
                  : { background: '#f7f8fa', color: '#5b6172', boxShadow: 'inset 0 0 0 1px #eceef2' }
              }
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.dot }} />
              {c.name}
            </span>
          )
        })}
      </div>

      <div className="mt-3.5 grid gap-2 text-[12px]">
        <span className="flex items-center gap-2 rounded-[10px] border border-[#eceef2] px-2.5 py-2">
          <CalendarDays className="h-3.5 w-3.5 text-[#a5aab8]" aria-hidden="true" />
          Mon, 5 Oct 2026
        </span>
        <span className="flex items-center gap-2 rounded-[10px] border border-[#eceef2] px-2.5 py-2">
          <Clock className="h-3.5 w-3.5 text-[#a5aab8]" aria-hidden="true" />
          <span className="font-mono">11:30</span>
          <span className="text-[#a5aab8]">→</span>
          <span className="font-mono">12:30</span>
        </span>
      </div>

      <span className="mt-4 flex h-9 items-center justify-center rounded-[10px] bg-[#1f2330] text-[12.5px] font-semibold text-white">
        Add event
      </span>
    </div>
  )
}

/** A note card from the notes rail, pinned to a day. */
export function NoteCloseup({
  className,
  title = 'Call back',
  lines = ['Sam — invoice question before Friday.', 'Bring the March figures.'],
  pinned = 'Oct 8 · 15:00',
}: {
  className?: string
  title?: string
  lines?: string[]
  pinned?: string
}) {
  return (
    <div
      className={cn(
        'w-[250px] rounded-[16px] border border-[#eeda5c]/60 bg-[#fdf6ab] p-4 text-[#3d3a1e] shadow-[0_26px_50px_-24px_rgba(90,70,0,0.5)]',
        className,
      )}
    >
      <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#2b2a14]">{title}</p>
      <ul className="mt-2 space-y-1 text-[12.5px] leading-snug">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[10.5px] font-semibold text-[#7a6410]">
        <Pin className="h-3 w-3" aria-hidden="true" />
        {pinned}
      </span>
    </div>
  )
}

/** "Now" marker chip, as it appears over today's column. */
export function NowChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-lp-ink py-1.5 pr-3.5 pl-2.5 font-mono text-[11.5px] text-lp-surface shadow-[0_14px_30px_-12px_rgba(20,21,15,0.6)]',
        className,
      )}
    >
      <span className="lp-pulse h-2 w-2 rounded-full bg-lp-signal" />
      Now · 11:42
    </span>
  )
}
