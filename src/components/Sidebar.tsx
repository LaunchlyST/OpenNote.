import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Check,
  Pencil,
  Plus,
  StickyNote,
  Sun,
  Trash2,
} from 'lucide-react'
import { useApp } from '../store'
import type { Calendar, CalendarEvent } from '../lib/types'
import { COLOR_IDS, colorOf } from '../lib/colors'
import {
  dateKey,
  formatClock,
  isSameDay,
  relativeDayLabel,
  startOfDay,
} from '../lib/date'
import { BLOCK_MS, blockStartOf, eventsInBlock } from '../lib/block'
import { cn } from '../lib/id'
import { useNow } from '../hooks'
import { IconButton, Section } from './ui'
import { MiniCalendar } from './MiniCalendar'
import { ProfileBox } from './ProfileBox'

interface SidebarProps {
  onToggleNotes?: () => void
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  trailing,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[12.5px] transition-all duration-150',
        active
          ? 'bg-white font-medium text-[#1f2330] shadow-[0_1px_2px_rgba(16,24,40,0.07)] ring-1 ring-black/[0.04]'
          : 'font-medium text-[#6b7183] hover:bg-white/70 hover:text-[#1f2330]',
      )}
    >
      <span
        className={cn(
          'shrink-0 transition-colors',
          active ? 'text-[#3f4a14]' : 'text-[#a5aab8] group-hover:text-[#6b7183]',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  )
}

function EventRow({ event }: { event: CalendarEvent }) {
  const { calendars, openEdit, settings } = useApp()
  const color = colorOf(calendars.find((c) => c.id === event.calendarId)?.color)
  const start = new Date(event.start)
  const end = new Date(event.end)
  return (
    <button
      type="button"
      onClick={() => openEdit(event)}
      className="group flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white"
    >
      <span
        className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: color.dot }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-snug text-[#1f2330]">
          {event.title || 'Untitled'}
        </span>
        <span className="block text-[11px] leading-snug text-[#8b90a0]">
          {formatClock(start, settings.hour12)} –{' '}
          {formatClock(end, settings.hour12)}
        </span>
      </span>
    </button>
  )
}

function CalendarRow({ calendar }: { calendar: Calendar }) {
  const { toggleCalendar, updateCalendar, deleteCalendar } = useApp()
  const [editing, setEditing] = useState(false)
  const color = colorOf(calendar.color)

  if (editing) {
    return (
      <div className="animate-rise rounded-xl bg-white p-2 shadow-[0_1px_3px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.04]">
        <input
          autoFocus
          value={calendar.name}
          onChange={(e) => updateCalendar(calendar.id, { name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditing(false)
          }}
          className="w-full rounded-lg border border-[#eceef2] bg-white px-2 py-1 text-[12px]"
        />
        <div className="mt-2 flex items-center gap-1">
          {COLOR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={colorOf(id).name}
              onClick={() => updateCalendar(calendar.id, { color: id })}
              className={cn(
                'h-4 w-4 rounded-full ring-offset-1 transition hover:scale-110',
                calendar.color === id && 'ring-2 ring-[#9aa0b0]',
              )}
              style={{ background: colorOf(id).dot }}
            />
          ))}
          <span className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Delete calendar"
              onClick={() => deleteCalendar(calendar.id)}
              className="grid h-5 w-5 place-items-center rounded text-[#c3c7d1] transition hover:bg-[#fdf1f1] hover:text-[#c0392b]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-label="Done"
              onClick={() => setEditing(false)}
              className="grid h-5 w-5 place-items-center rounded text-[#6b7183] transition hover:bg-[#f7f8fa]"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2.5 rounded-lg px-2 py-[5px] transition hover:bg-white/70">
      <button
        type="button"
        aria-label={calendar.visible ? 'Hide calendar' : 'Show calendar'}
        onClick={() => toggleCalendar(calendar.id)}
        className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[5px] border transition"
        style={{
          borderColor: color.dot,
          background: calendar.visible ? color.dot : 'transparent',
        }}
      >
        {calendar.visible && (
          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
        )}
      </button>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[12.5px]',
          calendar.visible ? 'text-[#1f2330]' : 'text-[#a5aab8] line-through',
        )}
      >
        {calendar.name}
      </span>
      <button
        type="button"
        aria-label="Edit calendar"
        onClick={() => setEditing(true)}
        className="grid h-5 w-5 place-items-center rounded text-[#a5aab8] opacity-0 transition hover:bg-white group-hover:opacity-100 focus:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  )
}

