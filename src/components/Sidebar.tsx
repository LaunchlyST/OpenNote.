import { useMemo, useState } from 'react'
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
  formatClock,
  isSameDay,
  relativeDayLabel,
  startOfDay,
} from '../lib/date'
import { cn } from '../lib/id'
import { useNow } from '../hooks'
import { IconButton, Section } from './ui'
import { ProfileBox } from './ProfileBox'
import { MiniCalendar } from './MiniCalendar'
import { AppIcon } from '../landing/components/primitives'

interface SidebarProps {
  onToggleNotes?: () => void
  notesOpen?: boolean
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
          ? 'bg-white font-medium text-[#191919] shadow-[0_1px_2px_rgba(16,24,40,0.07)] ring-1 ring-black/[0.04]'
          : 'font-medium text-[#6b6a66] hover:bg-white/70 hover:text-[#191919]',
      )}
    >
      <span
        className={cn(
          'shrink-0 transition-colors',
          active ? 'text-[#191919]' : 'text-[#a3a29e] group-hover:text-[#6b6a66]',
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
        <span className="block truncate text-[12.5px] font-medium leading-snug text-[#191919]">
          {event.title || 'Untitled'}
        </span>
        <span className="block text-[11px] leading-snug text-[#8f8e8a]">
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
          className="w-full rounded-lg border border-[#ececea] bg-white px-2 py-1 text-[12px]"
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
              className="grid h-5 w-5 place-items-center rounded text-[#c4c3be] transition hover:bg-[#fdf1f1] hover:text-[#c0392b]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-label="Done"
              onClick={() => setEditing(false)}
              className="grid h-5 w-5 place-items-center rounded text-[#6b6a66] transition hover:bg-[#f7f7f5]"
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
          calendar.visible ? 'text-[#191919]' : 'text-[#a3a29e] line-through',
        )}
      >
        {calendar.name}
      </span>
      <button
        type="button"
        aria-label="Edit calendar"
        onClick={() => setEditing(true)}
        className="grid h-5 w-5 place-items-center rounded text-[#a3a29e] opacity-0 transition hover:bg-white group-hover:opacity-100 focus:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  )
}

export function Sidebar({ onToggleNotes, notesOpen = false }: SidebarProps = {}) {
  const { calendars, events, selectedDate, addCalendar, view, setView, goToToday, openCreate } = useApp()
  const now = useNow(60_000)

  // The next few events across all visible calendars, soonest first.
  const upNext = useMemo(() => {
    const visible = new Set(calendars.filter((c) => c.visible).map((c) => c.id))
    return events
      .filter((e) => visible.has(e.calendarId) && new Date(e.end).getTime() > now.getTime())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 5)
  }, [events, calendars, now])

  const newEvent = () => {
    // Next whole hour on the selected day (or now, if that is today).
    const base = isSameDay(selectedDate, now) ? new Date(now) : new Date(selectedDate)
    if (isSameDay(selectedDate, now)) base.setHours(now.getHours() + 1, 0, 0, 0)
    else base.setHours(9, 0, 0, 0)
    openCreate(base, 60)
  }

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-[#ececea] bg-[#fbfbfa]">
      <div className="scroll-area flex-1 overflow-y-auto">
        {/* Month at a glance sits first; everything else follows below it. */}
        <div className="px-3 pt-3">
          <MiniCalendar />
        </div>

        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={newEvent}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-[#191919] text-[13.5px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.6)] transition hover:bg-[#37352f] active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            New event
          </button>
        </div>

        <div className="px-3 pb-3">
          <nav className="pt-2">
            <div className="space-y-0.5">
              <NavItem
                icon={<CalendarDays className="h-[15px] w-[15px]" />}
                label="Calendar"
                active={!notesOpen}
                onClick={() => {
                  if (notesOpen) onToggleNotes?.()
                  if (view === 'month') setView('week')
                }}
              />
              <NavItem
                icon={<StickyNote className="h-[15px] w-[15px]" />}
                label="Notes"
                active={notesOpen}
                onClick={onToggleNotes}
              />
              <NavItem icon={<Sun className="h-[15px] w-[15px]" />} label="Today" onClick={goToToday} />
            </div>
          </nav>

          <div className="my-3 h-px bg-[#ececea]" />

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
                <p className="px-2 py-1 text-[11.5px] text-[#a3a29e]">No calendars yet — add one above.</p>
              )}
            </div>
          </Section>

          <Section title="Up next">
            <div className="space-y-0.5">
              {upNext.map((e) => (
                <div key={e.id}>
                  <EventRow event={e} />
                  <p className="-mt-1 pb-1 pl-[26px] text-[10.5px] text-[#a3a29e]">
                    {relativeDayLabel(startOfDay(new Date(e.start)), now)}
                  </p>
                </div>
              ))}
              {upNext.length === 0 && (
                <p className="rounded-lg bg-white px-2.5 py-2 text-[11.5px] leading-snug text-[#a3a29e] ring-1 ring-black/[0.04]">
                  Nothing coming up. Enjoy the space.
                </p>
              )}
            </div>
          </Section>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#ececea] px-3 py-3">
        <div className="mb-2.5 flex items-center gap-2 px-1">
          <AppIcon className="h-6 w-6 text-[24px]" />
          <span className="text-[14px] font-semibold tracking-[-0.02em] text-[#191919]">OpenNote</span>
        </div>
        <ProfileBox />
      </div>
    </aside>
  )
}
