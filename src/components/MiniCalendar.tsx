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

export function MiniCalendar() {
  const { selectedDate, selectDate, events, calendars, settings } = useApp()
  const [cursor, setCursor] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  )

  // Follow the main calendar when the selected month changes.
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
    <div className="border-b border-[#eceef2] px-3 pb-3 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-semibold tracking-[-0.01em]">
          {monthLong(cursor)} {cursor.getFullYear()}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setCursor(
                (c) => new Date(c.getFullYear(), c.getMonth() - 1, 1),
              )
            }
            className="grid h-6 w-6 place-items-center rounded-md text-[#8b90a0] transition hover:bg-[#f2f3f6] hover:text-[#1f2330]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              setCursor(
                (c) => new Date(c.getFullYear(), c.getMonth() + 1, 1),
              )
            }
            className="grid h-6 w-6 place-items-center rounded-md text-[#8b90a0] transition hover:bg-[#f2f3f6] hover:text-[#1f2330]"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {cells.slice(0, 7).map((d, i) => (
          <span
            key={i}
            className="grid h-5 place-items-center text-[10px] font-semibold uppercase text-[#a5aab8]"
          >
            {weekdayShort(d).charAt(0)}
          </span>
        ))}
      </div>

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
              onClick={() => selectDate(d)}
              className="relative grid h-7 place-items-center"
            >
              <span
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-full text-[11.5px] transition',
                  selected
                    ? 'bg-[#bef264] font-semibold text-[#3f4a14]'
                    : isToday
                      ? 'font-semibold text-[#6f8f12] ring-1 ring-[#d4f08a]'
                      : inMonth
                        ? 'text-[#3d4354] hover:bg-[#f2f3f6]'
                        : 'text-[#c3c7d1] hover:bg-[#f7f8fa]',
                )}
              >
                {d.getDate()}
              </span>
              {hasEvents && !selected && (
                <span className="absolute bottom-[-1px] h-[3px] w-[3px] rounded-full bg-[#a3d922]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