export function Sidebar({ onToggleNotes }: SidebarProps = {}) {
  const {
    calendars,
    events,
    selectedDate,
    addCalendar,
    settings,
    view,
    setView,
    goToToday,
  } = useApp()
  // Tick twice a minute so the visible block advances on its own.
  const now = useNow(30_000)

  // The block view follows "today" by default — including across midnight,
  // where it switches to the new day and the blocks reset to 00:00–02:00.
  // Picking another day (mini calendar, arrows) pins the view to that day.
  const [followToday, setFollowToday] = useState(true)
  const prevDayRef = useRef(dateKey(now))
  useEffect(() => {
    const k = dateKey(now)
    const rolled = prevDayRef.current !== k
    prevDayRef.current = k
    if (rolled) return
    if (followToday && !isSameDay(selectedDate, now)) setFollowToday(false)
  }, [now, selectedDate, followToday])

  const realToday = startOfDay(now)
  const effectiveDay = followToday ? realToday : selectedDate

  // Start of the current 2-hour block (00:00–02:00, 02:00–04:00, …).
  const blockStart = useMemo(() => blockStartOf(now), [now])
  const blockEnd = blockStart + BLOCK_MS

  const blockEvents = useMemo(
    () => eventsInBlock(events, calendars, effectiveDay, blockStart),
    [events, calendars, effectiveDay, blockStart],
  )

  const rangeLabel = `${formatClock(new Date(blockStart), settings.hour12, false)} – ${formatClock(new Date(blockEnd), settings.hour12, false)}`

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-[#eceef2] bg-[#fafbfc]">
      <MiniCalendar />

      <div className="scroll-area flex-1 overflow-y-auto px-3 pb-2">
        {/* Primary navigation — every item maps to an existing action. */}
        <nav className="animate-rise pt-3">
          <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a5aab8]">
            Menu
          </p>
          <div className="space-y-0.5">
            <NavItem
              icon={<CalendarDays className="h-[15px] w-[15px]" />}
              label="Calendar"
              active={view !== 'month'}
              onClick={() => setView('week')}
            />
            <NavItem
              icon={<StickyNote className="h-[15px] w-[15px]" />}
              label="Notes"
              onClick={onToggleNotes}
            />
            <NavItem
              icon={<Sun className="h-[15px] w-[15px]" />}
              label="Today"
              onClick={goToToday}
            />
          </div>
        </nav>

        <div className="my-3 h-px bg-[#eceef2]" />

        <Section
          title="My Calendars"
          action={
            <IconButton label="Add calendar" onClick={addCalendar} className="h-6 w-6">
              <Plus className="h-3.5 w-3.5" />
            </IconButton>
          }
        >
          <div className="space-y-0.5">
            {calendars.map((c) => (
              <CalendarRow key={c.id} calendar={c} />
            ))}
            {calendars.length === 0 && (
              <p className="px-2 py-1 text-[11.5px] text-[#a5aab8]">
                No calendars yet — add one above.
              </p>
            )}
          </div>
        </Section>

        <Section title={rangeLabel}>
          <div className="mb-1.5 flex items-baseline justify-between px-2">
            <span className="text-[11px] font-medium text-[#8b90a0]">
              {relativeDayLabel(effectiveDay, now)}
            </span>
            <span className="text-[10.5px] tabular-nums text-[#a5aab8]">
              {blockEvents.length}{' '}
              {blockEvents.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          <div className="space-y-0.5">
            {blockEvents.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
            {blockEvents.length === 0 && (
              <p className="rounded-lg bg-white/80 px-2.5 py-2 text-[11.5px] leading-snug text-[#a5aab8] ring-1 ring-black/[0.03]">
                No events in this block.
              </p>
            )}
          </div>
        </Section>

        <Section title="Upcoming">
          <p className="px-2 py-1 text-[11.5px] text-[#a5aab8]">Coming Soon</p>
        </Section>
      </div>

      <div className="shrink-0 border-t border-[#eceef2] px-3 py-3">
        <ProfileBox />
      </div>
    </aside>
  )
}