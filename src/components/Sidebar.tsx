import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../store'
import type { Calendar, CalendarEvent } from '../lib/types'
import { COLOR_IDS, colorOf } from '../lib/colors'
import {
  dateKey,
  formatClock,
  isSameDay,
  monthShort,
  relativeDayLabel,
  weekdayShort,
} from '../lib/date'
import { cn } from '../lib/id'
import { useNow } from '../hooks'
import { IconButton, Section } from './ui'
import { MiniCalendar } from './MiniCalendar'

function EventRow({ event }: { event: CalendarEvent }) {
  const { calendars, openEdit, settings } = useApp()
  const color = colorOf(calendars.find((c) => c.id === event.calendarId)?.color)
  const start = new Date(event.start)
  const end = new Date(event.end)
  return (
    <button
      type="button"
      onClick={() => openEdit(event)}
      className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-[#f7f8fa]"
    >
      <span
        className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
        style={{ background: color.dot }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-snug">
          {event.title || 'Untitled'}
        </span>
        <span className="block text-[10.5px] leading-snug text-[#8b90a0]">
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
      <div className="rounded-lg bg-[#f7f8fa] p-1.5">
        <input
          autoFocus
          value={calendar.name}
          onChange={(e) => updateCalendar(calendar.id, { name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditing(false)
          }}
          className="w-full rounded-md border border-[#e4e6ec] bg-white px-2 py-1 text-[12px]"
        />
        <div className="mt-1.5 flex items-center gap-1">
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
              className="grid h-5 w-5 place-items-center rounded text-[#6b7183] transition hover:bg-white"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2 rounded-lg px-1.5 py-[5px] transition hover:bg-[#f7f8fa]">
      <button
        type="button"
        aria-label={calendar.visible ? 'Hide calendar' : 'Show calendar'}
        onClick={() => toggleCalendar(calendar.id)}
        className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border transition"
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

export function Sidebar() {
  const { calendars, events, selectedDate, addCalendar, settings } = useApp()
  const now = useNow(60_000)

  const todayEvents = useMemo(() => {
    const visible = new Set(calendars.filter((c) => c.visible).map((c) => c.id))
    return events
      .filter(
        (e) => visible.has(e.calendarId) && isSameDay(new Date(e.start), selectedDate),
      )
      .sort((a, b) => a.start.localeCompare(b.start))
  }, [events, calendars, selectedDate])

  const viewingToday = isSameDay(selectedDate, now)
  const dayKey = dateKey(selectedDate)

  // Start of the current 2-hour block (e.g. 10:00–12:00).
  const periodStart = useMemo(() => {
    const d = new Date(now)
    d.setHours(Math.floor(d.getHours() / 2) * 2, 0, 0, 0)
    return d.getTime()
  }, [now])

  // On the current day, hide tasks from earlier blocks so users can't
  // scroll back — only the current 2-hour period and upcoming tasks show.
  // On any other date, show every task with free scrolling.
  const visibleTasks = useMemo(
    () =>
      viewingToday
        ? todayEvents.filter((e) => new Date(e.end).getTime() > periodStart)
        : todayEvents,
    [todayEvents, viewingToday, periodStart],
  )

  // First task that is still ongoing or upcoming — the auto-scroll target.
  const currentTaskId = useMemo(
    () =>
      visibleTasks.find((e) => new Date(e.end).getTime() > now.getTime())
        ?.id ?? null,
    [visibleTasks, now],
  )

  const tasksRef = useRef<HTMLDivElement | null>(null)
  const userScrolledRef = useRef(false)
  const suppressRef = useRef(false)

  const scrollToCurrent = () => {
    const el = tasksRef.current
    if (!el) return
    const target =
      currentTaskId != null
        ? el.querySelector<HTMLElement>(`[data-task="${currentTaskId}"]`)
        : null
    suppressRef.current = true
    el.scrollTop = target ? target.offsetTop : 0
    window.setTimeout(() => {
      suppressRef.current = false
    }, 120)
  }

  const handleTasksScroll = () => {
    if (suppressRef.current) {
      suppressRef.current = false
      return
    }
    userScrolledRef.current = true
  }

  // Reset and pin to the current period whenever the viewed day changes.
  useEffect(() => {
    userScrolledRef.current = false
    scrollToCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey])

  // Keep the current period pinned as time passes, unless the user
  // has manually scrolled forward through upcoming tasks.
  const minuteKey = Math.floor(now.getTime() / 60_000)
  useEffect(() => {
    if (viewingToday && !userScrolledRef.current) scrollToCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minuteKey])

  const upcoming = useMemo(() => {
    const visible = new Set(calendars.filter((c) => c.visible).map((c) => c.id))
    return events
      .filter(
        (e) =>
          visible.has(e.calendarId) &&
          new Date(e.start).getTime() >=
            new Date(now).setHours(0, 0, 0, 0) &&
          dateKey(new Date(e.start)) !== dateKey(selectedDate),
      )
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 6)
  }, [events, calendars, now, selectedDate])

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-[#eceef2] bg-white">
      <MiniCalendar />

      <div className="scroll-area flex-1 overflow-y-auto">
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
              <p className="px-1.5 py-1 text-[11.5px] text-[#a5aab8]">
                No calendars yet — add one above.
              </p>
            )}
          </div>
        </Section>

        <Section title="Today's tasks">
          <div className="mb-1.5 flex items-baseline justify-between px-1.5">
            <span className="text-[11px] font-medium text-[#a5aab8]">
              {relativeDayLabel(selectedDate, now)}
            </span>
            <span className="text-[10.5px] text-[#c3c7d1]">
              {todayEvents.length}{' '}
              {todayEvents.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <div
            ref={tasksRef}
            onScroll={handleTasksScroll}
            className="scroll-area relative max-h-[248px] space-y-0.5 overflow-y-auto"
          >
            {visibleTasks.map((e) => (
              <div key={e.id} data-task={e.id}>
                <EventRow event={e} />
              </div>
            ))}
            {todayEvents.length === 0 && (
              <p className="rounded-lg bg-[#fafbfc] px-2.5 py-2 text-[11.5px] leading-snug text-[#a5aab8]">
                Nothing scheduled. Click a time slot to add something.
              </p>
            )}
            {todayEvents.length > 0 && visibleTasks.length === 0 && (
              <p className="rounded-lg bg-[#fafbfc] px-2.5 py-2 text-[11.5px] leading-snug text-[#a5aab8]">
                You&apos;re all caught up for today.
              </p>
            )}
          </div>
        </Section>

        <Section title="Upcoming">
          <div className="space-y-0.5">
            {upcoming.map((e, i) => {
              const d = new Date(e.start)
              const prev = i > 0 ? new Date(upcoming[i - 1].start) : null
              const showDay = !prev || dateKey(prev) !== dateKey(d)
              return (
                <div key={e.id}>
                  {showDay && (
                    <div className="px-1.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#b6bbc7]">
                      {weekdayShort(d)}, {monthShort(d)} {d.getDate()}
                    </div>
                  )}
                  <EventRow event={e} />
                </div>
              )
            })}
            {upcoming.length === 0 && (
              <p className="px-1.5 py-1 text-[11.5px] text-[#a5aab8]">
                No upcoming events.
              </p>
            )}
          </div>
        </Section>

        <div className="px-4 py-4 text-[10.5px] leading-relaxed text-[#c3c7d1]">
          {settings.hour12 ? '12-hour' : '24-hour'} clock ·{' '}
          {settings.weekStartsOn === 1 ? 'Monday' : 'Sunday'} start
        </div>
      </div>
    </aside>
  )
}
