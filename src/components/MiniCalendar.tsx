import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../store'
import {
  dateKey,
  isSameDay,
  isSameMonth,
  monthLong,
  monthMatrix,
  weekdayShort,
} from '../lib/date'
import { cn } from '../lib/id'

function Arrow({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-all duration-150 hover:bg-surface hover:text-ink hover:shadow-sm active:scale-95"
    >
      {children}
    </button>
  )
}

export function MiniCalendar() {
  const { selectedDate, selectDate, events, calendars, settings } = useApp()
  const [cursor, setCursor] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  )

  useEffect(() => {
    setCursor((prev) =>
      prev.getFullYear() === selectedDate.getFullYear() &&
      prev.getMonth() === selectedDate.getMonth()
        ? prev
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    )
  }, [selectedDate])

  const visible = useMemo(
    () => new Set(calendars.filter((c) => c.visible).map((c) => c.id)),
    [calendars],
  )

  const eventDays = useMemo(() => {
    const set = new Set<string>()
    for (const ev of events) {
      if (!visible.has(ev.calendarId)) continue
      set.add(dateKey(new Date(ev.start)))
    }
    return set
  }, [events, visible])

  const cells = useMemo(
    () =>
      monthMatrix(
        cursor.getFullYear(),
        cursor.getMonth(),
        settings.weekStartsOn,
      ),
    [cursor, settings.weekStartsOn],
  )

  const today = new Date()

  return (
    <div className="rounded-2xl border border-line bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-[13px] font-bold tracking-[-0.01em] text-ink">
          {monthLong(cursor)}{' '}
          <span className="font-medium text-muted">{cursor.getFullYear()}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <Arrow
            label="Previous month"
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Arrow>
          <Arrow
            label="Next month"
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Arrow>
        </div>
      </div>

      {/* Weekday headings */}
      <div className="mb-1 grid grid-cols-7">
        {cells.slice(0, 7).map((d, i) => (
          <span
            key={i}
            className="grid h-6 place-items-center text-[10px] font-bold uppercase tracking-[0.06em] text-faint"
          >
            {weekdayShort(d).charAt(0)}
          </span>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d) => {
          const selected = isSameDay(d, selectedDate)
          const isToday = isSameDay(d, today)
          const inMonth = isSameMonth(d, cursor)
          const hasEvents = eventDays.has(dateKey(d))

          return (
            <button
              key={d.toISOString()}
              type="button"
              aria-label={d.toDateString()}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => selectDate(d)}
              className="group grid h-9 place-items-center"
            >
              <span
                className={cn(
                  'relative grid h-8 w-8 place-items-center rounded-full text-[12.5px] tabular-nums transition-all duration-200 ease-out',
                  selected
                    ? 'bg-accent-soft font-bold text-accent-text shadow-[0_3px_10px_-3px_rgba(103,138,20,0.55)] ring-2 ring-accent/70'
                    : isToday
                      ? 'bg-white font-bold text-accent-text ring-1 ring-accent/60'
                      : inMonth
                        ? 'font-medium text-ink group-hover:bg-surface group-hover:shadow-sm'
                        : 'font-medium text-ghost group-hover:bg-surface',
                )}
              >
                {d.getDate()}
                {hasEvents && !selected && (
                  <span
                    className={cn(
                      'absolute bottom-[3px] h-[3px] w-[3px] rounded-full',
                      isToday ? 'bg-accent-deep' : inMonth ? 'bg-accent-deep/70' : 'bg-ghost',
                    )}
                  />
                )}
                {hasEvents && selected && (
                  <span className="absolute bottom-[3px] h-[3px] w-[3px] rounded-full bg-accent-deep" />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
