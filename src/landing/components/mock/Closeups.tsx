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

/** The "new event" editor, mid-typing — drawn like the live EventModal. */
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
  const field = 'flex items-center rounded-[10px] bg-[#f3f3f1] px-2.5 py-2 text-[12px] tabular-nums text-[#191919]'
  return (
    <div
      className={cn(
        'w-[300px] rounded-[18px] bg-white p-4 text-[#191919] shadow-[0_30px_60px_-24px_rgba(40,30,10,0.45),0_8px_20px_-10px_rgba(40,30,10,0.2)] ring-1 ring-black/[0.06]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center text-[17px] font-semibold tracking-[-0.02em]">
          {title}
          {caret && <span aria-hidden="true" className="lp-caret ml-0.5 inline-block h-[18px] w-[2px] bg-[#ff4d1c]" />}
        </p>
        <X className="mt-1 h-3.5 w-3.5 shrink-0 text-[#6b6a66]" aria-hidden="true" />
      </div>

      <div className="mt-3 grid gap-2">
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-[#8f8e8a]" aria-hidden="true" />
          <span className={cn(field, 'flex-1')}>Mon, 5 Oct 2026</span>
        </span>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-[#8f8e8a]" aria-hidden="true" />
          <span className={cn(field, 'flex-1')}>11:30</span>
          <span className={cn(field, 'flex-1')}>12:30</span>
        </span>
        <span className="pl-6 text-[10.5px] text-[#8f8e8a]">Monday · 1 h</span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {DEMO_CALENDARS.map((c) => {
          const col = COLORS[c.color]
          const on = c.color === calendar
          return (
            <span
              key={c.name}
              className="inline-flex items-center rounded-[9px] px-2.5 py-1 text-[11px] font-medium"
              style={
                on
                  ? { background: col.bg, color: col.text, boxShadow: `inset 0 0 0 1.5px ${col.dot}` }
                  : { background: '#f3f3f1', color: '#5f5e5b' }
              }
            >
              {c.name}
            </span>
          )
        })}
      </div>

      <span className="mt-2.5 block rounded-[10px] bg-[#f3f3f1] px-2.5 py-2 text-[11px] text-[#a3a29e]">Notes (optional)</span>

      <span className="mt-3.5 flex items-center gap-2">
        <span className="flex h-9 flex-1 items-center justify-center rounded-[10px] bg-[#191919] text-[12.5px] font-semibold text-white shadow-[0_6px_14px_-8px_rgba(0,0,0,0.6)]">
          Add event
        </span>
        <span className="px-2 text-[12px] text-[#37352f]">Cancel</span>
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
